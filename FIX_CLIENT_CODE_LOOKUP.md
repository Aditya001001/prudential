# ✅ Fix: Client Code Lookup from Database (Not Filename)

## 🎯 Issue Fixed

**Before:** The system extracted the client code from the uploaded photo filename, requiring users to name their files exactly as their client code (e.g., `00020880.jpg`).

**After:** The system now uses the client code entered by the user in Step 1, matching it against the database. The photo filename can be anything.

---

## 🔧 Changes Made

### Backend: `backend/app_with_db.py`

**Modified function:** `user_upload_photo()` (Line ~427)

#### Old Logic:
```python
# Extract client code from filename
filename = secure_filename(file.filename)
client_code = os.path.splitext(filename)[0]  # ❌ Assumes filename = client code

# Find agent in database
agent = get_agent_by_client_code(client_code)
```

#### New Logic:
```python
# Get client code from form data (PRIMARY SOURCE)
client_code = request.form.get('client_code', '').strip()

# If not provided in form, fall back to filename (for backward compatibility)
if not client_code:
    filename = secure_filename(file.filename)
    client_code = os.path.splitext(filename)[0]

# Find agent in database
agent = get_agent_by_client_code(client_code)
```

#### Updated File Saving:
```python
# Save uploaded photo temporarily with a unique filename
original_filename = secure_filename(file.filename)
file_extension = os.path.splitext(original_filename)[1]
temp_filename = f"{client_code}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{file_extension}"
temp_photo_path = os.path.join(USER_UPLOADS_FOLDER, temp_filename)
file.save(temp_photo_path)
```

---

## 🎯 How It Works Now

### User Journey:

1. **Step 1: Enter Client Code**
   - User enters: `00020880`
   - System validates input (non-empty)
   - Proceeds to Step 2

2. **Step 2: Upload Photo**
   - User uploads photo with ANY filename (e.g., `selfie.jpg`, `my_photo.png`, `IMG_1234.jpg`)
   - Photo filename doesn't matter anymore ✅

3. **Step 3: Backend Processing**
   - Backend receives:
     - `client_code` = `"00020880"` (from form data)
     - `photo` = file with any name
   - Backend looks up agent in database using `client_code`
   - If found → generates certificate
   - If not found → returns error: "Client code '00020880' not found in database"

4. **Temporary File Storage**
   - Uploaded photo saved as: `00020880_20260807_143052.jpg`
   - Format: `{client_code}_{timestamp}{extension}`
   - File deleted after certificate generation

---

## ✅ Benefits

### 1. **User-Friendly**
- ❌ Before: "Please rename your file to 00020880.jpg"
- ✅ After: "Upload any photo, just enter your client code"

### 2. **Prevents Errors**
- ❌ Before: User uploads `20880.jpg` → System looks for agent `20880` → Not found (missing leading zeros)
- ✅ After: User enters `00020880` → System finds agent → Success

### 3. **Database-Driven**
- Client codes are the source of truth (stored in database)
- No dependency on filename conventions
- Easy to validate against database

### 4. **Backward Compatible**
- If `client_code` is not provided in form data, falls back to filename extraction
- Ensures old integrations still work

---

## 📝 Frontend (No Changes Needed)

The frontend (`UserPortal.js`) was already sending the client code correctly:

```javascript
const formData = new FormData();
formData.append('client_code', clientCode.trim());  // ✅ Already sending this!
formData.append('photo', selectedFile);
```

The backend just wasn't using it before. Now it does! ✅

---

## 🧪 Testing

### Test Case 1: Valid Client Code + Any Photo
```bash
# User input:
Client Code: 00020880
Photo: my_selfie.jpg

# Expected result:
✅ Agent found in database
✅ Certificate generated: 00020880_KOO_SAU_FONG_CATHERINE_TOT.png
✅ Success message displayed
```

### Test Case 2: Invalid Client Code
```bash
# User input:
Client Code: 99999999
Photo: photo.jpg

# Expected result:
❌ Error: "Client code '99999999' not found in database"
```

### Test Case 3: Client Code with Leading Zeros
```bash
# User input:
Client Code: 00010120
Photo: IMG_5678.jpg

# Expected result:
✅ Agent found (leading zeros preserved in database)
✅ Certificate generated successfully
```

### Test Case 4: Empty Client Code (Edge Case)
```bash
# User input:
Client Code: (empty)
Photo: photo.jpg

# Expected result:
❌ Frontend prevents submission (validation in Step 1)
❌ If bypassed, backend falls back to filename extraction
```

---

## 🔍 Database Lookup Process

```python
# In db_services.py
def get_agent_by_client_code(client_code):
    """Get agent by client code"""
    return Agent.query.filter_by(client_code=client_code).first()

# SQL equivalent:
# SELECT * FROM agents WHERE client_code = '00020880' LIMIT 1;
```

**Database Schema:**
```sql
CREATE TABLE agents (
    id INTEGER PRIMARY KEY,
    client_code VARCHAR(20) UNIQUE NOT NULL,  -- String type preserves leading zeros
    agent_name VARCHAR(200),
    mdrt_tier VARCHAR(10),
    ...
);
```

---

## ⚠️ Important Notes

1. **Client Code is String Type**
   - Stored as `VARCHAR(20)` in database
   - Preserves leading zeros (e.g., `00020880` not `20880`)
   - Case-sensitive comparison

2. **Trimming Whitespace**
   - Backend trims whitespace: `client_code.strip()`
   - Prevents errors from accidental spaces

3. **File Extension Handling**
   - Accepts: `.jpg`, `.jpeg`, `.png`
   - Validated by `allowed_file()` function
   - Extension preserved in temp filename

4. **Temp File Cleanup**
   - Uploaded photo deleted after certificate generation
   - Only final certificate is kept in `user_outputs/`

---

## 🚀 Deployment

**No frontend changes needed!** Only backend changes.

### Apply the Fix:

1. **Restart Backend Service:**
   ```bash
   cd /home/aditya.developer/prudential/backend
   
   # Stop current backend
   ps aux | grep app_with_db.py
   kill <PID>
   
   # Start updated backend
   nohup ../venv/bin/python app_with_db.py > backend.log 2>&1 &
   ```

2. **Verify Fix:**
   ```bash
   # Check backend is running
   ss -tlnp | grep 5001
   
   # Test API
   curl http://localhost:5001/api/health
   ```

3. **Test User Flow:**
   - Go to http://34.21.174.189/prudential/
   - Enter a valid client code
   - Upload a photo with ANY filename
   - Verify certificate generates successfully

---

## 📊 Impact Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Photo Filename** | Must match client code exactly | Can be anything |
| **User Experience** | Confusing, error-prone | Simple and intuitive |
| **Data Source** | Filename (unreliable) | Database (reliable) |
| **Error Rate** | High (typos, missing zeros) | Low (validated against DB) |
| **Backward Compat** | N/A | Falls back to filename if needed |

---

## ✅ Summary

**The fix ensures:**
- ✅ Client code comes from user input (Step 1), not filename
- ✅ Database lookup uses the correct client code
- ✅ Users can upload photos with any filename
- ✅ Leading zeros are preserved
- ✅ Backward compatible with old behavior
- ✅ No frontend changes required

**Status:** Ready for deployment 🚀
