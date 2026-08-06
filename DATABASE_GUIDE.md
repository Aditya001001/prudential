# 🗄️ Database Integration Guide

## Overview

The MDRT Certificate Generator now includes a **SQLite database** to replace CSV file storage with proper relational data management.

---

## 🎯 **Why Database?**

### **Before (CSV-based):**
❌ No data validation
❌ No relationship tracking
❌ No history/audit trail
❌ File corruption risks
❌ Concurrent access issues
❌ No search capabilities

### **After (Database):**
✅ Structured data validation
✅ Agent-certificate relationships
✅ Complete generation history
✅ Reliable concurrent access
✅ Fast searches and queries
✅ Statistics and reporting

---

## 📊 **Database Schema**

### **1. Agents Table**
Stores all agent/user information

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment ID |
| client_code | String (20) | Unique client code (with leading zeros) |
| agent_name | String (200) | Full name |
| mdrt_tier | String (10) | MDRT, COT, or TOT |
| life_member | Boolean | LM badge earned |
| honor_roll | Boolean | HR badge earned |
| quarter_century | Boolean | QC badge earned |
| email | String (200) | Optional email |
| phone | String (50) | Optional phone |
| created_at | DateTime | Record creation timestamp |
| updated_at | DateTime | Last update timestamp |

**Indexes:** `client_code` (unique)

---

### **2. Certificates Table**
Tracks every generated certificate

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment ID |
| agent_id | Integer (FK) | Links to agents table |
| filename | String (255) | Certificate filename |
| filepath | String (500) | Full file path |
| file_size | Integer | File size in bytes |
| generated_at | DateTime | Generation timestamp |
| generated_by | String (100) | Optional: who generated it |
| agent_name_snapshot | String (200) | Name at generation time |
| tier_snapshot | String (10) | Tier at generation time |
| badges_snapshot | String (50) | Badges at generation (e.g., "LM,HR") |
| is_downloaded | Boolean | Download status |
| download_count | Integer | Number of downloads |
| last_downloaded_at | DateTime | Last download timestamp |

**Relationships:** Belongs to Agent (one-to-many)

---

### **3. System Assets Table**
Tracks uploaded backgrounds and badges

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment ID |
| asset_type | String (50) | 'background' or 'badge' |
| asset_name | String (50) | 'MDRT', 'LM', etc. |
| filename | String (255) | Asset filename |
| filepath | String (500) | Full file path |
| file_size | Integer | File size in bytes |
| uploaded_at | DateTime | Upload timestamp |
| uploaded_by | String (100) | Optional: uploader |
| is_active | Boolean | Active status |

**Unique Constraint:** (asset_type, asset_name)

---

## 🚀 **Getting Started**

### **Step 1: Install Dependencies**

The database dependency is already in `requirements.txt`:
```bash
cd backend
pip install -r requirements.txt
```

This installs `Flask-SQLAlchemy>=3.1.0`

---

### **Step 2: Initialize Database**

```bash
cd backend
python init_db.py init
```

**Output:**
```
✅ Database tables created successfully!

📋 Created Tables:
  - agents: Store agent/user information
  - certificates: Track generated certificates
  - system_assets: Track uploaded backgrounds and badges
```

This creates `mdrt_certificates.db` in the backend folder.

---

### **Step 3: Import Existing CSV Data (Optional)**

If you have existing CSV data, migrate it:

```bash
python init_db.py migrate
```

Or specify a custom CSV path:
```bash
python init_db.py migrate path/to/data.csv
```

**Output:**
```
📥 Importing agents from admin_assets/data.csv...
✅ Import complete!
   - New agents: 18
   - Updated agents: 0
```

---

### **Step 4: Run the New Database-Enabled App**

**Option A: Test the new version first**
```bash
python app_with_db.py
```

**Option B: Replace the old app**
```bash
# Backup current app
copy app.py app_no_db_backup.py

# Use the database version
copy app_with_db.py app.py

# Run it
python app.py
```

---

## 📚 **Database Commands**

### **Initialize Database**
```bash
python init_db.py init
```
Creates all tables in `mdrt_certificates.db`

### **Import CSV to Database**
```bash
python init_db.py migrate [csv_file]
```
Imports agents from CSV (default: `admin_assets/data.csv`)

### **View Statistics**
```bash
python init_db.py stats
```

**Output:**
```
📊 Database Statistics:
  Total Agents: 18
  Total Certificates: 45

  Tier Breakdown:
    - MDRT: 5
    - COT: 7
    - TOT: 6

  Badge Breakdown:
    - Life Member: 12
    - Honor Roll: 8
    - Quarter Century: 4
```

### **Drop All Tables (DANGER!)**
```bash
python init_db.py drop
```
⚠️ This deletes ALL data! You'll be prompted for confirmation.

---

## 🔄 **Backward Compatibility**

The database version is **100% backward compatible** with the CSV workflow:

1. **CSV Upload Still Works:**
   - Admin uploads CSV → Automatically imported to database
   - No manual migration needed

2. **Client Code Matching:**
   - User uploads photo named `00020880.jpg`
   - System searches database by client code
   - Same workflow as before

3. **File Storage:**
   - Backgrounds and badges still stored as files
   - Database just tracks metadata

---

## 🌟 **New Features with Database**

### **1. Agent Management API**

**Get all agents:**
```http
GET /api/agents
```

**Search agents:**
```http
GET /api/agents?search=Catherine
```

**Get specific agent:**
```http
GET /api/agents/00020880
```

**Update agent:**
```http
PUT /api/agents/1
Content-Type: application/json

{
  "agent_name": "Updated Name",
  "email": "agent@example.com"
}
```

**Delete agent:**
```http
DELETE /api/agents/1
```

---

### **2. Certificate History**

**Get recent certificates:**
```http
GET /api/certificates/recent?limit=10
```

**Response:**
```json
{
  "success": true,
  "certificates": [
    {
      "id": 1,
      "filename": "00020880_KOO_SAU_FONG_CATHERINE_TOT.png",
      "generated_at": "2026-07-29T10:30:00",
      "agent_name": "KOO SAU FONG CATHERINE",
      "tier": "TOT",
      "badges": "LM,HR,QC",
      "download_count": 3
    }
  ]
}
```

---

### **3. Statistics Dashboard**

```http
GET /api/statistics
```

**Response:**
```json
{
  "total_agents": 18,
  "total_certificates": 45,
  "tier_breakdown": {
    "MDRT": 5,
    "COT": 7,
    "TOT": 6
  },
  "badge_breakdown": {
    "LM": 12,
    "HR": 8,
    "QC": 4
  }
}
```

---

## 🔍 **Database File Location**

```
backend/
└── mdrt_certificates.db    # SQLite database file
```

**To view/edit database:**
- Use [DB Browser for SQLite](https://sqlitebrowser.org/) (free GUI)
- Or any SQLite client

---

## 📝 **Migration Notes**

### **CSV → Database Auto-Import**

When admin uploads CSV through the web interface:
1. CSV saved to `admin_assets/data.csv`
2. **Automatically imported to database**
3. Existing agents updated, new agents created
4. Preview shows first 10 agents

### **Leading Zeros Preserved**

```python
# In database.py
client_code = db.Column(db.String(20), ...)  # String type

# In db_services.py
df = pd.read_csv(csv_path, dtype={'Client Cd': str})
```

Client codes like `00020880` stay as `00020880` ✅

---

## ⚠️ **Important Notes**

1. **Database file is created automatically** on first run
2. **No migration needed** - CSV upload works as before
3. **Existing CSV data preserved** - can be imported anytime
4. **SQLite is file-based** - no server required
5. **Backup the .db file** to backup all data

---

## 🎯 **Quick Commands Summary**

```bash
# Setup
python init_db.py init                    # Create database
python init_db.py migrate                 # Import CSV data
python init_db.py stats                   # View statistics

# Run
python app_with_db.py                     # Test new version
# OR
python app.py                             # (after replacing with DB version)
```

---

**Database = Better data management + Same easy workflow!** 🚀
