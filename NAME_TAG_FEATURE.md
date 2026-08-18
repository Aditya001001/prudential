# Name Tag Banner Feature

## ✅ **Feature Added: Name Tag Banner Upload & Overlay**

### 🎯 **Purpose:**
Added the ability to upload a decorative name tag banner image that appears at the bottom of certificates with the agent's name displayed on top of it.

---

## 📐 **How It Works:**

### **1. Admin Upload:**
- Admin uploads a name tag banner image (PNG format)
- Image is stored in `admin_assets/nametag/nametag.png`
- Same banner is used for all certificates (MDRT, COT, TOT)

### **2. Certificate Generation:**
1. Background is loaded
2. Agent photo is placed (with background removed)
3. Badges are added
4. **Name tag banner is overlaid at the bottom** ⭐
5. Agent name text is drawn on top of the name tag

---

## 🎨 **Name Tag Positioning:**

### **Placement:**
```
┌────────────────────────────┐
│                            │
│     Certificate            │
│     Background             │
│                            │
│        Agent Photo         │
│                            │
│                            │
│                            │
│  ┌──────────────────────┐  │ ← 90% down from top
│  │   NAME TAG BANNER    │  │ ← 80% of background width
│  │  AGENT NAME ON TOP   │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

### **Size & Position:**
- **Width:** 80% of background width
- **Height:** Proportional to name tag aspect ratio
- **X Position:** Centered horizontally
- **Y Position:** 90% down from top (near bottom)
- **Aspect Ratio:** Preserved from uploaded image

---

## 💻 **Backend Changes:**

### **1. New Endpoint:**
`POST /api/admin/upload-nametag`

**Request:**
```javascript
FormData {
  nametag: <PNG file>
}
```

**Response:**
```json
{
  "success": true,
  "uploaded": true
}
```

### **2. Updated Status Endpoint:**
`GET /api/admin/status`

**Response (new field):**
```json
{
  "backgrounds": {...},
  "badges": {...},
  "nametag": true,  ← NEW!
  "csv": true,
  "agent_count": 150
}
```

### **3. Certificate Generation:**
**File:** `backend/app_with_db.py` → `generate_certificate_for_agent()`

**New Logic:**
```python
# Add name tag image at the bottom (if uploaded)
nametag_path = os.path.join(ADMIN_ASSETS_FOLDER, 'nametag', 'nametag.png')
if os.path.exists(nametag_path):
    nametag_img = Image.open(nametag_path).convert('RGBA')
    
    # Scale to 80% of background width
    nametag_width = int(bg_width * 0.8)
    nametag_aspect = nametag_img.size[1] / nametag_img.size[0]
    nametag_height = int(nametag_width * nametag_aspect)
    nametag_img = nametag_img.resize((nametag_width, nametag_height), Image.Resampling.LANCZOS)
    
    # Position at 90% down from top
    nametag_x = (bg_width - nametag_width) // 2
    nametag_y = int(bg_height * 0.90) - nametag_height // 2
    
    background.paste(nametag_img, (nametag_x, nametag_y), nametag_img)
```

---

## 🖥️ **Frontend Changes:**

### **1. Admin Dashboard - New Section:**

**Location:** After "Achievement Badges" section

**Features:**
- Upload name tag banner image
- Preview current name tag
- Status indicator in overview cards

**Handler Function:**
```javascript
const handleNametagUpload = async (file) => {
  const formData = new FormData();
  formData.append('nametag', file);
  
  await axios.post(`${API_URL}/admin/upload-nametag`, formData);
  await fetchAssetStatus();
};
```

### **2. Status Overview Card:**
New card showing name tag upload status:
```
┌─────────────────┐
│  📤 Name Tag    │
│  ✓Uploaded      │
└─────────────────┘
```

---

## 📂 **File Structure:**

```
prudential/
├── admin_assets/
│   ├── backgrounds/
│   │   ├── MDRT.png
│   │   ├── COT.png
│   │   └── TOT.png
│   ├── badges/
│   │   ├── LM.png
│   │   ├── HR.png
│   │   └── QC.png
│   ├── nametag/          ← NEW FOLDER!
│   │   └── nametag.png   ← Name tag banner
│   └── data.csv
```

---

## ✅ **Usage Instructions:**

### **For Admin:**
1. Log in to Admin Dashboard
2. Scroll to "Name Tag Banner" section
3. Click "Choose File" and select the name tag banner PNG
4. Upload completes automatically
5. Status card shows "✓Uploaded"

### **For Certificate Generation:**
- Name tag is automatically added to all new certificates
- If no name tag is uploaded, certificates generate normally without it
- Name tag is optional (backward compatible)

---

## 🎨 **Design Considerations:**

### **Name Tag Image Requirements:**
- **Format:** PNG (with transparency recommended)
- **Recommended Width:** 1440-1600 pixels (for 1800px wide backgrounds)
- **Aspect Ratio:** Any (will be scaled proportionally)
- **Style:** Should match certificate design (gold banner, ribbon, etc.)

### **Text Overlay:**
- Agent name text is drawn **on top** of the name tag
- Text uses same neon styling as before
- Text position controlled by `POSITION_RATIOS['name_text']`

---

## 🔧 **Technical Details:**

### **Image Scaling:**
```python
# Scale to 80% of background width
nametag_width = int(bg_width * 0.8)  # e.g., 1800 * 0.8 = 1440px

# Maintain aspect ratio
nametag_aspect = original_height / original_width
nametag_height = int(nametag_width * nametag_aspect)
```

### **Positioning:**
```python
# Center horizontally
nametag_x = (bg_width - nametag_width) // 2

# 90% down from top, centered vertically
nametag_y = int(bg_height * 0.90) - nametag_height // 2
```

---

**Name tag banner feature now fully implemented - upload via Admin Dashboard and it will automatically appear on all certificates!** 🏷️✨
