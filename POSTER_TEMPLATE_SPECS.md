# MDRT Poster Template Specifications

**Updated:** 2026-08-04
**Source:** Actual background images from `20260730 Poster/`

---

## 📐 Template Dimensions

### Poster Size (UPDATED)
- **Width:** 1077 pixels
- **Height:** 1600 pixels
- **Aspect Ratio:** 0.673 (2:3 portrait ratio)
- **Color Mode:** RGB
- **File Format:** PNG

**Note:** Updated to match the actual background image aspect ratio (5764×8560) to prevent distortion.

### Background Images
- **Original Size:** 5764 × 8560 pixels
- **Aspect Ratio:** 0.673 (2:3)
- **Scaled to:** 1077 × 1600 pixels (proportionally)

### Previous Sizes (for reference)
- **Original Spec:** 899 × 1600 pixels (0.562 ratio - would cause stretching)
- **Certificate Size:** 494 × 740 pixels
- **Scaling Factor:** 1077/899 = 1.198x width adjustment from original spec

---

## 🎨 Design Assets

### Fonts
1. **London Fill** (OTF/TTF)
   - Located: `20260714 Poster_Folder/20260714 Poster_Folder/Fonts/London Fill.ttf`
   - Usage: Decorative headings
   
2. **Avenir Black** (OTF from Avenir.ttc)
   - Located: `20260714 Poster_Folder/20260714 Poster_Folder/Fonts/Avenir.ttc`
   - Usage: Agent names (primary text)

### Background Images
- **Source:** MDRT.psd (1664 × 2514 pixels)
- **Located:** `20260714 Poster_Folder/20260714 Poster_Folder/Links/MDRT.psd`
- **Type:** Transparent RGB with 4 channels
- **Size:** 16,341 KB

**Note:** PSD files cannot be used directly by Python/PIL. Export to PNG format:
- Export each tier (MDRT, COT, TOT) as separate PNG files
- Size: 899 × 1600 pixels
- Save to: `backend/admin_assets/backgrounds/`

### Badge Images
- Life Member (LM)
- Honor Roll (HR)
- Quarter Century (QC)
- **Recommended Size:** ~91 × 91 pixels (scaled from original 50px)

---

## 📍 Position Coordinates (Updated for 1077×1600)

### Agent Photo
- **X:** 538 (center)
- **Y:** 691
- **Max Width:** 545 pixels
- **Max Height:** 756 pixels

### Agent Name Text
- **X:** 538 (center)
- **Y:** 1339
- **Font Size:** 69 pixels
- **Color:** White (#FFFFFF)
- **Glow Intensity:** 17
- **Outline Width:** 5 pixels

### Achievement Badges
- **Start X:** 66
- **Start Y:** 540
- **Spacing:** 131 pixels (vertical)
- **Size:** 109 × 109 pixels

---

## 🌈 Neon Colors by Tier

### TOT (Top of the Table)
- **RGB:** (255, 215, 0)
- **Color:** Gold

### COT (Court of the Table)
- **RGB:** (255, 100, 100)
- **Color:** Red/Pink

### MDRT (Million Dollar Round Table)
- **RGB:** (100, 200, 255)
- **Color:** Blue/Cyan

---

## 📦 Background Images (Ready to Use!)

### Available in: `20260730 Poster/`

**High-Resolution Images (5764×8560):**
- ✅ `MDRT.png` - Ready to upload
- ✅ `COT.png` - Ready to upload
- ✅ `TOT.png` - Ready to upload

**Upload via Admin Dashboard:**
1. Login to Admin Dashboard
2. Navigate to "Tier Backgrounds" section
3. Upload each PNG file to corresponding tier
4. System will automatically scale to 1077×1600

**Or Copy Manually:**
```bash
Copy from: 20260730 Poster/MDRT.png, COT.png, TOT.png
To: backend/admin_assets/backgrounds/
```

**Note:** Images will be automatically scaled from 5764×8560 to 1077×1600 maintaining perfect aspect ratio (no distortion).

5. **Optional - Copy Fonts:**
   ```
   Copy from: 20260714 Poster_Folder/Fonts/
   To: backend/fonts/ (create this folder)
   ```

---

## ✅ Current Implementation Status

### Backend Updates (✅ Completed)
- [x] Template dimensions updated to 1077×1600 (matches background ratio)
- [x] Position coordinates scaled: x*1.198, sizes*1.198
- [x] Background auto-resize to 1077×1600
- [x] Font size scaled to 69px
- [x] Glow and outline scaled proportionally
- [x] Badge size and spacing updated (109px badges)

### Frontend Updates (⏳ Pending)
- [ ] Update preview modal sizing
- [ ] Update CSS for larger images
- [ ] Test display on different screen sizes

### Assets (✅ Ready to Upload)
- [x] MDRT.png (5764×8560) - Available in 20260730 Poster/
- [x] COT.png (5760×8556) - Available in 20260730 Poster/
- [x] TOT.png (5764×8556) - Available in 20260730 Poster/
- [ ] London Fill font (optional)
- [ ] Avenir Black font (optional, using Arial fallback)

---

## 🔄 Migration Notes

### Why 1077×1600 Instead of 899×1600?

The original spec called for 899×1600 (aspect ratio 0.562), but the actual background images from the design files are 5764×8560 (aspect ratio 0.673).

**Without this change:** Backgrounds would be stretched horizontally by 20%, causing distortion.
**With this change:** Backgrounds maintain perfect proportions - no distortion!

### Automatic Scaling

The application automatically resizes uploaded backgrounds to 1077×1600 pixels:
1. **High-res input:** 5764×8560 → scaled down proportionally
2. **Output:** 1077×1600 (perfect aspect ratio match)
3. **Result:** Crystal clear, no distortion

---

## 📝 Developer Notes

- Template width constant: `TEMPLATE_WIDTH = 1077`
- Template height constant: `TEMPLATE_HEIGHT = 1600`
- Aspect ratio: 0.673 (2:3 portrait)
- All positions scaled by factor 1.198 from 899-width template
- Background resizing happens automatically in `generate_certificate_for_agent()` function
- Neon text effects scale with font size (now 69px)

---

**Last Updated:** 2026-08-04
**Status:** ✅ Updated to 1077×1600 to match background aspect ratio - No distortion!
