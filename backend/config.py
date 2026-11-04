"""Configuration shared by the web app and maintenance commands."""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env', override=False)


def configure(app):
    app.config.update(
        SECRET_KEY=os.environ.get('SECRET_KEY'),
        SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URL', f'sqlite:///{BASE_DIR / "instance/mdrt_certificates.db"}'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={'connect_args': {'timeout': 30}} if os.environ.get('DATABASE_URL', 'sqlite:').startswith('sqlite:') else {},
        ADMIN_USERNAME=os.environ.get('ADMIN_USERNAME', 'admin'),
        ADMIN_PASSWORD_HASH=os.environ.get('ADMIN_PASSWORD_HASH', ''),
        SESSION_COOKIE_NAME='prudential_session',
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=os.environ.get('COOKIE_SECURE', 'true').lower() == 'true',
        SESSION_COOKIE_SAMESITE='Lax',
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        SESSION_REFRESH_EACH_REQUEST=False,
        MAX_CONTENT_LENGTH=50 * 1024 * 1024,
        MAX_FORM_MEMORY_SIZE=512 * 1024,
        MAX_FORM_PARTS=20,
    )
