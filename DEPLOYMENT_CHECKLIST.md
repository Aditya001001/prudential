# 📋 Deployment Checklist - Render.com

## ✅ **Pre-Deployment (DONE!)**

- [x] Code pushed to GitHub
- [x] Repository: https://github.com/Aditya001001/prudential.git
- [x] `.gitignore` configured
- [x] `requirements.txt` ready
- [x] `render.yaml` configured

---

## 🚀 **Deployment Steps:**

### **Step 1: Sign Up for Render** ⏱️ 2 minutes

1. Go to https://render.com
2. Click **"Get Started for Free"**
3. Sign up with GitHub
4. Authorize Render to access your repositories

**Status:** [ ] Done

---

### **Step 2: Deploy Backend** ⏱️ 10 minutes

1. **Click "New +"** → **"Web Service"**

2. **Connect Repository:**
   - Find: `Aditya001001/prudential`
   - Click **"Connect"**

3. **Configure Service:**
   ```
   Name: prudential-backend
   Runtime: Python 3
   Region: Singapore (or closest to you)
   Branch: main
   Root Directory: (leave empty)
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn -w 1 -b 0.0.0.0:$PORT backend.app_with_db:app
   ```

4. **Plan:**
   - Instance Type: **Free**

5. **Advanced Settings:**
   - Add Environment Variable:
     - Key: `PYTHON_VERSION`
     - Value: `3.11`

6. **Click "Create Web Service"**

7. **Wait for deployment** (~5-10 minutes)
   - Watch the logs
   - Should see: "Your service is live 🎉"

8. **Copy your backend URL:**
   - Example: `https://prudential-backend.onrender.com`

**Status:** [ ] Done  
**Backend URL:** _________________

---

### **Step 3: Create Database** ⏱️ 3 minutes

1. **Click "New +"** → **"PostgreSQL"**

2. **Configure:**
   ```
   Name: prudential-db
   Region: Same as backend (Singapore)
   Database: prudential_db
   User: prudential_user
   ```

3. **Plan:**
   - Instance Type: **Free**

4. **Click "Create Database"**

5. **Wait for creation** (~2 minutes)

6. **Get Connection String:**
   - Click on database name
   - Copy **"Internal Database URL"**
   - Example: `postgresql://user:pass@host/db`

7. **Link to Backend:**
   - Go to backend service
   - Click **"Environment"** in left menu
   - Click **"Add Environment Variable"**
   - Key: `DATABASE_URL`
   - Value: Paste the Internal Database URL
   - Click **"Save Changes"**
   - Backend will auto-redeploy

**Status:** [ ] Done

---

### **Step 4: Deploy Frontend** ⏱️ 10 minutes

1. **IMPORTANT: Update API URL First**

   Before deploying, update your local code:
   
   Edit `frontend/src/pages/AdminDashboard.js`:
   ```javascript
   // Change line ~8
   const API_URL = 'https://prudential-backend.onrender.com/api'
   ```
   
   Edit `frontend/src/pages/UserPortal.js`:
   ```javascript
   // Change line ~8
   const API_URL = 'https://prudential-backend.onrender.com/api'
   ```
   
   **Push changes:**
   ```bash
   git add .
   git commit -m "Update API URL for production"
   git push
   ```

2. **Create Static Site:**
   - Click **"New +"** → **"Static Site"**

3. **Connect Repository:**
   - Select: `Aditya001001/prudential`
   - Click **"Connect"**

4. **Configure:**
   ```
   Name: prudential-frontend
   Branch: main
   Root Directory: (leave empty)
   Build Command: cd frontend && npm install && npm run build
   Publish Directory: frontend/build
   ```

5. **Click "Create Static Site"**

6. **Wait for build** (~5-10 minutes)
   - Watch the build logs
   - Should see: "Your site is live 🎉"

7. **Copy your frontend URL:**
   - Example: `https://prudential-frontend.onrender.com`

**Status:** [ ] Done  
**Frontend URL:** _________________

---

### **Step 5: Upload Admin Assets** ⏱️ 5 minutes

1. **Visit your admin panel:**
   - URL: `https://prudential-frontend.onrender.com/admin`

2. **Upload Backgrounds:**
   - COT.png
   - MDRT.png
   - TOT.png

3. **Upload Badges:**
   - LM_02.png → rename to LM.png
   - HR_01.png → rename to HR.png
   - QC_01.png → rename to QC.png

4. **Upload CSV:**
   - Your agent data CSV file
   - Should have columns: Client Cd, Agent Name, MDRT Title, Life Member, Honor Roll, Quarter Century

**Status:** [ ] Done

---

### **Step 6: Test the Application** ⏱️ 5 minutes

1. **Test User Portal:**
   - Visit: `https://prudential-frontend.onrender.com`
   - Enter a test client code
   - Upload a test photo
   - Generate certificate
   - Download and verify

2. **Check Certificate:**
   - Should be 1873×3334 pixels
   - All elements properly positioned
   - No white borders
   - Badges visible

3. **Test Admin Panel:**
   - Visit: `/admin`
   - Check that all assets are uploaded
   - Verify agent count

**Status:** [ ] Done

---

## 🎉 **Deployment Complete!**

### **Your Live URLs:**

- **User Portal:** `https://prudential-frontend.onrender.com`
- **Admin Panel:** `https://prudential-frontend.onrender.com/admin`
- **Backend API:** `https://prudential-backend.onrender.com`

---

## ⚠️ **Important Notes:**

### **Free Tier Limitations:**
- Backend **sleeps after 15 min** of inactivity
- **First request** after sleep takes ~30 seconds to wake up
- Subsequent requests are fast
- This is normal for free tier

### **If You Need Always-On:**
- Upgrade to $7/month (no sleep)
- Or use Railway.app ($5/month credit)

---

## 🆘 **Troubleshooting:**

### **Backend won't start:**
- Check logs in Render dashboard
- Verify `requirements.txt` is correct
- Make sure Python version is 3.11

### **Frontend can't connect:**
- Verify API_URL in frontend code
- Check CORS settings in backend
- Make sure backend is running

### **Database connection failed:**
- Check DATABASE_URL environment variable
- Verify database is created and running
- Check connection string format

---

## 📝 **Post-Deployment:**

### **Share URLs:**
- Send user portal URL to your team
- Keep admin panel URL private

### **Future Updates:**
```bash
# Make changes locally
git add .
git commit -m "Description"
git push

# Render auto-deploys!
```

---

**Congratulations! Your MDRT Certificate Generator is now LIVE!** 🎉🚀
