# MDRT Certificate Generator - Dual Architecture Guide

## 🎯 **Overview**

The MDRT Certificate Generator has been completely refactored into a **dual-role architecture**:

1. **Admin Dashboard** (`/admin`) - Master asset management
2. **User Portal** (`/`) - Self-service certificate generation

---

## 🏗️ **Architecture**

### **Folder Structure:**

```
backend/
├── admin_assets/           # Persistent admin storage
│   ├── backgrounds/        # MDRT, COT, TOT backgrounds
│   ├── badges/            # LM, HR, QC badges
│   └── data.csv           # Master agent database
├── user_uploads/          # Temporary user photos
└── user_outputs/          # Generated certificates

frontend/
├── src/
│   ├── pages/
│   │   ├── AdminDashboard.js    # Admin interface
│   │   ├── AdminDashboard.css
│   │   ├── UserPortal.js        # User interface
│   │   └── UserPortal.css
│   └── App.js             # Routing logic
```

---

## 👨‍💼 **Admin Dashboard** (`/admin`)

### **Purpose:**
Manage master assets that persist across all user sessions.

### **Features:**

#### **1. System Status Overview**
- Real-time status of all uploaded assets
- Visual indicators (✓ / ✗) for each asset
- Agent count from CSV

#### **2. Tier Backgrounds Upload**
- Upload 3 background images:
  - **MDRT** (Blue theme)
  - **COT** (Red theme)
  - **TOT** (Gold theme)
- Preview currently uploaded backgrounds
- Persists to `admin_assets/backgrounds/`

#### **3. Achievement Badges Upload**
- Upload 3 badge images:
  - **LM** (Life Member)
  - **HR** (Honor Roll)
  - **QC** (Quarter Century)
- Preview currently uploaded badges
- Persists to `admin_assets/badges/`

#### **4. Master CSV Upload**
- Upload master agent database
- Must contain columns:
  - `Client Cd` (with leading zeros, e.g., `00020880`)
  - `Agent Name`
  - `MDRT Title` (MDRT, COT, TOT)
  - `Life Member`, `Honor Roll`, `Quarter Century` (optional badges)
- Preview first 10 agents after upload
- Shows total agent count
- Persists to `admin_assets/data.csv`

### **Workflow:**
1. Navigate to `http://localhost:5000/admin`
2. Upload all three tier backgrounds
3. Upload all three badges
4. Upload master CSV file
5. System is now ready for users

---

## 👤 **User Portal** (`/`)

### **Purpose:**
Self-service certificate generation for agents.

### **Features:**

#### **1. System Ready Check**
- Automatically verifies all admin assets are uploaded
- Shows "System Not Ready" if missing assets
- Prevents usage until admin completes setup

#### **2. Simple Photo Upload**
- **Single upload zone** - drag & drop or click
- **Filename matching:** User must name photo as `ClientCode.jpg`
  - Example: `00020880.jpg` for client code `00020880`
- Automatic client code extraction from filename

#### **3. Auto-Match & Validation**
- Searches master CSV for client code
- Returns error if client code not found
- Shows clear error: *"Client code '00020880' not found in database"*

#### **4. Automatic Generation**
- Removes background using `rembg`
- Applies fixed positioning (494x740px)
- Adds neon text glow (tier-based colors):
  - TOT → Gold glow
  - COT → Red glow
  - MDRT → Blue glow
- Adds appropriate badges from CSV
- Uses admin's uploaded backgrounds

#### **5. Result Display**
- Shows agent information:
  - Name
  - Client Code
  - MDRT Tier
  - Badges earned
- Action buttons:
  - **Preview Certificate** - Full-size modal
  - **Download Certificate** - Direct download
  - **Generate Another** - Upload new photo

### **Workflow:**
1. Navigate to `http://localhost:5000/`
2. Name photo file with client code (e.g., `00020880.jpg`)
3. Drag & drop photo or click to browse
4. Wait for automatic generation (~5-10 seconds)
5. Preview and download certificate
6. Optional: Generate another

---

## 🔧 **Technical Details**

### **Backend API Endpoints:**

#### **Admin Endpoints:**
- `GET  /api/admin/status` - Get asset status
- `POST /api/admin/upload-backgrounds` - Upload backgrounds
- `POST /api/admin/upload-badges` - Upload badges
- `POST /api/admin/upload-csv` - Upload master CSV
- `GET  /api/admin/preview-asset/<type>/<filename>` - Preview assets

#### **User Endpoints:**
- `GET  /api/user/check-system` - Check if system is ready
- `POST /api/user/upload-photo` - Upload photo & generate
- `GET  /api/user/preview/<filename>` - Preview certificate
- `GET  /api/user/download/<filename>` - Download certificate

### **Frontend Routes:**
- `/` - User Portal
- `/admin` - Admin Dashboard

### **Navigation:**
Fixed navigation bar in top-right corner:
- **User Portal** (home icon)
- **Admin Dashboard** (shield icon)

---

## 🚀 **Getting Started**

### **Step 1: Start Backend**
```bash
cd backend
python app.py
```

**Output:**
```
====================================================
MDRT Certificate Generator - Dual Architecture
====================================================
Admin Dashboard: http://localhost:5000/admin
User Portal:     http://localhost:5000/
====================================================
```

### **Step 2: Access Admin Dashboard**
1. Go to `http://localhost:5000/admin`
2. Upload all backgrounds (MDRT, COT, TOT)
3. Upload all badges (LM, HR, QC)
4. Upload master CSV file
5. Verify all status indicators show ✓

### **Step 3: Users Can Now Generate Certificates**
1. Users go to `http://localhost:5000/`
2. Name photo with client code
3. Upload photo
4. Download certificate

---

## ✅ **Key Features**

### **Admin Benefits:**
✅ Centralized asset management
✅ Persistent storage (survives restarts)
✅ Preview all uploaded assets
✅ CSV preview with agent count
✅ One-time setup, reusable for all users

### **User Benefits:**
✅ Simple one-step process
✅ Automatic client code matching
✅ No manual data entry
✅ Instant certificate generation
✅ Preview before download
✅ Clear error messages

### **System Benefits:**
✅ Separation of concerns
✅ Admin-controlled data
✅ Automatic validation
✅ Persistent master assets
✅ Temporary user uploads (auto-cleanup)
✅ Fixed positioning (494x740px)
✅ Neon text effects preserved
✅ Background removal with `rembg`

---

## 📋 **Requirements**

### **Admin Must Upload:**
- ✅ 3 tier backgrounds (MDRT, COT, TOT)
- ✅ 3 badges (LM, HR, QC)
- ✅ 1 master CSV file

### **CSV Format:**
```csv
Client Cd,Agent Name,MDRT Title,Life Member,Honor Roll,Quarter Century
00020880,KOO SAU FONG CATHERINE,TOT,LM,HR,QC
01853964,JIN ZHONGLING,TOT,LM,,
03194364,JIANG KERUO,TOT,,,
```

**Important:**
- `Client Cd` must have leading zeros
- Column names must match exactly
- Badge columns can be empty

### **User Photo Requirements:**
- Filename: `ClientCode.jpg` (must match CSV exactly)
- Formats: JPG, PNG
- Client code must exist in CSV

---

## 🎨 **UI/UX Highlights**

### **Admin Dashboard:**
- Purple gradient background
- Status cards with color indicators
- Grid layout for uploads
- Preview buttons for each asset
- Success/error messages

### **User Portal:**
- Clean, centered design
- Large drag-and-drop zone
- Loading spinner during generation
- Beautiful result card
- Tier-colored badges
- Action buttons with icons

---

## 🔒 **Data Flow**

1. **Admin uploads master assets** → Saved to `admin_assets/`
2. **User uploads photo** → Temporarily saved to `user_uploads/`
3. **System extracts client code** from filename
4. **System searches CSV** for client code
5. **If found:** Generate certificate using admin assets
6. **Save certificate** to `user_outputs/`
7. **Return** certificate for preview/download
8. **Cleanup** temporary user upload

---

## 💡 **Error Handling**

### **Admin Dashboard:**
- Missing files detected
- Upload errors shown
- Invalid file types rejected

### **User Portal:**
- System not ready → Clear message
- Client code not found → Specific error
- Invalid file type → Clear rejection
- Generation failure → Error displayed

---

## 📁 **File Management**

### **Persistent (Admin Assets):**
```
admin_assets/
├── backgrounds/
│   ├── MDRT.png      # Persists
│   ├── COT.png       # Persists
│   └── TOT.png       # Persists
├── badges/
│   ├── LM.png        # Persists
│   ├── HR.png        # Persists
│   └── QC.png        # Persists
└── data.csv          # Persists
```

### **Temporary (User Data):**
```
user_uploads/         # Cleaned after processing
user_outputs/         # Certificates (downloadable)
```

---

**Admin sets up once → Users generate unlimited certificates!** 🚀
