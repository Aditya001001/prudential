# Name Tag Banner Feature - 3 Tier Support (Updated)

## ✅ **Feature Update: Separate Name Tags for Each Tier**

### 🎯 **Change:**
Updated the name tag banner feature to support **3 different name tag images** - one for each MDRT tier (MDRT, COT, TOT).

---

## 📐 **How It Works:**

### **1. Admin Upload (Updated):**
- Admin can upload **3 separate** name tag banner images
- Each tier has its own banner design:
  - `admin_assets/nametags/MDRT.png` - For MDRT tier certificates
  - `admin_assets/nametags/COT.png` - For COT tier certificates
  - `admin_assets/nametags/TOT.png` - For TOT tier certificates

### **2. Certificate Generation (Updated):**
1. Background is loaded (tier-specific)
2. Agent photo is placed (with background removed)
3. Badges are added
4. **Tier-specific name tag banner is overlaid at the bottom** ⭐
5. Agent name text is drawn on top of the name tag

---

## 🎨 **Name Tag Positioning:**

### **Placement:**
```
┌────────────────────────────┐
│     Background             │
│     Agent Photo            │
│     Badges                 │
│  ┌──────────────────────┐  │
│  │  🏷️ Name Tag (Tier)  │  │ ← Tier-specific banner
│  │   AGENT NAME ON TOP   │  │ ← Text overlay
│  └──────────────────────┘  │
└────────────────────────────┘
```

### **Sizing & Position:**
- **Width:** 80% of background width
- **Aspect Ratio:** Preserved from original upload
- **Horizontal Position:** Centered
- **Vertical Position:** 90% from top (bottom area)
- **Text:** Agent name rendered on top with neon styling

---

## 🔧 **Technical Changes:**

### **Backend (`app_with_db.py`):**

**1. Updated Status Function:**
```python
def get_admin_asset_status():
    status = {
        'nametags': {}  # Changed from 'nametag': False
    }
    
    # Check name tags for each tier
    for tier in ['MDRT', 'COT', 'TOT']:
        nametag_path = os.path.join(ADMIN_ASSETS_FOLDER, 'nametags', f'{tier}.png')
        status['nametags'][tier] = os.path.exists(nametag_path)
```

**2. Updated Upload Endpoint:**
```python
@app.route('/api/admin/upload-nametags', methods=['POST'])
def admin_upload_nametags():
    # Accepts MDRT, COT, and TOT files
    # Saves to nametags/ folder with tier-specific filenames
```

**3. Updated Certificate Generation:**
```python
# Load tier-specific name tag
nametag_path = os.path.join(ADMIN_ASSETS_FOLDER, 'nametags', f'{tier}.png')
if os.path.exists(nametag_path):
    # Overlay tier-specific name tag
```

### **Frontend (`AdminDashboard.js`):**

**1. Updated Handler:**
```javascript
const handleNametagUpload = async (tier, file) => {
    const formData = new FormData();
    formData.append(tier, file);  // Send with tier key
    await axios.post(`${API_URL}/admin/upload-nametags`, formData);
};
```

**2. Updated Status Card:**
```jsx
<h3>Name Tags</h3>
<div className="status-items">
  {assetStatus?.nametags?.MDRT && <span>✓MDRT</span>}
  {assetStatus?.nametags?.COT && <span>✓COT</span>}
  {assetStatus?.nametags?.TOT && <span>✓TOT</span>}
</div>
```

**3. Updated Upload Section:**
```jsx
<div className="upload-grid">
  <FileUploadBox title="MDRT Name Tag" ... />
  <FileUploadBox title="COT Name Tag" ... />
  <FileUploadBox title="TOT Name Tag" ... />
</div>
```

---

## 🧪 **Testing Instructions:**

### **1. Upload Name Tags:**
1. Visit: `https://prudential-uat.innocorn.net/prudential/admin`
2. Login: `admin` / `admin123`
3. Scroll to "Name Tag Banners" section
4. Upload 3 different banner images:
   - MDRT Name Tag (e.g., gold banner for MDRT)
   - COT Name Tag (e.g., silver banner for COT)
   - TOT Name Tag (e.g., platinum banner for TOT)
5. Status card should show "✓MDRT ✓COT ✓TOT"

### **2. Generate Certificates:**
1. Generate certificate for an MDRT agent → Should use MDRT name tag
2. Generate certificate for a COT agent → Should use COT name tag
3. Generate certificate for a TOT agent → Should use TOT name tag

---

## 📊 **Status Response Format:**

### **Before (Single Name Tag):**
```json
{
  "backgrounds": { "MDRT": true, "COT": true, "TOT": true },
  "badges": { "LM": true, "HR": true, "QC": true },
  "nametag": true,  ← Single boolean
  "csv": true
}
```

### **After (3 Tier Name Tags):**
```json
{
  "backgrounds": { "MDRT": true, "COT": true, "TOT": true },
  "badges": { "LM": true, "HR": true, "QC": true },
  "nametags": {  ← Object with tier keys
    "MDRT": true,
    "COT": true,
    "TOT": true
  },
  "csv": true
}
```

---

## ✅ **Benefits:**

1. **Tier-Specific Branding:** Each tier can have its own unique name tag design
2. **Better Visual Hierarchy:** Different colors/styles for different achievement levels
3. **Professional Presentation:** Matches the tier-specific backgrounds and overall design
4. **Flexibility:** Admins can update each tier's name tag independently

---

## 🚀 **Deployment Status:**

- ✅ Backend updated (`app_with_db.py`)
- ✅ Frontend updated (`AdminDashboard.js`)
- ✅ Frontend rebuilt successfully
- ✅ Backend auto-reloaded with changes
- ✅ Ready for testing

---

**Name tag feature now supports 3 separate tier-specific banners!** 🏷️✨
