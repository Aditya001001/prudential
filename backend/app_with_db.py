from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
from PIL import Image, ImageDraw, ImageFont
from rembg import remove, new_session
import io
from werkzeug.utils import secure_filename
from datetime import datetime

# Pre-load rembg AI model session for faster processing
# Using u2net_human_seg model - optimized for people/portraits (MUCH FASTER!)
# This prevents model reload on every request (saves 30-60 seconds!)
print("[STARTUP] Loading rembg AI model session (u2net_human_seg - fast model for people)...")
REMBG_SESSION = new_session("u2net_human_seg")
print("[STARTUP] rembg AI model loaded and ready!")

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
USER_PHOTOS_FOLDER = 'user_photos'  # Permanent storage for uploaded photos
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'csv'}

# Create folder structure
os.makedirs(ADMIN_ASSETS_FOLDER, exist_ok=True)
os.makedirs(os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds'), exist_ok=True)
os.makedirs(os.path.join(ADMIN_ASSETS_FOLDER, 'badges'), exist_ok=True)
os.makedirs(os.path.join(ADMIN_ASSETS_FOLDER, 'nametags'), exist_ok=True)
os.makedirs(USER_UPLOADS_FOLDER, exist_ok=True)
os.makedirs(USER_OUTPUTS_FOLDER, exist_ok=True)
os.makedirs(USER_PHOTOS_FOLDER, exist_ok=True)  # For permanent photo storage

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# Reference template dimensions (backgrounds are 1800px wide, varying heights ~3160-3184)
# We'll use actual background dimensions - NO RESIZING for best quality
REFERENCE_WIDTH = 1800
REFERENCE_HEIGHT = 3184  # Actual background height

# Positions as ratios of template size (will scale to actual background)
# MAXIMUM SIZE - fill as much space as possible!
POSITION_RATIOS = {
    'agent_photo': {
        'x_ratio': 900 / 1800,      # 0.5 (center horizontally)
        'y_ratio': 2400 / 3184,     # ~0.75 (bottom area - aligned to bottom)
        'width_ratio': 1600 / 1800,  # 0.89 (89% of width - MAXIMUM!)
        'height_ratio': 2400 / 3184  # ~0.75 (fills bottom 75% of certificate)
    },
    'name_text': {
        'x_ratio': 900 / 1800,       # 0.5 (center)
        'y_ratio': 2750 / 3184,      # ~0.864 (on name tag, moved higher)
        'font_size_ratio': 120 / 3184,  # ~3.8% font size (larger initial size)
        'min_font_size_ratio': 60 / 3184,  # ~1.9% minimum font size
        'color': '#000000',          # Black text (simple, no glow)
        'max_width_ratio': 0.85,     # Max 85% of name tag width (more space)
    },
    'badges': {
        'x_ratio': 30 / 1800,        # 0.017 (closer to left border)
        'y_ratio': 1200 / 3184,      # ~0.377 (higher up)
        'spacing_ratio': 450 / 3184, # Spacing between badges (for bigger badges)
        'size_ratio': 400 / 1800     # 0.222 (bigger badges - 400px)
    },
    'name_tag': {
        'y_ratio': 2750 / 3184,      # ~0.864 (moved higher up)
        'width_ratio': 0.90,         # 90% of background width (original size)
    }
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
        'nametags': {},
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

    # Check name tags for each tier
    for tier in ['MDRT', 'COT', 'TOT']:
        nametag_path = os.path.join(ADMIN_ASSETS_FOLDER, 'nametags', f'{tier}.png')
        status['nametags'][tier] = os.path.exists(nametag_path)

    # Check CSV / Database
    agent_count = Agent.query.count()
    status['csv'] = agent_count > 0
    status['agent_count'] = agent_count

    return status

def correct_image_orientation(img):
    """
    Correct image orientation based on EXIF data.
    Mobile photos often have EXIF orientation tags that need to be applied.
    """
    try:
        from PIL import ImageOps
        # Use ImageOps.exif_transpose to automatically handle EXIF orientation
        img = ImageOps.exif_transpose(img)
        print(f"[INFO] Image orientation corrected using EXIF data")
    except Exception as e:
        print(f"[INFO] No EXIF orientation correction needed: {e}")
    return img

def remove_background(image_path):
    """
    Remove background from image using hybrid resolution approach for speed.

    Strategy:
    1. Resize image to max 1024px for AI processing (8-12x faster)
    2. Apply rembg on smaller image
    3. Upscale result back to original size

    This reduces processing time from 90-120 seconds to 10-15 seconds
    with minimal quality impact for the final certificate.
    """
    import time
    with Image.open(image_path) as img:
        # Correct orientation first (important for mobile photos!)
        img = correct_image_orientation(img)

        original_size = img.size
        print(f"[TIMING] Original image size: {original_size}")

        # Calculate scale for processing (max dimension = 1024px)
        max_dim = max(img.size)
        if max_dim > 1024:
            scale_factor = 1024 / max_dim
            process_size = (int(img.size[0] * scale_factor), int(img.size[1] * scale_factor))
            print(f"[TIMING] Scaling down to: {process_size} (factor: {scale_factor:.3f})")

            # Resize for faster processing
            resize_start = time.time()
            img_resized = img.resize(process_size, Image.Resampling.LANCZOS)
            print(f"[TIMING] Resize down: {time.time() - resize_start:.2f}s")

            # Remove background on smaller image (FAST!)
            ai_start = time.time()
            no_bg_small = remove(img_resized, session=REMBG_SESSION)
            print(f"[TIMING] AI background removal (on {process_size}): {time.time() - ai_start:.2f}s")

            # Upscale result back to original size
            upscale_start = time.time()
            no_bg = no_bg_small.resize(original_size, Image.Resampling.LANCZOS)
            print(f"[TIMING] Upscale to original: {time.time() - upscale_start:.2f}s")

            return no_bg.convert("RGBA")
        else:
            # Image already small, process normally
            print(f"[TIMING] Image already small ({original_size}), processing at full resolution")
            ai_start = time.time()
            no_bg = remove(img, session=REMBG_SESSION)
            print(f"[TIMING] AI background removal (full res): {time.time() - ai_start:.2f}s")
            return no_bg.convert("RGBA")

def draw_neon_text(draw_obj, text, position, font, tier):
    """Draw text with clean neon glow effect based on tier"""
    x, y = position
    glow_color = NEON_COLORS.get(tier, (255, 255, 255))

    # Get text dimensions
    text_bbox = draw_obj.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    # Center the text
    text_x = int(x - text_width / 2)
    text_y = y

    # Draw subtle glow effect (3 layers with minimal overlap)
    # Layer 1: Outer glow (soft, large radius)
    for offset in [(0, 8), (8, 0), (0, -8), (-8, 0), (6, 6), (-6, 6), (6, -6), (-6, -6)]:
        draw_obj.text(
            (text_x + offset[0], text_y + offset[1]),
            text,
            font=font,
            fill=(*glow_color, 30)  # Low opacity
        )

    # Layer 2: Middle glow (medium radius)
    for offset in [(0, 4), (4, 0), (0, -4), (-4, 0)]:
        draw_obj.text(
            (text_x + offset[0], text_y + offset[1]),
            text,
            font=font,
            fill=(*glow_color, 60)  # Medium opacity
        )

    # Layer 3: Inner glow (tight radius)
    for offset in [(0, 2), (2, 0), (0, -2), (-2, 0), (1, 1), (-1, 1), (1, -1), (-1, -1)]:
        draw_obj.text(
            (text_x + offset[0], text_y + offset[1]),
            text,
            font=font,
            fill=(*glow_color, 100)  # Higher opacity
        )

    # Draw subtle black outline for definition (4 main directions only)
    outline_width = 2  # Reduced from 20 to 2
    for offset in [(-outline_width, 0), (outline_width, 0), (0, -outline_width), (0, outline_width)]:
        draw_obj.text(
            (text_x + offset[0], text_y + offset[1]),
            text,
            font=font,
            fill=(0, 0, 0, 180)  # Slightly transparent
        )

    # Draw main white text on top
    draw_obj.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

# ============= ADMIN ENDPOINTS =============

@app.route('/api/admin/status', methods=['GET'])
def admin_get_status():
    """Admin: Get system status"""
    status = get_admin_asset_status()

    # Add CSV preview if available (format to match CSV structure for frontend compatibility)
    if status['csv']:
        agents = get_all_agents(limit=10)

        # Try to get the actual CSV filename from the database
        from database import SystemAsset
        csv_asset = SystemAsset.query.filter_by(asset_type='csv', asset_name='agents_csv').first()
        csv_filename = 'data.csv'  # Default filename
        if csv_asset and csv_asset.filename:
            csv_filename = csv_asset.filename

        status['csv_info'] = {
            'total_agents': status['agent_count'],
            'filename': csv_filename,
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

        print(f"[BACKGROUND UPLOAD] Received files: {list(files.keys())}")

        for tier in ['MDRT', 'COT', 'TOT']:
            if tier in files:
                file = files[tier]
                if file and allowed_file(file.filename):
                    filename = f"{tier}.png"
                    filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', filename)
                    file.save(filepath)
                    print(f"[BACKGROUND UPLOAD] Saved {tier} to {filepath}")

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

@app.route('/api/admin/upload-nametags', methods=['POST'])
def admin_upload_nametags():
    """Admin: Upload name tag banner images for each tier (MDRT, COT, TOT)"""
    try:
        files = request.files
        uploaded = {}

        print(f"[NAMETAG UPLOAD] Received files: {list(files.keys())}")

        # Create nametags folder if it doesn't exist
        nametags_folder = os.path.join(ADMIN_ASSETS_FOLDER, 'nametags')
        os.makedirs(nametags_folder, exist_ok=True)

        for tier in ['MDRT', 'COT', 'TOT']:
            if tier in files:
                file = files[tier]
                if file and allowed_file(file.filename):
                    filename = f"{tier}.png"
                    filepath = os.path.join(nametags_folder, filename)
                    file.save(filepath)
                    print(f"[NAMETAG UPLOAD] Saved {tier} to {filepath}")

                    # Track in database
                    file_size = os.path.getsize(filepath)
                    create_or_update_asset('nametag', tier, filename, filepath, file_size)
                    uploaded[tier] = True

        print(f"[NAMETAG UPLOAD] Successfully uploaded: {uploaded}")
        return jsonify({'success': True, 'uploaded': uploaded})
    except Exception as e:
        print(f"[NAMETAG UPLOAD ERROR] {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/upload-csv', methods=['POST'])
def admin_upload_csv():
    """Admin: Upload master CSV file and import to database"""
    try:
        print(f"[CSV UPLOAD] Request files: {request.files}")
        print(f"[CSV UPLOAD] Request form: {request.form}")

        if 'csv' not in request.files:
            error_msg = 'No CSV file provided'
            print(f"[CSV UPLOAD ERROR] {error_msg}")
            return jsonify({'success': False, 'error': error_msg}), 400

        file = request.files['csv']
        print(f"[CSV UPLOAD] File received: {file.filename}")

        if file and allowed_file(file.filename):
            # Get original filename
            original_filename = secure_filename(file.filename)

            # Save CSV file with original name
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, original_filename)
            file.save(filepath)

            # Get file size
            file_size = os.path.getsize(filepath) if os.path.exists(filepath) else None

            # Store CSV filename in database for reference
            create_or_update_asset(
                asset_type='csv',
                asset_name='agents_csv',
                filename=original_filename,
                filepath=filepath,
                file_size=file_size
            )

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

        error_msg = 'Invalid file'
        print(f"[CSV UPLOAD ERROR] {error_msg}")
        return jsonify({'success': False, 'error': error_msg}), 400
    except Exception as e:
        print(f"[CSV UPLOAD EXCEPTION] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/delete-csv', methods=['DELETE'])
def admin_delete_csv():
    """Admin: Delete CSV file and clear all agent data"""
    try:
        # Delete all agents from database
        agent_count = Agent.query.count()
        Agent.query.delete()

        # Delete CSV asset record
        from database import SystemAsset
        SystemAsset.query.filter_by(asset_type='csv').delete()

        db.session.commit()

        # Delete CSV files from filesystem
        deleted_files = []
        for filename in os.listdir(ADMIN_ASSETS_FOLDER):
            if filename.endswith('.csv'):
                filepath = os.path.join(ADMIN_ASSETS_FOLDER, filename)
                os.remove(filepath)
                deleted_files.append(filename)

        return jsonify({
            'success': True,
            'message': f'CSV deleted. {agent_count} agents removed from database.',
            'deleted_agents': agent_count,
            'deleted_files': deleted_files
        })
    except Exception as e:
        db.session.rollback()
        print(f"[CSV DELETE ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
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
        elif asset_type in ['nametag', 'nametags']:
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'nametags', filename)
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

@app.route('/api/validate-client-code/<client_code>', methods=['GET'])
def validate_client_code(client_code):
    """Validate if client code exists in database (for real-time validation)"""
    try:
        if not client_code or not client_code.strip():
            return jsonify({
                'success': False,
                'exists': False,
                'message': 'Client code cannot be empty'
            })

        agent = get_agent_by_client_code(client_code.strip())

        if agent:
            return jsonify({
                'success': True,
                'exists': True,
                'agent_name': agent.agent_name,
                'tier': agent.mdrt_tier,
                'message': f'✓ Found: {agent.agent_name} ({agent.mdrt_tier})'
            })
        else:
            return jsonify({
                'success': True,
                'exists': False,
                'message': f'✗ Client code "{client_code}" not found in database'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'exists': False,
            'message': f'Error validating client code: {str(e)}'
        }), 400

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

        # Get client code from form data (PRIMARY SOURCE)
        client_code = request.form.get('client_code', '').strip()

        # If not provided in form, fall back to filename (for backward compatibility)
        if not client_code:
            filename = secure_filename(file.filename)
            client_code = os.path.splitext(filename)[0]

        # Find agent in database
        agent = get_agent_by_client_code(client_code)
        if not agent:
            return jsonify({
                'success': False,
                'error': f"Client code '{client_code}' not found in database"
            }), 404

        # Save uploaded photo temporarily with a unique filename
        original_filename = secure_filename(file.filename)
        file_extension = os.path.splitext(original_filename)[1]
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        temp_filename = f"{client_code}_{timestamp}{file_extension}"
        temp_photo_path = os.path.join(USER_UPLOADS_FOLDER, temp_filename)
        file.save(temp_photo_path)

        # ALSO save to permanent storage for history
        permanent_photo_filename = f"{client_code}_{timestamp}_original{file_extension}"
        permanent_photo_path = os.path.join(USER_PHOTOS_FOLDER, permanent_photo_filename)

        # Copy the uploaded file to permanent storage
        import shutil
        shutil.copy2(temp_photo_path, permanent_photo_path)
        photo_file_size = os.path.getsize(permanent_photo_path)
        print(f"[UPLOAD] Original photo saved permanently: {permanent_photo_filename}")

        # KEEP ALL CERTIFICATES - No deletion needed
        # Each generation will have a unique timestamp in the filename
        print(f"[UPLOAD] Generating certificate for {agent.agent_name} (ID: {agent.id})")

        # Generate certificate with timestamp to ensure unique filename
        cert_filename, cert_path = generate_certificate_for_agent(agent, temp_photo_path)
        print(f"[UPLOAD] Certificate generated: {cert_filename}")

        # Track certificate in database (keep all history)
        file_size = os.path.getsize(cert_path)
        print(f"[UPLOAD] Certificate file size: {file_size} bytes")

        # Create certificate record (keeping all previous generations)
        from database import Certificate as CertModel
        certificate = CertModel(
            agent_id=agent.id,
            filename=cert_filename,
            filepath=cert_path,
            file_size=file_size,
            original_photo_filename=permanent_photo_filename,
            original_photo_filepath=permanent_photo_path,
            original_photo_size=photo_file_size,
            agent_name_snapshot=agent.agent_name,
            tier_snapshot=agent.mdrt_tier,
            badges_snapshot=','.join(agent.get_badges())
        )
        db.session.add(certificate)
        db.session.commit()
        print(f"[UPLOAD] Certificate saved to database with ID: {certificate.id}")

        # Count total generations for this agent
        from database import Certificate as CertModel
        total_generations = CertModel.query.filter_by(agent_id=agent.id).count()
        print(f"[UPLOAD] Total certificates for this agent: {total_generations}")

        # Clean up temp photo (keep permanent one)
        if os.path.exists(temp_photo_path):
            os.remove(temp_photo_path)

        print(f"[UPLOAD] Returning response with cert_filename: {cert_filename}")
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
    import time
    start_time = time.time()

    tier = agent.mdrt_tier
    agent_name = agent.agent_name

    print(f"[TIMING] Starting certificate generation for {agent_name}")

    # Load tier background
    bg_path = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', f'{tier}.png')
    if not os.path.exists(bg_path):
        raise Exception(f"Background for {tier} not found")

    bg_load_start = time.time()
    background = Image.open(bg_path).convert('RGBA')
    bg_width_original, bg_height_original = background.size
    print(f"[TIMING] Background loaded: {time.time() - bg_load_start:.2f}s")
    print(f"[INFO] Background original size: {bg_width_original}x{bg_height_original}")

    # Remove background from agent photo FIRST to check its resolution
    rembg_start = time.time()
    print(f"[TIMING] Starting background removal...")
    agent_img = remove_background(photo_path)
    print(f"[TIMING] Background removal completed: {time.time() - rembg_start:.2f}s")

    img_w, img_h = agent_img.size
    print(f"[INFO] Agent photo size: {img_w}x{img_h}")

    # DYNAMIC BACKGROUND SCALING (Option 4)
    # If user photo is very low resolution, scale background down to match
    photo_ratios = POSITION_RATIOS['agent_photo']
    max_width_orig = int(bg_width_original * photo_ratios['width_ratio'])
    max_height_orig = int(bg_height_original * photo_ratios['height_ratio'])

    # Calculate what scale would be needed for the photo
    scale_w = max_width_orig / img_w
    scale_h = max_height_orig / img_h
    natural_scale = min(scale_w, scale_h)

    # If natural scale > 2.0 (would need heavy upscaling), scale background down instead
    MAX_UPSCALE = 2.0
    if natural_scale > MAX_UPSCALE:
        # Calculate background scale factor to keep photo scaling at MAX_UPSCALE
        bg_scale_factor = MAX_UPSCALE / natural_scale
        bg_width = int(bg_width_original * bg_scale_factor)
        bg_height = int(bg_height_original * bg_scale_factor)
        background = background.resize((bg_width, bg_height), Image.Resampling.LANCZOS)
        print(f"[DYNAMIC] Background scaled DOWN to {bg_width}x{bg_height} (scale: {bg_scale_factor:.2f}x)")
        print(f"[DYNAMIC] Reason: User photo too small ({img_w}x{img_h}), would need {natural_scale:.2f}x upscaling")
        print(f"[DYNAMIC] Now photo will only be upscaled {MAX_UPSCALE:.2f}x (better quality)")
    else:
        # Keep original background size
        bg_width = bg_width_original
        bg_height = bg_height_original
        print(f"[INFO] Using original background size (photo upscaling is {natural_scale:.2f}x, within {MAX_UPSCALE}x limit)")

    # Calculate positions based on (possibly scaled) background dimensions
    pos_x = int(bg_width * photo_ratios['x_ratio'])
    pos_y = int(bg_height * photo_ratios['y_ratio'])
    max_width = int(bg_width * photo_ratios['width_ratio'])
    max_height = int(bg_height * photo_ratios['height_ratio'])

    # Calculate final scaling for agent photo
    scale_w = max_width / img_w
    scale_h = max_height / img_h
    scale = min(scale_w, scale_h)

    # Apply scaling (capped at MAX_UPSCALE)
    if scale < 1:
        # Image is larger, scale it down to fit
        new_w = int(img_w * scale)
        new_h = int(img_h * scale)
        print(f"[INFO] Scaling down agent photo to {new_w}x{new_h} (scale: {scale:.2f})")
    else:
        # Image is smaller, scale it up but cap at MAX_UPSCALE
        scale = min(scale, MAX_UPSCALE)
        new_w = int(img_w * scale)
        new_h = int(img_h * scale)
        print(f"[INFO] Scaling up agent photo to {new_w}x{new_h} (scale: {scale:.2f})")

    agent_img = agent_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Position agent photo: centered horizontally, aligned to bottom vertically
    paste_x = pos_x - new_w // 2  # Center horizontally
    paste_y = bg_height - new_h  # Align to bottom (bottom edge of photo touches bottom of background)

    print(f"[INFO] Photo positioned at ({paste_x}, {paste_y}), size: {new_w}x{new_h}")
    print(f"[INFO] Photo extends from y={paste_y} to y={paste_y + new_h} (background height: {bg_height})")

    background.paste(agent_img, (paste_x, paste_y), agent_img)

    # Add badges (scaled to background)
    badges = agent.get_badges()
    badge_ratios = POSITION_RATIOS['badges']
    badge_x = int(bg_width * badge_ratios['x_ratio'])
    badge_y_start = int(bg_height * badge_ratios['y_ratio'])
    badge_spacing = int(bg_height * badge_ratios['spacing_ratio'])
    badge_size = int(bg_width * badge_ratios['size_ratio'])

    for i, badge_code in enumerate(badges):
        badge_path = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', f'{badge_code}.png')
        if os.path.exists(badge_path):
            badge_img = Image.open(badge_path).convert('RGBA')
            badge_img = badge_img.resize((badge_size, badge_size), Image.Resampling.LANCZOS)
            badge_y = badge_y_start + (i * badge_spacing)
            background.paste(badge_img, (badge_x, badge_y), badge_img)

    # Add tier-specific name tag banner OVER the photo at the bottom
    nametag_path = os.path.join(ADMIN_ASSETS_FOLDER, 'nametags', f'{tier}.png')
    if os.path.exists(nametag_path):
        nametag_img = Image.open(nametag_path).convert('RGBA')

        # Use ratios for consistent positioning (original aspect ratio)
        nametag_ratios = POSITION_RATIOS['name_tag']
        nametag_width = int(bg_width * nametag_ratios['width_ratio'])
        nametag_aspect = nametag_img.size[1] / nametag_img.size[0]
        nametag_height = int(nametag_width * nametag_aspect)
        nametag_img = nametag_img.resize((nametag_width, nametag_height), Image.Resampling.LANCZOS)

        # Position at bottom (centered horizontally, using y_ratio for vertical)
        nametag_x = (bg_width - nametag_width) // 2
        nametag_y = int(bg_height * nametag_ratios['y_ratio']) - nametag_height // 2

        # Paste name tag OVER the photo (layered on top)
        background.paste(nametag_img, (nametag_x, nametag_y), nametag_img)
        print(f"[INFO] Name tag ({tier}) overlaid at ({nametag_x}, {nametag_y}) with size {nametag_width}x{nametag_height}")

    # Add agent name with DYNAMIC FONT SIZE - drawn on top of name tag
    draw = ImageDraw.Draw(background)
    name_ratios = POSITION_RATIOS['name_text']
    max_font_size = int(bg_height * name_ratios['font_size_ratio'])
    min_font_size = int(bg_height * name_ratios.get('min_font_size_ratio', 60 / 3184))
    text_x = int(bg_width * name_ratios['x_ratio'])
    text_y = int(bg_height * name_ratios['y_ratio'])

    # Calculate max width based on name tag width
    nametag_ratios = POSITION_RATIOS['name_tag']
    nametag_width = int(bg_width * nametag_ratios['width_ratio'])
    max_text_width = int(nametag_width * name_ratios.get('max_width_ratio', 0.85))

    # Dynamic font sizing: Start with max and shrink if needed
    font_size = max_font_size
    font = None
    text_bbox = None

    for attempt in range(20):  # Try up to 20 times to find perfect size
        try:
            # Try to use DejaVu Sans Bold for better readability
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                font = ImageFont.load_default()

        # Get text dimensions
        text_bbox = draw.textbbox((0, 0), agent_name, font=font)
        text_width = text_bbox[2] - text_bbox[0]

        # If text fits, break
        if text_width <= max_text_width:
            break

        # Reduce font size and try again
        font_size = int(font_size * 0.92)  # Reduce by 8% each iteration
        if font_size < min_font_size:  # Don't go below minimum
            font_size = min_font_size
            break

    text_height = text_bbox[3] - text_bbox[1]

    # Center the text
    centered_x = text_x - text_width // 2
    centered_y = text_y - text_height // 2

    # Draw simple black text (no effects)
    text_color = name_ratios.get('color', '#000000')
    # Convert hex to RGB if needed
    if isinstance(text_color, str) and text_color.startswith('#'):
        text_color = tuple(int(text_color[i:i+2], 16) for i in (1, 3, 5))

    draw.text((centered_x, centered_y), agent_name, font=font, fill=text_color)
    print(f"[INFO] Name text '{agent_name}' drawn at ({centered_x}, {centered_y}) with font size {font_size}px (max width: {max_text_width}px, actual: {text_width}px)")

    # Save certificate with timestamp for unique filename
    save_start = time.time()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    cert_filename = f"{agent.client_code}_{agent_name.replace(' ', '_')}_{tier}_{timestamp}.png"
    cert_path = os.path.join(USER_OUTPUTS_FOLDER, cert_filename)
    background.save(cert_path, 'PNG')
    print(f"[TIMING] Certificate saved: {time.time() - save_start:.2f}s")

    print(f"[TIMING] TOTAL TIME: {time.time() - start_time:.2f}s")

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
                'generated_at': cert.generated_at.isoformat(),
                'original_photo_filename': cert.original_photo_filename,
                'has_original_photo': cert.original_photo_filename is not None
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

@app.route('/api/certificates/photo/<filename>', methods=['GET'])
def get_original_photo(filename):
    """Serve an original uploaded photo file"""
    try:
        filepath = os.path.join(USER_PHOTOS_FOLDER, filename)
        if os.path.exists(filepath):
            # Detect mime type from extension
            ext = os.path.splitext(filename)[1].lower()
            mime_type = 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/png'
            return send_file(filepath, mimetype=mime_type)
        return jsonify({'error': 'Photo not found'}), 404
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
    print("Admin Dashboard: http://localhost:5001/admin")
    print("User Portal:     http://localhost:5001/")
    print("=" * 60)
    print(f"Database: SQLite (mdrt_certificates.db)")

    # Get agent count within app context
    with app.app_context():
        agent_count = Agent.query.count()
        print(f"Total Agents: {agent_count}")

    print("=" * 60)
    app.run(host='0.0.0.0', port=5001, debug=True)
