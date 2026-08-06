# 🔧 Upload Troubleshooting Guide

## 🐛 **Common Upload Failure Causes:**

### **1. CORS Errors**
**Symptoms:**
```
Access-Control-Allow-Origin header is not present
CORS policy blocked
```

**Check:**
- Open browser console (F12)
- Look for red CORS errors

**Fix:**
- Backend should have CORS configured (already done)
- If still failing, backend needs redeploy

---

### **2. 404 Errors - Endpoint Not Found**
**Symptoms:**
```
POST /api/admin/upload-backgrounds 404 (Not Found)
```

**Possible Causes:**
- Backend is still starting up (cold start after sleep)
- Route not registered
- Backend crashed on startup

**Fix:**
- Wait 30-60 seconds for backend to wake up
- Check Render backend logs for errors

---

### **3. 500 Errors - Server Error**
**Symptoms:**
```
POST /api/admin/upload-backgrounds 500 (Internal Server Error)
```

**Possible Causes:**
- File permissions error
- Path doesn't exist
- Database connection error

**Fix:**
- Check Render logs for Python traceback
- Verify folders are created on startup

---

### **4. 413 Errors - File Too Large**
**Symptoms:**
```
413 Payload Too Large
```

**Fix:**
- Backend is configured for 50MB max
- Reduce image file sizes

---

## 🔍 **Diagnostic Steps:**

### **Step 1: Check Browser Console**

1. Open browser (Chrome/Edge)
2. Press **F12** to open DevTools
3. Click **Console** tab
4. Try uploading
5. Look for error messages

**Common errors:**
- Red text with "CORS"
- "404 Not Found"
- "500 Internal Server Error"
- "Failed to fetch"

---

### **Step 2: Check Network Tab**

1. Open DevTools (F12)
2. Click **Network** tab
3. Try uploading
4. Click the failed request (in red)
5. Check:
   - **Request URL** - Should be `https://prudential-certificate.onrender.com/api/admin/upload-backgrounds`
   - **Status Code** - 200 = success, 404 = not found, 500 = server error
   - **Response** - Shows error message

---

### **Step 3: Check Render Backend Logs**

1. Go to: https://render.com/dashboard
2. Click **backend service** (`prudential-certificate`)
3. Click **"Logs"** tab
4. Try uploading again
5. Watch for new log entries

**Look for:**
- `[STARTUP]` messages showing paths
- Python errors/tracebacks
- `[PREVIEW]` messages when checking files
- Any red error text

---

### **Step 4: Test Backend Health**

Visit: https://prudential-certificate.onrender.com

**Should see:**
- A JSON response, OR
- "Not Found" (but NOT a loading error)

**If you see:**
- "Application failed to respond" → Backend is down
- "This site can't be reached" → Service offline
- Takes 30+ seconds to load → Cold start (first request after sleep)

---

## ✅ **Quick Fixes:**

### **Fix 1: Wait for Cold Start**
If backend hasn't been used in 15+ minutes:
- First request takes 30-60 seconds
- Just wait and try again

### **Fix 2: Hard Refresh Frontend**
1. Press **Ctrl+Shift+R** (hard refresh)
2. Clear browser cache
3. Try upload again

### **Fix 3: Re-upload After Redeploy**
If backend was redeployed:
1. All previous uploads are lost (ephemeral storage)
2. Upload backgrounds and badges again
3. Upload CSV again

### **Fix 4: Check Backend is Running**
1. Render Dashboard → Backend Service
2. Status should show: 🟢 **Live**
3. If not, click **"Manual Deploy"**

---

## 🆘 **Specific Error Solutions:**

### **"Mixed Content" Warning**
**Error:** `Mixed Content: The page was loaded over HTTPS, but requested an insecure element`

**Solution:** Already fixed in code, frontend needs redeploy

---

### **"Failed to fetch"**
**Error:** `TypeError: Failed to fetch`

**Possible causes:**
- Network connection lost
- Backend is offline
- CORS blocking

**Solution:**
1. Check internet connection
2. Verify backend is running
3. Check browser console for CORS errors

---

### **"NetworkError"**
**Error:** `NetworkError when attempting to fetch resource`

**Solution:**
- Backend is likely offline or crashed
- Check Render logs for errors
- Redeploy backend if needed

---

## 📋 **Checklist for Upload Issues:**

- [ ] Backend status is 🟢 **Live** on Render
- [ ] Frontend can access backend (no CORS errors)
- [ ] Waited 60 seconds if backend was asleep
- [ ] Browser console shows specific error
- [ ] Checked Render backend logs
- [ ] Files are < 50MB each
- [ ] Using supported formats (PNG, JPG)

---

## 💡 **Most Common Issue:**

**Ephemeral Storage + Redeployment:**

Every time the backend redeploys:
1. ✅ Code updates successfully
2. ❌ All uploaded files are deleted
3. ⚠️ You need to re-upload everything

**Solution:**
After **every** backend deploy, re-upload:
- All 3 backgrounds (MDRT, COT, TOT)
- All 3 badges (LM, HR, QC)
- CSV file

---

## 🔧 **What to Share for Help:**

If upload is still failing, share:

1. **Browser console errors** (screenshot or copy text)
2. **Network tab request details** (status code, response)
3. **Render backend logs** (last 20 lines)
4. **What you're trying to upload** (which files)

This helps diagnose the exact issue!

---

## 🎯 **Expected Successful Upload:**

**Browser Console:**
```
(No errors)
```

**Network Tab:**
```
POST /api/admin/upload-backgrounds
Status: 200 OK
Response: {"success": true, "uploaded": {...}}
```

**Render Logs:**
```
[STARTUP] BASE_DIR: /opt/render/project/src/backend
[STARTUP] ADMIN_ASSETS_FOLDER: /opt/render/project/src/backend/admin_assets
```

**Frontend:**
```
✓ MDRT.png uploaded
✓ Preview showing image
```

---

**Start with Step 1 (Browser Console) and share what errors you see!** 🔍
