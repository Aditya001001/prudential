# Quick Start - Dual Architecture

## 🚀 **Start the Application**

```bash
cd backend
python app.py
```

**You'll see:**
```
====================================================
MDRT Certificate Generator - Dual Architecture
====================================================
Admin Dashboard: http://localhost:5000/admin
User Portal:     http://localhost:5000/
====================================================
 * Running on http://127.0.0.1:5000
```

---

## 👨‍💼 **Admin Setup (One-Time)**

### **1. Open Admin Dashboard**
Navigate to: **http://localhost:5000/admin**

### **2. Upload Backgrounds**
- Click file inputs for MDRT, COT, TOT
- Select corresponding background images
- Click "Upload Backgrounds"
- ✓ All three should show green checkmarks

### **3. Upload Badges**
- Click file inputs for LM, HR, QC
- Select corresponding badge images
- Click "Upload Badges"
- ✓ All three should show green checkmarks

### **4. Upload Master CSV**
- Click CSV file input
- Select your `data.csv` file (must have `Client Cd`, `Agent Name`, `MDRT Title` columns)
- Click "Upload CSV"
- ✓ Should show agent count and preview

### **5. Verify System Status**
Check the "System Status" cards at the top:
- Backgrounds: ✓ ✓ ✓
- Badges: ✓ ✓ ✓
- Master CSV: ✓ (X agents)

**Done! System is ready for users.**

---

## 👤 **User Usage**

### **1. Open User Portal**
Navigate to: **http://localhost:5000/**

### **2. Prepare Photo**
Rename your photo to match your client code:
- Example: `00020880.jpg` (must include leading zeros)
- Client code must exist in the CSV uploaded by admin

### **3. Upload Photo**
- Drag & drop your photo onto the upload zone
- OR click the zone to browse and select

### **4. Wait for Generation**
- System removes background (~5-10 seconds)
- Applies neon text effects
- Adds badges automatically

### **5. View & Download**
- See your agent information
- Click "Preview Certificate" to see full-size
- Click "Download Certificate" to save
- Click "Generate Another" for more

---

## 🔄 **Navigation**

Use the **floating navigation** in the top-right corner:
- **User Portal** (home icon) - For agents
- **Admin Dashboard** (shield icon) - For administrators

---

## ⚠️ **Important Notes**

### **CSV Format:**
```csv
Client Cd,Agent Name,MDRT Title,Life Member,Honor Roll,Quarter Century
00020880,KOO SAU FONG CATHERINE,TOT,LM,HR,QC
01853964,JIN ZHONGLING,TOT,LM,,
```

- `Client Cd` **must have leading zeros**
- Badge columns can be empty

### **Photo Naming:**
- ✅ `00020880.jpg` - Correct (matches CSV)
- ❌ `20880.jpg` - Wrong (missing leading zeros)
- ❌ `photo.jpg` - Wrong (not a client code)

---

## 🎯 **Workflow**

```
Admin (Once):
Upload backgrounds → Upload badges → Upload CSV → ✓ Ready

User (Anytime):
Name photo with client code → Upload → Generate → Download
```

---

## 🔧 **Troubleshooting**

### **"System Not Ready" message:**
→ Admin must upload all assets first

### **"Client code not found in database":**
→ Check photo filename matches CSV exactly (including leading zeros)

### **Upload fails:**
→ Check file format (PNG/JPG for images, CSV for data)

### **No preview showing:**
→ Refresh browser page (Ctrl + Shift + R)

---

**Quick Commands:**
```bash
# Start backend
cd backend
python app.py

# Access interfaces
# Admin:  http://localhost:5000/admin
# User:   http://localhost:5000/
```

---

**Admin uploads once → Users generate forever!** ✨
