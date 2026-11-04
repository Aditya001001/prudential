"""Versioned SQLite migrations. Run explicitly before starting a new release.

Historical orphan certificates are retained with a nullable agent reference;
client codes are recovered from their filename when the agent is unavailable.
"""
import re
from pathlib import Path
from datetime import datetime
import sqlite3
from sqlalchemy.schema import CreateTable
from database import db, Certificate

VERSION = 1


def upgrade():
    if db.engine.dialect.name != 'sqlite':
        raise RuntimeError('This deployment supports SQLite; migrate other engines separately.')
    path = db.engine.url.database
    if path and path != ':memory:' and Path(path).exists():
        backup = Path(path + '.backup_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
        with sqlite3.connect(path) as source, sqlite3.connect(backup) as target:
            source.backup(target)
        backup.chmod(0o600)
    with db.engine.connect() as connection:
        connection.exec_driver_sql('PRAGMA foreign_keys=OFF')
        connection.commit()
        try:
            with connection.begin():
                connection.exec_driver_sql('BEGIN IMMEDIATE')
                connection.exec_driver_sql('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
                done = connection.exec_driver_sql('SELECT version FROM schema_migrations WHERE version=1').first()
                tables = {r[0] for r in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'")}
                if not done and 'certificates' in tables:
                    connection.exec_driver_sql('ALTER TABLE certificates RENAME TO certificates_before_v1')
                    connection.execute(CreateTable(Certificate.__table__))
                    old_columns = {r[1] for r in connection.exec_driver_sql('PRAGMA table_info(certificates_before_v1)')}
                    common = [column.name for column in Certificate.__table__.columns if column.name in old_columns]
                    columns = ', '.join(common)
                    connection.exec_driver_sql(f'INSERT INTO certificates ({columns}) SELECT {columns} FROM certificates_before_v1')
                    # Fill only missing snapshots, never rewrite an existing historical value.
                    for row in connection.exec_driver_sql('SELECT id, agent_id, filename, client_code_snapshot, agent_name_snapshot, tier_snapshot, badges_snapshot FROM certificates').mappings().all():
                        agent = connection.exec_driver_sql('SELECT client_code, agent_name, mdrt_tier, life_member, honor_roll, quarter_century FROM agents WHERE id=?', (row['agent_id'],)).first()
                        match = re.match(r'^([A-Za-z0-9-]+)_', row['filename'])
                        code = row['client_code_snapshot'] or (agent[0] if agent else (match[1] if match else None))
                        name = row['agent_name_snapshot'] or (agent[1] if agent else 'Unknown historical agent')
                        tier = row['tier_snapshot'] or (agent[2] if agent else 'MDRT')
                        badges = row['badges_snapshot']
                        if badges is None:
                            badges = ','.join(code for code, earned in zip(('LM','HR','QC'), agent[3:] if agent else (False,)*3) if earned)
                        connection.exec_driver_sql('UPDATE certificates SET agent_id=?, client_code_snapshot=?, agent_name_snapshot=?, tier_snapshot=?, badges_snapshot=? WHERE id=?', (row['agent_id'] if agent else None, code, name, tier, badges, row['id']))
                    connection.exec_driver_sql('DROP TABLE certificates_before_v1')
                if not done:
                    connection.exec_driver_sql('INSERT INTO schema_migrations VALUES (?, ?)', (VERSION, datetime.now().isoformat()))
        finally:
            connection.exec_driver_sql('PRAGMA foreign_keys=ON')
            connection.commit()
    db.create_all()
    with db.engine.connect() as connection:
        if connection.exec_driver_sql('PRAGMA foreign_key_check').first():
            raise RuntimeError('Foreign-key check failed after migration.')
    return VERSION
