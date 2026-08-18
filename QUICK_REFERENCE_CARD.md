# 🚀 Prudential Certificate Generator - Quick Reference Card

## 📍 Essential Info

**SSH Access:**
```bash
ssh aditya.developer@34.21.174.189
cd /home/aditya.developer/prudential
```

**Live URLs:**
- User Portal: http://34.21.174.189/prudential/
- Admin Dashboard: http://34.21.174.189/prudential/admin

---

## 🔧 Common Commands

### Check Status
```bash
# Check if services are running
ss -tlnp | grep -E ":(5001|3001)"

# Check Nginx
sudo systemctl status nginx
```

### Start Services
```bash
# Backend
cd /home/aditya.developer/prudential/backend
nohup ../venv/bin/python app_with_db.py > backend.log 2>&1 &

# Frontend (Dev)
cd /home/aditya.developer/prudential/frontend
PORT=3001 nohup npm start > frontend.log 2>&1 &
```

### Stop Services
```bash
# Find and kill backend
ps aux | grep app_with_db.py
kill <PID>

# Find and kill frontend
ps aux | grep "npm start"
kill <PID>
```

### View Logs
```bash
# Backend logs
tail -f /home/aditya.developer/prudential/backend/backend.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🗄️ Database Commands

```bash
cd /home/aditya.developer/prudential/backend

# View statistics
../venv/bin/python init_db.py stats

# Import CSV data
../venv/bin/python init_db.py migrate admin_assets/data.csv

# Initialize database (first time only)
../venv/bin/python init_db.py init
```

---

## 🔍 Quick Health Check

```bash
# 1. Check services
ss -tlnp | grep -E ":(5001|3001)"

# 2. Test backend API
curl http://localhost:5001/api/health

# 3. Test frontend
curl -I http://34.21.174.189/prudential/

# 4. Check database
cd /home/aditya.developer/prudential/backend
../venv/bin/python init_db.py stats
```

---

## 📂 Important Directories

```
/home/aditya.developer/prudential/
├── backend/
│   ├── app_with_db.py        # Main app (USE THIS ONE!)
│   ├── mdrt_certificates.db  # Database (BACKUP THIS!)
│   ├── admin_assets/         # Uploaded files (BACKUP THIS!)
│   ├── user_uploads/         # Agent photos
│   ├── user_outputs/         # Generated certificates
│   └── backend.log           # Application logs
└── frontend/
    ├── src/pages/
    │   ├── AdminDashboard.js
    │   └── UserPortal.js
    └── build/                # Production build
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :5001   # Backend
sudo lsof -i :3001   # Frontend

# Kill the process
kill <PID>
```

### Module Not Found
```bash
# Backend
cd /home/aditya.developer/prudential
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd /home/aditya.developer/prudential/frontend
npm install
```

### Nginx 502 Error
```bash
# Check if backend/frontend are running
ss -tlnp | grep -E ":(5001|3001)"

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📚 Documentation Files

**Start Here:**
1. `README_DEVELOPER_HANDOFF.md` - Complete onboarding guide
2. `PROJECT_OVERVIEW.md` - Architecture details
3. `DATABASE_GUIDE.md` - Database schema & management
4. `DEPLOYMENT_INFO.md` - VM deployment specifics

**Quick Guides:**
- `QUICK_START.md` - Fast reference
- `MANUAL_START_GUIDE.md` - Detailed service management
- `QUICK_REFERENCE_CARD.md` - This file

---

## 🎯 First Time Setup Checklist

- [ ] SSH into VM successfully
- [ ] Navigate to `/home/aditya.developer/prudential`
- [ ] Check services are running: `ss -tlnp | grep -E ":(5001|3001)"`
- [ ] Access User Portal: http://34.21.174.189/prudential/
- [ ] Access Admin Dashboard: http://34.21.174.189/prudential/admin
- [ ] Read `README_DEVELOPER_HANDOFF.md`
- [ ] Review `PROJECT_OVERVIEW.md`
- [ ] Check logs: `tail -f backend/backend.log`
- [ ] Run health check commands above

---

**Everything is operational! Start with README_DEVELOPER_HANDOFF.md for complete details.**
