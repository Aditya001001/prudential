"""Validated uploads and recoverable filesystem operations."""
import hashlib
import os
import warnings
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.exceptions import BadRequest

# Certificates render at 1800 × 3184 (under 6 megapixels), so a 25-megapixel
# source leaves ample detail while avoiding unnecessarily large stored photos.
MAX_PIXELS = 25_000_000
MAX_PHOTO_PROCESSING_PIXELS = 50_000_000
MAX_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = MAX_PHOTO_PROCESSING_PIXELS


def validated_image(upload):
    """Validate an administrator image; its dimensions must already fit."""
    return _decode_image(upload, maximum_pixels=MAX_PIXELS)


def validated_photo(upload):
    """Validate a user portrait and reduce a safe high-resolution source.

    The input limit protects the upload endpoint and the normalized image is
    constrained before it is ever placed in the generation queue.  We permit
    up to 50 MP solely to automatically resize modern phone photos down to
    the 25 MP working limit.
    """
    return _decode_image(
        upload,
        maximum_pixels=MAX_PHOTO_PROCESSING_PIXELS,
        output_pixels=MAX_PIXELS,
        maximum_bytes=MAX_PHOTO_UPLOAD_BYTES,
    )


def _upload_size(upload):
    stream = upload.stream
    position = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(position)
    return size


def _scaled_size(width, height, maximum_pixels):
    scale = (maximum_pixels / (width * height)) ** 0.5
    scaled = max(1, int(width * scale)), max(1, int(height * scale))
    while scaled[0] * scaled[1] > maximum_pixels:
        scaled = scaled[0], scaled[1] - 1
    return scaled


def _decode_image(upload, *, maximum_pixels, output_pixels=None, maximum_bytes=None):
    if Path(upload.filename or '').suffix.lower() not in {'.png', '.jpg', '.jpeg'}:
        raise BadRequest('Upload a PNG or JPEG image.')
    if maximum_bytes is not None:
        size = _upload_size(upload)
        if size > maximum_bytes:
            raise BadRequest(
                f'Photo file size {size / 1024 / 1024:.2f} MB exceeds the 5 MB limit.'
            )
    try:
        with warnings.catch_warnings():
            # Check dimensions ourselves so over-limit uploads receive an
            # actionable error rather than being described as corrupt.
            warnings.simplefilter('ignore', Image.DecompressionBombWarning)
            with Image.open(upload.stream) as image:
                if image.format not in {'PNG', 'JPEG'}:
                    raise BadRequest('Upload a PNG or JPEG image.')
                source_pixels = image.width * image.height
                if source_pixels > maximum_pixels:
                    limit = maximum_pixels // 1_000_000
                    raise BadRequest(
                        f'Image resolution {image.width}x{image.height} exceeds the {limit} megapixel processing limit.'
                    )
                image.load()
                normalized = ImageOps.exif_transpose(image).convert('RGBA')
                if output_pixels and source_pixels > output_pixels:
                    normalized = normalized.resize(
                        _scaled_size(*normalized.size, output_pixels),
                        Image.Resampling.LANCZOS,
                    )
                return normalized
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise BadRequest('Image resolution exceeds the 50 megapixel processing limit.') from error
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise BadRequest('Image cannot be decoded. Export a new PNG or JPEG and try again.') from error


def atomic_photo_save(image, path, maximum_bytes=MAX_PHOTO_UPLOAD_BYTES):
    """Persist a portrait as a compact JPEG, never exceeding the 5 MB quota.

    Uploaded PNG portraits are flattened against white because the background
    removal model consumes a normal RGB photo.  A JPEG is considerably smaller
    than the previous decoded PNG and prevents a small JPEG upload from
    expanding into a very large permanent file on disk.
    """
    path = Path(path)
    source = image.convert('RGBA')
    background = Image.new('RGBA', source.size, 'white')
    background.alpha_composite(source)
    candidate = background.convert('RGB')
    temporary = path.with_name(f'.{uuid4().hex}.tmp')
    try:
        for _ in range(8):
            for quality in (88, 80, 72, 64):
                candidate.save(temporary, 'JPEG', quality=quality, optimize=True, progressive=True)
                if temporary.stat().st_size <= maximum_bytes:
                    os.replace(temporary, path)
                    return {'width': candidate.width, 'height': candidate.height, 'size': path.stat().st_size}
            candidate = candidate.resize(
                (max(1, int(candidate.width * 0.85)), max(1, int(candidate.height * 0.85))),
                Image.Resampling.LANCZOS,
            )
        raise BadRequest('Photo could not be compressed below the 5 MB storage limit. Please use a simpler image.')
    finally:
        temporary.unlink(missing_ok=True)


def safe_path(folder, filename):
    root = Path(folder).resolve()
    path = (root / filename).resolve()
    if path.parent != root or Path(filename).name != filename:
        raise BadRequest('Invalid filename.')
    return path


def atomic_image_save(image, path):
    path = Path(path)
    temporary = path.with_name(f'.{uuid4().hex}.tmp')
    try:
        image.save(temporary, 'PNG')
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def fingerprint(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


@contextmanager
def staged_delete(paths):
    """Rename files first, restore if the caller's DB transaction fails."""
    moved = []
    try:
        for path in dict.fromkeys(Path(p) for p in paths if p):
            if path.is_file():
                temporary = path.with_name(f'.deleted-{uuid4().hex}-{path.name}')
                path.rename(temporary)
                moved.append((path, temporary))
        yield
    except Exception:
        for original, temporary in reversed(moved):
            temporary.replace(original)
        raise
    else:
        for _, temporary in moved:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                # A hidden tombstone is safe to sweep later; DB deletion already committed.
                import logging
                logging.getLogger(__name__).exception('Unable to remove deletion tombstone')


def quarantine_unreferenced(base, references, destination, minimum_age=3600):
    """Move old unreferenced files into a private backup, never delete them.

    Recently written files are excluded so an in-flight generation can finish
    before a later maintenance run examines its database reference.
    """
    import json
    import time
    base, destination = Path(base), Path(destination)
    destination.mkdir(parents=True, mode=0o700)
    destination.chmod(0o700)
    cutoff = time.time() - minimum_age
    moved, manifest = [], []
    try:
        for folder, known in references.items():
            target = destination / folder
            for path in (base / folder).iterdir():
                if path.name.startswith('.') or path.is_symlink() or not path.is_file():
                    continue
                if path.name in known or path.stat().st_mtime > cutoff:
                    continue
                target.mkdir(exist_ok=True, mode=0o700)
                backup = target / path.name
                manifest.append({'source': str(path), 'backup': str(backup), 'bytes': path.stat().st_size})
                path.rename(backup)
                moved.append((path, backup))
        (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    except Exception:
        for original, backup in reversed(moved):
            backup.replace(original)
        raise
    return len(moved)
