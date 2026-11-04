"""Explicit migration, backup, audit and credential maintenance commands."""
import argparse
import getpass
import os
import secrets
import sqlite3
from pathlib import Path
from datetime import datetime
from flask import Flask
from werkzeug.security import generate_password_hash
from config import configure, BASE_DIR
from database import db, Agent, Certificate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['migrate', 'backup', 'audit', 'quarantine', 'credentials'])
    args = parser.parse_args()
    if args.command == 'credentials':
        password = getpass.getpass('Administrator password: ')
        confirmation = getpass.getpass('Confirm password: ')
        if not password or password != confirmation:
            parser.error('Passwords must be nonempty and match.')
        from dotenv import dotenv_values, set_key
        path = BASE_DIR / '.env'
        if not path.exists():
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(fd)
        path.chmod(0o600)
        values = dotenv_values(path)
        if len(values.get('SECRET_KEY', '')) < 32 or values.get('SECRET_KEY', '').startswith('replace-'):
            set_key(path, 'SECRET_KEY', secrets.token_urlsafe(48))
        set_key(path, 'ADMIN_USERNAME', values.get('ADMIN_USERNAME', 'admin'))
        set_key(path, 'ADMIN_PASSWORD_HASH', generate_password_hash(password))
        print('Credentials saved to backend/.env. Restart the backend to apply.')
        return
    app = Flask(__name__)
    configure(app)
    db.init_app(app)
    with app.app_context():
        if args.command == 'migrate':
            from migrations import upgrade
            print('Schema version:', upgrade())
        elif args.command == 'backup':
            path = Path(db.engine.url.database)
            if db.engine.dialect.name != 'sqlite':
                parser.error('Use your database provider backup tool.')
            backup = path.with_name(path.name + '.backup_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
            with sqlite3.connect(path) as source, sqlite3.connect(backup) as target:
                source.backup(target)
            backup.chmod(0o600)
            print('Backup:', backup)
        else:
            refs = {cert.filename for cert in Certificate.query.all()}
            photos = {cert.original_photo_filename for cert in Certificate.query.all() if cert.original_photo_filename}
            print('Agents:', Agent.query.count(), 'Certificates:', Certificate.query.count())
            print('Unresolved agent references:', Certificate.query.filter(Certificate.agent_id.isnot(None), ~Certificate.agent_id.in_(db.select(Agent.id))).count())
            for folder, known in [('user_outputs', refs), ('user_photos', photos), ('user_uploads', set())]:
                files = {p.name for p in (BASE_DIR / folder).iterdir() if p.is_file() and not p.name.startswith('.')}
                print(folder, 'unreferenced:', len(files-known), 'missing:', len(known-files))
            if args.command == 'quarantine':
                from storage import quarantine_unreferenced
                destination = BASE_DIR.parent / '.local-backups' / ('storage_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
                moved = quarantine_unreferenced(BASE_DIR, {'user_outputs': refs, 'user_photos': photos, 'user_uploads': set()}, destination)
                print('Moved', moved, 'old unreferenced files to', destination)
                print('Files are preserved with a restoration manifest. Files newer than one hour are skipped.')
            else:
                print('Audit only: no files removed. Use quarantine to archive old unreferenced files reversibly.')


if __name__ == '__main__':
    main()
