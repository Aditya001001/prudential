# Quick Restart Guide - Apply All Updates

## 🚀 **Two Major Updates Applied:**

1. ✅ **Fixed Positioning** - Scaled for 494x740px templates
2. ✅ **Neon Text Effects** - Tier-based glow colors (Gold/Red/Blue)

---

## 🔄 **How to Apply Updates:**

### **STEP 1: Restart Backend Server**

**Find the terminal running the backend** (shows Flask/Python output) and:

```bash
# Press Ctrl + C to stop
# Then restart:
cd backend
python app.py
```

**You should see:**
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

---

### **STEP 2: Refresh Browser**

Go to: **http://localhost:3001**

Press: **Ctrl + Shift + R** (hard refresh)

---

### **STEP 3: Start New Batch**

Click: **← Start New Batch** (bottom left)

---

### **STEP 4: Upload Assets**

Make sure your **photos are renamed** to match client codes:

**Required format:**
- `01853964.jpg` (not `1853964.jpg` - include leading zeros!)
- `03194364.jpg`
- `00020880.jpg` ← Note the leading zeros
- etc.

See `URGENT_FIXES.md` for the complete list of all 17 client codes.

---

### **STEP 5: Process Certificates**

Click **"Next: Process Certificates →"**

Click **"Start Processing"**

---

### **STEP 6: Check Results**

**Download a certificate and check:**

✅ **Positioning:**
- Agent photo centered and fits within background
- Name text at bottom
- Badges on left side
- Nothing cut off or out of bounds

✅ **Text Effects:**
- White text with colored glow:
  - **TOT** → Gold glow ✨
  - **COT** → Red/Pink glow 💗
  - **MDRT** → Blue/Cyan glow 💙
- Black outline around text
- Text appears to "float" with neon effect

---

## 📋 **Quick Checklist:**

- [ ] Backend restarted (Ctrl+C → `python app.py`)
- [ ] Browser refreshed (Ctrl+Shift+R)
- [ ] Photos renamed with client codes (including leading zeros)
- [ ] Assets uploaded
- [ ] Certificates processed
- [ ] Downloaded and verified:
  - [ ] Positioning correct (everything fits)
  - [ ] Neon glow visible (tier-based colors)
  - [ ] Text readable and styled

---

## 🎨 **Expected Text Appearance:**

### **TOT (Table of Three):**
```
┌─────────────────────────────┐
│                             │
│    [Agent Photo Here]       │
│                             │
│  ════════════════════       │
│  ║ AGENT NAME ║ ← Gold glow │
│  ════════════════════       │
└─────────────────────────────┘
```

### **COT (Court of the Table):**
```
┌─────────────────────────────┐
│                             │
│    [Agent Photo Here]       │
│                             │
│  ════════════════════       │
│  ║ AGENT NAME ║ ← Red glow  │
│  ════════════════════       │
└─────────────────────────────┘
```

### **MDRT (Million Dollar Round Table):**
```
┌─────────────────────────────┐
│                             │
│    [Agent Photo Here]       │
│                             │
│  ════════════════════       │
│  ║ AGENT NAME ║ ← Blue glow │
│  ════════════════════       │
└─────────────────────────────┘
```

---

## ⚡ **If Text Glow is Too Strong/Weak:**

Edit `backend/app.py` around line 41:

```python
'name_text': {
    'glow_intensity': 8,   # Try 12 for stronger, 4 for subtle
    'outline_width': 2     # Try 3 for thicker outline
}
```

Then restart backend again.

---

## 📁 **Documentation Files:**

- `URGENT_FIXES.md` - Positioning fixes & photo naming
- `NEON_TEXT_EFFECTS.md` - Detailed text effect explanation
- `QUICK_RESTART_GUIDE.md` - This file (quick reference)

---

## 🎯 **One-Command Restart:**

```bash
# Stop backend (Ctrl+C), then:
cd backend && python app.py
```

**That's it!** Backend restarted with all updates applied. 🚀

---

**Restart → Refresh → Upload → Process → Enjoy neon glow!** ✨
