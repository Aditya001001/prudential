from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
from rembg import remove
import io
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
CORS(app)

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

# ============================================
# UPDATED FOR 5764x8560 TEMPLATES
# ============================================
TEMPLATE_WIDTH = 5764
TEMPLATE_HEIGHT = 8560

FIXED_POSITIONS = {
    'agent_photo': {
        'x': 2882,          # Center (5764 / 2)
        'y': 3595,          # 42% from top (middle-upper area)
        'max_width': 2882,  # 50% of width
        'max_height': 4794  # 56% of height
    },
    'name_text': {
        'x': 2882,          # Center
        'y': 7447,          # 87% from top (bottom area)
        'font_size': 370,   # Scaled from 32px (32 * 8560/740)
        'color': '#FFFFFF',
        'glow_intensity': 92,    # Scaled from 8px
        'outline_width': 23      # Scaled from 2px
    },
    'badges': {
        'x': 415,           # 7.2% from left
        'y': 3424,          # 40% from top (middle area)
        'spacing': 694,     # Scaled from 60px
        'size': 578         # Scaled from 50px
    }
}

# Neon colors by tier
NEON_COLORS = {
    'TOT': (255, 215, 0),    # Gold
    'COT': (255, 100, 100),  # Red/Pink
    'MDRT': (100, 200, 255)  # Blue/Cyan
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_admin_asset_status():
    """Check which admin assets are available"""
    status = {
        'backgrounds': {
            'MDRT': os.path.exists(os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', 'MDRT.png')),
            'COT': os.path.exists(os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', 'COT.png')),
            'TOT': os.path.exists(os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', 'TOT.png'))
        },
        'badges': {
            'LM': os.path.exists(os.path.join(ADMIN_ASSETS_FOLDER, 'badges', 'LM.png')),
            'HR': os.path.exists(os.path.join(ADMIN_ASSETS_FOLDER, 'badges', 'HR.png')),
            'QC': os.path.exists(os.path.join(ADMIN_ASSETS_FOLDER, 'badges', 'QC.png'))
        },
        'csv': os.path.exists(os.path.join(ADMIN_ASSETS_FOLDER, 'data.csv'))
    }
    
    # Add CSV preview if available
    if status['csv']:
        csv_path = os.path.join(ADMIN_ASSETS_FOLDER, 'data.csv')
        try:
            df = pd.read_csv(csv_path, dtype={'Client Cd': str})
            preview = df.head(10).to_dict('records')
            status['csv_info'] = {
                'total_agents': len(df),
                'preview': preview
            }
        except Exception as e:
            status['csv_info'] = {'error': str(e)}
    
    return status

def get_master_csv():
    """Load the master CSV uploaded by admin"""
    csv_path = os.path.join(ADMIN_ASSETS_FOLDER, 'data.csv')
    if not os.path.exists(csv_path):
        return None
    return pd.read_csv(csv_path, dtype={'Client Cd': str})

def find_agent_by_client_code(client_code):
    """Find agent info by client code from master CSV"""
    df = get_master_csv()
    if df is None:
        return None
    
    client_code = str(client_code).strip()
    match = df[df['Client Cd'] == client_code]
    if not match.empty:
        return match.iloc[0].to_dict()
    
    return None

def remove_background(image_path):
    """Remove background from image"""
    with Image.open(image_path) as img:
        no_bg = remove(img)
        return no_bg.convert("RGBA")

def resize_image(img, max_width, max_height):
    """Resize image proportionally"""
    img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    return img

def paste_centered(background, overlay, center_x, center_y):
    """Paste overlay centered at position"""
    overlay_x = center_x - overlay.width // 2
    overlay_y = center_y - overlay.height // 2
    background.alpha_composite(overlay, dest=(overlay_x, overlay_y))

def draw_neon_text(draw_obj, text, position, font, tier):
    """Draw text with neon glow effect based on tier"""
    x, y = position
    glow_color = NEON_COLORS.get(tier, (255, 255, 255))
    glow_size = FIXED_POSITIONS['name_text']['glow_intensity']
    outline_width = FIXED_POSITIONS['name_text']['outline_width']

    # Get text dimensions for centering
    text_bbox = draw_obj.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    # Center the text
    text_x = int(x - text_width / 2)
    text_y = y

    # Draw glow layers (8 layers radiating outward)
    for offset in range(glow_size, 0, -1):
        alpha = int(255 * (glow_size - offset) / glow_size)
        glow_with_alpha = glow_color + (alpha,)

        # Draw in 8 directions
        for dx, dy in [(-1,-1), (0,-1), (1,-1), (-1,0), (1,0), (-1,1), (0,1), (1,1)]:
            draw_obj.text(
                (text_x + dx*offset, text_y + dy*offset),
                text,
                fill=glow_with_alpha,
                font=font
            )

    # Draw black outline for definition
    for dx, dy in [(-outline_width, 0), (outline_width, 0), (0, -outline_width), (0, outline_width)]:
        draw_obj.text((text_x + dx, text_y + dy), text, fill=(0, 0, 0, 200), font=font)

    # Draw main white text
    draw_obj.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)

# ============= ADMIN ENDPOINTS =============

@app.route('/api/admin/status', methods=['GET'])
def admin_status():
    """Get status of all admin assets"""
    status = get_admin_asset_status()
    return jsonify(status)

@app.route('/api/admin/upload-backgrounds', methods=['POST'])
def admin_upload_backgrounds():
    """Admin: Upload tier background images"""
    try:
        uploaded = {}
        for tier in ['MDRT', 'COT', 'TOT']:
            if tier in request.files:
                file = request.files[tier]
                if file and allowed_file(file.filename):
                    filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', f'{tier}.png')
                    file.save(filepath)
                    uploaded[tier] = True

        return jsonify({'success': True, 'uploaded': uploaded})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/upload-badges', methods=['POST'])
def admin_upload_badges():
    """Admin: Upload badge images"""
    try:
        uploaded = {}
        for badge in ['LM', 'HR', 'QC']:
            if badge in request.files:
                file = request.files[badge]
                if file and allowed_file(file.filename):
                    filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', f'{badge}.png')
                    file.save(filepath)
                    uploaded[badge] = True

        return jsonify({'success': True, 'uploaded': uploaded})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/upload-csv', methods=['POST'])
def admin_upload_csv():
    """Admin: Upload master CSV file"""
    try:
        if 'csv' not in request.files:
            return jsonify({'success': False, 'error': 'No CSV file provided'}), 400

        file = request.files['csv']
        if file and allowed_file(file.filename):
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'data.csv')
            file.save(filepath)

            # Parse and return preview
            df = pd.read_csv(filepath, dtype={'Client Cd': str})
            preview = df.head(10).to_dict('records')

            return jsonify({
                'success': True,
                'total_agents': len(df),
                'preview': preview
            })

        return jsonify({'success': False, 'error': 'Invalid file'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/admin/preview-asset/<asset_type>/<filename>', methods=['GET'])
def admin_preview_asset(asset_type, filename):
    """Admin: Preview uploaded asset"""
    try:
        if asset_type == 'background':
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', filename)
        elif asset_type == 'badge':
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', filename)
        else:
            return jsonify({'error': 'Invalid asset type'}), 400

        if os.path.exists(filepath):
            return send_file(filepath)
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ============= USER ENDPOINTS =============

@app.route('/api/user/check-system', methods=['GET'])
def user_check_system():
    """User: Check if system is ready"""
    status = get_admin_asset_status()

    all_backgrounds = all(status['backgrounds'].values())
    all_badges = all(status['badges'].values())
    csv_ready = status['csv']

    ready = all_backgrounds and all_badges and csv_ready

    return jsonify({
        'ready': ready,
        'status': status,
        'message': 'System ready' if ready else 'Admin must upload all assets first'
    })

@app.route('/api/user/upload-photo', methods=['POST'])
def user_upload_photo():
    """User: Upload agent photo and generate certificate"""
    try:
        # Check if system is ready
        status = get_admin_asset_status()
        if not (all(status['backgrounds'].values()) and all(status['badges'].values()) and status['csv']):
            return jsonify({
                'success': False,
                'error': 'System not ready. Admin must upload all assets first.'
            }), 400

        # Get uploaded file
        if 'photo' not in request.files:
            return jsonify({'success': False, 'error': 'No photo file provided'}), 400

        file = request.files['photo']
        if not file or not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type'}), 400

        # Extract client code from filename
        original_filename = secure_filename(file.filename)
        client_code = os.path.splitext(original_filename)[0]

        # Find agent in master CSV
        agent_info = find_agent_by_client_code(client_code)
        if not agent_info:
            return jsonify({
                'success': False,
                'error': f'Client code "{client_code}" not found in database. Please check your filename.'
            }), 404

        # Save uploaded photo temporarily
        temp_photo_path = os.path.join(USER_UPLOADS_FOLDER, original_filename)
        file.save(temp_photo_path)

        # Generate certificate
        result = generate_user_certificate(temp_photo_path, agent_info, client_code)

        # Clean up temp file
        if os.path.exists(temp_photo_path):
            os.remove(temp_photo_path)

        if result['success']:
            return jsonify({
                'success': True,
                'agent_info': {
                    'name': agent_info['Agent Name'],
                    'tier': agent_info['MDRT Title'],
                    'client_code': client_code,
                    'badges': result['badges']
                },
                'certificate_file': result['output_file']
            })
        else:
            return jsonify({'success': False, 'error': result['error']}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def generate_user_certificate(photo_path, agent_info, client_code):
    """Generate certificate for user with 5764x8560 templates"""
    try:
        agent_name = agent_info['Agent Name']
        tier = agent_info['MDRT Title']

        # Get badges
        badges = []
        for badge_col in ['Life Member', 'Honor Roll', 'Quarter Century']:
            if badge_col in agent_info and pd.notna(agent_info[badge_col]) and agent_info[badge_col]:
                badge_key = badge_col.split()[0][:2].upper()
                if badge_key == 'LI': badge_key = 'LM'
                if badge_key == 'HO': badge_key = 'HR'
                if badge_key == 'QU': badge_key = 'QC'
                badges.append(badge_key)

        # Load background (should be 5764x8560)
        bg_path = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', f'{tier}.png')
        if not os.path.exists(bg_path):
            return {'success': False, 'error': f'Background for {tier} not found'}

        background = Image.open(bg_path).convert('RGBA')

        # Verify background size matches expected dimensions
        if background.size != (TEMPLATE_WIDTH, TEMPLATE_HEIGHT):
            print(f"WARNING: Background size {background.size} doesn't match expected {TEMPLATE_WIDTH}x{TEMPLATE_HEIGHT}")
            # Resize background to expected size
            background = background.resize((TEMPLATE_WIDTH, TEMPLATE_HEIGHT), Image.Resampling.LANCZOS)

        canvas = background.copy()

        # Remove background from agent photo
        agent_no_bg = remove_background(photo_path)

        # Resize agent photo
        photo_config = FIXED_POSITIONS['agent_photo']
        agent_resized = resize_image(agent_no_bg, photo_config['max_width'], photo_config['max_height'])

        # Paste agent photo centered
        paste_centered(canvas, agent_resized, photo_config['x'], photo_config['y'])

        # Add badges
        badge_config = FIXED_POSITIONS['badges']
        for idx, badge_key in enumerate(badges):
            badge_path = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', f'{badge_key}.png')
            if os.path.exists(badge_path):
                badge_img = Image.open(badge_path).convert('RGBA')
                badge_img = badge_img.resize((badge_config['size'], badge_config['size']), Image.Resampling.LANCZOS)

                badge_x = badge_config['x']
                badge_y = badge_config['y'] + (idx * badge_config['spacing'])
                canvas.alpha_composite(badge_img, dest=(badge_x, badge_y))

        # Draw name with neon glow effect
        draw = ImageDraw.Draw(canvas)
        text_config = FIXED_POSITIONS['name_text']

        # Use bold font
        try:
            font = ImageFont.truetype("arialbd.ttf", size=text_config['font_size'])
        except:
            try:
                font = ImageFont.truetype("arial.ttf", size=text_config['font_size'])
            except:
                font = ImageFont.load_default()

        # Draw neon text
        text_pos = (text_config['x'], text_config['y'])
        draw_neon_text(draw, agent_name, text_pos, font, tier)

        # Save certificate (full resolution)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"{client_code}_{agent_name.replace(' ', '_')}_{tier}_{timestamp}.png"
        output_path = os.path.join(USER_OUTPUTS_FOLDER, output_filename)
        canvas.save(output_path, "PNG")

        return {
            'success': True,
            'output_file': output_filename,
            'badges': badges
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

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
            return send_file(filepath, as_attachment=True, download_name=filename)
        return jsonify({'error': 'Certificate not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/certificates/history', methods=['GET'])
def certificates_history():
    """Get recent certificates"""
    try:
        files = []
        if os.path.exists(USER_OUTPUTS_FOLDER):
            for filename in os.listdir(USER_OUTPUTS_FOLDER):
                if filename.endswith('.png'):
                    filepath = os.path.join(USER_OUTPUTS_FOLDER, filename)
                    stat = os.stat(filepath)
                    files.append({
                        'filename': filename,
                        'size': stat.st_size,
                        'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })

        # Sort by creation time (newest first)
        files.sort(key=lambda x: x['created'], reverse=True)

        return jsonify({
            'success': True,
            'certificates': files[:50]  # Return last 50
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    print("=" * 60)
    print("MDRT Certificate Generator - 5764x8560 Edition")
    print("=" * 60)
    print("Template Size: 5764 x 8560 pixels")
    print("Admin Dashboard: http://localhost:5000/admin")
    print("User Portal:     http://localhost:5000/")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
