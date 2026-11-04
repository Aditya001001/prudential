# 🎯 Prudential Certificate Generator - Developer Handoff Guide

## Traditional Chinese interface (November 2026)

The active interface is directly in Traditional Chinese, following `prudential_translation`; there is no language switch. This includes the user flow, desktop/mobile result actions, portrait editor, administrator login/dashboard, both history pages, confirmations, loading states, accessible labels and error prompts. The document and installable-app metadata use `zh-Hant-HK`, and dates/times display with `zh-HK`. Chinese system-font fallbacks are included. Uploaded names, filenames, CSV column keys and tier codes remain data values; poster artwork and rendering are unchanged.

The device-upload control shows **請上載清晰半身職業照，面部清楚可見。** before any file is selected, alongside JPG/JPEG or PNG, a file size under 50 MB, recommended minimum resolution of 1,000 × 1,500 pixels, and the existing 25-megapixel ceiling. The guidance is beside the control on wider screens and immediately below it on phones. The 1,000 × 1,500 threshold remains a quality recommendation; smaller images retain the existing warning behavior. The previously removed first-page helper sentence stays removed.

Static interface text is Chinese in the React components. `frontend/src/messages.js` translates API error descriptions at the display boundary, including CSV row numbers and validation details; the API and import schemas remain unchanged. `frontend/src/api.js` handles these messages centrally. Existing tests use translated accessible labels and cover login/import errors, image readiness and portrait controls. Added coverage verifies nested import-error localization, unknown-message fallbacks, and guidance visible before choosing a photo.

## Portrait adjustment after generation

Newly generated certificates offer **Adjust portrait**, **Download**, **View Full Size**, and **Generate Another** on desktop and tablets, with the original horizontal icons and compact buttons. On phones (viewport width at most 600px), these become **Edit**, **Save**, **View**, and **Exit**, with icons above the short labels in a single row. Mobile buttons are 60px high and up to 60px wide, shrinking to fit narrow phones. The labels and icons switch automatically when the viewport changes. **Edit** opens portrait adjustment, **Save** downloads the current poster, **View** opens the full-size image, and **Exit** returns to the client-code entry screen. Users can drag the portrait with a mouse or touch, resize it from 25–250%, change horizontal/vertical position with sliders, and use arrow buttons or keyboard arrows for fine positioning. **Reset position** restores the automatic starting placement; **Cancel** discards unsaved changes. **Save changes** updates the full-resolution PNG and the download/preview shown on the result screen.

On phones, the editor fills the available viewport and keeps its heading, **Save changes**, and **Cancel** visible. The portrait has more preview space; **Fine position** starts collapsed on small screens and can be expanded for sliders and arrow buttons. Large slider thumbs, 44px touch targets, and **− / +** size buttons support precise changes. One finger moves the portrait; two fingers pinch to resize around their midpoint and can pan together. Releasing a finger continues dragging from the current placement. Portrait and landscape layouts account for safe-area insets. Desktop controls remain available.

Preview drawing is batched with `requestAnimationFrame`. Fixed artwork is cached at the display size, the canvas buffer is reused while dragging, and its backing resolution is capped at 900px wide. Viewport changes resize the preview without changing the full-resolution saved output.

After a save, the result preview mounts a fresh image for the new filename. It shows **Loading updated poster…** until the new PNG finishes loading and decoding, then enables full-size viewing and downloading. The previous image is removed immediately, so a slow connection cannot leave it looking like the saved result. A failed preview can be retried without saving the edit again. This loading step is image delivery, not a delayed database commit.

The background and foreground artwork, including the name and badges, are saved as separate fixed layers; only the portrait transform changes. Saving updates the same certificate history record and preserves agent snapshots, original-photo references and generation time. It does not run AI background removal again. Concurrent stale saves return 409 rather than overwriting a newer edit. Edits require the generating browser session or an authenticated administrator, plus CSRF protection for saving.

- Backend: `backend/portrait_editor.py`; generation, editor-layer and adjustment endpoints in `backend/app_with_db.py`.
- Frontend: `frontend/src/components/PortraitEditor.js`, `PortraitEditor.css`, and `portraitPlacement.js`; result-screen integration in `UserPortalNew.js`.
- New certificate `render_metadata.editor` stores an opaque layer key, initial portrait rectangle, current transform and revision. There is no database schema change.
- Private editor PNGs live in `backend/user_outputs/edits/<opaque-key>/`. Include this directory with normal output backups. They are removed when the owning certificate is deleted, and generation failures clean them up.
- Certificates generated before this feature do not have edit layers. Generate a new certificate to adjust its portrait. The result screen offers the editor only when those layers exist.
- Tests cover ownership, CSRF, geometry, stale revisions, rollback after failed saves, layer cleanup, and UI controls. Browser checks cover mouse dragging, mobile touch dragging, saving/downloading, reopening saved positions and cancelling drafts.

## October 2026 remediation update

Name-tag rendering was corrected in November 2026 (renderer v4): transparent export padding is removed before sizing the visible artwork. The banner retains its aspect ratio and fits within the poster with an inset at the sides and bottom. Name fitting uses the actual rendered banner width. The name uses a small 30px offset to the right at the 1800px output width to align visually with the banner crest, and its fitting area is limited to 78% of the banner width so it clears the left star and stays inside the right border. Source artwork remains unchanged; render metadata records the source alpha bounds and final placement. This applies to new generations. Existing saved posters and their cached editor foregrounds retain their original artwork; generate a new poster to pick up the correction.

This section supersedes older implementation and deployment examples below.

- **Administrator credentials:** The existing username/password are retained by request, but authentication now occurs on the server. Only a Werkzeug password hash is stored in the private, mode-600 `backend/.env`. The login page no longer publishes credentials. Use `venv/bin/python backend/manage.py credentials` to change them. Restart the service afterwards; old sessions are invalidated when the credential hash changes.
- **Sessions:** HTTP-only, Secure, SameSite=Lax cookies; eight-hour administrator sessions are backed by revocable database records. Mutations require a CSRF token obtained from `/api/auth/session`. The frontend handles this centrally in `frontend/src/api.js`. Old local-storage login flags have no authority.
- **Guest files:** A guest may preview/download only certificates created in their current browser session. Original photographs, master uploads, history, agent lists, statistics and all administrative operations require administrator authentication. Historical certificates remain available to administrators. Client-code validation remains public and throttled, returning existence without names or other agent metadata. A client code is a lookup identifier, not identity verification.
- **Imports:** CSV, XLSX and XLS imports validate required fields, tiers, duplicates and explicit badge values before changing anything. `No`, `False`, `0` and blank mean false. Imports are atomic **merges**: omitted agents remain. Invalid files return errors and do not replace current metadata or create archive records.
- **History:** Deleting agents or clearing master data retains certificates with nullable agent references and immutable snapshots. Migration v1 repairs legacy orphan references, fills missing snapshots where recoverable, and preserves existing certificate files. Badges in historical responses come only from their snapshots.
- **Storage:** Images are decoded and validated, normalized to PNG, and saved atomically with UUID identifiers. Asset uploads create immutable versions. New certificates record asset hashes, layout/font settings and renderer metadata. Failure cleanup removes new files; deletion restores staged files when a database transaction fails. Original portraits are removed with their last certificate reference. `manage.py audit` reports historical unreferenced files without deleting them. `manage.py quarantine` moves unreferenced files older than one hour into a private backup with a restoration manifest.
- **Rendering:** Output is always 1800×3184. Portraits fit both width and height without extending outside the photo box. Background removal enlarges only the alpha mask, retaining original portrait detail. Displayed uppercase names are measured with space for the 3D effect. One generation runs at a time; excess requests receive a visible retry message instead of unbounded processing. The AI model loads lazily.
- **Runtime:** Gunicorn, one worker/four threads, bound to `127.0.0.1:5001`; debug is disabled. Keep one worker because generation concurrency and request throttles are process-local. Backend HKT timestamps are preserved via `TZ=Asia/Hong_Kong` in the service. Validated runtime: Python 3.14 and Node 22. Backend dependencies are pinned in `backend/requirements.txt`; root requirements delegate to that list.
- **Frontend:** Loading/retry states, visible request errors, cancelled stale validation, and server-side history pagination. API configuration is centralized. Development uses `setupProxy.js`; production keeps the Nginx `/prudential-api` prefix.
- **Supported deployment:** VM/systemd/Nginx/SQLite. The nonfunctional Render manifest was removed. Older backend entry points forward to the supported secured application. Historical notes remain for reference.

### Release procedure

```bash
cd /home/aditya.developer/prudential
venv/bin/python -m pip install -r requirements.txt
venv/bin/python -m unittest discover -s backend/tests -v
cd frontend
npm ci
CI=true npm test -- --watchAll=false --runInBand
CI=true npm run build              # builds build-staged only
cd ..
venv/bin/python backend/manage.py backup
sudo systemctl stop prudential-backend.service
venv/bin/python backend/manage.py migrate  # explicit, versioned, backed up
sudo install -m 644 prudential-backend.service /etc/systemd/system/prudential-backend.service
sudo systemctl daemon-reload
sudo systemctl start prudential-backend.service
curl --fail http://127.0.0.1:5001/api/health
cd frontend
npm run publish                    # publish only after backend is ready
cd ..
sudo install -m 644 nginx_cloudflare_realip.conf /etc/nginx/snippets/prudential-cloudflare-realip.conf
sudo install -m 644 nginx_ssl_config.conf /etc/nginx/sites-available/prudential
sudo nginx -t
sudo systemctl reload nginx
```

Back up the current Nginx/service files and frontend before deployment. This checkout's remediation backup is under ignored `.local-backups/`; database migrations also create mode-600 SQLite backups. Restore the matching source, database, service, Nginx config and frontend together if rolling back. Never overwrite the new database with an old backup while the service is running.

### Outstanding external TLS action

The removed repository private key matches the live Cloudflare origin certificate. Moving it outside Git does not revoke previously exposed copies. A new private key has been prepared at `/etc/ssl/private/prudential-rotation/replacement.key` (root-only) with a public CSR at `backend/origin-replacement.csr`. The Cloudflare administrator must issue a replacement certificate for `prudential-uat.innocorn.net` using that CSR, install it with the matching new key, validate Nginx, then revoke the old certificate. Do not replace the current origin certificate with a self-signed certificate: Cloudflare strict origin validation would fail. The existing certificate stays active until its signed replacement is available. Historical Git copies also remain until a separately coordinated history rewrite.

Once the signed certificate and Cloudflare Origin CA root are available:

```bash
sudo bash scripts/install-origin-certificate.sh /path/to/signed-origin.pem /path/to/cloudflare-origin-ca.pem
```

The installer verifies the signature, hostname, validity and key match before installing. It backs up the previous pair, checks Nginx, reloads, and restores the previous pair if installation fails. Revoke the old certificate in Cloudflare only after checking the public site.

### Security proxy and health

The Nginx site trusts `CF-Connecting-IP` only from official Cloudflare network ranges in `nginx_cloudflare_realip.conf`; other peers cannot spoof that header. It forwards the resulting client IP to the loopback backend for throttling. Refresh those ranges from the official Cloudflare IP lists when they change. Frontend HTML uses no-cache; hashed JS/CSS uses immutable caching. API/private-file responses use no-store.

Public `/api/health` checks database connectivity without exposing agent counts. No TLS keys belong in the repository.

## Welcome! 👋

This document will get you up to speed with the Prudential MDRT Certificate Generator deployed on the VM at `34.87.167.252` (UAT).

> ⚠️ **This file was out of date (described an old manual `npm start`/nohup setup).** It has been rewritten (Oct 2026) to reflect the actual current deployment: **systemd service + Nginx + Cloudflare + custom domain**. If anything here conflicts with other older `.md` files in the repo root, **trust this file** — the others are historical notes from earlier development sessions.

---

## 📍 Quick Access Information

### Live URLs (production/UAT)
- **Domain:** `https://prudential-uat.innocorn.net` (behind Cloudflare, proxied to this VM)
- **User Portal:** `https://prudential-uat.innocorn.net/prudential/`
- **Admin Dashboard:** `https://prudential-uat.innocorn.net/prudential/admin`
- **Admin Login:** `https://prudential-uat.innocorn.net/prudential/admin/login`
- **Certificate History:** `.../prudential/history`
- **Master Data History:** `.../prudential/master-data-history`

### SSH Access
```bash
ssh aditya.developer@34.87.167.252
cd /home/aditya.developer/prudential
```
(VM is a GCP instance — IP can change if the VM is recreated; always re-check with the infra owner / GCP console if SSH fails, and update Cloudflare DNS + this doc accordingly.)

### Service Ports (internal, not publicly exposed directly)
- **Backend (Flask API):** Port 5001 (run as a `systemd` service, NOT via nohup)
- **Frontend (React):** Pre-built static files served by Nginx from `frontend/build/` — there is **no live dev server running in production**
- **Public Access:** Cloudflare → Nginx (ports 80/443) → `/prudential/` (static frontend) and `/prudential-api/` (proxied to Flask on 5001)

---

## 🏗️ What This Application Does

**Automated MDRT certificate generation system** that:
1. **Removes backgrounds** from agent photos using AI (rembg/U2-Net model)
2. **Generates personalized certificates** by compositing agents onto tier-specific backgrounds (MDRT/COT/TOT)
3. **Adds milestone badges** (Life Member, Honor Roll, Quarter Century)
4. **Overlays agent names** with custom fonts and 3D metallic effects
5. **Imports master agent data** from CSV or Excel (.xlsx/.xls), then generates certificates individually from user portraits
6. **Tracks history** of every generated certificate and every master data file upload, with download/delete support for both

**Certificate resolution:** 1800 x 3184 pixels (portrait).

**Recent features added (most recent first):**
- Master Data History page (`/prudential/master-data-history`) — own sidebar nav item, lists every uploaded master CSV/Excel file with download + **delete** actions.
- Excel (`.xlsx`/`.xls`) upload support for the master data file, in addition to CSV (uses `openpyxl` + `pandas.read_excel`).
- Server timezone changed to **Asia/Hong_Kong (HKT, UTC+8)** — see "Timezone" section below. All new timestamps (certificates, history) are recorded in HKT.
- Removed the "Reset Database" admin feature and the notification bell icon from the UI (no longer present — don't try to re-add unless requested).
- Certificate history now stores a `client_code_snapshot` (and other snapshots) so re-uploading/replacing the master CSV doesn't break old certificate history records.
- Client code is looked up from the database using user input, not from the uploaded photo filename. Users can upload photos with any filename. See `FIX_CLIENT_CODE_LOOKUP.md` for background (historical).

---

## 📊 Architecture Overview

```
                 Internet
                    │
                    ▼
            ┌───────────────┐
            │  Cloudflare   │  (DNS + proxy for prudential-uat.innocorn.net)
            └───────┬───────┘
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────────┐
│  Nginx (ports 80/443 on the VM, site: "prudential")  │
│  • /prudential/        → static React build (files)  │
│  • /prudential-api/*   → proxy_pass → 127.0.0.1:5001  │
│  • HTTP → HTTPS redirect, SSL via self-managed certs  │
└───────────────────┬───────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Flask Backend — systemd service                 │
│  "prudential-backend.service", port 5001          │
│  • File upload handling (CSV/Excel, images)       │
│  • AI background removal (rembg)                  │
│  • Image processing (Pillow)                       │
│  • SQLite database (mdrt_certificates.db)           │
└─────────────────────────────────────────────────┘
```

**Important:** The React frontend is **NOT** run as a live server (no `npm start`/port 3001 in production). It's built once with `npm run build` and Nginx serves the static files directly from `frontend/build/`. Any frontend change requires a rebuild + the files are picked up immediately (no restart needed, but browsers may cache — hard refresh when testing).

**Tech Stack:**
- **Backend:** Flask, Flask-SQLAlchemy, Pillow, rembg (AI), pandas, openpyxl (Excel), SQLite
- **Frontend:** React 18 (Create React App), react-router-dom, axios, lucide-react
- **Deployment:** Nginx (static file serving + reverse proxy), systemd (backend process management), Cloudflare (DNS/SSL edge), self-managed SSL certs on the VM for origin HTTPS

---

## 📂 Project Structure

```
/home/aditya.developer/prudential/
├── backend/
│   ├── app_with_db.py          # Main Flask application (DATABASE VERSION — use this, not app.py)
│   ├── database.py             # SQLAlchemy models (Agent, Certificate, SystemAsset, CSVUploadHistory)
│   ├── db_services.py          # Database helper functions (CRUD, CSV/Excel import, history)
│   ├── init_db.py              # Database initialization CLI script
│   ├── requirements.txt        # Python dependencies (pandas, openpyxl, Flask, rembg, etc.)
│   ├── admin_assets/           # Admin-uploaded "live" files (backgrounds, badges, nametags, master CSV/Excel)
│   │   └── csv_history/        # Timestamped permanent copies of every master CSV/Excel upload
│   ├── user_uploads/           # Temp storage for user-uploaded agent photos (cleared after processing)
│   ├── user_photos/            # Permanent storage of original uploaded photos
│   ├── user_outputs/           # Generated certificates (served for download/preview)
│   ├── instance/mdrt_certificates.db # SQLite database (all agents, certificates, history)
│   └── app.log                 # systemd-managed stdout/stderr log (see service file)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminDashboard.js       # Admin asset/CSV upload interface
│   │   │   ├── CertificateHistory.js   # List/download/delete generated certificates
│   │   │   ├── MasterDataHistory.js    # List/download/delete uploaded master CSV/Excel files
│   │   │   └── UserPortalNew.js           # User-facing certificate generation wizard
│   │   ├── components/
│   │   │   └── ConfirmModal.js         # Reusable "are you sure?" confirmation dialog
│   │   └── App.js                      # React Router routes
│   ├── package.json
│   └── build/                  # Production build — THIS is what Nginx actually serves
├── venv/                       # Python virtual environment (use venv/bin/python3 and venv/bin/pip)
└── [Documentation .md files]   # Many historical/outdated notes from earlier dev sessions — see note below
```

**⚠️ Documentation file warning:** The project root has 70+ `.md` files from earlier development (e.g. `DEPLOYMENT_GUIDE.md`, `QUICK_START.md`, etc.). Most describe an **old manual dev setup** (local `npm start` + nohup Flask, different VM IP) that **no longer matches production**. Treat this `README_DEVELOPER_HANDOFF.md` as the source of truth for current deployment; use the others only for historical feature context (e.g. `NAME_TAG_FEATURE.md`, `NAME_TAG_3_TIERS_UPDATE.md`).

---

## 🚀 Starting & Stopping Services

The backend runs as a **systemd service** called `prudential-backend.service`. The frontend has **no running process** — it's a static build served by Nginx.

### Check Service Status
```bash
# Backend service status
sudo systemctl status prudential-backend.service --no-pager

# Is it listening on port 5001?
ss -tlnp | grep 5001

# Nginx status
sudo systemctl status nginx --no-pager
```

### Restart Backend (after any backend code change)
```bash
sudo systemctl restart prudential-backend.service
sleep 3
sudo systemctl status prudential-backend.service --no-pager | head -10
```
The service has `Restart=always`, so it auto-recovers from crashes. Logs go to `backend/app.log` (see service file for exact path).

### Rebuild & Deploy Frontend (after any frontend code change)
```bash
cd /home/aditya.developer/prudential/frontend
npm run build
npm run publish
# No restart needed — Nginx serves the new build/ files immediately.
# Browsers may cache the old index.html/JS bundle — hard refresh (Ctrl+Shift+R) to verify.
```

### Reload Nginx (after nginx config changes only)
```bash
sudo nginx -t          # Always test config first
sudo systemctl reload nginx
```

### Stop/Start Backend Manually (rarely needed — prefer systemctl restart)
```bash
sudo systemctl stop prudential-backend.service
sudo systemctl start prudential-backend.service
```

---

## 🗄️ Database Management

### Database Location
```
/home/aditya.developer/prudential/backend/instance/mdrt_certificates.db
```

### Database Commands
```bash
cd /home/aditya.developer/prudential/backend

# Initialize database (first time setup)
../venv/bin/python init_db.py init

# Import CSV data to database
../venv/bin/python init_db.py migrate admin_assets/data.csv

# View statistics
../venv/bin/python init_db.py stats

# Drop all tables (DANGER!)
../venv/bin/python init_db.py drop
```

### Database Schema
- **agents** - Agent/user information (client_code, name, tier, badges)
- **certificates** - Generated certificate tracking, with snapshot fields (`client_code_snapshot`, `agent_name_snapshot`, `tier_snapshot`, `badges_snapshot`) so history survives master CSV re-uploads
- **system_assets** - Uploaded backgrounds/badges/nametags/CSV metadata (the "live"/current asset pointer)
- **csv_upload_history** - Every master CSV/Excel upload ever made, with a permanent timestamped copy of the file in `admin_assets/csv_history/`, downloadable and deletable from the Master Data History page

**See:** `DATABASE_GUIDE.md` for original schema details (note: `csv_upload_history` table was added later and is not documented there — see `backend/database.py` directly for the current source of truth).

### Timezone
The VM's system timezone was changed from UTC to **Asia/Hong_Kong (HKT, UTC+8)**:
```bash
sudo timedatectl set-timezone Asia/Hong_Kong   # already applied — just for reference
timedatectl                                     # verify current setting
```
All backend timestamps use `datetime.now()` (NOT `datetime.utcnow()`) in `database.py`/`db_services.py` so they follow the system's local timezone. **If you ever change the VM's timezone again, restart `prudential-backend.service`** so the running Python process picks up the new zone. Timestamps recorded before this change (historical records) remain in UTC and will NOT be retroactively corrected.

---

## 📚 Essential Documentation

Start with this file. Other `.md` files in the repo root are historical and may describe an outdated setup — treat them only as feature-level background, not operational truth:

1. **README_DEVELOPER_HANDOFF.md** (this file) - Current deployment/ops source of truth
2. **NAME_TAG_FEATURE.md** / **NAME_TAG_3_TIERS_UPDATE.md** - Background on the name-tag/badge rendering feature
3. **FIX_CLIENT_CODE_LOOKUP.md** - Background: client code lookup from database (not filename)
4. Any other `.md` file - historical notes, may be stale; verify against actual code before relying on them

---

## 🔧 Common Maintenance Tasks

### 1. Update Python Dependencies
```bash
cd /home/aditya.developer/prudential
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### 2. Update Frontend Dependencies
```bash
cd /home/aditya.developer/prudential/frontend
npm install
npm run build  # Rebuild for production
```

### 3. View Logs
```bash
# Backend application logs (systemd-managed)
tail -f /home/aditya.developer/prudential/backend/app.log

# Or via journalctl
sudo journalctl -u prudential-backend.service -f

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### 4. Clear Generated Certificates
```bash
cd /home/aditya.developer/prudential/backend
../venv/bin/python manage.py audit  # reports files; does not delete history
```

### 5. Backup Database
```bash
cd /home/aditya.developer/prudential/backend
../venv/bin/python manage.py backup
```

### 6. Backup Uploaded Assets
```bash
cd /home/aditya.developer/prudential/backend
tar -czf admin_assets_backup_$(date +%Y%m%d).tar.gz admin_assets/
```

---

## 🌐 Nginx Configuration & Cloudflare

**Config file:** `/etc/nginx/sites-available/prudential` (symlinked from `/etc/nginx/sites-enabled/prudential`).

**DNS/Edge:** The domain `prudential-uat.innocorn.net` is managed in **Cloudflare**, pointing to this VM's IP (`34.87.167.252` as of Oct 2026 — GCP VM IPs can change if the instance is recreated; if the site becomes unreachable, first check whether the VM's external IP changed and update the Cloudflare DNS A record accordingly).

**Actual current config (simplified — see file for full version):**
```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name prudential-uat.innocorn.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name prudential-uat.innocorn.net;

    ssl_certificate /etc/ssl/certs/prudential-cert.pem;
    ssl_certificate_key /etc/ssl/private/prudential-key.pem;

    # Backend API — must come before /prudential/ to take precedence
    location /prudential-api {
        rewrite ^/prudential-api/(.*) /api/$1 break;
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 50M;   # allows large CSV/Excel/photo uploads
    }

    # Static JS/CSS build assets
    location /prudential/static/ {
        alias /home/aditya.developer/prudential/frontend/build/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Other static assets (fonts, images) referenced at /prudential root
    location ~ /prudential/.*\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /home/aditya.developer/prudential/frontend/build;
        rewrite ^/prudential/(.*)$ /$1 break;
        expires 1y;
    }

    # React app itself — serves build/index.html for all other /prudential/* routes
    # (so React Router's client-side routing works, e.g. /prudential/master-data-history)
    location /prudential/ {
        alias /home/aditya.developer/prudential/frontend/build/;
        try_files $uri $uri/ /prudential/index.html;
        index index.html;
    }

    location = /prudential { return 301 https://$server_name/prudential/; }
    location = / { return 301 https://$server_name/prudential/; }
}
```

Note: API calls from the frontend go to `/prudential-api/...` (NOT `/prudential/api/...`) — check `frontend/src/pages/*.js` for the `API_BASE_URL`/axios base URL constant if API calls seem to 404.

**Reload Nginx after config changes:**
```bash
sudo nginx -t  # Always test configuration first
sudo systemctl reload nginx
```

---

## 🐛 Troubleshooting Guide

### Issue: "Port already in use"
```bash
# Find process using port 5001 (backend)
sudo lsof -i :5001
# Normally this should be the systemd-managed process. Restart via systemd instead of killing manually:
sudo systemctl restart prudential-backend.service
```

### Issue: "Module not found" errors
```bash
# Backend dependencies
cd /home/aditya.developer/prudential
source venv/bin/activate
pip install -r requirements.txt

# Frontend dependencies
cd /home/aditya.developer/prudential/frontend
npm install
```

### Issue: "Database locked" error
```bash
# Check for processes accessing the database
sudo lsof | grep mdrt_certificates.db
# Kill any stale connections
# Restart backend service
```

### Issue: AI model download fails
```bash
# The rembg model (~180MB) downloads on first run
# Manually download if needed:
cd /home/aditya.developer/prudential/backend
source ../venv/bin/activate
python -c "from rembg import new_session; new_session('u2net_human_seg')"
```

### Issue: Certificates not generating
1. Check backend logs: `tail -f backend/app.log` or `sudo journalctl -u prudential-backend.service -f`
2. Verify admin assets are uploaded (backgrounds, badges, master CSV/Excel) via Admin Dashboard
3. Verify agent photos are named correctly (e.g., `00020880.jpg` with leading zeros) — or check client code lookup if using the input-based flow
4. Check database has agent data: `cd backend && ../venv/bin/python init_db.py stats`

### Issue: Nginx 502 Bad Gateway
```bash
# Check backend service is running
sudo systemctl status prudential-backend.service --no-pager
ss -tlnp | grep 5001

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: Site unreachable / Cloudflare showing error
1. Check the VM's current external IP: `curl -s ifconfig.me`
2. Compare against the DNS A record for `prudential-uat.innocorn.net` in Cloudflare — GCP VM IPs can change on VM recreation/restart in some configurations. Update the Cloudflare A record if they don't match.
3. Verify Nginx and the backend service are both running (commands above).

---

## 🔑 Important Files & Directories

### Backend Files
- **app_with_db.py** - Main Flask application (USE THIS, not app.py) — all API routes
- **database.py** - SQLAlchemy ORM models (Agent, Certificate, SystemAsset, CSVUploadHistory)
- **db_services.py** - Database operations (CSV/Excel import, history CRUD, delete functions)
- **init_db.py** - Database initialization CLI tool

### Data Directories (BACKUP THESE!)
- **admin_assets/** - Uploaded backgrounds, badges, nametags, master CSV/Excel (live/current)
- **admin_assets/csv_history/** - Permanent archive of every master CSV/Excel upload
- **mdrt_certificates.db** - SQLite database (all agent, certificate, and history data)
- **user_outputs/** - Generated certificates

### Configuration
- API base URL in frontend: check `frontend/src/pages/*.js` for the axios/`API_BASE_URL` constant — it should point to `/prudential-api` (relative path, works through Nginx in production)
- Database path: `backend/app_with_db.py` (SQLALCHEMY_DATABASE_URI config)
- CORS settings: `backend/app_with_db.py` (Flask-CORS init)
- systemd service file: `/etc/systemd/system/prudential-backend.service`
- Nginx site config: `/etc/nginx/sites-available/prudential`

---

## 📦 Dependencies

### Backend (Python)
See `backend/requirements.txt` for the exact pinned list. Key packages:
```
Flask, Flask-SQLAlchemy, Flask-CORS
pandas          # CSV parsing
openpyxl        # XLSX parsing
xlrd            # legacy XLS parsing
gunicorn        # production WSGI server
python-dotenv   # private backend configuration
Pillow          # Image compositing
rembg[cpu]      # AI background removal
Werkzeug
```

### Frontend (Node.js)
```
react: ^18.2.0
axios: ^1.6.2
react-dropzone: ^14.2.3
lucide-react: ^0.294.0
```

---

## 🔐 Security Notes

1. **No external API calls** - All processing is local (after AI model download)
2. **Origin policy** - Same-origin API access; wildcard CORS is disabled; mutations require CSRF tokens
3. **File uploads** - Uploaded files stored in `backend/admin_assets/` (and archived in `backend/admin_assets/csv_history/`) and `backend/user_uploads/`
4. **Database** - SQLite file-based, no network exposure
5. **Firewall** - Ensure only necessary ports are exposed (80, 443, 22); backend port 5001 should only be reachable via localhost/Nginx, not directly from the internet
6. **SSL** - Origin SSL cert/key at `/etc/ssl/certs/prudential-cert.pem` / `/etc/ssl/private/prudential-key.pem`; Cloudflare provides the edge SSL for end users

---

## 📞 Getting Help

### Documentation Files (in project root)
The repo root has many historical `.md` files from earlier development sessions (`PROJECT_OVERVIEW.md`, `DATABASE_GUIDE.md`, `DEPLOYMENT_INFO.md`, `MANUAL_START_GUIDE.md`, `QUICK_START.md`, `NAME_TAG_FEATURE.md`, `NAME_TAG_3_TIERS_UPDATE.md`, etc.). Many describe outdated deployment details (wrong IP, manual nohup processes, no Cloudflare). **This file (`README_DEVELOPER_HANDOFF.md`) is the current source of truth for deployment/ops** — use the others only for historical feature-level context when needed.

### Key Commands Cheat Sheet
```bash
# SSH to VM
ssh aditya.developer@34.87.167.252

# Navigate to project
cd /home/aditya.developer/prudential

# Check backend service
sudo systemctl status prudential-backend.service --no-pager
ss -tlnp | grep 5001

# View logs
tail -f backend/app.log
sudo journalctl -u prudential-backend.service -f

# Restart backend (after backend code changes)
sudo systemctl restart prudential-backend.service

# Rebuild frontend (after frontend code changes)
cd frontend && npm run build && npm run publish

# Restart Nginx (after nginx config changes)
sudo nginx -t && sudo systemctl reload nginx

# Database stats
cd backend && ../venv/bin/python init_db.py stats
```

---

## ✅ Quick Health Check

Run this to verify everything is working:

```bash
# 1. Check backend service is running
sudo systemctl status prudential-backend.service --no-pager
ss -tlnp | grep 5001

# 2. Test backend API directly (bypassing Nginx)
curl http://localhost:5001/api/health

# 3. Test the live site end-to-end (through Cloudflare + Nginx)
curl -I https://prudential-uat.innocorn.net/prudential/

# 4. Check database
cd /home/aditya.developer/prudential/backend
../venv/bin/python init_db.py stats

# 5. Check disk space (for generated certificates and CSV history)
df -h /home/aditya.developer/prudential/backend/user_outputs
```

---

## 🎯 Next Steps for a New Developer

1. **SSH into the VM** and navigate to the project directory
2. **Check service status** using the commands above (backend via systemd, frontend is static)
3. **Read this file fully** — it's the current source of truth for deployment
4. **Browse `backend/app_with_db.py`** to see all API routes, and `database.py` for the schema
5. **Test the application** by accessing the live URL: `https://prudential-uat.innocorn.net/prudential/`
6. **Review logs** (`backend/app.log` or `journalctl -u prudential-backend.service`) to understand recent activity
7. Use the release procedure above for code changes; migrations precede backend startup and frontend publication.

---

## 📝 Deployment Notes

- **Deployed alongside:** Other apps on the same shared VM (e.g. Nurse Rostering, Luna Roster) — each uses its own Nginx site config and port, so avoid port conflicts when adding new services.
- **VM:** Google Cloud Platform (GCP) instance, Ubuntu/Debian Linux. External IP as of Oct 2026: `34.87.167.252` — **verify with `curl ifconfig.me` since GCP ephemeral IPs can change**; update Cloudflare DNS if it does.
- **Domain/Edge:** Cloudflare manages DNS + edge SSL/proxying for `prudential-uat.innocorn.net`.
- **Backend process management:** systemd unit `prudential-backend.service` (auto-restarts on crash/reboot).
- **Frontend:** Static production build (`npm run build`) served directly by Nginx — no Node process running in production.
- **Server timezone:** `Asia/Hong_Kong` (HKT, UTC+8) — see Timezone section above.

---

## 🚀 Everything is Operational!

The application includes the remediation above; Cloudflare origin certificate rotation remains an infrastructure follow-up. The admin can upload assets (backgrounds, badges, master CSV/Excel) via the Admin Dashboard, and users can generate certificates via the user portal. Certificate and master-data upload history are both tracked with download/delete support.

**Questions?** Review this file first, then the historical `.md` docs for feature-specific background, then the logs for recent activity.

**Good luck!** 🎉
