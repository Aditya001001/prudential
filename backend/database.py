from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# ============= DATABASE MODELS =============

class Agent(db.Model):
    """Agent/User information - replaces CSV data"""
    __tablename__ = 'agents'
    
    id = db.Column(db.Integer, primary_key=True)
    client_code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    agent_name = db.Column(db.String(200), nullable=False)
    mdrt_tier = db.Column(db.String(10), nullable=False)  # MDRT, COT, TOT
    
    # Achievement badges
    life_member = db.Column(db.Boolean, default=False)
    honor_roll = db.Column(db.Boolean, default=False)
    quarter_century = db.Column(db.Boolean, default=False)
    
    # Additional metadata
    email = db.Column(db.String(200), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    certificates = db.relationship('Certificate', back_populates='agent', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Agent {self.client_code}: {self.agent_name}>'
    
    def to_dict(self):
        """Convert to dictionary for JSON responses"""
        return {
            'id': self.id,
            'client_code': self.client_code,
            'agent_name': self.agent_name,
            'mdrt_tier': self.mdrt_tier,
            'life_member': self.life_member,
            'honor_roll': self.honor_roll,
            'quarter_century': self.quarter_century,
            'email': self.email,
            'phone': self.phone,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_badges(self):
        """Get list of badge codes earned"""
        badges = []
        if self.life_member:
            badges.append('LM')
        if self.honor_roll:
            badges.append('HR')
        if self.quarter_century:
            badges.append('QC')
        return badges


class Certificate(db.Model):
    """Generated certificates - tracking and history"""
    __tablename__ = 'certificates'

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('agents.id'), nullable=False)

    # File information
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)  # in bytes

    # Original uploaded photo information
    original_photo_filename = db.Column(db.String(255), nullable=True)
    original_photo_filepath = db.Column(db.String(500), nullable=True)
    original_photo_size = db.Column(db.Integer, nullable=True)  # in bytes

    # Generation metadata
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    generated_by = db.Column(db.String(100))  # Optional: track who generated it

    # Certificate details (snapshot at generation time)
    agent_name_snapshot = db.Column(db.String(200))
    tier_snapshot = db.Column(db.String(10))
    badges_snapshot = db.Column(db.String(50))  # e.g., "LM,HR,QC"

    # Status
    is_downloaded = db.Column(db.Boolean, default=False)
    download_count = db.Column(db.Integer, default=0)
    last_downloaded_at = db.Column(db.DateTime, nullable=True)
    
    # Relationship
    agent = db.relationship('Agent', back_populates='certificates')
    
    def __repr__(self):
        return f'<Certificate {self.filename}>'
    
    def to_dict(self):
        """Convert to dictionary for JSON responses"""
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'filename': self.filename,
            'filepath': self.filepath,
            'file_size': self.file_size,
            'original_photo_filename': self.original_photo_filename,
            'has_original_photo': self.original_photo_filename is not None,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'generated_by': self.generated_by,
            'agent_name': self.agent_name_snapshot,
            'tier': self.tier_snapshot,
            'badges': self.badges_snapshot,
            'is_downloaded': self.is_downloaded,
            'download_count': self.download_count,
            'last_downloaded_at': self.last_downloaded_at.isoformat() if self.last_downloaded_at else None
        }
    
    def mark_downloaded(self):
        """Mark certificate as downloaded"""
        self.is_downloaded = True
        self.download_count += 1
        self.last_downloaded_at = datetime.utcnow()


class SystemAsset(db.Model):
    """System assets metadata - backgrounds, badges, etc."""
    __tablename__ = 'system_assets'
    
    id = db.Column(db.Integer, primary_key=True)
    asset_type = db.Column(db.String(50), nullable=False)  # 'background', 'badge'
    asset_name = db.Column(db.String(50), nullable=False)  # 'MDRT', 'LM', etc.
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by = db.Column(db.String(100))  # Optional: track admin user
    
    is_active = db.Column(db.Boolean, default=True)
    
    __table_args__ = (
        db.UniqueConstraint('asset_type', 'asset_name', name='unique_asset'),
    )
    
    def __repr__(self):
        return f'<SystemAsset {self.asset_type}/{self.asset_name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'asset_type': self.asset_type,
            'asset_name': self.asset_name,
            'filename': self.filename,
            'filepath': self.filepath,
            'file_size': self.file_size,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'is_active': self.is_active
        }
