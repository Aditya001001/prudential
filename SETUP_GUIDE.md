# Quick Setup Guide

Follow these steps to get your certificate generator running:

## Step 1: Install Python (if not already installed)

Download and install Python 3.8+ from [python.org](https://www.python.org/downloads/)

Verify installation:
```bash
python --version
```

## Step 2: Install Dependencies

Open terminal/command prompt in your project folder and run:

```bash
pip install -r requirements.txt
```

**Important:** The first time you run the script, it will download a ~180MB AI model for background removal. This only happens once.

## Step 3: Organize Your Files

### Create these folders:

```
📁 backgrounds/      ← Put your 3 tier background images here
📁 agent_photos/     ← Put agent photos here (named by Client Cd)
📁 badges/           ← Put badge PNG overlays here
📁 fonts/            ← Put your font file here
```

### File naming conventions:

**Backgrounds:**
- `mdrt_red.png` (or whatever you name them in the config)
- `cot_purple.png`
- `tot_gold.png`

**Agent Photos:**
- Name them by Client Code from CSV
- Examples: `01853964.jpg`, `03194364.png`, `00010120.jpeg`

**Badges:**
- `life_member.png` (LM badge)
- `honor_roll.png` (HR badge)
- `quarter_century.png` (QC badge)

**Font:**
- `Arial_Bold.ttf` (or any .ttf font file)

## Step 4: Configure Positioning

Open `certificate_generator.py` and adjust coordinates based on your background design:

```python
# Line 33-35: Where to place agent photo
AGENT_PHOTO_CONFIG = {
    "position": (400, 500),    # Adjust X, Y coordinates
    "max_height": 600,
    "max_width": 500
}

# Line 39-44: Where to place name text
NAME_TEXT_CONFIG = {
    "position": (400, 850),    # Adjust X, Y coordinates
    "font_size": 60,
    # ... other settings
}

# Line 48-51: Where to place badges
BADGE_CONFIG = {
    "start_position": (50, 400),   # First badge position
    "vertical_spacing": 120,        # Space between badges
    "badge_size": (100, 100)
}
```

**Tip:** Open one background image in an image editor (Paint, Photoshop, GIMP) and note the pixel coordinates where elements should be placed.

## Step 5: Test with One Record

Before processing all 18 agents, test with just one:

1. Edit `Sample Data.csv` and comment out all rows except the first agent
2. Run: `python certificate_generator.py`
3. Check the output in `output_certificates/`
4. Adjust coordinates if needed
5. Repeat until positioning is perfect

## Step 6: Process All Certificates

Once positioning is correct:

1. Restore all rows in `Sample Data.csv`
2. Run: `python certificate_generator.py`
3. Wait for processing (background removal takes ~5-10 seconds per image)
4. Find all certificates in `output_certificates/`

## Common Issues

### Issue: "ModuleNotFoundError: No module named 'rembg'"
**Solution:** Run `pip install -r requirements.txt`

### Issue: "Background not found: backgrounds/mdrt_red.png"
**Solution:** 
- Make sure the `backgrounds/` folder exists
- Check that file names match exactly (case-sensitive)
- Update `TIER_BACKGROUNDS` in the script if using different names

### Issue: "Agent photo not found for client code: 01853964"
**Solution:**
- Photo must be named exactly as Client Cd in CSV
- Example: If CSV has `01853964`, photo should be `01853964.jpg` or `01853964.png`
- Place photos in `agent_photos/` folder

### Issue: Name text is not centered or cut off
**Solution:** Adjust `NAME_TEXT_CONFIG["position"]` coordinates

### Issue: Badges are overlapping or in wrong position
**Solution:** Adjust `BADGE_CONFIG["start_position"]` and `"vertical_spacing"`

### Issue: Agent photo is too small/large
**Solution:** Adjust `AGENT_PHOTO_CONFIG["max_height"]` and `"max_width"`

## Coordinate System Reference

```
(0,0) ─────────────────── X →
  │
  │     Your Background
  │     Image Canvas
  │
  Y
  ↓

Example for 800x1200px background:
- Center: (400, 600)
- Top-left corner: (0, 0)
- Bottom-right corner: (800, 1200)
```

## Performance Tips

- **First run:** ~10-15 seconds per image (AI model loading)
- **Subsequent runs:** ~5-8 seconds per image
- **For 18 agents:** Expect ~3-5 minutes total
- **GPU acceleration:** Install `pip install rembg[gpu]` for 2-3x speedup (requires NVIDIA GPU)

## Next Steps

Once everything works:
- Keep the script and folder structure
- Next time you need to generate certificates, just:
  1. Update `Sample Data.csv`
  2. Add new agent photos to `agent_photos/`
  3. Run `python certificate_generator.py`

---

**Need help?** Check the configuration comments in `certificate_generator.py` or refer to `README.md` for detailed documentation.
