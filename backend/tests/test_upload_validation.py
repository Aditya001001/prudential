import io
import sys
import unittest
from pathlib import Path

from PIL import Image
from werkzeug.datastructures import FileStorage
from werkzeug.exceptions import BadRequest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from storage import validated_image


class UploadValidationTests(unittest.TestCase):
    def upload(self, size, name='image.png'):
        content = io.BytesIO()
        Image.new('1', size).save(content, 'PNG')
        content.seek(0)
        return FileStorage(stream=content, filename=name)

    def test_compressed_small_file_reports_actual_over_limit_dimensions(self):
        upload = self.upload((5001, 5000))
        self.assertLess(len(upload.stream.getvalue()), 3_000_000)
        with self.assertRaisesRegex(BadRequest, 'Image resolution 5001x5000 exceeds 25 megapixels'):
            validated_image(upload)

    def test_extreme_dimensions_report_resolution_instead_of_corruption(self):
        with self.assertRaisesRegex(BadRequest, 'Image resolution exceeds 25 megapixels'):
            validated_image(self.upload((10001, 5000)))

    def test_unreadable_contents_explain_how_to_retry(self):
        with self.assertRaisesRegex(BadRequest, 'Export a new PNG or JPEG'):
            validated_image(FileStorage(stream=io.BytesIO(b'broken'), filename='image.png'))

    def test_valid_transparency_is_preserved(self):
        content = io.BytesIO()
        Image.new('RGBA', (10, 20), (80, 90, 100, 64)).save(content, 'PNG')
        content.seek(0)
        image = validated_image(FileStorage(stream=content, filename='image.png'))
        self.assertEqual(image.getpixel((0, 0)), (80, 90, 100, 64))
