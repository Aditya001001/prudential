"""Validated uploads and recoverable filesystem operations."""
import hashlib
import os
import warnings
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.exceptions import BadRequest

MAX_PIXELS = 25_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def validated_image(upload):
    if Path(upload.filename or '').suffix.lower() not in {'.png', '.jpg', '.jpeg'}:
        raise BadRequest('Upload a PNG or JPEG image.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(upload.stream) as image:
                if image.format not in {'PNG', 'JPEG'} or image.width * image.height > MAX_PIXELS:
                    raise BadRequest('Image must be PNG/JPEG and no larger than 25 megapixels.')
                image.load()
                return ImageOps.exif_transpose(image).convert('RGBA')
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise BadRequest('The uploaded image is corrupt or too large.') from error


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
