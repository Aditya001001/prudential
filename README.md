# MDRT Certificate Generator

Automated certificate generator for MDRT achievements with a modern React web interface. Processes agent data from CSV, uses AI to remove backgrounds from photos, and generates personalized certificates with achievement-specific backgrounds and milestone badges.

## 🚀 Quick Start

**Easiest Way:**
1. Double-click `start.bat`
2. Wait 15 seconds
3. Browser opens automatically to http://localhost:3001

**Manual Way:** See [MANUAL_START_GUIDE.md](MANUAL_START_GUIDE.md)

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - Fast reference guide
- **[MANUAL_START_GUIDE.md](MANUAL_START_GUIDE.md)** - Complete manual startup instructions
- **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)** - First-time setup
- **[REACT_SETUP.md](REACT_SETUP.md)** - React app details
- **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** - Architecture and technical details

## Features

- ✅ **100% Offline Processing** - All operations run locally including AI background removal
- ✅ **Batch Processing** - Process hundreds of certificates from CSV
- ✅ **Smart Background Removal** - Uses rembg AI model (U2-Net)
- ✅ **Tier-Specific Backgrounds** - Automatic background selection (MDRT/COT/TOT)
- ✅ **Milestone Badges** - Supports Life Member, Honor Roll, Quarter Century
- ✅ **Dynamic Text Overlay** - Agent names with customizable fonts

## Prerequisites

- Python 3.8 or higher
- Windows/Mac/Linux

## Installation

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Note:** First run will download the AI model (~180MB) for background removal. After that, everything runs offline.

### 2. Set Up Directory Structure

Create the following folders in your project directory:

```
Template_HK/
├── certificate_generator.py
├── Sample Data.csv
├── backgrounds/
│   ├── mdrt_red.png
│   ├── cot_purple.png
│   └── tot_gold.png
├── agent_photos/
│   ├── 01853964.jpg
│   ├── 03194364.jpg
│   └── ...
├── badges/
│   ├── life_member.png
│   ├── honor_roll.png
│   └── quarter_century.png
├── fonts/
│   └── Arial_Bold.ttf
└── output_certificates/  (auto-created)
```

### 3. Prepare Your Assets

#### A. Background Images
Place 3 background templates in `backgrounds/`:
- `mdrt_red.png` - Red background for MDRT tier
- `cot_purple.png` - Purple background for COT tier
- `tot_gold.png` - Gold background for TOT tier

#### B. Agent Photos
Place agent photos in `agent_photos/` named by their client code:
- Format: `{Client_Cd}.jpg` or `{Client_Cd}.png`
- Example: `01853964.jpg`, `03194364.png`

#### C. Badge Images
Place badge PNG files in `badges/`:
- `life_member.png` - Life Member badge (10 years)
- `honor_roll.png` - Honor Roll badge (15 years)
- `quarter_century.png` - Quarter Century badge (25 years)

#### D. Font File
Place your font file in `fonts/`:
- Default: `Arial_Bold.ttf`
- Or use any `.ttf` font file

## Configuration

Open `certificate_generator.py` and adjust these settings:

### Background Files (lines 16-20)
```python
TIER_BACKGROUNDS = {
    "MDRT": "mdrt_red.png",
    "COT": "cot_purple.png",
    "TOT": "tot_gold.png"
}
```

### Agent Photo Position (lines 31-35)
```python
AGENT_PHOTO_CONFIG = {
    "position": (400, 500),        # (x, y) center position
    "max_height": 600,             # Maximum height
    "max_width": 500               # Maximum width
}
```

### Name Text Settings (lines 38-44)
```python
NAME_TEXT_CONFIG = {
    "position": (400, 850),        # (x, y) center position
    "font_size": 60,
    "font_file": "Arial_Bold.ttf",
    "color": "white",
    "stroke_width": 2,
    "stroke_color": "black"
}
```

### Badge Positioning (lines 47-51)
```python
BADGE_CONFIG = {
    "start_position": (50, 400),   # (x, y) for first badge
    "vertical_spacing": 120,       # Space between badges
    "badge_size": (100, 100)       # Resize badges to this size
}
```

## Usage

### Run the Generator

```bash
python certificate_generator.py
```

### Expected Output

```
============================================================
MDRT Certificate Generator
============================================================

✓ Loaded 18 records from Sample Data.csv

============================================================
Processing: JIN ZHONGLING (TOT)
Badges: LM=True, HR=False, QC=False
  → Removing background from 01853964.jpg...
  ✓ Loaded background: tot_gold.png
  ✓ Processed agent photo
  ✓ Placed agent on background
  ✓ Added badge: LM
  ✓ Added name text
  ✓ Saved: 01853964_JIN_ZHONGLING_TOT.png

...

============================================================
PROCESSING COMPLETE
============================================================
✓ Successful: 18
✗ Failed: 0
📁 Output directory: output_certificates
============================================================
```

## CSV Format

Your `Sample Data.csv` should have these columns:

| Client Cd | Agent Name | MDRT Title | Life Member | Honor Roll | Quarter Century |
|-----------|------------|------------|-------------|------------|-----------------|
| 01853964  | JIN ZHONGLING | TOT | LM | | |
| 03194364  | JIANG KERUO | TOT | | | |
| 01564131  | XIONG WINNIE J W | COT | LM | | |
| 00010120  | NG CHI LAP KINSON | COT | LM | | QC |

- **Client Cd**: Used to match agent photo filename
- **Agent Name**: Displayed on certificate
- **MDRT Title**: `MDRT`, `COT`, or `TOT`
- **Badges**: `LM`, `HR`, or `QC` (leave empty if not applicable)

## Troubleshooting

### "Background not found"
- Ensure background PNG files are in `backgrounds/` folder
- Check filename matches exactly (case-sensitive on Linux/Mac)

### "Agent photo not found"
- Ensure photos are named with client code: `{Client_Cd}.jpg`
- Supported formats: `.jpg`, `.jpeg`, `.png`

### "Font not found, using default"
- Place font file in `fonts/` folder
- Update `NAME_TEXT_CONFIG["font_file"]` with correct filename

### Background removal is slow
- First image takes longer (loading AI model)
- Subsequent images are faster
- Use GPU version of rembg for faster processing (optional)

## Advanced: GPU Acceleration

For faster background removal with NVIDIA GPU:

```bash
pip install rembg[gpu]
```

Requires CUDA-compatible GPU and drivers.

## License

Free to use for internal business purposes.

## Support

For issues or questions, check the configuration section or adjust coordinates in the script.
