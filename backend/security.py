"""Server authorization, CSRF protection and bounded request throttling."""
import hmac
import hashlib
from datetime import datetime, timedelta
from database import db, AdminSession
import secrets
import time
from collections import OrderedDict, deque
from threading import Lock
from flask import request, session, jsonify, abort
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

_DUMMY_HASH = generate_password_hash(secrets.token_urlsafe(32))


def install_security(app):
    # Only trust the local Nginx hop; Gunicorn binds to loopback.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=0)
    buckets, lock = OrderedDict(), Lock()
    public = {'health_check', 'auth_session', 'auth_login', 'user_check_system',
              'validate_client_code', 'user_upload_photo', 'user_preview_certificate',
              'user_download_certificate', 'user_get_editor', 'user_get_editor_layer',
              'user_adjust_certificate', 'serve_frontend'}

    def throttle(key, maximum, seconds):
        now = time.monotonic()
        with lock:
            entries = buckets.setdefault(key, deque())
            while entries and entries[0] <= now - seconds:
                entries.popleft()
            if len(entries) >= maximum:
                abort(429, description='Too many requests. Please try again later.')
            entries.append(now)
            buckets.move_to_end(key)
            while len(buckets) > 5000:
                buckets.popitem(last=False)

    @app.before_request
    def authorize():
        if not request.path.startswith('/api/'):
            return
        if session.get('admin'):
            token = session.get('admin_token', '')
            record = db.session.get(AdminSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
            if not record or record.expires_at <= datetime.now() or record.username != app.config['ADMIN_USERNAME'] or session.get('credential_version') != hashlib.sha256(app.config['ADMIN_PASSWORD_HASH'].encode()).hexdigest():
                session.pop('admin', None)
                session.pop('admin_token', None)
        if request.endpoint is None:
            abort(404)
        if request.endpoint not in public and not session.get('admin'):
            abort(401, description='Administrator sign-in required.')
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            expected = session.get('csrf', '')
            supplied = request.headers.get('X-CSRF-Token', '')
            if not expected or not hmac.compare_digest(expected.encode(), supplied.encode()):
                abort(403, description='Session expired. Refresh the page and try again.')
        if request.endpoint == 'auth_login':
            throttle(('login', request.remote_addr), 10, 900)
        elif request.endpoint == 'validate_client_code':
            throttle(('lookup', request.remote_addr), 60, 60)
        elif request.endpoint in {'user_upload_photo', 'user_adjust_certificate'}:
            throttle((request.endpoint, request.remote_addr), 20 if request.endpoint == 'user_adjust_certificate' else 10, 60)

    @app.after_request
    def headers(response):
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['Referrer-Policy'] = 'same-origin'
        return response

    @app.get('/api/auth/session')
    def auth_session():
        session.permanent = True
        session.setdefault('csrf', secrets.token_urlsafe(32))
        session.setdefault('owner', secrets.token_urlsafe(32))
        return jsonify(authenticated=bool(session.get('admin')), csrf_token=session['csrf'])

    @app.post('/api/auth/login')
    def auth_login():
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            abort(400, description='Invalid credentials.')
        password, username = data.get('password', ''), data.get('username', '')
        if not isinstance(password, str) or not isinstance(username, str) or len(password) > 1024:
            abort(400, description='Invalid credentials.')
        configured = app.config['ADMIN_PASSWORD_HASH']
        valid = check_password_hash(configured or _DUMMY_HASH, password)
        if not configured or not valid or not hmac.compare_digest(username.encode(), app.config['ADMIN_USERNAME'].encode()):
            abort(401, description='Invalid username or password.')
        AdminSession.query.filter(AdminSession.expires_at <= datetime.now()).delete()
        token = secrets.token_urlsafe(32)
        db.session.add(AdminSession(token_hash=hashlib.sha256(token.encode()).hexdigest(),
                                  username=app.config['ADMIN_USERNAME'], expires_at=datetime.now() + timedelta(hours=8)))
        db.session.commit()
        owner = session.get('owner', secrets.token_urlsafe(32))
        session.clear()
        session.update(admin=app.config['ADMIN_USERNAME'], admin_token=token, owner=owner, csrf=secrets.token_urlsafe(32),
                       credential_version=hashlib.sha256(configured.encode()).hexdigest())
        session.permanent = True
        return jsonify(success=True, csrf_token=session['csrf'])

    @app.post('/api/auth/logout')
    def auth_logout():
        token = session.get('admin_token', '')
        if token:
            AdminSession.query.filter_by(token_hash=hashlib.sha256(token.encode()).hexdigest()).delete()
            db.session.commit()
        session.clear()
        return jsonify(success=True)


def require_certificate_access(certificate):
    if not certificate:
        abort(404, description='Certificate not found.')
    if not session.get('admin') and (not session.get('owner') or certificate.generated_by != session['owner']):
        abort(404, description='Certificate not found.')
