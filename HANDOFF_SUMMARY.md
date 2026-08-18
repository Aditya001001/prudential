# 📋 Developer Handoff Summary

## 🎯 Project: Prudential MDRT Certificate Generator

**Status:** ✅ Fully Operational  
**Location:** VM at 34.21.174.189  
**Deployed:** Alongside Nurse Rostering app  

---

## 🌐 Access Information

| Resource | URL/Command |
|----------|-------------|
| **User Portal** | http://34.21.174.189/prudential/ |
| **Admin Dashboard** | http://34.21.174.189/prudential/admin |
| **SSH Command** | `ssh aditya.developer@34.21.174.189` |
| **Project Directory** | `/home/aditya.developer/prudential` |

---

## 🏗️ System Architecture

```
                    Internet
                       ↓
            ┌──────────────────────┐
            │   Nginx (Port 80)    │
            │  Reverse Proxy       │
            └──────────┬───────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ↓                            ↓
┌────────────────┐          ┌────────────────┐
│ React Frontend │          │ Flask Backend  │
│   Port 3001    │ ←──────→ │   Port 5001    │
└────────────────┘   API    └────────┬───────┘
                                     │
                              ┌──────┴───────┐
                              │              │
                              ↓              ↓
                     ┌──────────────┐  ┌──────────┐
                     │ SQLite DB    │  │  rembg   │
                     │ Agent Data   │  │  AI Model│
                     └──────────────┘  └──────────┘
```

---

## 🔑 Key Components

### 1. Backend (Flask API - Port 5001)
- **Main File:** `backend/app_with_db.py` ⚠️ USE THIS, NOT app.py
- **Database:** SQLite (`backend/mdrt_certificates.db`)
- **AI Processing:** rembg library for background removal
- **Image Processing:** Pillow for certificate generation

### 2. Frontend (React - Port 3001)
- **Admin Interface:** Upload backgrounds, badges, CSV data
- **User Interface:** Upload agent photos, generate certificates
- **Build Output:** `frontend/build/` (served by Nginx)

### 3. Database (SQLite)
- **Location:** `backend/mdrt_certificates.db`
- **Tables:** agents, certificates, system_assets
- **Management:** Use `init_db.py` script

### 4. Nginx Reverse Proxy
- **Routes:** `/prudential/` → Frontend (3001)
- **Routes:** `/prudential/api/` → Backend (5001)
- **Config:** `/etc/nginx/sites-available/` (check default or prudential)

---

## 📂 Critical Files & Directories

**⚠️ MUST BACKUP:**
- `backend/mdrt_certificates.db` - All agent data
- `backend/admin_assets/` - Uploaded backgrounds, badges, CSV

**Important Application Files:**
- `backend/app_with_db.py` - Main Flask application
- `backend/database.py` - Database models
- `backend/db_services.py` - Database operations
- `frontend/src/pages/AdminDashboard.js` - Admin UI
- `frontend/src/pages/UserPortal.js` - User UI

**Logs:**
- `backend/backend.log` - Application logs
- `/var/log/nginx/error.log` - Nginx errors
- `/var/log/nginx/access.log` - Nginx access logs

---

## 🚀 Service Management

### Quick Start
```bash
cd /home/aditya.developer/prudential

# Backend
cd backend && nohup ../venv/bin/python app_with_db.py > backend.log 2>&1 &

# Frontend (Dev mode)
cd frontend && PORT=3001 nohup npm start > frontend.log 2>&1 &
```

### Check Status
```bash
ss -tlnp | grep -E ":(5001|3001)"
```

### Stop Services
```bash
ps aux | grep -E "app_with_db|npm start"
kill <PID>
```

---

## 🗄️ Database Quick Reference

```bash
cd /home/aditya.developer/prudential/backend

# View statistics
../venv/bin/python init_db.py stats

# Import CSV
../venv/bin/python init_db.py migrate admin_assets/data.csv

# Initialize (first time only)
../venv/bin/python init_db.py init
```

**Database Schema:**
- `agents` - Client code, name, tier (MDRT/COT/TOT), badges (LM/HR/QC)
- `certificates` - Generated certificate tracking & download history
- `system_assets` - Uploaded backgrounds & badges metadata

---

## 🔍 Health Check Commands

```bash
# 1. Services running?
ss -tlnp | grep -E ":(5001|3001)"

# 2. Backend API working?
curl http://localhost:5001/api/health

# 3. Frontend accessible?
curl -I http://34.21.174.189/prudential/

# 4. Database OK?
cd /home/aditya.developer/prudential/backend
../venv/bin/python init_db.py stats

# 5. Nginx OK?
sudo systemctl status nginx
```

---

## 📖 Documentation Guide

**🌟 START HERE:**
1. **README_DEVELOPER_HANDOFF.md** - Complete onboarding (you should read this first!)
2. **QUICK_REFERENCE_CARD.md** - Quick command reference
3. **HANDOFF_SUMMARY.md** - This file (overview)

**Deep Dive:**
4. **PROJECT_OVERVIEW.md** - Architecture & technology stack
5. **DATABASE_GUIDE.md** - Database schema, API, management
6. **DEPLOYMENT_INFO.md** - VM deployment specifics
7. **MANUAL_START_GUIDE.md** - Detailed service management

**Feature Documentation:**
- **NEON_TEXT_EFFECTS.md** - Text styling with tier-based glow
- **DUAL_ARCHITECTURE_GUIDE.md** - Admin vs User workflows
- **POSTER_TEMPLATE_SPECS.md** - Template specifications

**Troubleshooting:**
- **UPLOAD_TROUBLESHOOTING.md** - File upload issues
- **URGENT_FIXES.md** - Common fixes & solutions

---

## 🎯 Common Tasks

### Update Dependencies
```bash
# Backend
cd /home/aditya.developer/prudential
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Frontend
cd frontend && npm install
```

### Rebuild Frontend
```bash
cd /home/aditya.developer/prudential/frontend
npm run build
sudo systemctl reload nginx
```

### Backup Database
```bash
cd /home/aditya.developer/prudential/backend
cp mdrt_certificates.db mdrt_certificates.db.backup_$(date +%Y%m%d)
```

### View Logs
```bash
tail -f /home/aditya.developer/prudential/backend/backend.log
```

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Port in use** | `sudo lsof -i :5001` → `kill <PID>` |
| **502 Bad Gateway** | Check if backend/frontend running, restart services |
| **Module not found** | `pip install -r requirements.txt` or `npm install` |
| **Database locked** | Kill processes accessing DB, restart backend |
| **Certificates not generating** | Check logs, verify admin assets uploaded, check agent photo filenames |

---

## 📦 Tech Stack Summary

| Component | Technology | Version |
|-----------|------------|---------|
| **Backend Framework** | Flask | 3.0.0 |
| **Database** | SQLite | (file-based) |
| **ORM** | Flask-SQLAlchemy | 3.1.1 |
| **Image Processing** | Pillow | 10.0+ |
| **AI Background Removal** | rembg | 2.0.50+ |
| **Frontend Framework** | React | 18.2.0 |
| **HTTP Client** | axios | 1.6.2 |
| **Web Server** | Nginx | (check: `nginx -v`) |
| **Python** | 3.8+ | (check: `python3 --version`) |
| **Node.js** | 14+ | (check: `node --version`) |

---

## ✅ Handoff Checklist

**Before you start:**
- [ ] I have SSH access to 34.21.174.189
- [ ] I can navigate to `/home/aditya.developer/prudential`
- [ ] I can access http://34.21.174.189/prudential/
- [ ] I have read `README_DEVELOPER_HANDOFF.md`

**Understanding the system:**
- [ ] I understand the dual architecture (Admin vs User)
- [ ] I know where the database is located
- [ ] I know how to start/stop services
- [ ] I know where to find logs

**Ready to maintain:**
- [ ] I can run the health check commands
- [ ] I know how to backup the database
- [ ] I know how to view logs
- [ ] I have reviewed the common issues & solutions

---

## 🆘 Need Help?

1. **Check logs first:** `tail -f backend/backend.log`
2. **Run health checks:** See "Health Check Commands" above
3. **Review documentation:** Start with `README_DEVELOPER_HANDOFF.md`
4. **Check troubleshooting docs:** `UPLOAD_TROUBLESHOOTING.md`, `URGENT_FIXES.md`

---

## 🎉 You're Ready!

Everything is set up and operational. The application is fully functional and serving users.

**Next Step:** SSH into the VM and read `README_DEVELOPER_HANDOFF.md` for complete details.

```bash
ssh aditya.developer@34.21.174.189
cd /home/aditya.developer/prudential
cat README_DEVELOPER_HANDOFF.md
```

**Good luck! 🚀**
