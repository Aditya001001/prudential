# Prudential MDRT Certificate Generator

React portal and Flask API for generating personalized MDRT, COT and TOT certificates from validated agent master data and portrait photographs. Background removal runs locally with rembg; Pillow composes fixed 1800×3184 PNG certificates. After generation, **Adjust portrait** lets users drag, resize, reset and save their portrait while the certificate artwork stays fixed.

Read [README_DEVELOPER_HANDOFF.md](README_DEVELOPER_HANDOFF.md) for the supported VM deployment, configuration, backups and operations. Other historical guides may describe retired deployments.

The supported backend is `backend/app_with_db.py`, served by Gunicorn behind Nginx. Master imports **merge** agents; certificate snapshots survive agent deletion. Administrator access is enforced by server sessions. Guest certificate downloads are scoped to the browser session that generated them; existing historical certificates require administrator access.

## Development

```bash
venv/bin/python -m pip install -r requirements.txt
cp backend/.env.example backend/.env
chmod 600 backend/.env
venv/bin/python backend/manage.py credentials
# Set COOKIE_SECURE=false in backend/.env for local HTTP only.
venv/bin/python backend/manage.py migrate
venv/bin/python backend/app_with_db.py
```

In another terminal:

```bash
cd frontend
npm ci
npm start
```

Open `http://localhost:3001/prudential/`. The development proxy forwards `/prudential-api` to loopback port 5001. HTTPS deployments use secure cookies; do not disable them in UAT.

## Validation

```bash
venv/bin/python -m unittest discover -s backend/tests -v
cd frontend
CI=true npm test -- --watchAll=false --runInBand
CI=true npm run build
```

`npm run build` prepares `frontend/build-staged`; it does not publish the live frontend. After backend migration and deployment, `npm run publish` copies assets first and switches the HTML entry point last. Prior hashed assets remain available to open browser tabs.

## Data and credentials

The default database is `backend/instance/mdrt_certificates.db`. Back up this database together with `backend/admin_assets`, `backend/user_photos` and `backend/user_outputs`. Use `backend/manage.py backup` for a consistent SQLite snapshot and `backend/manage.py audit` for a read-only storage audit. `manage.py quarantine` reversibly archives unreferenced files older than one hour under `.local-backups/`, leaving referenced files intact.

Do not commit passwords, `.env` files, TLS keys, master uploads, or user photographs. Origin TLS credentials live under `/etc/ssl`; replacement and revocation of the previously committed Cloudflare origin certificate must be completed by the Cloudflare administrator.
