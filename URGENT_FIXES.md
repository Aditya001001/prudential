# URGENT FIXES - Positioning & Photo Matching Issues

## ✅ **Issues Fixed:**

### **1. Positions Out of Bounds** ✅
**Problem:** Images were going outside the background because I set positions for 1080x1920px templates, but your templates are **494x740px**.

**Fixed:** Updated all positions to match your actual template size (494x740px):

```python
# NEW POSITIONS (494x740px templates)
'agent_photo': {
    'x': 247,           # Center X (494 / 2)
    'y': 320,           # Center Y position
    'max_width': 250,   # Maximum width
    'max_height': 350   # Maximum height
}
'name_text': {
    'x': 247,           # Center X
    'y': 620,           # Bottom area (740 - 120)
    'font_size': 32,    # Font size (scaled down from 80)
    'color': '#FFFFFF'  # White text
}
'badges': {
    'x': 30,            # Left margin
    'y': 250,           # Start Y position
    'spacing': 60,      # Vertical spacing between badges
    'size': 50          # Badge size (50x50px)
}
```

---

### **2. Client Code Leading Zeros Lost** ✅
**Problem:** Your CSV has client codes with leading zeros (`01853964`, `03194364`), but pandas was reading them as numbers (`1853964`, `3194364`), causing photo matching to fail.

**Fixed:** Force pandas to read Client Cd as string to preserve leading zeros:

```python
df = pd.read_csv(filepath, dtype={'Client Cd': str})
```

---

## 🚨 **ACTION REQUIRED:**

### **STEP 1: RENAME YOUR PHOTOS**

Your photos must be named with the **exact client code** from the CSV.

**Current photo names:**
- `WhatsApp_Image_2026-04-27_at_11.01.13.jpeg`
- `WhatsApp_Image_2026-05-08_at_16.10.32.jpeg`

**Required names (from your CSV):**
- `01853964.jpg` (for JIN ZHONGLING)
- `03194364.jpg` (for JIANG KERUO)
- `01722065.jpg` (for LUO DONG YAN)
- `01564131.jpg` (for XIONG WINNIE J W)
- ... etc for all 17 agents

**Quick way to check client codes:**
Open `Sample Data.csv` and look at the `Client Cd` column - each photo filename must match exactly (including leading zeros).

---

### **STEP 2: RESTART THE BACKEND**

The backend needs to be restarted to pick up the position changes.

**Find your backend terminal** (the one running `python app.py`) and:
1. Press **Ctrl + C** to stop it
2. Run `python app.py` again

Or just **double-click `start.bat`** to restart both servers.

---

### **STEP 3: RE-UPLOAD RENAMED PHOTOS**

1. Go to http://localhost:3001
2. Click "← Start New Batch" (bottom left)
3. Upload your renamed photos (must match client codes)
4. Click "Process"

---

## 📋 **Photo Naming Reference:**

From your CSV, here are all the client codes your photos need to match:

```
01853964.jpg  → JIN ZHONGLING (TOT)
03194364.jpg  → JIANG KERUO (TOT)
01722065.jpg  → LUO DONG YAN (TOT)
01564131.jpg  → XIONG WINNIE J W (COT)
03215440.jpg  → ZHONG LINGYU (TOT)
01354857.jpg  → MIN HONGYAN NANCY (MDRT)
00808383.jpg  → WONG PAN NGA (MDRT)
00010120.jpg  → NG CHI LAP KINSON (TOT)
00032027.jpg  → LEUNG WAI MING PATRIC (TOT)
00716588.jpg  → NG HOI SZE ELSIE (COT)
00010073.jpg  → PAU TSUI MEE MICHELLE (TOT)
01327320.jpg  → KOU ZHENG JANET (MDRT)
00852051.jpg  → SHIH MING FENG (MDRT)
03006637.jpg  → GAO PANQI (TOT)
00020880.jpg  → KOO SAU FONG CATHERINE (TOT)  ← You selected this one
02271429.jpg  → LI YUXUAN (COT)
01583286.jpg  → QU WENXIU SPENCER (MDRT)
```

**Important:** 
- Include the leading zeros (e.g., `00020880.jpg` not `20880.jpg`)
- File extensions can be `.jpg`, `.jpeg`, or `.png` (case insensitive)

---

## 🔍 **Example: Renaming Photos**

If you have a photo of **KOO SAU FONG CATHERINE**, rename it to:
- ✅ `00020880.jpg` or `00020880.png`
- ❌ NOT `20880.jpg` (missing leading zeros)
- ❌ NOT `KOO_SAU_FONG_CATHERINE.jpg` (not the client code)

---

## ✅ **After Fixes:**

1. **Positions will be correct** - Everything fits within the 494x740px templates
2. **Photos will match** - Client codes with leading zeros preserved
3. **Processing will succeed** - All 17 certificates generated

---

## 🎯 **Quick Checklist:**

- [ ] Rename all photos to match client codes (with leading zeros)
- [ ] Restart backend server (Ctrl+C, then `python app.py`)
- [ ] Go to http://localhost:3001
- [ ] Click "Start New Batch"
- [ ] Upload renamed photos
- [ ] Process certificates
- [ ] Check positioning is correct

---

## 📐 **Template Size Reference:**

Your certificate templates are **494 x 740 pixels** (portrait):
- Width: 494px
- Height: 740px
- Center X: 247px
- Center Y: 370px

All positions are now scaled to fit this size perfectly.

---

**Rename photos → Restart backend → Re-upload → Process!** 🚀
