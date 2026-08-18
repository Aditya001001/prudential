# 🎯 Prudential Certificate Generator - Developer Handoff Guide

## Welcome! 👋

This document will get you up to speed with the Prudential MDRT Certificate Generator deployed on the VM at `34.21.174.189`.

---

## 📍 Quick Access Information

### Live URLs
- **User Portal:** http://34.21.174.189/prudential/
- **Admin Dashboard:** http://34.21.174.189/prudential/admin

### SSH Access
```bash
ssh aditya.developer@34.21.174.189
cd /home/aditya.developer/prudential
```

### Service Ports
- **Backend (Flask API):** Port 5001
- **Frontend (React):** Port 3001
- **Public Access (Nginx):** Via `/prudential/` path

---

## 🏗️ What This Application Does

**Automated MDRT certificate generation system** that:
1. **Removes backgrounds** from agent photos using AI (rembg/U2-Net model)
2. **Generates personalized certificates** by compositing agents onto tier-specific backgrounds (MDRT/COT/TOT)
3. **Adds milestone badges** (Life Member, Honor Roll, Quarter Century)
4. **Overlays agent names** with custom fonts and neon glow effects
5. **Batch processes** hundreds of certificates from CSV data

**Latest Update:** Client code is now looked up from the database using user input, not from the uploaded photo filename. Users can upload photos with any filename. See `FIX_CLIENT_CODE_LOOKUP.md` for details.

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│    React Frontend (Port 3001)                   │
│    • Admin Dashboard (/admin)                   │
│    • User Portal (/)                            │
│    • 4-step wizard interface                    │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/REST API
┌──────────────────▼──────────────────────────────┐
│    Flask Backend (Port 5001)                    │
│    • File upload handling                       │
│    • AI background removal (rembg)              │
│    • Image processing (Pillow)                  │
│    • SQLite database                            │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│    Nginx Reverse Proxy (Port 80)                │
│    • Routes /prudential/ → Frontend             │
│    • Routes /prudential/api/ → Backend          │
└─────────────────────────────────────────────────┘
```

**Tech Stack:**
- **Backend:** Flask, Pillow, rembg (AI), pandas, SQLite
- **Frontend:** React 18, react-dropzone, axios, lucide-react
- **Deployment:** Nginx reverse proxy, systemd services (if configured)

---

## 📂 Project Structure

```
/home/aditya.developer/prudential/
├── backend/
│   ├── app_with_db.py          # Main Flask application (DATABASE VERSION)
│   ├── database.py             # SQLAlchemy models
│   ├── db_services.py          # Database helper functions
│   ├── init_db.py              # Database initialization script
│   ├── requirements.txt        # Python dependencies
│   ├── admin_assets/           # Admin-uploaded files (backgrounds, badges, CSV)
│   ├── user_uploads/           # User-uploaded agent photos
│   ├── user_outputs/           # Generated certificates
│   ├── mdrt_certificates.db    # SQLite database
│   └── backend.log             # Application logs
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminDashboard.js  # Admin interface
│   │   │   └── UserPortal.js      # User interface
│   │   └── App.js
│   ├── package.json
│   └── build/                  # Production build (served by Nginx)
├── venv/                       # Python virtual environment
└── [Documentation files]
```

---

## 🚀 Starting & Stopping Services

### Check Service Status
```bash
# Check if backend is running
ss -tlnp | grep 5001

# Check if frontend is running
ss -tlnp | grep 3001

# Check Nginx
sudo systemctl status nginx
```

### Start Services Manually

**Backend:**
```bash
cd /home/aditya.developer/prudential/backend
nohup ../venv/bin/python app_with_db.py > backend.log 2>&1 &
```

**Frontend (Development):**
```bash
cd /home/aditya.developer/prudential/frontend
PORT=3001 nohup npm start > frontend.log 2>&1 &
```

**Frontend (Production Build):**
```bash
cd /home/aditya.developer/prudential/frontend
npm run build
# Then Nginx serves from build/ directory
```

### Stop Services
```bash
# Find backend process
ps aux | grep app_with_db.py
kill <PID>

# Find frontend process
ps aux | grep "npm start"
kill <PID>
```

---

## 🗄️ Database Management

### Database Location
```
/home/aditya.developer/prudential/backend/mdrt_certificates.db
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
- **certificates** - Generated certificate tracking
- **system_assets** - Uploaded backgrounds and badges metadata

**See:** `DATABASE_GUIDE.md` for complete schema details

---

## 📚 Essential Documentation

Start with these files in order:

1. **README_DEVELOPER_HANDOFF.md** (this file) - Start here
2. **PROJECT_OVERVIEW.md** - Architecture and technical details
3. **DATABASE_GUIDE.md** - Database schema and management
4. **DEPLOYMENT_INFO.md** - VM deployment specifics
5. **MANUAL_START_GUIDE.md** - Detailed service management
6. **FIX_CLIENT_CODE_LOOKUP.md** - Latest fix: Client code lookup from database (not filename)

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
# Backend logs
tail -f /home/aditya.developer/prudential/backend/backend.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### 4. Clear Generated Certificates
```bash
cd /home/aditya.developer/prudential/backend
rm -rf user_outputs/certificates/*
```

### 5. Backup Database
```bash
cd /home/aditya.developer/prudential/backend
cp mdrt_certificates.db mdrt_certificates.db.backup_$(date +%Y%m%d)
```

### 6. Backup Uploaded Assets
```bash
cd /home/aditya.developer/prudential/backend
tar -czf admin_assets_backup_$(date +%Y%m%d).tar.gz admin_assets/
```

---

## 🌐 Nginx Configuration

The application is reverse-proxied through Nginx. Configuration likely in:
```bash
/etc/nginx/sites-available/default
# or
/etc/nginx/sites-available/prudential
```

**Key proxy settings:**
```nginx
location /prudential/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

location /prudential/api/ {
    proxy_pass http://localhost:5001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Reload Nginx after config changes:**
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## 🐛 Troubleshooting Guide

### Issue: "Port already in use"
```bash
# Find process using port 5001 (backend)
sudo lsof -i :5001
kill <PID>

# Find process using port 3001 (frontend)
sudo lsof -i :3001
kill <PID>
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
python -c "from rembg import new_session; new_session('u2net')"
```

### Issue: Certificates not generating
1. Check backend logs: `tail -f backend/backend.log`
2. Verify admin assets are uploaded (backgrounds, badges, CSV)
3. Verify agent photos are named correctly (e.g., `00020880.jpg` with leading zeros)
4. Check database has agent data: `sqlite3 mdrt_certificates.db "SELECT * FROM agents LIMIT 5;"`

### Issue: Nginx 502 Bad Gateway
```bash
# Check if backend is running
ss -tlnp | grep 5001

# Check if frontend is running
ss -tlnp | grep 3001

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔑 Important Files & Directories

### Backend Files
- **app_with_db.py** - Main Flask application (USE THIS, not app.py)
- **database.py** - SQLAlchemy ORM models
- **db_services.py** - Database operations (import CSV, etc.)
- **init_db.py** - Database initialization CLI tool

### Data Directories (BACKUP THESE!)
- **admin_assets/** - Uploaded backgrounds, badges, CSV data
- **mdrt_certificates.db** - SQLite database (all agent data)
- **user_outputs/certificates/** - Generated certificates

### Configuration
- API URLs in frontend:
  - `frontend/src/pages/AdminDashboard.js` - Line ~7
  - `frontend/src/pages/UserPortal.js` - Line ~7
- Database path: `backend/app_with_db.py` - Line ~17
- CORS settings: `backend/app_with_db.py` - Line ~14

---

## 📦 Dependencies

### Backend (Python)
```
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-CORS==4.0.0
pandas>=2.0.0
Pillow>=10.0.0
rembg[cpu]>=2.0.50  # AI background removal
Werkzeug==3.0.1
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
2. **CORS** - Currently allows all origins (consider restricting in production)
3. **File uploads** - Uploaded files stored in `backend/admin_assets/` and `backend/user_uploads/`
4. **Database** - SQLite file-based, no network exposure
5. **Firewall** - Ensure only necessary ports are exposed (80, 443, 22)

---

## 📞 Getting Help

### Documentation Files (in project root)
- **PROJECT_OVERVIEW.md** - Detailed architecture
- **DATABASE_GUIDE.md** - Database schema and API
- **DEPLOYMENT_INFO.md** - Deployment specifics
- **MANUAL_START_GUIDE.md** - Service management
- **QUICK_START.md** - Quick reference guide

### Key Commands Cheat Sheet
```bash
# SSH to VM
ssh aditya.developer@34.21.174.189

# Navigate to project
cd /home/aditya.developer/prudential

# Check services
ss -tlnp | grep -E ":(5001|3001)"

# View logs
tail -f backend/backend.log

# Restart Nginx
sudo systemctl reload nginx

# Database stats
cd backend && ../venv/bin/python init_db.py stats
```

---

## ✅ Quick Health Check

Run this to verify everything is working:

```bash
# 1. Check services are running
ss -tlnp | grep -E ":(5001|3001)"

# 2. Test backend API
curl http://localhost:5001/api/health

# 3. Test frontend via Nginx
curl -I http://34.21.174.189/prudential/

# 4. Check database
cd /home/aditya.developer/prudential/backend
../venv/bin/python init_db.py stats

# 5. Check disk space (for generated certificates)
df -h /home/aditya.developer/prudential/backend/user_outputs
```

---

## 🎯 Next Steps

1. **SSH into the VM** and navigate to the project directory
2. **Check service status** using the commands above
3. **Review the PROJECT_OVERVIEW.md** for architecture details
4. **Review the DATABASE_GUIDE.md** for database operations
5. **Test the application** by accessing the live URLs
6. **Review logs** to understand recent activity

---

## 📝 Deployment Notes

- **Deployed alongside:** Nurse Rostering app (on same VM)
- **Deployment date:** Recent (check git logs for exact date)
- **VM OS:** Likely Ubuntu/Debian Linux
- **Python version:** 3.8+
- **Node.js version:** 14+ (check with `node --version`)

**Previous deployment attempts:**
- Initially attempted Render.com deployment (see DEPLOYMENT_SUCCESS.md)
- Reverted to VM deployment for better performance (see REVERTED_TO_VM_DEPLOYMENT.md)

---

## 🚀 Everything is Operational!

The application is fully functional and ready to use. The admin can upload assets via the admin dashboard, and users can generate certificates via the user portal.

**Questions?** Review the documentation files or check the logs for recent activity.

**Good luck!** 🎉
