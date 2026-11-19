import io
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from werkzeug.datastructures import FileStorage
from werkzeug.exceptions import BadRequest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from storage import MAX_PIXELS, atomic_photo_save, validated_image, validated_photo


class UploadValidationTests(unittest.TestCase):
    def upload(self, size, name='image.png'):
        content = io.BytesIO()
        Image.new('1', size).save(content, 'PNG')
        content.seek(0)
        return FileStorage(stream=content, filename=name)

    def test_compressed_small_file_reports_actual_over_limit_dimensions(self):
        upload = self.upload((5001, 5000))
        self.assertLess(len(upload.stream.getvalue()), 3_000_000)
        with self.assertRaisesRegex(BadRequest, 'Image resolution 5001x5000 exceeds the 25 megapixel processing limit'):
            validated_image(upload)

    def test_extreme_dimensions_report_resolution_instead_of_corruption(self):
        with self.assertRaisesRegex(BadRequest, 'Image resolution 10001x5000 exceeds the 25 megapixel processing limit'):
            validated_image(self.upload((10001, 5000)))

    def test_user_photo_just_over_25_megapixels_is_automatically_resized(self):
        image = validated_photo(self.upload((5001, 5000)))
        self.assertLessEqual(image.width * image.height, MAX_PIXELS)
        self.assertGreater(image.width, 4000)

    def test_user_photo_over_5_megabytes_reports_a_file_size_error(self):
        upload = FileStorage(stream=io.BytesIO(b'x' * (5 * 1024 * 1024 + 1)), filename='portrait.png')
        with self.assertRaisesRegex(BadRequest, 'Photo file size 5.00 MB exceeds the 5 MB limit'):
            validated_photo(upload)

    def test_normalized_stored_photo_is_a_compact_jpeg(self):
        image = Image.new('RGBA', (200, 400), (80, 90, 100, 64))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'portrait.jpg'
            details = atomic_photo_save(image, path)
            self.assertTrue(path.is_file())
            self.assertLessEqual(details['size'], 5 * 1024 * 1024)
            with Image.open(path) as stored:
                self.assertEqual(stored.format, 'JPEG')

    def test_unreadable_contents_explain_how_to_retry(self):
        with self.assertRaisesRegex(BadRequest, 'Export a new PNG or JPEG'):
            validated_image(FileStorage(stream=io.BytesIO(b'broken'), filename='image.png'))

    def test_valid_transparency_is_preserved(self):
        content = io.BytesIO()
        Image.new('RGBA', (10, 20), (80, 90, 100, 64)).save(content, 'PNG')
        content.seek(0)
        image = validated_image(FileStorage(stream=content, filename='image.png'))
        self.assertEqual(image.getpixel((0, 0)), (80, 90, 100, 64))
