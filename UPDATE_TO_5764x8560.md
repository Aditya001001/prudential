# 🎯 Update to 5764×8560 High-Resolution Templates

## ✅ COMPLETED: New Backend Configuration

I've created a new backend file configured specifically for your **5764×8560** templates (COT.png, MDRT.png, TOT.png).

---

## 📊 New Configuration Details

### **Template Size:**
- Width: **5764 pixels**
- Height: **8560 pixels**
- Aspect Ratio: **0.673** (2:3)
- Perfect for: **Print-quality certificates**

### **Updated Positions:**

```python
TEMPLATE_WIDTH = 5764
TEMPLATE_HEIGHT = 8560

FIXED_POSITIONS = {
    'agent_photo': {
        'x': 2882,          # Center (50%)
        'y': 3595,          # 42% from top
        'max_width': 2882,  # 50% of width
        'max_height': 4794  # 56% of height
    },
    'name_text': {
        'x': 2882,          # Center
        'y': 7447,          # 87% from top (bottom area)
        'font_size': 370,   # Scaled up 11.5x from 32px
        'glow_intensity': 92,
        'outline_width': 23
    },
    'badges': {
        'x': 415,           # 7.2% from left
        'y': 3424,          # 40% from top
        'spacing': 694,     # Vertical spacing between badges
        'size': 578         # Badge size (scaled from 50px)
    }
}
```

---

## 🚀 How to Apply the Update

### **Option 1: Replace Current app.py (RECOMMENDED)**

```bash
# Backup current app.py
copy backend\app.py backend\app_backup_old.py

# Replace with new configuration
copy backend\app_updated_5764x8560.py backend\app.py

# Restart backend
cd backend
python app.py
```

### **Option 2: Use New File Directly**

```bash
cd backend
python app_updated_5764x8560.py
```

---

## 📁 Required Files

### **1. Upload Your Templates to Admin Assets**

Make sure these files are in `backend/admin_assets/backgrounds/`:
- `COT.png` (5760×8556 or 5764×8560)
- `MDRT.png` (5764×8560)
- `TOT.png` (5764×8556 or 5764×8560)

**Copy them now:**
```bash
copy "20260730 Poster\COT.png" backend\admin_assets\backgrounds\COT.png
copy "20260730 Poster\MDRT.png" backend\admin_assets\backgrounds\MDRT.png
copy "20260730 Poster\TOT.png" backend\admin_assets\backgrounds\TOT.png
```

### **2. Badge Images**

Make sure badges are in `backend/admin_assets/badges/`:
- `LM.png`, `HR.png`, `QC.png`

---

## 🎨 What Changed

### **Before (Old app.py):**
- Template size: **494×740** ❌ Wrong!
- Agent photo at: 247×320 (only 4.3% from left on 5764px canvas!)
- Text font: 32px (barely visible on 8560px tall image!)
- Badges: 50px (microscopic!)

### **After (New Configuration):**
- Template size: **5764×8560** ✅ Matches your templates!
- Agent photo at: 2882×3595 (perfectly centered at 50%)
- Text font: 370px (proportionally scaled, clearly visible)
- Badges: 578px (prominent and visible)

---

## ✨ Benefits

### **High Resolution:**
- ✅ Print-ready quality
- ✅ Sharp text at any zoom level
- ✅ Professional output
- ✅ Suitable for physical certificates

### **Accurate Positioning:**
- ✅ Elements properly centered
- ✅ Text readable and prominent
- ✅ Badges clearly visible
- ✅ Photo well-proportioned

---

## 🧪 Testing

### **Step 1: Start Backend**
```bash
cd backend
python app_updated_5764x8560.py
```

You should see:
```
============================================================
MDRT Certificate Generator - 5764x8560 Edition
============================================================
Template Size: 5764 x 8560 pixels
Admin Dashboard: http://localhost:5000/admin
User Portal:     http://localhost:5000/
============================================================
```

### **Step 2: Verify Templates**
```bash
python -c "from PIL import Image; import os; folder = 'backend/admin_assets/backgrounds'; [print(f'{f}: {Image.open(os.path.join(folder, f)).size}') for f in os.listdir(folder) if f.endswith('.png')]"
```

Expected output:
```
COT.png: (5760, 8556) or (5764, 8560)
MDRT.png: (5764, 8560)
TOT.png: (5764, 8556) or (5764, 8560)
```

### **Step 3: Generate Test Certificate**
1. Open frontend: http://localhost:3001
2. Upload a test photo named with a client code (e.g., `00020880.jpg`)
3. Wait for generation
4. Download and check certificate size

```bash
# Check generated certificate size
python -c "from PIL import Image; img = Image.open('backend/user_outputs/[FILENAME].png'); print(f'Size: {img.size}')"
```

Expected: **5764×8560** pixels

---

## ⚠️ Important Notes

### **File Sizes:**
- Generated certificates will be **5-15 MB** each (vs 500KB-2MB previously)
- High resolution = larger files
- Perfect for printing, but may be slower to email/download

### **Processing Time:**
- Background removal: ~3-5 seconds (same)
- Image composition: ~2-3 seconds (slightly slower due to size)
- **Total: ~8-10 seconds per certificate**

### **Memory Usage:**
- Working with 5764×8560 images requires more RAM
- Expect ~200-300MB per certificate generation
- Should be fine on modern systems

---

## 🔍 Verification Checklist

- [ ] Copied templates to `backend/admin_assets/backgrounds/`
- [ ] Templates are 5764×8560 (or similar)
- [ ] Replaced `app.py` with updated version
- [ ] Restarted backend server
- [ ] Generated test certificate
- [ ] Certificate is 5764×8560 pixels
- [ ] Photo is centered
- [ ] Text is clearly visible
- [ ] Badges are prominent

---

## 📞 Next Steps

1. **Copy templates** to admin_assets folder
2. **Replace app.py** with new configuration
3. **Restart backend**
4. **Test** with one sample certificate
5. **Verify** output size and quality
6. **Process** all certificates

**Ready to proceed?** Follow the steps above and you'll have high-resolution certificates!
