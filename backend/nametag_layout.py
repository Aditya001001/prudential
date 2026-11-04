"""Fit visible name-tag artwork independently of transparent export padding."""
from PIL import Image


def fit_nametag(image, canvas_size, width_ratio, y_ratio):
    image = image.convert('RGBA')
    source_bounds = image.getchannel('A').getbbox()
    if source_bounds is None:
        return None

    artwork = image.crop(source_bounds)
    canvas_width, canvas_height = canvas_size
    target_width = max(1, min(canvas_width, int(canvas_width * width_ratio)))
    margin = (canvas_width - target_width) // 2
    center_y = int(canvas_height * y_ratio)
    # Keep the whole banner inside the canvas with the same inset as its sides.
    max_height = max(1, 2 * min(center_y - margin, canvas_height - margin - center_y))
    scale = min(target_width / artwork.width, max_height / artwork.height)
    width = max(1, int(artwork.width * scale))
    height = max(1, int(artwork.height * scale))
    artwork = artwork.resize((width, height), Image.Resampling.LANCZOS)
    x = (canvas_width - width) // 2
    y = max(0, min(canvas_height - height, center_y - height // 2))
    metadata = {
        'source_size': list(image.size),
        'source_bounds': list(source_bounds),
        'bounds': {'x': x, 'y': y, 'width': width, 'height': height},
    }
    return artwork, (x, y), metadata
