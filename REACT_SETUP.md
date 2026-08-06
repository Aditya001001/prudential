# MDRT Certificate Generator - React Web App

Beautiful, modern web interface for automated MDRT certificate generation with AI-powered background removal.

## 🎨 Features

- **Modern UI/UX** - Clean, intuitive 4-step wizard interface
- **Drag & Drop** - Easy file uploads with visual feedback
- **Real-time Progress** - Live processing status and progress tracking
- **Batch Downloads** - Download all certificates as ZIP or individually
- **100% Offline** - All processing happens locally on your machine
- **Responsive Design** - Works on desktop, tablet, and mobile

## 📋 Prerequisites

- **Python 3.8+** (for backend)
- **Node.js 16+** (for frontend)
- **npm or yarn** (comes with Node.js)

## 🚀 Quick Start

### Step 1: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Note:** First run downloads the AI model (~180MB) for background removal.

### Step 2: Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Step 3: Start the Backend Server

```bash
cd backend
python app.py
```

Backend will run on: `http://localhost:5000`

### Step 4: Start the Frontend (New Terminal)

```bash
cd frontend
npm start
```

Frontend will open automatically at: `http://localhost:3000`

## 📁 Project Structure

```
Template_HK/
├── backend/
│   ├── app.py                 # Flask API server
│   ├── requirements.txt       # Python dependencies
│   ├── uploads/               # Auto-created for uploaded files
│   └── outputs/               # Auto-created for generated certificates
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js             # Main app component
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── index.css
│   │   └── components/
│   │       ├── UploadStep.js      # Step 1: File uploads
│   │       ├── ConfigureStep.js   # Step 2: Position config
│   │       ├── ProcessStep.js     # Step 3: Batch processing
│   │       └── ResultsStep.js     # Step 4: Downloads
│   └── package.json
│
├── Sample Data.csv
├── category.txt
└── REACT_SETUP.md (this file)
```

## 🎯 How to Use

### Step 1: Upload Assets

1. **Background Images** (3 files):
   - MDRT Background (Red theme)
   - COT Background (Purple theme)
   - TOT Background (Gold theme)

2. **Badge Images** (3 files):
   - Life Member badge (LM)
   - Honor Roll badge (HR)
   - Quarter Century badge (QC)

3. **Font File**:
   - Upload a `.ttf` font file for agent names

4. **CSV Data**:
   - Upload your `Sample Data.csv` with agent information

5. **Agent Photos**:
   - Drag & drop all agent photos (named by Client Code)

### Step 2: Configure Positions

Adjust pixel coordinates for:
- Agent photo center position and size
- Name text position, size, and color
- Badge start position and spacing

Click **Save Configuration** when done.

### Step 3: Process Certificates

Click **Start Processing** to:
- Remove backgrounds from agent photos (AI-powered)
- Composite images on tier-specific backgrounds
- Add milestone badges
- Overlay agent names
- Generate all certificates

### Step 4: Download Results

- **Download All as ZIP** - Get all certificates in one file
- **Download Individual** - Download specific certificates
- View summary of successful and failed generations

## 🎨 UI Preview

The app features:
- **Gradient Purple Header** with logo and title
- **Step Progress Indicator** showing current position
- **Card-based Layout** with smooth animations
- **Color-coded Status** (Success = Green, Error = Red)
- **Drag & Drop Zones** with visual feedback
- **Real-time Validation** for required files

## 📊 API Endpoints

Backend Flask API endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload-backgrounds` | Upload 3 tier backgrounds |
| POST | `/api/upload-badges` | Upload 3 badge images |
| POST | `/api/upload-font` | Upload font file |
| POST | `/api/upload-csv` | Upload CSV data |
| POST | `/api/upload-photos` | Upload agent photos |
| POST | `/api/update-positions` | Save position config |
| GET | `/api/config` | Get current config |
| POST | `/api/process` | Process all certificates |
| GET | `/api/download/<filename>` | Download single file |
| GET | `/api/download-all` | Download ZIP |

## 🔧 Configuration

Default positions (can be adjusted in UI):

```python
agent_photo: { x: 400, y: 500, max_width: 500, max_height: 600 }
name_text: { x: 400, y: 850, font_size: 60, color: '#FFFFFF' }
badges: { x: 50, y: 400, spacing: 120, size: 100 }
```

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.8+

# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

### Frontend won't start
```bash
# Check Node version
node --version  # Should be 16+

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS errors
- Ensure backend is running on port 5000
- Check `API_URL` in frontend components matches backend URL

### Upload fails
- Check file formats (PNG for backgrounds/badges, TTF for fonts, CSV for data)
- Ensure file sizes are under 50MB
- Check browser console for detailed errors

## 🚀 Performance

- **First certificate**: ~10-15 seconds (loading AI model)
- **Subsequent certificates**: ~5-8 seconds each
- **18 agents**: ~3-5 minutes total processing time
- **GPU acceleration**: Install `pip install rembg[gpu]` for 2-3x speedup

## 🔒 Privacy & Security

- **100% Local Processing** - No data sent to cloud
- **Offline After Setup** - Only initial model download requires internet
- **No Data Storage** - Files auto-deleted after session (optional)

## 📦 Building for Production

### Build Frontend
```bash
cd frontend
npm run build
```

Serves optimized static files from `frontend/build/`

### Serve with Flask (Optional)
Modify `backend/app.py` to serve React build:

```python
from flask import send_from_directory

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(f"../frontend/build/{path}"):
        return send_from_directory('../frontend/build', path)
    return send_from_directory('../frontend/build', 'index.html')
```

## 📄 License

Free for internal business use.

## 🤝 Support

For issues:
1. Check this README
2. Review browser console (F12)
3. Check backend terminal logs
4. Verify all files are uploaded correctly

---

**Made with ❤️ for MDRT Certificate Automation**
