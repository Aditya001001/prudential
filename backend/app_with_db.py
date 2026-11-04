from flask import Flask, request, jsonify, send_file, send_from_directory, session, abort
import os
import shutil
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from uuid import uuid4
from threading import BoundedSemaphore, Lock
from werkzeug.exceptions import HTTPException, BadRequest
from werkzeug.utils import secure_filename
from datetime import datetime
from copy import deepcopy
from config import configure, BASE_DIR
from security import install_security, require_certificate_access
from storage import validated_image, safe_path, atomic_image_save, fingerprint, staged_delete
from nametag_layout import fit_nametag

from portrait_editor import (
    create_layers, discard_layers, layer_paths, compose, render_saved_layers, validate_transform,
)

REMBG_SESSION = None
MODEL_LOCK = Lock()
GENERATION_SLOT = BoundedSemaphore(1)

# Database imports
from database import db, Agent, Certificate, SystemAsset, CSVUploadHistory
from db_services import (
    get_agent_by_client_code, get_all_agents, update_agent, delete_agent,
    import_agents_from_csv, get_recent_certificates, get_statistics,
    create_or_update_asset, get_asset, create_csv_upload_record,
)

app = Flask(__name__)
configure(app)
if not app.config['SECRET_KEY'] or len(app.config['SECRET_KEY']) < 32 or app.config['SECRET_KEY'].startswith('replace-'):
    raise RuntimeError('SECRET_KEY is required. See backend/.env.example.')
db.init_app(app)
install_security(app)

ADMIN_ASSETS_FOLDER = str(BASE_DIR / 'admin_assets')
USER_UPLOADS_FOLDER = str(BASE_DIR / 'user_uploads')
USER_OUTPUTS_FOLDER = str(BASE_DIR / 'user_outputs')
USER_PHOTOS_FOLDER = str(BASE_DIR / 'user_photos')
for folder in (ADMIN_ASSETS_FOLDER, USER_UPLOADS_FOLDER, USER_OUTPUTS_FOLDER, USER_PHOTOS_FOLDER):
    Path(folder).mkdir(parents=True, exist_ok=True)
for folder in ('backgrounds', 'badges', 'nametags', 'layers', 'versions', 'csv_history'):
    (Path(ADMIN_ASSETS_FOLDER) / folder).mkdir(exist_ok=True)


@app.errorhandler(HTTPException)
def http_error(error):
    return jsonify(success=False, error=error.description), error.code


@app.errorhandler(Exception)
def unexpected_error(error):
    db.session.rollback()
    app.logger.exception('Request failed')
    return jsonify(success=False, error='An unexpected error occurred. Please try again.'), 500


def asset_path(kind, name):
    asset = get_asset(kind, name)
    if asset:
        candidate = Path(asset.filepath)
        if not candidate.is_absolute():
            candidate = BASE_DIR / candidate
        if candidate.resolve().is_relative_to(Path(ADMIN_ASSETS_FOLDER).resolve()):
            return str(candidate)
    folder = {'background': 'backgrounds', 'badge': 'badges', 'nametag': 'nametags', 'layer': 'layers'}[kind]
    return str(Path(ADMIN_ASSETS_FOLDER) / folder / f'{name}.png')


def pagination():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('per_page', 25))
    except ValueError:
        abort(400, description='Invalid pagination.')
    if page < 1 or size < 1 or size > 100:
        abort(400, description='Page must be positive; per_page must be 1-100.')
    return page, size


# Output dimensions are stable across templates and uploaded portrait resolutions.
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
        'x_ratio': 930 / 1800,       # Small optical offset to align with the banner crest
        'y_ratio': 2750 / 3184,      # ~0.864 (on name tag, moved higher)
        'font_size_ratio': 170 / 3184,  # ~5.3% font size (bigger initial size)
        'min_font_size_ratio': 90 / 3184,  # ~2.8% minimum font size
        'color': '#000000',          # Black text (simple, no glow)
        'max_width_ratio': 0.78,     # Leave room for the left star, right border and 3D text
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

# Schema changes are applied explicitly by manage.py migrate.

def get_admin_asset_status():
    """Check which admin assets are uploaded (file-based + database)"""
    status = {
        'backgrounds': {},
        'badges': {},
        'nametags': {},
        'layers': {},
        'csv': False,
        'agent_count': 0
    }

    # Check backgrounds (file-based for now, can migrate to DB)
    for tier in ['MDRT', 'COT', 'TOT']:
        bg_path = asset_path('background', tier)
        status['backgrounds'][tier] = os.path.exists(bg_path)

    # Check badges (file-based for now)
    for badge in ['LM', 'HR', 'QC']:
        badge_path = asset_path('badge', badge)
        status['badges'][badge] = os.path.exists(badge_path)

    # Check name tags for each tier
    for tier in ['MDRT', 'COT', 'TOT']:
        nametag_path = asset_path('nametag', tier)
        status['nametags'][tier] = os.path.exists(nametag_path)

    # Check layers for each tier (overlay placed on top of photo, below name tag)
    for tier in ['MDRT', 'COT', 'TOT']:
        layer_path = asset_path('layer', tier)
        status['layers'][tier] = os.path.exists(layer_path)

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

def _lerp_color(c1, c2, t):
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def _make_vertical_gradient(width, height, stops):
    """stops: list of (offset 0..1, (r,g,b)) sorted by offset."""
    gradient = Image.new('RGB', (1, height), stops[0][1])
    for y in range(height):
        t = y / max(1, height - 1)
        # find surrounding stops
        for i in range(len(stops) - 1):
            o1, c1 = stops[i]
            o2, c2 = stops[i + 1]
            if o1 <= t <= o2:
                local_t = (t - o1) / max(1e-6, (o2 - o1))
                gradient.putpixel((0, y), _lerp_color(c1, c2, local_t))
                break
    return gradient.resize((width, height))


def draw_3d_metallic_text(background, text, font, center_x, center_y, style='name'):
    """
    Render text with a 3D "poster" extrusion effect, matching the client's
    reference (GPT example 3D text.html):
      - Face is filled with a near-white/cream vertical gradient with a
        thin orange stroke outline (paint-order: stroke fill).
      - A thick orange->deep-red gradient extrusion is drawn beneath the
        face, offset diagonally (multiple stacked copies) to build up
        physical depth.
      - A soft, warm drop shadow sits behind everything.
      - A glossy white highlight is blended over the upper portion of the
        face to simulate the glass-like sheen in the reference.

    Args:
        background: RGBA PIL Image to draw onto (modified in place).
        text: string to render.
        font: PIL ImageFont instance.
        center_x, center_y: pixel coordinates for the center of the text.
        style: 'top' for the "YEAR + TIER" title line, or 'name' for the
            agent name line. Each uses the gradient stops from the
            reference HTML (#topFace/#topExtrude vs #nameFace/#extrude).

    Returns:
        (text_width, text_height) of the rendered text bounding box.
    """
    from PIL import ImageFilter

    if style == 'top':
        face_stops = [
            (0.0, (255, 248, 233)),   # #fff8e9
            (0.45, (255, 228, 201)),  # #ffe4c9
            (1.0, (255, 246, 233)),   # #fff6e9
        ]
        extrude_stops = [
            (0.0, (255, 154, 70)),    # #ff9a46
            (0.5, (237, 107, 34)),    # #ed6b22
            (1.0, (177, 43, 8)),      # #b12b08
        ]
        stroke_rgb = (195, 66, 17)    # #c34211
    else:
        face_stops = [
            (0.0, (255, 255, 255)),   # #ffffff
            (0.34, (255, 253, 248)),  # #fffdf8
            (0.62, (255, 247, 239)),  # #fff7ef
            (1.0, (255, 255, 255)),   # #ffffff
        ]
        extrude_stops = [
            (0.0, (255, 138, 56)),    # #ff8a38
            (0.45, (242, 105, 34)),   # #f26922
            (0.72, (215, 70, 15)),    # #d7460f
            (1.0, (168, 34, 8)),      # #a82208
        ]
        stroke_rgb = (240, 92, 49)    # #f05c31

    measure_draw = ImageDraw.Draw(background)
    bbox = measure_draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Depth of the extrusion scales with the text size so it reads
    # correctly at both small and large font sizes.
    depth = max(6, int(text_h * 0.09))
    stroke_w = max(2, int(text_h * 0.03))

    # Padding so shadows/extrusion offsets don't get clipped
    pad = max(30, text_h // 3) + depth
    layer_w = text_w + pad * 2
    layer_h = text_h + pad * 2

    # Origin so the glyph's own bbox offset is cancelled out
    origin_x = pad - bbox[0]
    origin_y = pad - bbox[1]

    # ---- 1. Soft warm drop shadow ----
    shadow_layer = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    shadow_dx, shadow_dy = int(depth * 0.9), int(depth * 1.3)
    shadow_draw.text(
        (origin_x + shadow_dx, origin_y + shadow_dy), text, font=font,
        fill=(93, 10, 0, 130), stroke_width=stroke_w
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=max(4, depth // 2)))

    # ---- 2. Extrusion (orange -> deep red gradient, stacked diagonal copies) ----
    extrude_gradient = _make_vertical_gradient(layer_w, layer_h, extrude_stops)
    extrusion_mask = Image.new('L', (layer_w, layer_h), 0)
    extrusion_mask_draw = ImageDraw.Draw(extrusion_mask)
    steps = 6
    for i in range(steps, 0, -1):
        offset = int(depth * i / steps)
        extrusion_mask_draw.text(
            (origin_x + offset, origin_y + offset), text, font=font,
            fill=255, stroke_width=stroke_w, stroke_fill=255
        )
    extrusion_layer = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    extrusion_layer.paste(extrude_gradient, (0, 0), extrusion_mask)

    # ---- 2b. Metallic diagonal sheen across the extrusion (brushed-metal look) ----
    sheen_layer = Image.new('L', (layer_w, layer_h), 0)
    sheen_draw = ImageDraw.Draw(sheen_layer)
    # A soft diagonal band of light, repeated a couple of times, drawn as
    # thick semi-transparent white lines then blurred for a smooth streak.
    band_w = max(20, int(layer_h * 0.35))
    for band_offset in (-int(layer_w * 0.15), int(layer_w * 0.55)):
        sheen_draw.line(
            [(band_offset, layer_h), (band_offset + layer_h, 0)],
            fill=255, width=band_w
        )
    sheen_layer = sheen_layer.filter(ImageFilter.GaussianBlur(radius=max(6, band_w // 3)))
    sheen_rgba = Image.new('RGBA', (layer_w, layer_h), (255, 255, 255, 0))
    sheen_alpha = sheen_layer.point(lambda p: int(p * 0.55))
    sheen_rgba.putalpha(sheen_alpha)
    # Clip the sheen to the extrusion silhouette only
    sheen_masked = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    sheen_masked.paste(sheen_rgba, (0, 0), extrusion_mask)
    extrusion_layer = Image.alpha_composite(extrusion_layer, sheen_masked)

    # ---- 3. Face gradient fill (near-white/cream, glossy metal look) ----
    gradient = _make_vertical_gradient(layer_w, layer_h, face_stops)
    # Face mask includes the stroke outline so the orange edge shows
    # around the cream/white fill (paint-order: stroke fill).
    face_stroke_mask = Image.new('L', (layer_w, layer_h), 0)
    face_stroke_mask_draw = ImageDraw.Draw(face_stroke_mask)
    face_stroke_mask_draw.text(
        (origin_x, origin_y), text, font=font,
        fill=255, stroke_width=stroke_w, stroke_fill=255
    )
    stroke_color_layer = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    stroke_color_layer.paste((*stroke_rgb, 255), (0, 0, layer_w, layer_h), face_stroke_mask)

    # Fill-only mask (no stroke) for the gradient face on top of the stroke
    face_fill_mask = Image.new('L', (layer_w, layer_h), 0)
    face_fill_mask_draw = ImageDraw.Draw(face_fill_mask)
    face_fill_mask_draw.text((origin_x, origin_y), text, font=font, fill=255)
    gradient_text = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    gradient_rgba = gradient.convert('RGBA')
    gradient_text.paste(gradient_rgba, (0, 0), face_fill_mask)

    # ---- 4. Glossy highlight over the upper portion of the face ----
    highlight_gradient = _make_vertical_gradient(layer_w, layer_h, [
        (0.0, (255, 255, 255)),
        (0.3, (255, 255, 255)),
        (0.55, (255, 255, 255)),
        (1.0, (255, 255, 255)),
    ])
    highlight_alpha = Image.new('L', (1, layer_h), 0)
    for y in range(layer_h):
        t = y / max(1, layer_h - 1)
        if t <= 0.3:
            a = int(242 * (1 - (t / 0.3) * 0.42))
        elif t <= 0.55:
            local_t = (t - 0.3) / 0.25
            a = int(140 - local_t * 120)
        else:
            a = 0
        highlight_alpha.putpixel((0, y), a)
    highlight_alpha = highlight_alpha.resize((layer_w, layer_h))
    highlight_layer = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    highlight_layer.paste(highlight_gradient.convert('RGBA'), (0, 0))
    highlight_layer.putalpha(highlight_alpha)
    highlight_masked = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    highlight_masked.paste(highlight_layer, (0, 0), face_fill_mask)

    # ---- Composite: shadow -> extrusion -> stroke -> face fill -> highlight ----
    composed = Image.new('RGBA', (layer_w, layer_h), (0, 0, 0, 0))
    composed = Image.alpha_composite(composed, shadow_layer)
    composed = Image.alpha_composite(composed, extrusion_layer)
    composed = Image.alpha_composite(composed, stroke_color_layer)
    composed = Image.alpha_composite(composed, gradient_text)
    composed = Image.alpha_composite(composed, highlight_masked)

    paste_x = int(center_x - layer_w / 2)
    paste_y = int(center_y - layer_h / 2)
    background.alpha_composite(composed, (paste_x, paste_y))

    return text_w, text_h


def remove_background(image_path):
    global REMBG_SESSION
    from rembg import remove, new_session
    with MODEL_LOCK:
        if REMBG_SESSION is None:
            REMBG_SESSION = new_session('u2net_human_seg')
    with Image.open(image_path) as opened:
        image = correct_image_orientation(opened).convert('RGBA')
        processing = image.copy()
        processing.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        mask = remove(processing, session=REMBG_SESSION, only_mask=True).convert('L')
        mask = mask.resize(image.size, Image.Resampling.LANCZOS)
        from PIL import ImageChops
        image.putalpha(ImageChops.multiply(image.getchannel('A'), mask))
        return image


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

def upload_assets(kind, names):
    prepared = []
    try:
        unknown = set(request.files) - set(names)
        if unknown or not request.files:
            abort(400, description='Provide at least one recognized asset.')
        for name in names:
            if name not in request.files:
                continue
            image = validated_image(request.files[name])
            if kind == 'background' and (image.width < 300 or image.height < 300):
                abort(400, description='Background dimensions must be at least 300 pixels.')
            path = Path(ADMIN_ASSETS_FOLDER) / 'versions' / f'{kind}_{name}_{uuid4().hex}.png'
            prepared.append(path)
            atomic_image_save(image, path)
            create_or_update_asset(kind, name, path.name, str(path), path.stat().st_size,
                                   uploaded_by=session['admin'], commit=False)
        db.session.commit()
        return jsonify(success=True, uploaded={name: True for name in names if name in request.files})
    except Exception:
        db.session.rollback()
        for path in prepared:
            path.unlink(missing_ok=True)
        raise


@app.route('/api/admin/upload-backgrounds', methods=['POST'])
def admin_upload_backgrounds():
    return upload_assets('background', ('MDRT', 'COT', 'TOT'))


@app.route('/api/admin/upload-badges', methods=['POST'])
def admin_upload_badges():
    return upload_assets('badge', ('LM', 'HR', 'QC'))


@app.route('/api/admin/upload-nametags', methods=['POST'])
def admin_upload_nametags():
    return upload_assets('nametag', ('MDRT', 'COT', 'TOT'))


@app.route('/api/admin/upload-layers', methods=['POST'])
def admin_upload_layers():
    return upload_assets('layer', ('MDRT', 'COT', 'TOT'))


@app.route('/api/admin/upload-csv', methods=['POST'])
def admin_upload_csv():
    upload = request.files.get('csv')
    if not upload or Path(upload.filename or '').suffix.lower() not in {'.csv', '.xlsx', '.xls'}:
        abort(400, description='Upload a CSV, XLSX or XLS file.')
    original = secure_filename(upload.filename)
    path = Path(ADMIN_ASSETS_FOLDER) / 'csv_history' / f'{uuid4().hex}{Path(original).suffix.lower()}'
    try:
        upload.save(path)
        result = import_agents_from_csv(str(path), commit=False)
        if not result['success']:
            db.session.rollback()
            path.unlink(missing_ok=True)
            return jsonify(result), 400
        create_or_update_asset('csv', 'agents_csv', original, str(path), path.stat().st_size,
                               uploaded_by=session['admin'], commit=False)
        total = Agent.query.count()
        create_csv_upload_record(original, path.name, str(path), path.stat().st_size,
                                 total, result['imported'], result['updated'],
                                 uploaded_by=session['admin'], commit=False)
        db.session.commit()
        return jsonify(**result, total_agents=total)
    except Exception:
        db.session.rollback()
        path.unlink(missing_ok=True)
        raise


@app.route('/api/admin/csv-history', methods=['GET'])
def admin_csv_history():
    page, size = pagination()
    query = CSVUploadHistory.query.order_by(CSVUploadHistory.uploaded_at.desc(), CSVUploadHistory.id.desc())
    total = query.count()
    return jsonify(success=True, total=total, page=page, per_page=size,
                   history=[row.to_dict() for row in query.offset((page-1)*size).limit(size).all()])


@app.route('/api/admin/csv-history/<int:upload_id>/download', methods=['GET'])
def admin_csv_history_download(upload_id):
    record = db.get_or_404(CSVUploadHistory, upload_id)
    path = Path(record.filepath)
    if not path.is_absolute():
        path = BASE_DIR / path
    if not path.resolve().is_relative_to(Path(ADMIN_ASSETS_FOLDER).resolve()) or not path.is_file():
        abort(404)
    return send_file(path, as_attachment=True, download_name=record.original_filename)


@app.route('/api/admin/csv-history/<int:upload_id>', methods=['DELETE'])
def admin_csv_history_delete(upload_id):
    record = db.get_or_404(CSVUploadHistory, upload_id)
    path = Path(record.filepath)
    if not path.is_absolute():
        path = BASE_DIR / path
    if not path.resolve().is_relative_to(Path(ADMIN_ASSETS_FOLDER).resolve()):
        abort(400)
    # A history record can also be the active master-file pointer.
    SystemAsset.query.filter_by(asset_type='csv', filepath=record.filepath).delete()
    with staged_delete([path]):
        db.session.delete(record)
        db.session.commit()
    return jsonify(success=True)


@app.route('/api/admin/delete-csv', methods=['DELETE'])
def admin_delete_csv():
    # Preserve generated certificates and their immutable snapshots.
    count = Agent.query.count()
    Certificate.query.update({Certificate.agent_id: None}, synchronize_session=False)
    Agent.query.delete(synchronize_session=False)
    SystemAsset.query.filter_by(asset_type='csv').delete()
    db.session.commit()
    return jsonify(success=True, deleted_agents=count,
                   message='Master data cleared. Certificate and upload history retained.')


@app.route('/api/admin/preview-asset/<asset_type>/<filename>', methods=['GET'])
def admin_preview_asset(asset_type, filename):
    kinds = {'background': 'background', 'backgrounds': 'background', 'badge': 'badge',
             'badges': 'badge', 'nametag': 'nametag', 'nametags': 'nametag',
             'layer': 'layer', 'layers': 'layer'}
    kind = kinds.get(asset_type)
    name = Path(filename).stem
    allowed = ('LM', 'HR', 'QC') if kind == 'badge' else ('MDRT', 'COT', 'TOT')
    if not kind or name not in allowed or filename != name + '.png':
        abort(404)
    path = Path(asset_path(kind, name))
    if not path.is_file():
        abort(404)
    return send_file(path, mimetype='image/png')


@app.route('/api/agents', methods=['GET'])
def get_agents():
    page, size = pagination()
    query = Agent.query
    search = request.args.get('search', '').strip()[:200]
    if search:
        query = query.filter(db.or_(Agent.agent_name.icontains(search, autoescape=True),
                                   Agent.client_code.icontains(search, autoescape=True)))
    return jsonify(success=True, total=query.count(), page=page, per_page=size,
                   agents=[agent.to_dict() for agent in query.order_by(Agent.agent_name, Agent.id).offset((page-1)*size).limit(size).all()])


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
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Request failed")
        return jsonify({'success': False, 'error': 'Unable to complete request.'}), 400

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
                'message': 'Client code found.'
            })
        else:
            return jsonify({
                'success': True,
                'exists': False,
                'message': f'✗ Client code "{client_code}" not found in database'
            })
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Request failed")
        return jsonify({
            'success': False,
            'exists': False,
            'message': 'Unable to validate client code.'
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
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Request failed")
        return jsonify({'success': False, 'error': 'Unable to complete request.'}), 400

@app.route('/api/agents/<int:agent_id>', methods=['DELETE'])
def delete_agent_endpoint(agent_id):
    """Delete an agent"""
    try:
        success = delete_agent(agent_id)
        if success:
            return jsonify({'success': True})
        return jsonify({'success': False, 'error': 'Agent not found'}), 404
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Request failed")
        return jsonify({'success': False, 'error': 'Unable to complete request.'}), 400

# ============= USER ENDPOINTS =============

@app.route('/api/user/check-system', methods=['GET'])
def user_check_system():
    """User: Check if system is ready"""
    status = get_admin_asset_status()

    all_backgrounds = all(status['backgrounds'].values())
    all_badges = all(status['badges'].values())
    has_agents = status['csv']

    ready = all_backgrounds and all_badges and has_agents

    return jsonify(ready=ready, message='System ready' if ready else 'Admin must upload assets and master data.')

@app.route('/api/user/upload-photo', methods=['POST'])
def user_upload_photo():
    upload = request.files.get('photo')
    if not upload:
        abort(400, description='No photo provided.')
    client_code = request.form.get('client_code', '').strip()
    agent = get_agent_by_client_code(client_code)
    if not agent:
        abort(404, description='Client code not found.')
    if not GENERATION_SLOT.acquire(blocking=False):
        abort(429, description='The generator is busy. Please try again shortly.')
    paths = []
    metadata = None
    try:
        image = validated_image(upload)
        if image.width < 100 or image.height < 100:
            abort(400, description='Photo must be at least 100 pixels wide and high.')
        identifier = uuid4().hex
        temp_path = Path(USER_UPLOADS_FOLDER) / f'{identifier}.png'
        photo_path = Path(USER_PHOTOS_FOLDER) / f'{identifier}_original.png'
        paths.extend([temp_path, photo_path])
        atomic_image_save(image, temp_path)
        shutil.copyfile(temp_path, photo_path)
        filename, cert_path, metadata = generate_certificate_for_agent(agent, str(temp_path))
        paths.append(Path(cert_path))
        certificate = Certificate(
            agent_id=agent.id, filename=filename, filepath=cert_path,
            file_size=Path(cert_path).stat().st_size,
            original_photo_filename=photo_path.name, original_photo_filepath=str(photo_path),
            original_photo_size=photo_path.stat().st_size, generated_by=session['owner'],
            client_code_snapshot=agent.client_code, agent_name_snapshot=agent.agent_name,
            tier_snapshot=agent.mdrt_tier, badges_snapshot=','.join(agent.get_badges()),
            render_metadata=metadata)
        db.session.add(certificate)
        db.session.commit()
        return jsonify(success=True, certificate_file=filename,
                       certificate={'id': certificate.id, 'filename': filename, 'editable': bool(metadata.get('editor'))},
                       agent_info={'name': agent.agent_name, 'client_code': agent.client_code,
                                   'tier': agent.mdrt_tier, 'badges': agent.get_badges()})
    except Exception:
        db.session.rollback()
        if metadata:
            discard_layers(USER_OUTPUTS_FOLDER, metadata.get('editor'))
        for path in paths:
            path.unlink(missing_ok=True)
        raise
    finally:
        for path in paths:
            if path.parent == Path(USER_UPLOADS_FOLDER):
                path.unlink(missing_ok=True)
        GENERATION_SLOT.release()


def generate_certificate_for_agent(agent, photo_path):
    """Generate certificate for an agent"""
    import time
    start_time = time.time()

    assets = {(kind, name): asset_path(kind, name)
              for kind, names in [('background', ('MDRT','COT','TOT')), ('badge', ('LM','HR','QC')),
                                   ('nametag', ('MDRT','COT','TOT')), ('layer', ('MDRT','COT','TOT'))]
              for name in names}
    def resolved(kind, name):
        return assets[(kind, name)]
    metadata = {'renderer_version': 4, 'model': 'u2net_human_seg', 'mask_max_dimension': 1024,
                'layout': POSITION_RATIOS, 'assets': {f'{k[0]}/{k[1]}':
                    {'path': v, 'sha256': fingerprint(v)} for k, v in assets.items() if Path(v).is_file()}}
    tier = agent.mdrt_tier
    agent_name = agent.agent_name

    print(f"[TIMING] Starting certificate generation for {agent_name}")

    # Load tier background
    bg_path = resolved('background', tier)
    if not os.path.exists(bg_path):
        raise Exception(f"Background for {tier} not found")

    bg_load_start = time.time()
    background = Image.open(bg_path).convert('RGBA')
    background = background.resize((REFERENCE_WIDTH, REFERENCE_HEIGHT), Image.Resampling.LANCZOS)
    bg_width_original, bg_height_original = background.size
    print(f"[TIMING] Background loaded: {time.time() - bg_load_start:.2f}s")
    print(f"[INFO] Background original size: {bg_width_original}x{bg_height_original}")

    # Remove background from agent photo FIRST to check its resolution
    rembg_start = time.time()
    print(f"[TIMING] Starting background removal...")
    agent_img = remove_background(photo_path)
    print(f"[TIMING] Background removal completed: {time.time() - rembg_start:.2f}s")

    # Trim empty transparent margin around the subject before scaling.
    # Some photos (e.g. wide webcam/laptop shots) have the subject occupying
    # only a fraction of the frame's width, surrounded by empty background
    # that was just removed. Without trimming, that empty margin gets
    # scaled up along with the subject, making the person look small/
    # zoomed-out even though the overall image "fills" the placeholder box.
    # This is always safe: it only removes fully-transparent pixels, never
    # touches the visible person, so nothing is ever cropped/trimmed off
    # the subject itself. A small padding is kept around the tight bbox to
    # avoid clipping soft/antialiased edges from background removal.
    subject_bbox = agent_img.split()[-1].getbbox()
    if subject_bbox:
        bx0, by0, bx1, by1 = subject_bbox
        pad_x = max(4, int((bx1 - bx0) * 0.02))
        pad_y = max(4, int((by1 - by0) * 0.02))
        orig_w, orig_h = agent_img.size
        bx0 = max(0, bx0 - pad_x)
        by0 = max(0, by0 - pad_y)
        bx1 = min(orig_w, bx1 + pad_x)
        by1 = min(orig_h, by1 + pad_y)
        if (bx0, by0, bx1, by1) != (0, 0, orig_w, orig_h):
            agent_img = agent_img.crop((bx0, by0, bx1, by1))
            print(f"[INFO] Trimmed empty transparent margin: {orig_w}x{orig_h} -> {agent_img.size[0]}x{agent_img.size[1]}")

    img_w, img_h = agent_img.size
    print(f"[INFO] Agent photo size: {img_w}x{img_h}")

    if subject_bbox is None:
        raise BadRequest('No subject detected. Please upload a clearer portrait.')
    bg_width, bg_height = background.size
    photo_ratios = POSITION_RATIOS['agent_photo']
    max_width = int(bg_width * photo_ratios['width_ratio'])
    max_height = int(bg_height * photo_ratios['height_ratio'])
    scale = min(max_width / img_w, max_height / img_h)
    new_w, new_h = max(1, round(img_w * scale)), max(1, round(img_h * scale))
    paste_x = (bg_width - new_w) // 2
    paste_y = bg_height - new_h

    print(f"[INFO] Photo positioned at ({paste_x}, {paste_y}), size: {new_w}x{new_h}")
    print(f"[INFO] Photo extends from y={paste_y} to y={paste_y + new_h} (background height: {bg_height})")

    foreground = Image.new('RGBA', background.size)

    # Add badges (scaled to background)
    badges = agent.get_badges()
    badge_ratios = POSITION_RATIOS['badges']
    badge_x = int(bg_width * badge_ratios['x_ratio'])
    badge_y_start = int(bg_height * badge_ratios['y_ratio'])
    badge_spacing = int(bg_height * badge_ratios['spacing_ratio'])
    badge_size = int(bg_width * badge_ratios['size_ratio'])

    for i, badge_code in enumerate(badges):
        badge_path = resolved('badge', badge_code)
        if os.path.exists(badge_path):
            badge_img = Image.open(badge_path).convert('RGBA')
            badge_img = badge_img.resize((badge_size, badge_size), Image.Resampling.LANCZOS)
            badge_y = badge_y_start + (i * badge_spacing)
            foreground.alpha_composite(badge_img, (badge_x, badge_y))

    # Add tier-specific layer overlay OVER the photo (below the name tag)
    layer_path = resolved('layer', tier)
    if os.path.exists(layer_path):
        layer_img = Image.open(layer_path).convert('RGBA')
        # Layer covers the full certificate canvas, same as the background
        layer_img = layer_img.resize((bg_width, bg_height), Image.Resampling.LANCZOS)
        foreground.alpha_composite(layer_img)
        print(f"[INFO] Layer ({tier}) overlaid at full size {bg_width}x{bg_height}")

    # Add tier-specific name tag banner OVER the photo at the bottom
    nametag_ratios = POSITION_RATIOS['name_tag']
    nametag_width = int(bg_width * nametag_ratios['width_ratio'])
    nametag_path = resolved('nametag', tier)
    if os.path.exists(nametag_path):
        with Image.open(nametag_path) as uploaded_nametag:
            fitted = fit_nametag(uploaded_nametag, background.size,
                                 nametag_ratios['width_ratio'], nametag_ratios['y_ratio'])
        if fitted is not None:
            nametag_img, position, metadata['name_tag'] = fitted
            nametag_width = nametag_img.width
            foreground.alpha_composite(nametag_img, position)
            print(f"[INFO] Name tag ({tier}) overlaid at {position} with size {nametag_img.width}x{nametag_img.height}")

    # Add agent name with DYNAMIC FONT SIZE - drawn on top of name tag
    draw = ImageDraw.Draw(foreground)
    name_ratios = POSITION_RATIOS['name_text']
    max_font_size = int(bg_height * name_ratios['font_size_ratio'])
    text_x = int(bg_width * name_ratios['x_ratio'])
    text_y = int(bg_height * name_ratios['y_ratio'])

    # Calculate max width based on name tag width
    max_text_width = int(nametag_width * name_ratios.get('max_width_ratio', 0.85))

    # Dynamic font sizing: Start with max and shrink if needed
    font_size = max_font_size
    font = None
    text_bbox = None

    # Client-provided "Avenir Black" font for the agent name text
    AVENIR_FONT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts', 'Avenir.ttc')
    AVENIR_BLACK_INDEX = 2  # Index within the .ttc collection for "Avenir Black"

    display_name = agent_name.upper()
    for attempt in range(80):  # Fit the uppercase face and 3D decoration.
        try:
            # Use the client-provided Avenir Black font
            font = ImageFont.truetype(AVENIR_FONT_PATH, font_size, index=AVENIR_BLACK_INDEX)
        except:
            try:
                # Fallback to DejaVu Sans Bold for readability
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
            except:
                try:
                    font = ImageFont.truetype("arial.ttf", font_size)
                except:
                    font = ImageFont.load_default()

        # Get text dimensions
        text_bbox = draw.textbbox((0, 0), display_name, font=font)
        text_width = text_bbox[2] - text_bbox[0]

        # If text fits, break
        if text_width + max(32, font_size // 2) <= max_text_width:
            break

        # Reduce font size and try again. Keep shrinking past the
        # "preferred" minimum for very long names so the text never
        # overflows the name tag -- only stop at a hard floor where
        # text would become unreadably small.
        font_size = int(font_size * 0.92)  # Reduce by 8% each iteration
        hard_floor = 12
        if font_size < hard_floor:
            font_size = hard_floor
            font = ImageFont.truetype(AVENIR_FONT_PATH, font_size, index=AVENIR_BLACK_INDEX) if os.path.exists(AVENIR_FONT_PATH) else font
            text_bbox = draw.textbbox((0, 0), display_name, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            break

    if text_width + max(32, font_size // 2) > max_text_width:
        raise BadRequest('Agent name is too long for the certificate.')
    metadata['font'] = {'path': AVENIR_FONT_PATH, 'index': AVENIR_BLACK_INDEX, 'size': font_size,
                        'sha256': fingerprint(AVENIR_FONT_PATH) if Path(AVENIR_FONT_PATH).is_file() else None}

    # 3D metallic extruded text effect (per client reference "GPT example
    # 3D text.html"): uppercase, gradient-filled face + orange->red gradient
    # extrusion + soft drop shadow.
    display_name = agent_name.upper()
    draw_3d_metallic_text(foreground, display_name, font, text_x, text_y, style='name')
    print(f"[INFO] Name text '{display_name}' drawn (3D metallic style) centered at ({text_x}, {text_y}) with font size {font_size}px (max width: {max_text_width}px, actual: {text_width}px)")

    cert_filename = f'{uuid4().hex}.png'
    cert_path = str(Path(USER_OUTPUTS_FOLDER) / cert_filename)
    metadata['output_size'] = [bg_width, bg_height]
    metadata['editor'] = create_layers(USER_OUTPUTS_FOLDER, background, agent_img, foreground,
                                       {'x': paste_x, 'y': paste_y, 'width': new_w, 'height': new_h})
    try:
        certificate_image = compose(background, agent_img, foreground, metadata['editor'], metadata['editor']['transform'])
        atomic_image_save(certificate_image, cert_path)
    except Exception:
        discard_layers(USER_OUTPUTS_FOLDER, metadata['editor'])
        raise

    return cert_filename, cert_path, metadata

@app.get('/api/user/certificates/<int:cert_id>/editor')
def user_get_editor(cert_id):
    certificate = db.session.get(Certificate, cert_id)
    require_certificate_access(certificate)
    editor = (certificate.render_metadata or {}).get('editor')
    paths = layer_paths(USER_OUTPUTS_FOLDER, editor)
    if any(not path.is_file() for path in paths.values()):
        abort(404, description='The portrait adjustment files are no longer available.')
    return jsonify(success=True, width=editor['width'], height=editor['height'],
                   portrait_rect=editor['portrait_rect'], transform=editor['transform'], revision=editor['revision'],
                   layers={name: f'/user/certificates/{cert_id}/editor/{name}' for name in paths})


@app.get('/api/user/certificates/<int:cert_id>/editor/<layer>')
def user_get_editor_layer(cert_id, layer):
    certificate = db.session.get(Certificate, cert_id)
    require_certificate_access(certificate)
    paths = layer_paths(USER_OUTPUTS_FOLDER, (certificate.render_metadata or {}).get('editor'))
    if layer not in paths or not paths[layer].is_file():
        abort(404)
    return send_file(paths[layer], mimetype='image/png')


@app.post('/api/user/certificates/<int:cert_id>/adjust')
def user_adjust_certificate(cert_id):
    certificate = db.session.get(Certificate, cert_id)
    require_certificate_access(certificate)
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or type(data.get('revision')) is not int or data['revision'] < 0:
        abort(400, description='Provide the current certificate revision.')
    transform = validate_transform(data.get('transform'))
    if not GENERATION_SLOT.acquire(blocking=False):
        abort(429, description='The generator is busy. Please try again shortly.')
    new_path = None
    try:
        # Another request may have saved while we were checking ownership.
        db.session.expire_all()
        certificate = db.session.get(Certificate, cert_id)
        require_certificate_access(certificate)
        metadata = deepcopy(certificate.render_metadata or {})
        editor = metadata.get('editor')
        layer_paths(USER_OUTPUTS_FOLDER, editor)
        if editor['revision'] != data['revision']:
            abort(409, description='This certificate has changed. Reopen the editor to load its latest position.')
        image = render_saved_layers(USER_OUTPUTS_FOLDER, editor, transform)
        old_path = safe_path(USER_OUTPUTS_FOLDER, certificate.filename)
        filename = f'{uuid4().hex}.png'
        new_path = safe_path(USER_OUTPUTS_FOLDER, filename)
        atomic_image_save(image, new_path)
        editor.update(transform=transform, revision=editor['revision'] + 1)
        metadata['edited_at'] = datetime.now().isoformat()
        certificate.render_metadata = metadata
        certificate.filename, certificate.filepath = filename, str(new_path)
        certificate.file_size = new_path.stat().st_size
        # Restore the previous PNG if updating the history record fails.
        with staged_delete([old_path]):
            db.session.commit()
        return jsonify(success=True, certificate_file=filename, revision=editor['revision'], transform=transform)
    except Exception:
        db.session.rollback()
        if new_path:
            new_path.unlink(missing_ok=True)
        raise
    finally:
        GENERATION_SLOT.release()


@app.route('/api/user/preview/<filename>', methods=['GET'])
def user_preview_certificate(filename):
    certificate = Certificate.query.filter_by(filename=filename).first()
    require_certificate_access(certificate)
    path = safe_path(USER_OUTPUTS_FOLDER, certificate.filename)
    if not path.is_file():
        abort(404)
    return send_file(path, mimetype='image/png')


@app.route('/api/user/download/<filename>', methods=['GET'])
def user_download_certificate(filename):
    certificate = Certificate.query.filter_by(filename=filename).first()
    require_certificate_access(certificate)
    path = safe_path(USER_OUTPUTS_FOLDER, certificate.filename)
    if not path.is_file():
        abort(404)
    Certificate.query.filter_by(id=certificate.id).update({
        Certificate.download_count: Certificate.download_count + 1,
        Certificate.is_downloaded: True, Certificate.last_downloaded_at: datetime.now()})
    db.session.commit()
    return send_file(path, as_attachment=True, download_name=f'{secure_filename(certificate.client_code_snapshot or "certificate")}.png')


@app.route('/api/statistics', methods=['GET'])
def get_stats():
    """Get system statistics"""
    try:
        stats = get_statistics()
        return jsonify({
            'success': True,
            'statistics': stats
        })
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Request failed")
        return jsonify({'success': False, 'error': 'Unable to complete request.'}), 400

@app.route('/api/certificates/recent', methods=['GET'])
def get_recent_certs():
    limit = request.args.get('limit', 10, type=int)
    if not 1 <= limit <= 100:
        abort(400, description='Limit must be 1-100.')
    return jsonify(success=True, certificates=[row.to_dict() for row in get_recent_certificates(limit)])


@app.route('/api/certificates/history', methods=['GET'])
def get_certificate_history():
    page, size = pagination()
    query = Certificate.query
    search = request.args.get('search', '').strip()[:200]
    if search:
        query = query.filter(db.or_(Certificate.agent_name_snapshot.icontains(search, autoescape=True),
                                   Certificate.client_code_snapshot.icontains(search, autoescape=True)))
    from datetime import timedelta
    for parameter, upper in [('from', False), ('to', True)]:
        value = request.args.get(parameter)
        if value:
            try:
                date = datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                abort(400, description='Dates must use YYYY-MM-DD.')
            query = query.filter(Certificate.generated_at < date + timedelta(days=1)) if upper else query.filter(Certificate.generated_at >= date)
    total = query.count()
    records = query.order_by(Certificate.generated_at.desc(), Certificate.id.desc()).offset((page-1)*size).limit(size).all()
    results = []
    for cert in records:
        badges = (cert.badges_snapshot or '').split(',')
        results.append({'id': cert.id, 'client_code': cert.client_code_snapshot or 'UNKNOWN',
                        'agent_name': cert.agent_name_snapshot or 'Unknown historical agent',
                        'mdrt_tier': cert.tier_snapshot, 'life_member': 'LM' in badges,
                        'honor_roll': 'HR' in badges, 'quarter_century': 'QC' in badges,
                        'filename': cert.filename, 'generated_at': cert.generated_at.isoformat(),
                        'original_photo_filename': cert.original_photo_filename,
                        'has_original_photo': bool(cert.original_photo_filename)})
    return jsonify(success=True, total=total, page=page, per_page=size, certificates=results)


@app.route('/api/certificates/<filename>', methods=['GET'])
def get_certificate_file(filename):
    return user_preview_certificate(filename)


@app.route('/api/certificates/photo/<filename>', methods=['GET'])
def get_original_photo(filename):
    if not Certificate.query.filter_by(original_photo_filename=filename).first():
        abort(404)
    path = safe_path(USER_PHOTOS_FOLDER, filename)
    if not path.is_file():
        abort(404)
    return send_file(path)


@app.route('/api/certificates/<int:cert_id>', methods=['DELETE'])
def delete_certificate(cert_id):
    certificate = db.get_or_404(Certificate, cert_id)
    paths = []
    if not Certificate.query.filter(Certificate.id != cert_id, Certificate.filename == certificate.filename).first():
        paths.append(safe_path(USER_OUTPUTS_FOLDER, certificate.filename))
    if certificate.original_photo_filename and not Certificate.query.filter(Certificate.id != cert_id, Certificate.original_photo_filename == certificate.original_photo_filename).first():
        paths.append(safe_path(USER_PHOTOS_FOLDER, certificate.original_photo_filename))
    editor = (certificate.render_metadata or {}).get('editor')
    if editor:
        paths.extend(layer_paths(USER_OUTPUTS_FOLDER, editor).values())
    with staged_delete(paths):
        db.session.delete(certificate)
        db.session.commit()
    discard_layers(USER_OUTPUTS_FOLDER, editor)
    return jsonify(success=True)


@app.route('/api/health', methods=['GET'])
def health_check():
    db.session.execute(db.text('SELECT 1'))
    return jsonify(status='ok', database='connected')

# Serve React frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve React frontend files"""
    if path == 'api' or path.startswith('api/'):
        abort(404)
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
    app.run(host='127.0.0.1', port=5001, debug=False)
