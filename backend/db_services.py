"""
Database service layer - handles all database operations
"""
from database import db, Agent, Certificate, SystemAsset, CSVUploadHistory
from datetime import datetime
import pandas as pd


# ============= AGENT SERVICES =============

def create_agent(client_code, agent_name, mdrt_tier, life_member=False, honor_roll=False, quarter_century=False, email=None, phone=None):
    """Create a new agent"""
    values = validate_agent_values(dict(client_code=client_code, agent_name=agent_name, mdrt_tier=mdrt_tier))
    client_code, agent_name, mdrt_tier = values['client_code'], values['agent_name'], values['mdrt_tier']
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
    return db.session.get(Agent, agent_id)


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
    agent = db.session.get(Agent, agent_id)
    if not agent:
        return None
    
    for key in ('life_member', 'honor_roll', 'quarter_century'):
        if key in kwargs and not isinstance(kwargs[key], bool):
            raise ValueError(f'{key} must be a boolean.')
    validated = validate_agent_values({'client_code': agent.client_code, 'agent_name': kwargs.get('agent_name', agent.agent_name), 'mdrt_tier': kwargs.get('mdrt_tier', agent.mdrt_tier)})
    kwargs.update(agent_name=validated['agent_name'], mdrt_tier=validated['mdrt_tier'])
    allowed_fields = ['agent_name', 'mdrt_tier', 'life_member', 'honor_roll', 'quarter_century', 'email', 'phone']
    for key, value in kwargs.items():
        if key in allowed_fields:
            setattr(agent, key, value)
    
    agent.updated_at = datetime.now()
    db.session.commit()
    return agent


def delete_agent(agent_id):
    """Delete master data while preserving certificate snapshots."""
    agent = db.session.get(Agent, agent_id)
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


def validate_agent_values(values):
    import re
    code = str(values.get('client_code', '')).strip()
    name = values.get('agent_name')
    tier = str(values.get('mdrt_tier', '')).strip().upper()
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,20}', code) or code.lower() == 'nan':
        raise ValueError('Client Cd must contain 1-20 letters, digits, underscores or hyphens.')
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 200:
        raise ValueError('Agent Name must contain 1-200 characters.')
    if any(ord(c) < 32 for c in name):
        raise ValueError('Agent Name contains control characters.')
    if tier not in {'MDRT', 'COT', 'TOT'}:
        raise ValueError('MDRT Title must be MDRT, COT or TOT.')
    return {**values, 'client_code': code, 'agent_name': name.strip(), 'mdrt_tier': tier}


def parse_badge(value, code):
    if pd.isna(value):
        return False
    text = str(value).strip().upper()
    if text in {'', 'NO', 'N', 'FALSE', '0', '0.0'}:
        return False
    if text in {code, 'YES', 'Y', 'TRUE', '1', '1.0'}:
        return True
    raise ValueError(f'Invalid {code} value: use {code}, Yes/No, True/False, 1/0, or blank.')


def import_agents_from_csv(csv_path, commit=True):
    """Validate the entire file, then atomically merge it into the master data.

    Omitted agents remain; this is an upsert, never an implicit replacement.
    Set commit=False to include asset metadata/history in the same transaction.
    """
    try:
        ext = str(csv_path).rsplit('.', 1)[-1].lower()
        if ext not in {'csv', 'xlsx', 'xls'}:
            raise ValueError('Upload a CSV, XLSX or XLS file.')
        if ext == 'xlsx':
            from zipfile import ZipFile, BadZipFile
            try:
                with ZipFile(csv_path) as archive:
                    if sum(item.file_size for item in archive.infolist()) > 128 * 1024 * 1024:
                        raise ValueError('Excel workbook is too large when decompressed.')
            except BadZipFile as error:
                raise ValueError('Invalid XLSX workbook.') from error
        if ext == 'csv':
            df = pd.read_csv(csv_path, dtype={'Client Cd': str}, keep_default_na=False, nrows=50001)
        else:
            df = pd.read_excel(csv_path, dtype={'Client Cd': str}, keep_default_na=False,
                               engine='xlrd' if ext == 'xls' else 'openpyxl', nrows=50001)
        required = {'Client Cd', 'Agent Name', 'MDRT Title'}
        missing = required - set(df.columns)
        if missing:
            raise ValueError('Missing required columns: ' + ', '.join(sorted(missing)))
        if df.empty or len(df) > 50000:
            raise ValueError('Master data must contain between 1 and 50,000 agents.')
        rows, errors, seen = [], [], set()
        for index, row in df.iterrows():
            try:
                values = validate_agent_values({
                    'client_code': row['Client Cd'], 'agent_name': row['Agent Name'],
                    'mdrt_tier': row['MDRT Title'],
                    'life_member': parse_badge(row.get('Life Member', ''), 'LM'),
                    'honor_roll': parse_badge(row.get('Honor Roll', ''), 'HR'),
                    'quarter_century': parse_badge(row.get('Quarter Century', ''), 'QC'),
                })
                if values['client_code'] in seen:
                    raise ValueError('Duplicate Client Cd in this upload.')
                seen.add(values['client_code'])
                rows.append(values)
            except ValueError as error:
                if len(errors) < 100:
                    errors.append(f'Row {index + 2}: {error}')
        if errors:
            return {'success': False, 'error': 'Import rejected. No agents changed.', 'errors': errors}
        existing = {agent.client_code: agent for agent in Agent.query.all()}
        imported = updated = 0
        for values in rows:
            agent = existing.get(values['client_code'])
            if agent:
                for key, value in values.items():
                    setattr(agent, key, value)
                updated += 1
            else:
                db.session.add(Agent(**values))
                imported += 1
        db.session.flush()
        if commit:
            db.session.commit()
        return {'success': True, 'imported': imported, 'updated': updated, 'errors': []}
    except Exception as error:
        db.session.rollback()
        return {'success': False, 'error': str(error)}


# ============= CERTIFICATE SERVICES =============

def create_certificate(agent_id, filename, filepath, file_size=None, generated_by=None):
    """Create a certificate record (keeps all generations as history)"""
    agent = get_agent_by_id(agent_id)
    if not agent:
        return None

    # Count existing certificates for this agent
    existing_count = Certificate.query.filter_by(agent_id=agent_id).count()
    print(f"[CERTIFICATE] Agent {agent_id} has {existing_count} existing certificate(s)")

    # Create new certificate record (keeping all previous generations)
    certificate = Certificate(
        agent_id=agent_id,
        filename=filename,
        filepath=filepath,
        file_size=file_size,
        generated_by=generated_by,
        client_code_snapshot=agent.client_code,
        agent_name_snapshot=agent.agent_name,
        tier_snapshot=agent.mdrt_tier,
        badges_snapshot=','.join(agent.get_badges())
    )
    db.session.add(certificate)
    db.session.commit()

    print(f"[CERTIFICATE] Created new certificate: {filename} (Total for agent: {existing_count + 1})")
    return certificate


def get_certificate_by_id(cert_id):
    """Get certificate by ID"""
    return db.session.get(Certificate, cert_id)


def get_certificates_by_agent(agent_id):
    """Get all certificates for an agent"""
    return Certificate.query.filter_by(agent_id=agent_id).order_by(Certificate.generated_at.desc()).all()


def get_recent_certificates(limit=10):
    """Get recently generated certificates"""
    return Certificate.query.order_by(Certificate.generated_at.desc()).limit(limit).all()


def mark_certificate_downloaded(cert_id):
    """Mark a certificate as downloaded"""
    cert = db.session.get(Certificate, cert_id)
    if cert:
        cert.mark_downloaded()
        db.session.commit()
        return cert
    return None


def delete_certificate(cert_id):
    """Delete a certificate record"""
    cert = db.session.get(Certificate, cert_id)
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

def create_or_update_asset(asset_type, asset_name, filename, filepath, file_size=None, uploaded_by=None, commit=True):
    """Create or update a system asset"""
    asset = SystemAsset.query.filter_by(asset_type=asset_type, asset_name=asset_name).first()

    if asset:
        # Update existing
        asset.filename = filename
        asset.filepath = filepath
        asset.file_size = file_size
        asset.uploaded_at = datetime.now()
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

    if commit:
        db.session.commit()
    else:
        db.session.flush()
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


def create_csv_upload_record(original_filename, stored_filename, filepath, file_size, total_agents=0, imported_count=0, updated_count=0, uploaded_by=None, commit=True):
    """Create a record for a master CSV upload (kept permanently as history)"""
    record = CSVUploadHistory(
        original_filename=original_filename,
        stored_filename=stored_filename,
        filepath=filepath,
        file_size=file_size,
        total_agents=total_agents,
        imported_count=imported_count,
        updated_count=updated_count,
        uploaded_by=uploaded_by
    )
    db.session.add(record)
    if commit:
        db.session.commit()
    else:
        db.session.flush()
    return record


def get_csv_upload_history():
    """Get all master CSV upload history, most recent first"""
    return CSVUploadHistory.query.order_by(CSVUploadHistory.uploaded_at.desc()).all()


def get_csv_upload_by_id(upload_id):
    """Get a single CSV upload history record by id"""
    return db.session.get(CSVUploadHistory, upload_id)


def delete_csv_upload_record(upload_id):
    """Delete a master CSV/Excel upload history record"""
    record = db.session.get(CSVUploadHistory, upload_id)
    if record:
        db.session.delete(record)
        db.session.commit()
        return record
    return None


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

