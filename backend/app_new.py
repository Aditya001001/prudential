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

# Fixed positions for 494x740px templates
FIXED_POSITIONS = {
    'agent_photo': {'x': 247, 'y': 320, 'max_width': 250, 'max_height': 350},
    'name_text': {'x': 247, 'y': 620, 'font_size': 32, 'color': '#FFFFFF', 'glow_intensity': 8, 'outline_width': 2},
    'badges': {'x': 30, 'y': 250, 'spacing': 60, 'size': 50}
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

# ============= ADMIN ENDPOINTS =============

@app.route('/api/admin/status', methods=['GET'])
def admin_status():
    """Get status of all admin assets"""
    status = get_admin_asset_status()
    
    # Add CSV preview if available
    if status['csv']:
        df = get_master_csv()
        status['csv_info'] = {
            'total_agents': len(df),
            'preview': df.head(5).to_dict('records')
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
    """Admin: Preview uploaded assets"""
    try:
        if asset_type == 'background':
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', filename)
        elif asset_type == 'badge':
            filepath = os.path.join(ADMIN_ASSETS_FOLDER, 'badges', filename)
        else:
            return jsonify({'error': 'Invalid asset type'}), 404

        if os.path.exists(filepath):
            return send_file(filepath, mimetype='image/png')
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============= USER ENDPOINTS =============

@app.route('/api/user/check-system', methods=['GET'])
def user_check_system():
    """User: Check if system is ready (all admin assets uploaded)"""
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

        # Extract client code from filename (e.g., "00020880.jpg" -> "00020880")
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
    """Generate certificate for user"""
    try:
        agent_name = agent_info['Agent Name']
        tier = agent_info['MDRT Title']

        # Get badges
        badges = []
        for badge_col in ['Life Member', 'Honor Roll', 'Quarter Century']:
            if badge_col in agent_info and pd.notna(agent_info[badge_col]) and agent_info[badge_col]:
                badge_key = badge_col.split()[0][:2].upper()  # LM, HR, QC
                if badge_key == 'LI': badge_key = 'LM'
                if badge_key == 'HO': badge_key = 'HR'
                if badge_key == 'QU': badge_key = 'QC'
                badges.append(badge_key)

        # Load background
        bg_path = os.path.join(ADMIN_ASSETS_FOLDER, 'backgrounds', f'{tier}.png')
        if not os.path.exists(bg_path):
            return {'success': False, 'error': f'Background for {tier} not found'}

        background = Image.open(bg_path).convert('RGBA')
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

        # Center text
        bbox = draw.textbbox((0, 0), agent_name, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        text_x = text_config['x'] - text_width // 2
        text_y = text_config['y'] - text_height // 2

        # Neon glow colors by tier
        glow_colors = {
            'TOT': (255, 215, 0),
            'COT': (255, 100, 100),
            'MDRT': (100, 200, 255)
        }
        glow_color = glow_colors.get(tier, (100, 200, 255))

        # Draw glow layers
        for offset in range(8, 0, -1):
            alpha = int(255 * (8 - offset) / 8)
            glow_with_alpha = glow_color + (alpha,)

            for dx in [-offset, 0, offset]:
                for dy in [-offset, 0, offset]:
                    if dx == 0 and dy == 0:
                        continue
                    draw.text(
                        (text_x + dx, text_y + dy),
                        agent_name,
                        fill=glow_with_alpha,
                        font=font
                    )

        # Draw black outline
        outline_width = 2
        for dx in range(-outline_width, outline_width + 1):
            for dy in range(-outline_width, outline_width + 1):
                if dx != 0 or dy != 0:
                    draw.text(
                        (text_x + dx, text_y + dy),
                        agent_name,
                        fill=(0, 0, 0, 200),
                        font=font
                    )

        # Draw main text (white)
        draw.text((text_x, text_y), agent_name, fill=(255, 255, 255, 255), font=font)

        # Save certificate
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
        return {'success': False, 'error': str(e)}

@app.route('/api/user/preview/<filename>', methods=['GET'])
def user_preview_certificate(filename):
    """User: Preview generated certificate"""
    filepath = os.path.join(USER_OUTPUTS_FOLDER, filename)
    if os.path.exists(filepath):
        return send_file(filepath, mimetype='image/png')
    return jsonify({'error': 'Certificate not found'}), 404

@app.route('/api/user/download/<filename>', methods=['GET'])
def user_download_certificate(filename):
    """User: Download generated certificate"""
    filepath = os.path.join(USER_OUTPUTS_FOLDER, filename)
    if os.path.exists(filepath):
        return send_file(filepath, as_attachment=True)
    return jsonify({'error': 'Certificate not found'}), 404

# ============= GENERAL ENDPOINTS =============

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'MDRT Certificate Generator API'})

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
    print("MDRT Certificate Generator - Dual Architecture")
    print("=" * 60)
    print("Admin Dashboard: http://localhost:5000/admin")
    print("User Portal:     http://localhost:5000/")
    print("=" * 60)
    app.run(debug=True, port=5000, host='0.0.0.0')
