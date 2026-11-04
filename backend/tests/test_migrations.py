import unittest
from unittest.mock import patch
from sqlalchemy import text
from test_regressions import web
from database import db, Certificate
from migrations import upgrade


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.context=web.app.app_context();self.context.push()
        db.session.remove();db.drop_all();db.create_all()
        with db.engine.connect() as connection:
            connection.exec_driver_sql('PRAGMA foreign_keys=OFF');connection.commit()
            connection.exec_driver_sql('DROP TABLE IF EXISTS schema_migrations')
            connection.exec_driver_sql('DROP TABLE certificates')
            connection.exec_driver_sql('CREATE TABLE certificates (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, filename TEXT NOT NULL, filepath TEXT NOT NULL, generated_at TEXT, agent_name_snapshot TEXT, tier_snapshot TEXT, badges_snapshot TEXT)')
            connection.exec_driver_sql("INSERT INTO certificates VALUES (1,999,'00042_Historical_Agent_TOT_20260930_120000.png','legacy.png','2026-09-30 12:00:00','Historical Agent','TOT','')")
            connection.commit();connection.exec_driver_sql('PRAGMA foreign_keys=ON');connection.commit()

    def tearDown(self):
        db.session.remove()
        with db.engine.begin() as connection:
            connection.exec_driver_sql('DROP TABLE IF EXISTS certificates_before_v1')
            connection.exec_driver_sql('DROP TABLE IF EXISTS schema_migrations')
        db.drop_all();self.context.pop()

    def test_migration_preserves_orphans_and_recovers_client_code(self):
        self.assertEqual(upgrade(),1)
        cert=db.session.get(Certificate,1)
        self.assertIsNone(cert.agent_id);self.assertEqual(cert.client_code_snapshot,'00042')
        self.assertEqual(cert.agent_name_snapshot,'Historical Agent');self.assertEqual(cert.badges_snapshot,'')
        self.assertIsNone(cert.render_metadata)
        self.assertEqual(upgrade(),1);self.assertEqual(Certificate.query.count(),1)
        with db.engine.connect() as connection:
            self.assertEqual(connection.exec_driver_sql('PRAGMA foreign_key_check').all(),[])
            self.assertEqual(connection.exec_driver_sql('PRAGMA foreign_keys').scalar(),1)

    def test_failed_migration_rolls_back_table_rebuild(self):
        from sqlalchemy.engine import Connection
        execute=Connection.exec_driver_sql
        def fail(connection, statement, *args, **kwargs):
            if statement.startswith('INSERT INTO certificates ('):raise RuntimeError('simulated migration failure')
            return execute(connection,statement,*args,**kwargs)
        with patch.object(Connection,'exec_driver_sql',fail):
            with self.assertRaises(RuntimeError):upgrade()
        with db.engine.connect() as connection:
            self.assertEqual(connection.exec_driver_sql('SELECT COUNT(*) FROM certificates').scalar(),1)
            self.assertNotIn('render_metadata',{r[1] for r in connection.exec_driver_sql('PRAGMA table_info(certificates)')})
            self.assertEqual(connection.exec_driver_sql('PRAGMA foreign_keys').scalar(),1)
