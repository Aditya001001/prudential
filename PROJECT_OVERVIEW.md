# MDRT Certificate Generator - Project Overview

## 🎯 What This Does

Automatically generates personalized MDRT achievement certificates by:
1. **Removing backgrounds** from agent photos using AI
2. **Placing agents** on achievement-specific backgrounds (MDRT/COT/TOT)
3. **Adding milestone badges** (Life Member, Honor Roll, Quarter Century)
4. **Overlaying agent names** with custom fonts
5. **Batch processing** hundreds of certificates in minutes

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│          React Frontend (Port 3000)             │
│  - Modern UI with 4-step wizard                 │
│  - Drag & drop file uploads                     │
│  - Real-time progress tracking                  │
│  - Batch download capabilities                  │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/REST API
┌──────────────────▼──────────────────────────────┐
│          Flask Backend (Port 5000)              │
│  - File upload handling                         │
│  - Image processing pipeline                    │
│  - AI background removal (rembg + U2-Net)      │
│  - Certificate generation                       │
└─────────────────────────────────────────────────┘
```

## 📂 Technology Stack

### Backend (Python)
- **Flask** - Web framework & REST API
- **Pillow** - Image manipulation and composition
- **rembg** - AI-powered background removal (U2-Net model)
- **pandas** - CSV data processing
- **Flask-CORS** - Cross-origin resource sharing

### Frontend (JavaScript/React)
- **React 18** - UI framework
- **react-dropzone** - Drag & drop file uploads
- **axios** - HTTP client
- **lucide-react** - Beautiful icon library
- **CSS3** - Modern gradient animations

## 📊 Data Flow

```
1. User Uploads
   ├── 3 Background Images (MDRT, COT, TOT)
   ├── 3 Badge Images (LM, HR, QC)
   ├── 1 Font File (.ttf)
   ├── 1 CSV Data File
   └── N Agent Photos

2. Configuration
   ├── Agent Photo Position (x, y, width, height)
   ├── Name Text Position (x, y, size, color)
   └── Badge Positions (x, y, spacing, size)

3. Processing
   ├── Read CSV → For each agent:
   │   ├── Load tier background
   │   ├── Remove agent photo background (AI)
   │   ├── Resize & place agent on background
   │   ├── Add applicable badges
   │   └── Overlay agent name
   └── Save to outputs/

4. Download
   ├── Download all as ZIP
   └── Download individual certificates
```

## 🎨 UI/UX Flow

### Step 1: Upload Assets
- **Purpose**: Collect all required files
- **Features**:
  - Drag & drop zones
  - Real-time validation
  - CSV preview (first 3 records)
  - Upload progress indicators
  - Success/error messages

### Step 2: Configure Positions
- **Purpose**: Fine-tune element positioning
- **Features**:
  - Numeric inputs for pixel coordinates
  - Color picker for text
  - Save configuration button
  - Live validation

### Step 3: Process Certificates
- **Purpose**: Execute batch generation
- **Features**:
  - One-click start button
  - Processing animation
  - Status updates
  - Auto-redirect on completion

### Step 4: Results & Download
- **Purpose**: Deliver final certificates
- **Features**:
  - Success/failure summary cards
  - Download all as ZIP button
  - Individual download buttons
  - Error list (if any failures)

## 🔄 Processing Pipeline

```python
For each agent in CSV:
  1. Identify tier (MDRT/COT/TOT)
  2. Load corresponding background
  3. Load agent photo by Client Code
  4. Remove background using rembg AI
     └─→ U2-Net deep learning model
  5. Resize agent photo to fit
  6. Composite agent onto background
  7. Check for badges (LM, HR, QC)
  8. Stack applicable badges vertically
  9. Render agent name with font
  10. Save as PNG
```

## 🎯 Key Features

### ✅ User-Friendly
- No coding required
- Visual drag & drop
- Step-by-step wizard
- Clear error messages

### ✅ Powerful
- AI background removal
- Batch processing
- Configurable positioning
- High-quality output

### ✅ Fast
- 5-8 seconds per certificate
- Parallel processing ready
- Optional GPU acceleration

### ✅ Private
- 100% offline processing
- No cloud uploads
- Local data storage
- No external dependencies (after setup)

## 📁 File Structure

```
Template_HK/
├── backend/
│   ├── app.py                    # Flask API (339 lines)
│   ├── requirements.txt          # Python dependencies
│   ├── uploads/                  # User-uploaded files
│   │   ├── MDRT_background.png
│   │   ├── COT_background.png
│   │   ├── TOT_background.png
│   │   ├── LM_badge.png
│   │   ├── HR_badge.png
│   │   ├── QC_badge.png
│   │   ├── custom_font.ttf
│   │   ├── data.csv
│   │   └── agent_photos/
│   │       ├── 01853964.jpg
│   │       └── ...
│   └── outputs/
│       └── certificates/
│           ├── 01853964_JIN_ZHONGLING_TOT.png
│           └── ...
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js                # Main app
│   │   ├── App.css               # Global styles
│   │   ├── index.js              # Entry point
│   │   ├── index.css             # Base styles
│   │   └── components/
│   │       ├── UploadStep.js     # Step 1 component
│   │       ├── UploadStep.css
│   │       ├── ConfigureStep.js  # Step 2 component
│   │       ├── ConfigureStep.css
│   │       ├── ProcessStep.js    # Step 3 component
│   │       ├── ProcessStep.css
│   │       ├── ResultsStep.js    # Step 4 component
│   │       └── ResultsStep.css
│   └── package.json
│
├── certificate_generator.py     # Standalone CLI version
├── Sample Data.csv               # Example CSV
├── category.txt                  # Tier color mapping
├── start.bat                     # Windows quick start
├── .gitignore                    # Git ignore rules
├── README.md                     # CLI documentation
├── SETUP_GUIDE.md               # CLI setup guide
├── REACT_SETUP.md               # React setup guide
├── INSTALLATION_GUIDE.md        # Step-by-step install
└── PROJECT_OVERVIEW.md          # This file
```

## 🚀 Quick Start Summary

```bash
# 1. Install backend
cd backend
pip install -r requirements.txt

# 2. Install frontend
cd frontend
npm install

# 3. Start backend (Terminal 1)
cd backend
python app.py

# 4. Start frontend (Terminal 2)
cd frontend
npm start

# 5. Open browser
http://localhost:3000
```

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Backend startup | < 2 seconds |
| Frontend build | ~30 seconds |
| AI model loading | ~3 seconds (first run) |
| Background removal | 3-5 seconds/image |
| Image composition | < 1 second/image |
| Total per certificate | 5-8 seconds |
| 18-agent batch | 3-5 minutes |

## 🔐 Security & Privacy

- ✅ No external API calls (after model download)
- ✅ All processing happens locally
- ✅ No data sent to cloud services
- ✅ Files stored only on local machine
- ✅ No telemetry or tracking
- ✅ Open source dependencies

## 🎓 Use Cases

1. **MDRT Organizations** - Automate annual certificate generation
2. **Insurance Companies** - Recognize top performers
3. **Event Planners** - Batch create personalized graphics
4. **HR Departments** - Employee achievement certificates
5. **Educational Institutions** - Student recognition awards

## 🔄 Future Enhancements (Optional)

- [ ] Preview before processing
- [ ] Template designer (visual editor)
- [ ] Multiple template support
- [ ] Database integration
- [ ] Email distribution
- [ ] PDF export option
- [ ] Multi-language support
- [ ] Theme customization

## 📞 Support & Documentation

- **Installation**: See `INSTALLATION_GUIDE.md`
- **React Setup**: See `REACT_SETUP.md`
- **CLI Usage**: See `README.md` and `SETUP_GUIDE.md`
- **API Reference**: Check backend `app.py` docstrings

## 🎉 Credits

Built with:
- **rembg** by danielgatis (Background removal)
- **React** by Meta (Frontend framework)
- **Flask** by Pallets (Backend framework)
- **Pillow** by Python Imaging Library (Image processing)

---

**Built for MDRT Certificate Automation | 2027**
