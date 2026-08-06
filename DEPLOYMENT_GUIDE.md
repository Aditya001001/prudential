# 🚀 Deployment Guide - MDRT Certificate Generator

## 🎯 **Recommended: Render.com (FREE)**

### **Why Render?**
- ✅ 100% FREE (no credit card needed)
- ✅ Easiest deployment process
- ✅ Supports Flask backend + React frontend
- ✅ Free PostgreSQL database included
- ✅ Auto-deploy from GitHub
- ✅ HTTPS/SSL included
- ✅ Custom domains supported

**Only limitation:** Backend sleeps after 15 min inactivity (wakes in ~30 sec)

---

## 📦 **Preparation (Already Done!)**

I've created these files for you:
1. ✅ `requirements.txt` - Python dependencies
2. ✅ `render.yaml` - Render deployment config
3. ✅ `.gitignore` - Files to exclude from git

---

## 🔧 **Step-by-Step Deployment:**

### **Step 1: Push to GitHub**

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - MDRT Certificate Generator"

# Create a new repository on GitHub (github.com)
# Then link and push:
git remote add origin https://github.com/YOUR_USERNAME/mdrt-generator.git
git branch -M main
git push -u origin main
```

---

### **Step 2: Sign Up for Render**

1. Go to https://render.com
2. Click **"Get Started for Free"**
3. Sign up with GitHub (recommended)
4. Authorize Render to access your repositories

---

### **Step 3: Deploy Backend (Flask)**

1. **Click "New +"** → **"Web Service"**
2. **Connect your GitHub repository**
3. **Configure:**
   - **Name:** `mdrt-backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn -w 1 -b 0.0.0.0:$PORT backend.app_with_db:app`
   - **Instance Type:** `Free`
4. **Add Environment Variables:**
   - Click **"Advanced"**
   - Add: `PYTHON_VERSION = 3.11`
5. **Click "Create Web Service"**
6. Wait for deployment (~5-10 minutes first time)
7. **Copy the URL** (e.g., `https://mdrt-backend.onrender.com`)

---

### **Step 4: Create Database**

1. **Click "New +"** → **"PostgreSQL"**
2. **Configure:**
   - **Name:** `mdrt-db`
   - **Instance Type:** `Free`
3. **Click "Create Database"**
4. Wait for creation (~2 minutes)
5. **Link to Backend:**
   - Go to your backend service
   - Click **"Environment"**
   - Add variable: `DATABASE_URL`
   - **Value:** Internal Database URL from the database page

---

### **Step 5: Deploy Frontend (React)**

1. **Update API URL in frontend:**
   - Edit `frontend/src/pages/AdminDashboard.js`
   - Change `const API_URL = 'http://localhost:5000/api'`
   - To: `const API_URL = 'https://mdrt-backend.onrender.com/api'`
   - Do the same for `UserPortal.js`
   - Commit and push changes

2. **Create Static Site:**
   - Click **"New +"** → **"Static Site"**
   - **Connect repository**
   - **Configure:**
     - **Name:** `mdrt-frontend`
     - **Build Command:** `cd frontend && npm install && npm run build`
     - **Publish Directory:** `frontend/build`
   - Click **"Create Static Site"**
   - Wait for build (~5-10 minutes)

3. **Get your URL** (e.g., `https://mdrt-frontend.onrender.com`)

---

### **Step 6: Upload Admin Assets**

1. Visit your frontend URL
2. Go to `/admin` route
3. Upload:
   - ✅ Background templates (COT, MDRT, TOT)
   - ✅ Badge images (LM, HR, QC)
   - ✅ CSV file with agent data

---

## 🎉 **Done! Your App is Live!**

**Access:**
- **User Portal:** `https://mdrt-frontend.onrender.com`
- **Admin Panel:** `https://mdrt-frontend.onrender.com/admin`
- **Backend API:** `https://mdrt-backend.onrender.com`

---

## 🔄 **Auto-Deploy Updates:**

Just push to GitHub:
```bash
git add .
git commit -m "Updated feature"
git push
```

Render will automatically rebuild and deploy! 🚀

---

## 💰 **Other Free Options:**

### **Railway.app** (Better performance)
- $5/month free credit
- No spin-down
- Similar setup to Render
- Sign up at https://railway.app

### **Vercel + Render** (Fastest frontend)
- Deploy frontend to Vercel (always-on)
- Deploy backend to Render (free)
- Sign up at https://vercel.com

### **Fly.io** (Good for Python)
- 3 free VMs
- No spin-down
- CLI-based deployment
- Sign up at https://fly.io

---

## ⚠️ **Important Notes:**

### **File Upload Limits:**
- Render free tier: 512 MB RAM
- Your high-res images may need optimization
- Consider using 1873×3334 resolution (not 5764×8560)

### **Spin-Down Behavior:**
- Backend sleeps after 15 min inactivity
- First request after sleep takes ~30 seconds to wake up
- Subsequent requests are fast
- Not ideal for public-facing apps, fine for internal tools

### **Upgrade Options:**
If you need:
- ✅ No spin-down: Upgrade to $7/month
- ✅ More RAM: Upgrade to $7-25/month
- ✅ Better performance: Consider Railway or Fly.io

---

## 🆘 **Troubleshooting:**

### **Backend won't start:**
- Check logs in Render dashboard
- Verify `requirements.txt` has all dependencies
- Make sure `gunicorn` is installed

### **Frontend can't connect to backend:**
- Check API_URL in frontend code
- Make sure CORS is enabled in Flask
- Verify backend URL is correct

### **Database connection failed:**
- Check DATABASE_URL environment variable
- Make sure PostgreSQL is running
- Verify connection string

---

## 📚 **Resources:**

- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs

---

**Ready to deploy? Start with Step 1!** 🚀
