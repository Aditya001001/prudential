# Test Background Removal - Quick Guide

## 🎯 Purpose

Test the AI background removal on a single photo before processing all your certificates.

## 🚀 How to Run

### **Method 1: Automatic (finds sample image)**

```bash
python test_background_removal.py
```

The script will automatically find and test one of the WhatsApp images in your folder.

---

### **Method 2: Test Your Own Image**

```bash
python test_background_removal.py path/to/your/photo.jpg
```

**Examples:**

```bash
# Test with a specific file in current folder
python test_background_removal.py agent_photo.jpg

# Test with full path
python test_background_removal.py "C:\Users\Photos\person.png"

# Test with one of the sample images
python test_background_removal.py "WhatsApp Image 2026-04-27 at 11.01.13.jpeg"
```

---

## 📊 What It Does

1. ✅ Loads your image
2. 🤖 Removes background using AI (U2-Net model)
3. 💾 Saves 4 output files in `test_output/` folder:
   - `1_original.png` - Your original image
   - `2_background_removed.png` - Transparent background version
   - `3_preview_white_bg.png` - Preview on white background
   - `4_preview_colored_bg.png` - Preview on purple background

---

## ⏱️ Expected Time

- **First run**: 10-15 seconds (loading AI model)
- **Subsequent runs**: 5-8 seconds

---

## ✅ What You Should See

```
============================================================
MDRT Certificate Generator - Background Removal Test
============================================================

📁 Input image: WhatsApp Image 2026-04-27 at 11.01.13.jpeg
📁 Output directory: test_output

📷 Loading image...
   ✓ Image loaded: 1200x1600 pixels
   ✓ Original saved: test_output/1_original.png

🤖 Removing background with AI (U2-Net model)...
   This may take 5-15 seconds on first run...
   ✓ Background removed successfully!
   ✓ Saved result: test_output/2_background_removed.png

🎨 Creating preview with colored background...
   ✓ White background preview: test_output/3_preview_white_bg.png
   ✓ Colored background preview: test_output/4_preview_colored_bg.png

============================================================
✅ SUCCESS! Background removal test complete!
============================================================

📂 Check the output folder for results:
   C:\Users\ahada\Desktop\Template_HK\test_output

Files created:
   1_original.png - Your original image
   2_background_removed.png - Transparent background
   3_preview_white_bg.png - Preview on white
   4_preview_colored_bg.png - Preview on purple

🎯 If the background was removed cleanly, the app is ready!
```

---

## 🔍 Check the Results

1. **Open the `test_output` folder**
2. **Look at the 4 PNG files**
3. **Check quality:**
   - Is the person cleanly cut out?
   - Are the edges smooth?
   - Is any background remaining?

---

## ✅ If Background Removal Looks Good:

**You're ready to use the main app!**

1. Start the app (double-click `start.bat`)
2. Upload all your assets
3. Process certificates with confidence

---

## ❌ If Background Removal Has Issues:

### **Common Issues:**

**Issue: Some background remains**
- Try a photo with better contrast
- Ensure good lighting in original photo
- Avoid busy backgrounds

**Issue: Person's edges are rough**
- This is normal for some photos
- AI works best with:
  - Solid color backgrounds
  - Good lighting
  - Clear separation between person and background

**Issue: Parts of person are removed**
- Photo may have been too similar to background
- Try a different photo with better contrast

---

## 🎨 Tips for Best Results

### **Good Photos:**
✅ Solid background (white, grey, or solid color)
✅ Good lighting
✅ Person clearly separated from background
✅ High resolution

### **Avoid:**
❌ Busy/patterned backgrounds
❌ Low lighting
❌ Person blending into background
❌ Very low resolution

---

## 🔄 Test Multiple Photos

You can run the test multiple times with different photos:

```bash
python test_background_removal.py photo1.jpg
python test_background_removal.py photo2.jpg
python test_background_removal.py photo3.jpg
```

Each run creates a new `test_output` folder (overwrites previous).

---

## 🆘 Troubleshooting

### **Error: "Image not found"**
- Check the file path is correct
- Use quotes if path has spaces
- Make sure file exists

### **Error: "rembg not installed"**
```bash
cd backend
python -m pip install rembg
```

### **Script runs but no output folder**
- Check for error messages in terminal
- Make sure you have write permissions

---

## 📝 Next Steps After Testing

1. ✅ If background removal looks good → Start using the main app
2. ✅ Prepare your assets (backgrounds, badges, CSV, photos)
3. ✅ Follow the upload wizard in the app
4. ✅ Generate certificates!

---

**Quick Test Command:**
```bash
python test_background_removal.py
```

That's it! Simple and fast way to test before full processing. 🚀
