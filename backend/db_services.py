"""
Database service layer - handles all database operations
"""
from database import db, Agent, Certificate, SystemAsset
from datetime import datetime
import pandas as pd


# ============= AGENT SERVICES =============

def create_agent(client_code, agent_name, mdrt_tier, life_member=False, honor_roll=False, quarter_century=False, email=None, phone=None):
    """Create a new agent"""
    agent = Agent(
        client_code=client_code,
        agent_name=agent_name,
        mdrt_tier=mdrt_tier,
        life_member=life_member,
        honor_roll=honor_roll,
        quarter_century=quarter_century,
        email=email,
        phone=phone
    )
    db.session.add(agent)
    db.session.commit()
    return agent


def get_agent_by_client_code(client_code):
    """Find agent by client code"""
    return Agent.query.filter_by(client_code=str(client_code).strip()).first()


def get_agent_by_id(agent_id):
    """Find agent by ID"""
    return Agent.query.get(agent_id)


def get_all_agents(limit=None, offset=None):
    """Get all agents with optional pagination"""
    query = Agent.query.order_by(Agent.agent_name)
    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)
    return query.all()


def update_agent(agent_id, **kwargs):
    """Update agent information"""
    agent = Agent.query.get(agent_id)
    if not agent:
        return None
    
    allowed_fields = ['agent_name', 'mdrt_tier', 'life_member', 'honor_roll', 'quarter_century', 'email', 'phone']
    for key, value in kwargs.items():
        if key in allowed_fields:
            setattr(agent, key, value)
    
    agent.updated_at = datetime.utcnow()
    db.session.commit()
    return agent


def delete_agent(agent_id):
    """Delete an agent (and their certificates)"""
    agent = Agent.query.get(agent_id)
    if agent:
        db.session.delete(agent)
        db.session.commit()
        return True
    return False


def search_agents(search_term):
    """Search agents by name or client code"""
    search = f"%{search_term}%"
    return Agent.query.filter(
        (Agent.agent_name.ilike(search)) | (Agent.client_code.ilike(search))
    ).all()


def import_agents_from_csv(csv_path):
    """
    Import agents from CSV file (maintains backward compatibility)
    Expected columns: Client Cd, Agent Name, MDRT Title, Life Member, Honor Roll, Quarter Century
    """
    try:
        df = pd.read_csv(csv_path, dtype={'Client Cd': str})
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                client_code = str(row['Client Cd']).strip()
                agent_name = row['Agent Name']
                mdrt_tier = row['MDRT Title']
                
                # Parse badges (can be 'LM', empty string, or NaN)
                life_member = pd.notna(row.get('Life Member')) and str(row['Life Member']).strip() != ''
                honor_roll = pd.notna(row.get('Honor Roll')) and str(row['Honor Roll']).strip() != ''
                quarter_century = pd.notna(row.get('Quarter Century')) and str(row['Quarter Century']).strip() != ''
                
                # Check if agent already exists
                existing_agent = get_agent_by_client_code(client_code)
                
                if existing_agent:
                    # Update existing
                    update_agent(
                        existing_agent.id,
                        agent_name=agent_name,
                        mdrt_tier=mdrt_tier,
                        life_member=life_member,
                        honor_roll=honor_roll,
                        quarter_century=quarter_century
                    )
                    updated_count += 1
                else:
                    # Create new
                    create_agent(
                        client_code=client_code,
                        agent_name=agent_name,
                        mdrt_tier=mdrt_tier,
                        life_member=life_member,
                        honor_roll=honor_roll,
                        quarter_century=quarter_century
                    )
                    imported_count += 1
                    
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        return {
            'success': True,
            'imported': imported_count,
            'updated': updated_count,
            'errors': errors
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


# ============= CERTIFICATE SERVICES =============

def create_certificate(agent_id, filename, filepath, file_size=None, generated_by=None):
    """Create a certificate record"""
    agent = get_agent_by_id(agent_id)
    if not agent:
        return None

    certificate = Certificate(
        agent_id=agent_id,
        filename=filename,
        filepath=filepath,
        file_size=file_size,
        generated_by=generated_by,
        agent_name_snapshot=agent.agent_name,
        tier_snapshot=agent.mdrt_tier,
        badges_snapshot=','.join(agent.get_badges())
    )
    db.session.add(certificate)
    db.session.commit()
    return certificate


def get_certificate_by_id(cert_id):
    """Get certificate by ID"""
    return Certificate.query.get(cert_id)


def get_certificates_by_agent(agent_id):
    """Get all certificates for an agent"""
    return Certificate.query.filter_by(agent_id=agent_id).order_by(Certificate.generated_at.desc()).all()


def get_recent_certificates(limit=10):
    """Get recently generated certificates"""
    return Certificate.query.order_by(Certificate.generated_at.desc()).limit(limit).all()


def mark_certificate_downloaded(cert_id):
    """Mark a certificate as downloaded"""
    cert = Certificate.query.get(cert_id)
    if cert:
        cert.mark_downloaded()
        db.session.commit()
        return cert
    return None


def delete_certificate(cert_id):
    """Delete a certificate record"""
    cert = Certificate.query.get(cert_id)
    if cert:
        db.session.delete(cert)
        db.session.commit()
        return True
    return False


def get_statistics():
    """Get system statistics"""
    total_agents = Agent.query.count()
    total_certificates = Certificate.query.count()

    # Count by tier
    mdrt_count = Agent.query.filter_by(mdrt_tier='MDRT').count()
    cot_count = Agent.query.filter_by(mdrt_tier='COT').count()
    tot_count = Agent.query.filter_by(mdrt_tier='TOT').count()

    # Count by badges
    lm_count = Agent.query.filter_by(life_member=True).count()
    hr_count = Agent.query.filter_by(honor_roll=True).count()
    qc_count = Agent.query.filter_by(quarter_century=True).count()

    return {
        'total_agents': total_agents,
        'total_certificates': total_certificates,
        'tier_breakdown': {
            'MDRT': mdrt_count,
            'COT': cot_count,
            'TOT': tot_count
        },
        'badge_breakdown': {
            'LM': lm_count,
            'HR': hr_count,
            'QC': qc_count
        }
    }


# ============= SYSTEM ASSET SERVICES =============

def create_or_update_asset(asset_type, asset_name, filename, filepath, file_size=None, uploaded_by=None):
    """Create or update a system asset"""
    asset = SystemAsset.query.filter_by(asset_type=asset_type, asset_name=asset_name).first()

    if asset:
        # Update existing
        asset.filename = filename
        asset.filepath = filepath
        asset.file_size = file_size
        asset.uploaded_at = datetime.utcnow()
        asset.uploaded_by = uploaded_by
        asset.is_active = True
    else:
        # Create new
        asset = SystemAsset(
            asset_type=asset_type,
            asset_name=asset_name,
            filename=filename,
            filepath=filepath,
            file_size=file_size,
            uploaded_by=uploaded_by
        )
        db.session.add(asset)

    db.session.commit()
    return asset


def get_asset(asset_type, asset_name):
    """Get a specific asset"""
    return SystemAsset.query.filter_by(
        asset_type=asset_type,
        asset_name=asset_name,
        is_active=True
    ).first()


def get_all_assets_by_type(asset_type):
    """Get all assets of a specific type"""
    return SystemAsset.query.filter_by(asset_type=asset_type, is_active=True).all()


def check_system_assets_ready():
    """Check if all required system assets are uploaded"""
    backgrounds = ['MDRT', 'COT', 'TOT']
    badges = ['LM', 'HR', 'QC']

    status = {
        'backgrounds': {},
        'badges': {},
        'all_ready': False
    }

    # Check backgrounds
    for bg in backgrounds:
        asset = get_asset('background', bg)
        status['backgrounds'][bg] = asset is not None

    # Check badges
    for badge in badges:
        asset = get_asset('badge', badge)
        status['badges'][badge] = asset is not None

    # Check if all ready
    all_backgrounds = all(status['backgrounds'].values())
    all_badges = all(status['badges'].values())
    status['all_ready'] = all_backgrounds and all_badges

    return status

