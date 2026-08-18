# 🚀 Deployment Guide: Client Code Lookup Fix

## 📋 What Changed

**Fixed Issue:** Client code is now sourced from user input (database lookup), not from uploaded photo filename.

**Files Modified:**
- ✅ `backend/app_with_db.py` (Lines 435-456)

**Files Created:**
- ✅ `FIX_CLIENT_CODE_LOOKUP.md` - Complete documentation
- ✅ `DEPLOY_CLIENT_CODE_FIX.md` - This deployment guide

---

## 🎯 Impact

### What Works Now ✅
- Users can upload photos with **any filename** (e.g., `selfie.jpg`, `IMG_1234.jpg`, `photo.png`)
- Client code entered in Step 1 is used for database lookup
- More reliable and user-friendly

### What Changed ❌
- Photo filename is no longer used for client code extraction
- Old behavior: `00020880.jpg` → extract `00020880` → lookup in DB
- New behavior: User enters `00020880` in Step 1 → lookup in DB directly

---

## 🚀 Deployment Steps

### Step 1: Verify Current State

```bash
# SSH to VM
ssh aditya.developer@34.21.174.189

# Navigate to project
cd /home/aditya.developer/prudential

# Check if backend is running
ss -tlnp | grep 5001
```

### Step 2: Backup Current Backend (Optional but Recommended)

```bash
cd /home/aditya.developer/prudential/backend

# Backup current version
cp app_with_db.py app_with_db.py.backup_before_client_code_fix
```

### Step 3: Verify Changes

```bash
# View the changes
cd /home/aditya.developer/prudential/backend

# Check the modified function (should show new logic)
grep -A 15 "Get client code from form data" app_with_db.py
```

**Expected output:**
```python
# Get client code from form data (PRIMARY SOURCE)
client_code = request.form.get('client_code', '').strip()

# If not provided in form, fall back to filename (for backward compatibility)
if not client_code:
    filename = secure_filename(file.filename)
    client_code = os.path.splitext(filename)[0]
```

### Step 4: Restart Backend Service

```bash
cd /home/aditya.developer/prudential/backend

# Find and stop current backend process
ps aux | grep app_with_db.py
kill <PID>

# Start updated backend
nohup ../venv/bin/python app_with_db.py > backend.log 2>&1 &

# Verify it started
ss -tlnp | grep 5001
```

### Step 5: Test the Fix

```bash
# Test 1: Health check
curl http://localhost:5001/api/health

# Expected: {"status": "ok", "message": "Backend is running"}
```

```bash
# Test 2: Check agents in database
cd /home/aditya.developer/prudential/backend
../venv/bin/python init_db.py stats

# Expected: Shows count of agents
```

### Step 6: Manual User Flow Test

1. **Open browser:** http://34.21.174.189/prudential/

2. **Step 1 - Enter Client Code:**
   - Find a valid client code from database stats (e.g., `00020880`)
   - Enter it in the input field
   - Click "Next: Upload Photo →"

3. **Step 2 - Upload Photo:**
   - Upload **any photo** with **any filename** (don't rename it!)
   - Example: `my_photo.jpg`, `selfie.png`, `IMG_5678.jpg`

4. **Expected Result:**
   - ✅ Certificate generates successfully
   - ✅ Shows agent name and tier
   - ✅ Download link appears

5. **If Error Occurs:**
   - Check backend logs: `tail -f backend/backend.log`
   - Error message should be clear: "Client code 'XXXXX' not found in database"

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Backend service is running on port 5001
- [ ] `/api/health` endpoint returns success
- [ ] User Portal is accessible at http://34.21.174.189/prudential/
- [ ] User can enter a valid client code
- [ ] User can upload a photo with **any filename**
- [ ] Certificate generates successfully
- [ ] No errors in backend logs
- [ ] Downloaded certificate has correct agent name and tier

---

## 🐛 Troubleshooting

### Issue: Backend won't start

```bash
# Check logs
tail -f /home/aditya.developer/prudential/backend/backend.log

# Common issues:
# - Port 5001 in use: kill the process
# - Import error: check if datetime is imported
# - Database error: check if mdrt_certificates.db exists
```

### Issue: "Module 'datetime' not found"

The `datetime` module should already be imported at the top of `app_with_db.py`:

```python
from datetime import datetime
```

If not, add it to the imports section.

### Issue: Certificate still not generating

```bash
# Check if client code exists in database
cd /home/aditya.developer/prudential/backend
../venv/bin/python -c "
from database import db, Agent
from app_with_db import app
with app.app_context():
    agent = Agent.query.filter_by(client_code='00020880').first()
    if agent:
        print(f'Found: {agent.agent_name}')
    else:
        print('Not found')
"
```

### Issue: "Client code 'XXXXX' not found"

This is **expected behavior** if:
- Client code doesn't exist in database
- User entered wrong client code
- Leading zeros are missing (e.g., entered `20880` instead of `00020880`)

**Solution:** Verify client code in database and ensure user enters it correctly.

---

## 📊 Testing Matrix

| Test Case | Client Code | Photo Filename | Expected Result |
|-----------|-------------|----------------|-----------------|
| ✅ Valid code, any photo | `00020880` | `selfie.jpg` | Success |
| ✅ Valid code, IMG file | `00020880` | `IMG_1234.jpg` | Success |
| ✅ Valid code, PNG | `00020880` | `my_photo.png` | Success |
| ❌ Invalid code | `99999999` | `photo.jpg` | Error: "not found" |
| ❌ Empty code (bypassed) | `` | `00020880.jpg` | Falls back to filename → Success (backward compat) |
| ✅ Leading zeros | `00010120` | `any_name.jpg` | Success |

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong, you can rollback:

```bash
cd /home/aditya.developer/prudential/backend

# Stop current backend
ps aux | grep app_with_db.py
kill <PID>

# Restore backup
cp app_with_db.py.backup_before_client_code_fix app_with_db.py

# Restart backend
nohup ../venv/bin/python app_with_db.py > backend.log 2>&1 &
```

---

## 📝 Post-Deployment Notes

1. **No Frontend Changes:** The frontend was already sending `client_code` correctly. Only backend was updated.

2. **Backward Compatible:** If `client_code` is not provided in form data, system falls back to extracting from filename.

3. **Database Remains Unchanged:** No schema changes, no data migration needed.

4. **User Impact:** Immediate improvement in user experience - no need to rename photos.

---

## 📞 Support

**If issues arise:**
1. Check backend logs: `tail -f backend/backend.log`
2. Review fix documentation: `FIX_CLIENT_CODE_LOOKUP.md`
3. Check database stats: `../venv/bin/python init_db.py stats`
4. Test API health: `curl http://localhost:5001/api/health`

---

## ✅ Deployment Complete!

Once all checklist items are verified, the fix is successfully deployed.

**Status:** Ready for production use 🚀

**Next Steps:**
- Monitor logs for the first few user requests
- Verify certificates are being generated correctly
- Update any user documentation if needed

---

**Deployed on:** [Date will be filled when you deploy]  
**Deployed by:** [Your name]  
**Backend Version:** Using `app_with_db.py` with client code form data lookup
