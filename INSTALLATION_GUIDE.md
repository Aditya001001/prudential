# Installation Guide - MDRT Certificate Generator

Complete step-by-step installation guide for the React web application.

## 📋 What You Need

Before starting, make sure you have:
- ✅ Windows 10/11, macOS, or Linux
- ✅ Administrator/sudo access
- ✅ Internet connection (for initial setup only)
- ✅ ~2GB free disk space

## 🔧 Step-by-Step Installation

### 1. Install Python (Backend)

#### Windows:
1. Download Python 3.8+ from [python.org/downloads](https://www.python.org/downloads/)
2. Run the installer
3. ✅ **IMPORTANT**: Check "Add Python to PATH"
4. Click "Install Now"
5. Verify installation:
   ```bash
   python --version
   ```

#### macOS:
```bash
brew install python3
python3 --version
```

#### Linux:
```bash
sudo apt update
sudo apt install python3 python3-pip
python3 --version
```

### 2. Install Node.js (Frontend)

#### Windows/macOS:
1. Download Node.js 16+ from [nodejs.org](https://nodejs.org/)
2. Run the installer (use default settings)
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### Linux:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs
node --version
npm --version
```

### 3. Install Backend Dependencies

Open terminal/command prompt in the project folder:

```bash
cd backend
pip install -r requirements.txt
```

**What's happening:**
- Installing Flask (web server)
- Installing Pillow (image processing)
- Installing rembg (AI background removal)
- Downloading U2-Net model (~180MB) on first run

**Expected output:**
```
Successfully installed Flask-3.0.0 Pillow-10.0.0 rembg-2.0.50 ...
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

**What's happening:**
- Installing React and React DOM
- Installing UI libraries (lucide-react, react-dropzone)
- Installing axios (HTTP client)

**Expected output:**
```
added 1500+ packages in 30s
```

## 🎯 First Run

### Option A: Quick Start (Windows)

Double-click `start.bat` in the project root. This will:
1. Start the Flask backend on port 5000
2. Start the React frontend on port 3000
3. Open your browser automatically

### Option B: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```
You should see:
```
* Running on http://127.0.0.1:5000
* Debug mode: on
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```
Browser will auto-open to: `http://localhost:3000`

## ✅ Verify Installation

### Backend Check:
Open browser to: `http://localhost:5000/api/health`

Expected response:
```json
{"status": "ok", "message": "Backend is running"}
```

### Frontend Check:
You should see the MDRT Certificate Generator interface with:
- Purple gradient header
- 4-step progress indicator
- Upload file sections

## 🎨 Prepare Your Assets

Before using the app, prepare these files:

### 1. Background Images (3 PNG files)
- Red background for MDRT tier
- Purple background for COT tier
- Gold background for TOT tier

### 2. Badge Images (3 PNG files)
- Life Member badge (transparent PNG)
- Honor Roll badge (transparent PNG)
- Quarter Century badge (transparent PNG)

### 3. Font File (1 TTF file)
- Any TrueType font (.ttf) for agent names
- Example: Arial Bold, Roboto, Montserrat

### 4. CSV Data File
Format:
```csv
Client Cd,Agent Name,MDRT Title,Life Member,Honor Roll,Quarter Century
01853964,JIN ZHONGLING,TOT,LM,,
03194364,JIANG KERUO,TOT,,,
01564131,XIONG WINNIE J W,COT,LM,,
```

### 5. Agent Photos
- Name each photo by Client Code: `01853964.jpg`, `03194364.png`, etc.
- Supported formats: JPG, JPEG, PNG
- Any resolution (will be auto-resized)

## 🚀 Using the App

### Step 1: Upload Assets (2-3 minutes)
1. Upload 3 background images
2. Upload 3 badge images
3. Upload font file
4. Upload CSV data
5. Drag & drop all agent photos

### Step 2: Configure Positions (1 minute)
Adjust pixel coordinates:
- Agent photo position and size
- Name text position and font size
- Badge positions and spacing

💡 **Tip**: Open one background in an image editor to find exact pixel positions

### Step 3: Process (3-5 minutes for 18 agents)
Click "Start Processing" and wait. The app will:
- Remove backgrounds using AI
- Composite images
- Add badges and text
- Generate all certificates

### Step 4: Download
- Download all as ZIP
- Or download individually

## 🐛 Common Issues & Fixes

### Issue: "python: command not found"
**Fix:** Python not in PATH. Reinstall Python with "Add to PATH" checked.

### Issue: "npm: command not found"
**Fix:** Node.js not installed. Download from nodejs.org

### Issue: Backend shows "ModuleNotFoundError"
**Fix:**
```bash
cd backend
pip install --upgrade -r requirements.txt
```

### Issue: Frontend shows "npm ERR!"
**Fix:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Port 5000 already in use"
**Fix:** Kill the process using port 5000:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill -9
```

### Issue: "CORS policy error"
**Fix:** Ensure backend is running on port 5000 before starting frontend

### Issue: Background removal is very slow
**Fix (Optional GPU Acceleration):**
```bash
pip install rembg[gpu]
```
Requires NVIDIA GPU with CUDA drivers.

## 📊 Performance Expectations

| Operation | Time |
|-----------|------|
| First certificate | 10-15 sec |
| Subsequent certificates | 5-8 sec |
| 18 agents batch | 3-5 min |
| With GPU acceleration | 1-2 min |

## 🔄 Updates & Maintenance

### Update Backend:
```bash
cd backend
pip install --upgrade -r requirements.txt
```

### Update Frontend:
```bash
cd frontend
npm update
```

### Clear Cache:
```bash
# Backend
rm -rf backend/uploads backend/outputs

# Frontend
cd frontend
npm cache clean --force
```

## 🎓 Next Steps

1. ✅ Complete installation
2. ✅ Prepare your assets
3. ✅ Run the app
4. ✅ Upload files
5. ✅ Configure positions
6. ✅ Process certificates
7. ✅ Download results

## 📞 Getting Help

If you encounter issues:
1. Check this guide
2. Review terminal/console logs
3. Check browser DevTools (F12) → Console tab
4. Verify all prerequisites are installed

## 🎉 Success!

You're ready to generate certificates! Run the app and follow the 4-step wizard.

**Pro Tips:**
- Test with 1-2 agents first to verify positioning
- Keep background images consistent size (e.g., 800x1200px)
- Name agent photos exactly as Client Cd in CSV
- Save configuration after adjusting positions

---

**Happy Certificate Generating! 🏆**
