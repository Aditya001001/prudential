# MDRT Certificate Generator - Manual Start Guide

## 📋 Prerequisites Check

Before starting, verify you have:
- ✅ Python 3.8+ installed (`python --version`)
- ✅ Node.js 16+ installed (`node --version`)
- ✅ Dependencies installed (see below if not)

---

## 🔧 One-Time Setup (If Not Done Yet)

### **1. Install Backend Dependencies**

Open **Terminal/PowerShell** and run:

```bash
cd C:\Users\ahada\Desktop\Template_HK\backend
python -m pip install -r requirements.txt
```

**Expected output:**
```
Successfully installed Flask-3.0.0 Flask-CORS-6.0.5 pandas-2.0.0 Pillow-12.3.0 rembg-2.0.77 ...
```

**Note:** First run downloads AI model (~180MB). Only happens once.

---

### **2. Install Frontend Dependencies**

Open **Terminal/PowerShell** and run:

```bash
cd C:\Users\ahada\Desktop\Template_HK\frontend
npm install
```

**Expected output:**
```
added 1500+ packages in 30s
```

---

## 🚀 Manual Startup (Every Time)

### **Step 1: Start Backend Server**

**Open PowerShell/Terminal Window 1:**

```bash
cd C:\Users\ahada\Desktop\Template_HK\backend
python app.py
```

**You should see:**
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
 * Debugger is active!
```

✅ **Leave this window OPEN!** (Don't close it)

You may see some warnings about cryptography - that's normal, ignore them.

---

### **Step 2: Start Frontend Server**

**Open PowerShell/Terminal Window 2 (NEW WINDOW):**

```bash
cd C:\Users\ahada\Desktop\Template_HK\frontend
npm start
```

**You should see:**
```
Compiled successfully!

You can now view mdrt-certificate-generator in the browser.

  Local:            http://localhost:3001
  On Your Network:  http://192.168.x.x:3001
```

✅ **Leave this window OPEN too!**

**Wait 30-60 seconds** for React to compile (first time).

---

### **Step 3: Open Browser**

**Automatic:** Browser should open to http://localhost:3001

**Manual:** If browser doesn't open automatically:
```
Open your browser → Type: http://localhost:3001
```

---

## ✅ Verify Everything Works

### **Check Backend:**
Open: http://localhost:5000/api/health

Should see:
```json
{"status": "ok", "message": "Backend is running"}
```

### **Check Frontend:**
Open: http://localhost:3001

Should see:
- Purple gradient header
- "MDRT Certificate Generator" title
- 4-step progress indicator
- Upload file sections

---

## 🛑 How to Stop Servers

### **Method 1: Keyboard Shortcut**
1. Click on each terminal window
2. Press **Ctrl + C**
3. Type `Y` if asked to confirm
4. Repeat for both windows

### **Method 2: Close Windows**
- Simply close both terminal windows
- Windows will ask "Terminate batch job?" → Click Yes

---

## 🔄 How to Restart

1. **Stop both servers** (Ctrl+C or close windows)
2. **Wait 5 seconds**
3. **Repeat Step 1** (Start Backend)
4. **Wait 3 seconds**
5. **Repeat Step 2** (Start Frontend)
6. **Browser opens automatically**

---

## ⚠️ Troubleshooting

### **Issue: "Port 5000 already in use"**

**Find and kill the process:**

```powershell
# Find what's using port 5000
netstat -ano | findstr :5000

# Kill it (replace PID with the number you see)
taskkill /PID <PID_NUMBER> /F
```

Example:
```powershell
netstat -ano | findstr :5000
# Output: TCP 0.0.0.0:5000 ... LISTENING 12345

taskkill /PID 12345 /F
# Output: SUCCESS: The process with PID 12345 has been terminated.
```

Then try starting backend again.

---

### **Issue: "Port 3001 already in use"**

**Kill all Node processes:**

```powershell
taskkill /F /IM node.exe
```

Then try starting frontend again.

---

### **Issue: Backend shows errors**

**Reinstall dependencies:**

```bash
cd C:\Users\ahada\Desktop\Template_HK\backend
python -m pip install --upgrade -r requirements.txt
```

---

### **Issue: Frontend shows blank page**

**Try these in order:**

1. **Hard refresh browser:**
   - Press **Ctrl + Shift + R**
   - Or **Ctrl + F5**

2. **Clear browser cache:**
   - Press **F12** → Right-click refresh button → "Empty Cache and Hard Reload"

3. **Rebuild frontend:**
   ```bash
   cd C:\Users\ahada\Desktop\Template_HK\frontend
   npm run build
   ```

4. **Check console for errors:**
   - Press **F12** → Console tab
   - Look for red error messages
   - Share them if you need help

---

### **Issue: npm start shows nothing**

This is **normal on Windows PowerShell**. The server is running even without visible output.

**Check if it's working:**
1. Wait 60 seconds
2. Open http://localhost:3001 in browser
3. If blank, press F12 and check Console for errors

---

## 📝 Quick Command Reference

### **Backend (Terminal 1):**
```bash
cd C:\Users\ahada\Desktop\Template_HK\backend
python app.py
```

### **Frontend (Terminal 2):**
```bash
cd C:\Users\ahada\Desktop\Template_HK\frontend
npm start
```

### **Check if Servers Running:**
```bash
# Backend
netstat -ano | findstr :5000

# Frontend  
netstat -ano | findstr :3001
```

### **Kill All Processes:**
```bash
# Kill backend
taskkill /F /IM python.exe

# Kill frontend
taskkill /F /IM node.exe
```

---

## 💡 Pro Tips

### **Tip 1: Use Separate Terminal Apps**
- **Terminal 1**: PowerShell for backend
- **Terminal 2**: Command Prompt for frontend
- Easier to identify which is which

### **Tip 2: Name Your Windows**
```bash
# In PowerShell, set window title:
$host.ui.RawUI.WindowTitle = "MDRT Backend"
```

### **Tip 3: Check Logs**
- Backend logs appear in Terminal 1
- Frontend compilation logs in Terminal 2
- Browser console (F12) shows client errors

### **Tip 4: Fast Restart**
Instead of closing windows:
- Press **Ctrl+C** in each terminal
- Run the start command again
- Faster than closing and reopening

---

## 🎯 Step-by-Step Visual Guide

```
┌─────────────────────────────────────────┐
│  Step 1: Start Backend                  │
│  Terminal 1 → cd backend → python app.py│
│  ✓ See "Running on http://127.0.0.1:5000"│
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Step 2: Start Frontend                 │
│  Terminal 2 → cd frontend → npm start   │
│  ✓ Wait 30-60 seconds for compilation   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Step 3: Open Browser                   │
│  http://localhost:3001                  │
│  ✓ See purple UI with upload sections   │
└─────────────────────────────────────────┘
```

---

## ✅ Success Checklist

After starting both servers, verify:

- [ ] Terminal 1 shows "Running on http://127.0.0.1:5000"
- [ ] Terminal 2 shows "Compiled successfully!"
- [ ] http://localhost:5000/api/health returns JSON
- [ ] http://localhost:3001 shows the UI
- [ ] Both terminal windows are still open
- [ ] No red errors in browser console (F12)

If all checked → **You're ready to use the app!** ✅

---

## 🆘 Still Having Issues?

1. Check both terminals for error messages
2. Check browser console (F12) for errors
3. Try restarting your computer
4. Make sure no antivirus is blocking ports 5000/3001
5. Verify Python and Node.js are installed correctly

---

**That's it! You now know how to manually start the project!** 🚀

For easier startup next time, just use `start.bat` instead of manual steps.
