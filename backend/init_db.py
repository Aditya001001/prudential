"""
Database initialization script
Run this to create the database and tables
"""
from flask import Flask
from database import db, Agent, Certificate, SystemAsset
import os

def init_database(app=None):
    """Initialize the database"""
    if app is None:
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mdrt_certificates.db'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        db.init_app(app)
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✅ Database tables created successfully!")
        
        # Print table info
        print("\n📋 Created Tables:")
        print("  - agents: Store agent/user information")
        print("  - certificates: Track generated certificates")
        print("  - system_assets: Track uploaded backgrounds and badges")
        
        return db

def drop_database(app=None):
    """Drop all database tables (CAUTION: destroys all data!)"""
    if app is None:
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mdrt_certificates.db'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        db.init_app(app)
    
    with app.app_context():
        response = input("⚠️  WARNING: This will delete ALL data. Continue? (yes/no): ")
        if response.lower() == 'yes':
            db.drop_all()
            print("❌ All tables dropped!")
        else:
            print("✅ Operation cancelled.")

def migrate_csv_to_db(csv_path='admin_assets/data.csv'):
    """Migrate existing CSV data to database"""
    from db_services import import_agents_from_csv
    
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mdrt_certificates.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    with app.app_context():
        if not os.path.exists(csv_path):
            print(f"❌ CSV file not found: {csv_path}")
            return
        
        print(f"📥 Importing agents from {csv_path}...")
        result = import_agents_from_csv(csv_path)
        
        if result['success']:
            print(f"✅ Import complete!")
            print(f"   - New agents: {result['imported']}")
            print(f"   - Updated agents: {result['updated']}")
            if result['errors']:
                print(f"   - Errors: {len(result['errors'])}")
                for error in result['errors'][:5]:  # Show first 5 errors
                    print(f"     • {error}")
        else:
            print(f"❌ Import failed: {result['error']}")

def show_statistics():
    """Show database statistics"""
    from db_services import get_statistics
    
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mdrt_certificates.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    with app.app_context():
        stats = get_statistics()
        
        print("\n📊 Database Statistics:")
        print(f"  Total Agents: {stats['total_agents']}")
        print(f"  Total Certificates: {stats['total_certificates']}")
        
        print("\n  Tier Breakdown:")
        for tier, count in stats['tier_breakdown'].items():
            print(f"    - {tier}: {count}")
        
        print("\n  Badge Breakdown:")
        for badge, count in stats['badge_breakdown'].items():
            badge_names = {'LM': 'Life Member', 'HR': 'Honor Roll', 'QC': 'Quarter Century'}
            print(f"    - {badge_names[badge]}: {count}")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python init_db.py init          - Initialize database")
        print("  python init_db.py migrate       - Migrate CSV to database")
        print("  python init_db.py stats         - Show statistics")
        print("  python init_db.py drop          - Drop all tables (DANGER!)")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'init':
        init_database()
    elif command == 'migrate':
        csv_file = sys.argv[2] if len(sys.argv) > 2 else 'admin_assets/data.csv'
        migrate_csv_to_db(csv_file)
    elif command == 'stats':
        show_statistics()
    elif command == 'drop':
        drop_database()
    else:
        print(f"Unknown command: {command}")
