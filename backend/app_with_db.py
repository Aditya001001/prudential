from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
from PIL import Image, ImageDraw, ImageFont
from rembg import remove
import io
from werkzeug.utils import secure_filename
from datetime import datetime

# Database imports
from database import db, Agent, Certificate, SystemAsset
from db_services import (
    get_agent_by_client_code, get_agent_by_id, get_all_agents,
    create_agent, update_agent, delete_agent, search_agents,
    import_agents_from_csv, create_certificate, get_certificates_by_agent,
    get_recent_certificates, mark_certificate_downloaded, get_statistics,
    create_or_update_asset, get_asset, check_system_assets_ready
)

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mdrt_certificates.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Configuration - Dual Architecture
ADMIN_ASSETS_FOLDER = 'admin_assets'
USER_UPLOADS_FOLDER = 'user_uploads'
USER_OUTPUTS_FOLDER = 'user_outputs'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'csv'}

# Create folder structure
os.makedirs(ADMIN_ASSETS_FOLDER, exist_ok=True)
os.makedirs(os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds'), exist_ok=True)
os.makedirs(os.path.join(ADMIN_ASSETS_FOLDER, 'badges'), exist_ok=True)
os.makedirs(USER_UPLOADS_FOLDER, exist_ok=True)
os.makedirs(USER_OUTPUTS_FOLDER, exist_ok=True)

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# Fixed positions for 899x1600px poster templates (from 20260714 Poster Report)
# Template size: 899 x 1600 pixels
# Scaling factor from 494x740: width ~1.82x, height ~2.16x
TEMPLATE_WIDTH = 899
TEMPLATE_HEIGHT = 1600

FIXED_POSITIONS = {
    'agent_photo': {'x': 449, 'y': 691, 'max_width': 455, 'max_height': 756},  # Scaled proportionally
    'name_text': {'x': 449, 'y': 1339, 'font_size': 58, 'color': '#FFFFFF', 'glow_intensity': 14, 'outline_width': 4},  # Scaled
    'badges': {'x': 55, 'y': 540, 'spacing': 109, 'size': 91}  # Scaled proportionally
}

# Neon colors by tier
NEON_COLORS = {
    'TOT': (255, 215, 0),    # Gold
    'COT': (255, 100, 100),  # Red/Pink
    'MDRT': (100, 200, 255)  # Blue/Cyan
}

# Initialize database on first run
with app.app_context():
    db.create_all()

# ============= HELPER FUNCTIONS =============

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_admin_asset_status():
    """Check which admin assets are uploaded (file-based + database)"""
    status = {
        'backgrounds': {},
        'badges': {},
        'csv': False,
        'agent_count': 0
    }
    
    # Check backgrounds (file-based for now, can migrate to DB)
    for tier in ['MDRT', 'COT', 'TOT']:
        bg_path = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', f'{tier}.png')
        status['backgrounds'][tier] = os.path.exists(bg_path)
    
    # Check badges (file-based for now)
    for badge in ['LM', 'HR', 'QC']:
        badge_path = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', f'{badge}.png')
        status['badges'][badge] = os.path.exists(badge_path)
    
    # Check CSV / Database
    agent_count = Agent.query.count()
    status['csv'] = agent_count > 0
    status['agent_count'] = agent_count
    
    return status

def remove_background(image_path):
    """Remove background from image"""
    with Image.open(image_path) as img:
        no_bg = remove(img)
        return no_bg.convert("RGBA")

def draw_neon_text(draw_obj, text, position, font, tier):
    """Draw text with neon glow effect based on tier"""
    x, y = position
    glow_color = NEON_COLORS.get(tier, (255, 255, 255))
    glow_size = FIXED_POSITIONS['name_text']['glow_intensity']
    outline_width = FIXED_POSITIONS['name_text']['outline_width']
    
    # Create a separate image for glow
    text_bbox = draw_obj.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    # Center the text
    text_x = int(x - text_width / 2)
    text_y = y
    
    # Draw glow layers (outer to inner, fading alpha)
    for radius in range(glow_size, 0, -1):
        glow_alpha = int(100 * (1 - radius/glow_size))
        for offset_x in range(-radius, radius+1):
            for offset_y in range(-radius, radius+1):
                if offset_x*offset_x + offset_y*offset_y <= radius*radius:
                    draw_obj.text(
                        (text_x + offset_x, text_y + offset_y),
                        text,
                        font=font,
                        fill=(*glow_color, glow_alpha)
                    )
    
    # Draw black outline for definition
    for offset_x in range(-outline_width, outline_width+1):
        for offset_y in range(-outline_width, outline_width+1):
            if offset_x != 0 or offset_y != 0:
                draw_obj.text((text_x + offset_x, text_y + offset_y), text, font=font, fill=(0, 0, 0, 255))
    
    # Draw main white text
    draw_obj.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

# ============= ADMIN ENDPOINTS =============

@app.route('/api/admin/status', methods=['GET'])
def admin_get_status():
    """Admin: Get system status"""
    status = get_admin_asset_status()

    # Add CSV preview if available (format to match CSV structure for frontend compatibility)
    if status['csv']:
        agents = get_all_agents(limit=10)
        status['csv_info'] = {
            'total_agents': status['agent_count'],
            'preview': [
                {
                    'Client Cd': agent.client_code,
                    'Agent Name': agent.agent_name,
                    'MDRT Title': agent.mdrt_tier,
                    'Life Member': 'LM' if agent.life_member else '',
                    'Honor Roll': 'HR' if agent.honor_roll else '',
                    'Quarter Century': 'QC' if agent.quarter_century else ''
                }
                for agent in agents
            ]
        }

    return jsonify(status)

@app.route('/api/admin/upload-backgrounds', methods=['POST'])
def admin_upload_backgrounds():
    """Admin: Upload tier background images"""
    try:
        files = request.files
        uploaded = {}

        for tier in ['MDRT', 'COT', 'TOT']:
            if tier in files:
                file = files[tier]
                if file and allowed_file(file.filename):
                    filename = f"{tier}.png"
                    filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', filename)
                    file.save(filepath)

                    # Track in database
                    file_size = os.path.getsize(filepath)
                    create_or_update_asset('background', tier, filename, filepath, file_size)
                    uploaded[tier] = True

        return jsonify({'success': True, 'uploaded': uploaded})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/upload-badges', methods=['POST'])
def admin_upload_badges():
    """Admin: Upload badge images"""
    try:
        files = request.files
        uploaded = {}

        for badge in ['LM', 'HR', 'QC']:
            if badge in files:
                file = files[badge]
                if file and allowed_file(file.filename):
                    filename = f"{badge}.png"
                    filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', filename)
                    file.save(filepath)

                    # Track in database
                    file_size = os.path.getsize(filepath)
                    create_or_update_asset('badge', badge, filename, filepath, file_size)
                    uploaded[badge] = True

        return jsonify({'success': True, 'uploaded': uploaded})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/upload-csv', methods=['POST'])
def admin_upload_csv():
    """Admin: Upload master CSV file and import to database"""
    try:
        if 'csv' not in request.files:
            return jsonify({'success': False, 'error': 'No CSV file provided'}), 400

        file = request.files['csv']
        if file and allowed_file(file.filename):
            # Save CSV file
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'data.csv')
            file.save(filepath)

            # Import to database
            result = import_agents_from_csv(filepath)

            if result['success']:
                stats = get_statistics()
                agents = get_all_agents(limit=10)  # Get first 10 for preview

                # Format preview to match CSV structure for frontend compatibility
                preview = [
                    {
                        'Client Cd': agent.client_code,
                        'Agent Name': agent.agent_name,
                        'MDRT Title': agent.mdrt_tier,
                        'Life Member': 'LM' if agent.life_member else '',
                        'Honor Roll': 'HR' if agent.honor_roll else '',
                        'Quarter Century': 'QC' if agent.quarter_century else ''
                    }
                    for agent in agents
                ]

                return jsonify({
                    'success': True,
                    'total_agents': stats['total_agents'],
                    'imported': result['imported'],
                    'updated': result['updated'],
                    'preview': preview,
                    'errors': result['errors'] if result['errors'] else None
                })
            else:
                return jsonify({'success': False, 'error': result['error']}), 400

        return jsonify({'success': False, 'error': 'Invalid file'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/preview-asset/<asset_type>/<filename>', methods=['GET'])
def admin_preview_asset(asset_type, filename):
    """Admin: Preview uploaded assets"""
    try:
        # Accept both singular and plural forms
        if asset_type in ['background', 'backgrounds']:
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', filename)
        elif asset_type in ['badge', 'badges']:
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', filename)
        else:
            return jsonify({'error': 'Invalid asset type'}), 400

        if os.path.exists(filepath):
            return send_file(filepath)
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/reset-database', methods=['POST'])
def admin_reset_database():
    """Admin: Reset admin assets and agent data (keeps generated certificates)"""
    try:
        # Count before deletion
        agent_count = Agent.query.count()

        # Delete all agents (but NOT certificates - they stay as history)
        Agent.query.delete()

        # Delete all system assets records
        SystemAsset.query.delete()

        # Commit the database transaction
        db.session.commit()

        # Delete physical files from admin_assets folder
        deleted_files = {
            'backgrounds': [],
            'badges': [],
            'csv': False
        }

        # Delete backgrounds
        backgrounds_dir = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds')
        if os.path.exists(backgrounds_dir):
            for filename in os.listdir(backgrounds_dir):
                if filename.endswith(('.png', '.jpg', '.jpeg')):
                    filepath = os.path.join(backgrounds_dir, filename)
                    os.remove(filepath)
                    deleted_files['backgrounds'].append(filename)

        # Delete badges
        badges_dir = os.path.join(ADMIN_ASSETS_FOLDER, 'badges')
        if os.path.exists(badges_dir):
            for filename in os.listdir(badges_dir):
                if filename.endswith('.png'):
                    filepath = os.path.join(badges_dir, filename)
                    os.remove(filepath)
                    deleted_files['badges'].append(filename)

        # Delete CSV if exists
        csv_path = os.path.join(ADMIN_ASSETS_FOLDER, 'master_data.csv')
        if os.path.exists(csv_path):
            os.remove(csv_path)
            deleted_files['csv'] = True

        return jsonify({
            'success': True,
            'message': 'Admin assets reset successfully (generated certificates preserved)',
            'deleted': {
                'agents': agent_count,
                'files': deleted_files
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 400

# ============= AGENT MANAGEMENT ENDPOINTS =============

@app.route('/api/agents', methods=['GET'])
def get_agents():
    """Get all agents or search"""
    try:
        search_term = request.args.get('search')
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int)

        if search_term:
            agents = search_agents(search_term)
        else:
            agents = get_all_agents(limit=limit, offset=offset)

        return jsonify({
            'success': True,
            'agents': [agent.to_dict() for agent in agents],
            'total': Agent.query.count()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/agents/<client_code>', methods=['GET'])
def get_agent(client_code):
    """Get agent by client code"""
    try:
        agent = get_agent_by_client_code(client_code)
        if agent:
            return jsonify({
                'success': True,
                'agent': agent.to_dict()
            })
        return jsonify({'success': False, 'error': 'Agent not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/agents/<int:agent_id>', methods=['PUT'])
def update_agent_endpoint(agent_id):
    """Update agent information"""
    try:
        data = request.json
        agent = update_agent(agent_id, **data)
        if agent:
            return jsonify({
                'success': True,
                'agent': agent.to_dict()
            })
        return jsonify({'success': False, 'error': 'Agent not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/agents/<int:agent_id>', methods=['DELETE'])
def delete_agent_endpoint(agent_id):
    """Delete an agent"""
    try:
        success = delete_agent(agent_id)
        if success:
            return jsonify({'success': True})
        return jsonify({'success': False, 'error': 'Agent not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

# ============= USER ENDPOINTS =============

@app.route('/api/user/check-system', methods=['GET'])
def user_check_system():
    """User: Check if system is ready"""
    status = get_admin_asset_status()

    all_backgrounds = all(status['backgrounds'].values())
    all_badges = all(status['badges'].values())
    has_agents = status['csv']

    ready = all_backgrounds and all_badges and has_agents

    return jsonify({
        'ready': ready,
        'status': status,
        'message': 'System ready' if ready else 'Admin must upload all assets and import agents first'
    })

@app.route('/api/user/upload-photo', methods=['POST'])
def user_upload_photo():
    """User: Upload agent photo and generate certificate"""
    try:
        # Get uploaded file
        if 'photo' not in request.files:
            return jsonify({'success': False, 'error': 'No photo file provided'}), 400

        file = request.files['photo']
        if not file or not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type'}), 400

        # Extract client code from filename
        filename = secure_filename(file.filename)
        client_code = os.path.splitext(filename)[0]

        # Find agent in database
        agent = get_agent_by_client_code(client_code)
        if not agent:
            return jsonify({
                'success': False,
                'error': f"Client code '{client_code}' not found in database"
            }), 404

        # Save uploaded photo temporarily
        temp_photo_path = os.path.join(USER_UPLOADS_FOLDER, filename)
        file.save(temp_photo_path)

        # Generate certificate
        cert_filename, cert_path = generate_certificate_for_agent(agent, temp_photo_path)

        # Track certificate in database
        file_size = os.path.getsize(cert_path)
        certificate = create_certificate(agent.id, cert_filename, cert_path, file_size)

        # Clean up temp photo
        if os.path.exists(temp_photo_path):
            os.remove(temp_photo_path)

        return jsonify({
            'success': True,
            'agent_info': {
                'name': agent.agent_name,
                'client_code': agent.client_code,
                'tier': agent.mdrt_tier,
                'badges': agent.get_badges()
            },
            'certificate_file': cert_filename,
            'certificate': {
                'id': certificate.id,
                'filename': cert_filename,
                'preview_url': f'/api/user/preview/{cert_filename}',
                'download_url': f'/api/user/download/{cert_filename}'
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

def generate_certificate_for_agent(agent, photo_path):
    """Generate certificate for an agent"""
    tier = agent.mdrt_tier
    agent_name = agent.agent_name

    # Load tier background
    bg_path = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', f'{tier}.png')
    if not os.path.exists(bg_path):
        raise Exception(f"Background for {tier} not found")

    background = Image.open(bg_path).convert('RGBA')

    # Resize background to poster template size (899x1600)
    if background.size != (TEMPLATE_WIDTH, TEMPLATE_HEIGHT):
        background = background.resize((TEMPLATE_WIDTH, TEMPLATE_HEIGHT), Image.Resampling.LANCZOS)

    # Remove background from agent photo
    agent_img = remove_background(photo_path)

    # Resize and position agent photo
    pos = FIXED_POSITIONS['agent_photo']
    agent_img.thumbnail((pos['max_width'], pos['max_height']), Image.Resampling.LANCZOS)

    img_w, img_h = agent_img.size
    paste_x = pos['x'] - img_w // 2
    paste_y = pos['y'] - img_h // 2

    background.paste(agent_img, (paste_x, paste_y), agent_img)

    # Add badges
    badges = agent.get_badges()
    badge_config = FIXED_POSITIONS['badges']
    for i, badge_code in enumerate(badges):
        badge_path = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', f'{badge_code}.png')
        if os.path.exists(badge_path):
            badge_img = Image.open(badge_path).convert('RGBA')
            badge_img = badge_img.resize((badge_config['size'], badge_config['size']), Image.Resampling.LANCZOS)
            badge_y = badge_config['y'] + (i * badge_config['spacing'])
            background.paste(badge_img, (badge_config['x'], badge_y), badge_img)

    # Add agent name with neon effect
    draw = ImageDraw.Draw(background)
    try:
        font = ImageFont.truetype("arial.ttf", FIXED_POSITIONS['name_text']['font_size'])
    except:
        font = ImageFont.load_default()

    text_pos = (FIXED_POSITIONS['name_text']['x'], FIXED_POSITIONS['name_text']['y'])
    draw_neon_text(draw, agent_name, text_pos, font, tier)

    # Save certificate
    cert_filename = f"{agent.client_code}_{agent_name.replace(' ', '_')}_{tier}.png"
    cert_path = os.path.join(USER_OUTPUTS_FOLDER, cert_filename)
    background.save(cert_path, 'PNG')

    return cert_filename, cert_path

@app.route('/api/user/preview/<filename>', methods=['GET'])
def user_preview_certificate(filename):
    """User: Preview generated certificate"""
    try:
        filepath = os.path.join(USER_OUTPUTS_FOLDER, filename)
        if os.path.exists(filepath):
            return send_file(filepath)
        return jsonify({'error': 'Certificate not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/user/download/<filename>', methods=['GET'])
def user_download_certificate(filename):
    """User: Download certificate"""
    try:
        filepath = os.path.join(USER_OUTPUTS_FOLDER, filename)
        if os.path.exists(filepath):
            # Mark as downloaded in database
            cert = Certificate.query.filter_by(filename=filename).first()
            if cert:
                mark_certificate_downloaded(cert.id)

            return send_file(filepath, as_attachment=True)
        return jsonify({'error': 'Certificate not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ============= STATISTICS & REPORTING =============

@app.route('/api/statistics', methods=['GET'])
def get_stats():
    """Get system statistics"""
    try:
        stats = get_statistics()
        return jsonify({
            'success': True,
            'statistics': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/certificates/recent', methods=['GET'])
def get_recent_certs():
    """Get recently generated certificates"""
    try:
        limit = request.args.get('limit', 10, type=int)
        certificates = get_recent_certificates(limit=limit)

        return jsonify({
            'success': True,
            'certificates': [cert.to_dict() for cert in certificates]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

# ============= CERTIFICATE HISTORY ENDPOINTS =============

@app.route('/api/certificates/history', methods=['GET'])
def get_certificate_history():
    """Get all generated certificates (for viewing history in User Portal)"""
    try:
        # Get all certificates, ordered by most recent first
        certificates = Certificate.query.order_by(Certificate.generated_at.desc()).all()

        result = []
        for cert in certificates:
            # Get agent details from relationship
            agent = cert.agent

            # Parse badges from snapshot
            badges_str = cert.badges_snapshot or ''
            badges = badges_str.split(',') if badges_str else []

            result.append({
                'id': cert.id,
                'client_code': agent.client_code if agent else 'UNKNOWN',
                'agent_name': cert.agent_name_snapshot or (agent.agent_name if agent else 'UNKNOWN'),
                'mdrt_tier': cert.tier_snapshot or (agent.mdrt_tier if agent else 'MDRT'),
                'life_member': 'LM' in badges or (agent.life_member if agent else False),
                'honor_roll': 'HR' in badges or (agent.honor_roll if agent else False),
                'quarter_century': 'QC' in badges or (agent.quarter_century if agent else False),
                'filename': cert.filename,
                'generated_at': cert.generated_at.isoformat()
            })

        return jsonify({
            'success': True,
            'total': len(result),
            'certificates': result
        })
    except Exception as e:
        print(f"Error fetching certificate history: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/certificates/<filename>', methods=['GET'])
def get_certificate_file(filename):
    """Serve a generated certificate file"""
    try:
        filepath = os.path.join(USER_OUTPUTS_FOLDER, filename)
        if os.path.exists(filepath):
            return send_file(filepath, mimetype='image/png')
        return jsonify({'error': 'Certificate not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/certificates/<int:cert_id>', methods=['DELETE'])
def delete_certificate(cert_id):
    """Delete a certificate from history"""
    try:
        # Find certificate by ID
        certificate = Certificate.query.get(cert_id)
        if not certificate:
            return jsonify({'success': False, 'error': 'Certificate not found'}), 404

        # Delete physical file
        filepath = os.path.join(USER_OUTPUTS_FOLDER, certificate.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"Deleted certificate file: {filepath}")

        # Delete from database
        db.session.delete(certificate)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Certificate {certificate.filename} deleted successfully'
        })
    except Exception as e:
        print(f"Error deleting certificate: {str(e)}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 400

# ============= GENERAL ENDPOINTS =============

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'MDRT Certificate Generator API with Database',
        'database': 'connected',
        'total_agents': Agent.query.count()
    })

# Serve React frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve React frontend files"""
    frontend_build = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build'))

    if path != "" and os.path.exists(os.path.join(frontend_build, path)):
        return send_from_directory(frontend_build, path)
    else:
        return send_from_directory(frontend_build, 'index.html')

if __name__ == '__main__':
    print("=" * 60)
    print("MDRT Certificate Generator - Database Edition")
    print("=" * 60)
    print("Admin Dashboard: http://localhost:5000/admin")
    print("User Portal:     http://localhost:5000/")
    print("=" * 60)
    print(f"Database: SQLite (mdrt_certificates.db)")

    # Get agent count within app context
    with app.app_context():
        agent_count = Agent.query.count()
        print(f"Total Agents: {agent_count}")

    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
