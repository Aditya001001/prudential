# How to Start the MDRT Certificate Generator

## ✅ Easy Start (Recommended)

### **Option 1: Double-click start.bat (Windows)**
1. Locate `start.bat` in the project root folder
2. **Double-click** `start.bat`
3. Two terminal windows will open:
   - **Backend (Flask)** - Keep running
   - **Frontend (React)** - Keep running
4. Wait 30-60 seconds for React to compile
5. Browser will auto-open to http://localhost:3000

### **Option 2: PowerShell Script**
1. Right-click `start.ps1` → **Run with PowerShell**
2. If you see security warning, click "Run anyway"
3. Two PowerShell windows will open
4. Wait for React to compile
5. Open http://localhost:3000 in browser

---

## 🔧 Manual Start (If scripts don't work)

### **Step 1: Start Backend**
Open **Terminal/PowerShell 1**:
```bash
cd C:\Users\ahada\Desktop\Template_HK\backend
python app.py
```

**You should see:**
```
* Serving Flask app 'app'
* Running on http://127.0.0.1:5000
```

✅ **Keep this terminal open!**

---

### **Step 2: Start Frontend**
Open **Terminal/PowerShell 2** (NEW window):
```bash
cd C:\Users\ahada\Desktop\Template_HK\frontend
npm start
```

**You should see:**
```
Compiled successfully!
Local:            http://localhost:3000
```

✅ **Keep this terminal open too!**

---

## 🌐 Access the Application

Once both servers are running:
- **Frontend UI**: http://localhost:3001
- **Backend API**: http://localhost:5000/api/health

The browser should open automatically. If not, manually open http://localhost:3001

---

## 🛑 How to Stop

### **Stop Both Servers:**
1. Go to each terminal window
2. Press **Ctrl + C**
3. Type `Y` if asked to confirm

### **Or Just Close:**
- Simply close both terminal windows

---

## ⚠️ Troubleshooting

### **Issue: Frontend shows blank page**

**Solution 1 - Hard Refresh:**
1. Open http://localhost:3000
2. Press **Ctrl + Shift + R** (hard refresh)
3. Or **Ctrl + F5**

**Solution 2 - Clear Cache:**
1. Press **F12** in browser
2. Right-click the refresh button
3. Click "Empty Cache and Hard Reload"

**Solution 3 - Rebuild Frontend:**
```bash
cd frontend
npm run build
```

---

### **Issue: Port 3000 already in use**

**Kill the process using port 3000:**
```powershell
# Find the process
netstat -ano | findstr :3000

# Kill it (replace PID with the number you see)
taskkill /PID <PID> /F
```

Then restart the frontend.

---

### **Issue: Port 5000 already in use**

**Kill the process using port 5000:**
```powershell
# Find the process
netstat -ano | findstr :5000

# Kill it
taskkill /PID <PID> /F
```

Then restart the backend.

---

### **Issue: npm start shows no output**

This is normal on Windows PowerShell. The server is running even if you don't see output.

**Check if it's running:**
1. Open browser to http://localhost:3000
2. Wait 60 seconds for compilation
3. If blank, check browser console (F12)

---

### **Issue: Backend shows Python errors**

**Reinstall dependencies:**
```bash
cd backend
python -m pip install --upgrade -r requirements.txt
```

---

## 📝 Normal Startup Sequence

1. **Backend starts** (2-3 seconds)
   - Shows Flask server messages
   - You may see some warnings (ignore them)
   - Should say "Running on http://127.0.0.1:5000"

2. **Frontend starts** (30-60 seconds)
   - npm compiles React app
   - May show no output on Windows (this is normal)
   - Browser opens automatically when ready

3. **Both running**
   - Backend on port 5000
   - Frontend on port 3000
   - Ready to use!

---

## ✅ Success Indicators

### **Backend is working:**
- Terminal shows "Running on http://127.0.0.1:5000"
- Visit http://localhost:5000/api/health
- Should see: `{"status": "ok", "message": "Backend is running"}`

### **Frontend is working:**
- Browser opens to http://localhost:3000
- You see purple gradient header
- "MDRT Certificate Generator" title visible
- 4-step wizard appears
- Upload sections are visible

---

## 🎯 Quick Test

After both servers start:

1. **Open**: http://localhost:3000
2. **You should see**:
   - Purple header
   - "Upload Assets" step active
   - Drag & drop zones
   - Upload buttons

3. **Test backend connection**:
   - Open: http://localhost:5000/api/health
   - Should see JSON response

If both work → ✅ **You're ready to go!**

---

## 💡 Pro Tips

- **Keep both terminals open** while using the app
- **Don't close** until you're done generating certificates
- **First startup** takes longer (60 seconds for React)
- **Subsequent startups** are faster (~10 seconds)
- **Browser refresh** works if page freezes
- **Check F12 console** if you see errors

---

## 🔄 Restart Instructions

If you need to restart:

1. **Stop** both servers (Ctrl+C in each terminal)
2. **Wait** 5 seconds
3. **Start** backend first
4. **Wait** 3 seconds
5. **Start** frontend
6. **Wait** 60 seconds for compilation
7. **Refresh** browser

---

**You're all set! Both servers will stay running until you stop them.** 🚀
