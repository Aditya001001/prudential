# Client Code Upload System - Updated! ✅

## 🎉 What Changed?

The system now **accepts any photo filename** - users no longer need to rename their photos to match the client code!

---

## 📋 How It Works Now

### **User Workflow:**

1. **Enter Client Code** (Step 1)
   - User types their client code (e.g., `00020880`)
   - No need to rename the photo file!

2. **Upload Photo** (Step 2)
   - Upload photo with **ANY filename** (e.g., `photo.jpg`, `selfie.png`, `IMG_1234.jpg`)
   - Or capture directly from camera

3. **Generate Certificate** (Step 3)
   - System looks up the client code in the database
   - Generates certificate with correct name and tier

---

## 🔧 Backend Changes

### **Modified Endpoint: `/api/user/upload-photo`**

**Before:**
```python
# Extracted client code from filename
filename = secure_filename(file.filename)
client_code = os.path.splitext(filename)[0]  # "photo.jpg" → "photo" ❌
```

**After:**
```python
# Gets client code from form data (separate from filename)
client_code = request.form.get('client_code', '').strip()  # From user input ✅
```

### **New Endpoint: `/api/user/search-agent`**

Allows searching for agents by client code or name:

```bash
GET /api/user/search-agent?query=00020880
GET /api/user/search-agent?query=Catherine
```

Returns:
- Single result if exact client code match
- Multiple results if searching by name

---

## 📊 Available Client Codes in Database

Based on `backend/admin_assets/data.csv`:

| Client Code | Name | Tier | Badges |
|-------------|------|------|--------|
| **00020880** | KOO SAU FONG CATHERINE | MDRT | LM, HR |
| 00010120 | NG CHI LAP KINSON | COT | LM, QC |
| 00032027 | LEUNG WAI MING PATRIC | MDRT | LM, QC |
| 00716588 | NG HOI SZE ELSIE | MDRT | LM, QC |
| 00010073 | PAU TSUI MEE MICHELLE | MDRT | LM, QC |
| 01853964 | JIN ZHONGLING | TOT | LM |
| 03194364 | JIANG KERUO | TOT | - |
| 01722065 | LUO DONG YAN | TOT | LM, HR |
| ... | (17 agents total) | ... | ... |

---

## 🧪 Testing Instructions

### **Test 1: Generate Certificate for Catherine**

1. Open frontend: `http://localhost:3000`
2. Enter client code: `00020880`
3. Click "Next: Upload Photo"
4. Upload **any photo** (e.g., `test.jpg`, `photo.png`, etc.)
5. Click "Generate Certificate"
6. ✅ Should create certificate for "KOO SAU FONG CATHERINE" with MDRT tier

### **Test 2: Test with Different Agent**

1. Enter client code: `00010120`
2. Upload any photo
3. ✅ Should create certificate for "NG CHI LAP KINSON" with COT tier

### **Test 3: Invalid Client Code**

1. Enter client code: `99999999` (doesn't exist)
2. Upload photo
3. ❌ Should show error: "Client code '99999999' not found in database"

---

## 📂 File Upload Format

### **Form Data Structure:**

```javascript
const formData = new FormData();
formData.append('client_code', '00020880');     // ← Client code (from user input)
formData.append('photo', fileObject);            // ← Photo file (any filename!)
```

### **Accepted File Types:**
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- Any filename is OK!

---

## 🎨 Current Layout Settings

Photo size has been increased to make the person much bigger:

```python
FIXED_POSITIONS = {
    'agent_photo': {
        'x': 449, 
        'y': 550, 
        'max_width': 750,      # 83% of certificate width
        'max_height': 1250     # 78% of certificate height
    },
    'name_text': {
        'x': 449, 
        'y': 1485,             # Near bottom edge
        'font_size': 70,
        'glow_intensity': 18,
        'outline_width': 6
    },
    'badges': {
        'x': 65, 
        'y': 600,              # Middle-left area
        'spacing': 150,
        'size': 145
    }
}
```

---

## ✅ Summary

### **What Users See:**
1. Enter their client code
2. Upload photo with **any filename**
3. Get personalized certificate

### **What System Does:**
1. Receives client code from form input
2. Looks up agent in database by client code
3. Generates certificate with correct:
   - Agent name
   - MDRT tier (TOT/COT/MDRT)
   - Badges (LM, HR, QC)
   - Background image
   - Large photo (750×1250px)

---

## 🚀 Ready to Test!

Backend is running on: `http://localhost:5000`
Frontend is running on: `http://localhost:3000`

**Try it now:**
- Client Code: `00020880`
- Upload: Any photo file (e.g., `00020880.jpeg` from project root)
- Result: Certificate for Catherine with MDRT tier and larger person size! 🎉
