"""Lossless certificate layers and portrait-only recomposition, without AI reruns."""
import math
import re
import shutil
from pathlib import Path
from uuid import uuid4
from PIL import Image
from werkzeug.exceptions import BadRequest, Conflict, NotFound
from storage import atomic_image_save

DEFAULT_TRANSFORM = {'scale': 1.0, 'offset_x': 0.0, 'offset_y': 0.0}
LAYERS = ('background', 'portrait', 'foreground')


def validate_transform(value):
    if not isinstance(value, dict) or set(value) != set(DEFAULT_TRANSFORM):
        raise BadRequest('Provide portrait size and horizontal/vertical position.')
    result = {}
    for key, lower, upper in [('scale', .25, 2.5), ('offset_x', -1, 1), ('offset_y', -1, 1)]:
        number = value[key]
        if isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not lower <= number <= upper:
            raise BadRequest('Portrait size must be 25–250%; position must remain within the adjustment range.')
        result[key] = float(number)
    return result


def portrait_rectangle(editor, transform):
    original = editor['portrait_rect']
    width = max(1, math.floor(original['width'] * transform['scale'] + .5))
    height = max(1, math.floor(original['height'] * transform['scale'] + .5))
    x = math.floor(original['x'] + original['width']/2 - width/2 + transform['offset_x'] * editor['width'] + .5)
    y = math.floor(original['y'] + original['height']/2 - height/2 + transform['offset_y'] * editor['height'] + .5)
    visible_width = min(editor['width'], x + width) - max(0, x)
    visible_height = min(editor['height'], y + height) - max(0, y)
    if min(visible_width, visible_height) < 16:
        raise BadRequest('Keep part of your portrait inside the certificate.')
    return x, y, width, height


def layer_paths(output_folder, editor):
    if not isinstance(editor, dict) or editor.get('version') != 1:
        raise Conflict('Photo adjustments are available for newly generated certificates. Please generate a new certificate.')
    key = editor.get('asset_key', '')
    if not isinstance(key, str) or not re.fullmatch(r'[a-f0-9]{32}', key):
        raise Conflict('Portrait adjustment data is unavailable.')
    root = Path(output_folder).resolve()
    directory = root / 'edits' / key
    if directory.resolve() != directory or not directory.is_relative_to(root):
        raise Conflict('Portrait adjustment data is unavailable.')
    return {name: directory / f'{name}.png' for name in LAYERS}


def discard_layers(output_folder, editor):
    if not editor:
        return
    paths = layer_paths(output_folder, editor)
    shutil.rmtree(paths['background'].parent, ignore_errors=True)


def create_layers(output_folder, background, portrait, foreground, rectangle):
    editor = {'version': 1, 'asset_key': uuid4().hex, 'width': background.width, 'height': background.height,
              'portrait_rect': rectangle, 'transform': dict(DEFAULT_TRANSFORM), 'revision': 0}
    paths = layer_paths(output_folder, editor)
    directory = paths['background'].parent
    directory.mkdir(parents=True, mode=0o700)
    try:
        for name, image in [('background', background), ('portrait', portrait), ('foreground', foreground)]:
            atomic_image_save(image, paths[name])
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        raise
    return editor


def compose(background, portrait, foreground, editor, transform):
    transform = validate_transform(transform)
    x, y, width, height = portrait_rectangle(editor, transform)
    result = background.copy().convert('RGBA')
    # Rendering to a bounded canvas clips moved/zoomed portraits at the edges.
    resized = portrait.resize((width, height), Image.Resampling.LANCZOS)
    result.alpha_composite(resized, (x, y))
    result.alpha_composite(foreground)
    return result


def render_saved_layers(output_folder, editor, transform):
    paths = layer_paths(output_folder, editor)
    if any(not path.is_file() for path in paths.values()):
        raise NotFound('The portrait adjustment files are no longer available.')
    with Image.open(paths['background']) as background, Image.open(paths['portrait']) as portrait, Image.open(paths['foreground']) as foreground:
        return compose(background.convert('RGBA'), portrait.convert('RGBA'), foreground.convert('RGBA'), editor, transform)
