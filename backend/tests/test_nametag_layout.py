import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nametag_layout import fit_nametag


class NameTagLayoutTests(unittest.TestCase):
    def fit(self, image):
        return fit_nametag(image, (1800, 3184), .9, 2750 / 3184)

    def test_transparent_poster_export_matches_tightly_cropped_artwork(self):
        # Match the current uploads: artwork at the bottom of a tall transparent canvas.
        artwork = Image.new('RGBA', (1778, 760), '#eab308')
        ImageDraw.Draw(artwork).rectangle((200, 300, 1200, 600), fill='#7c3aed')
        padded = Image.new('RGBA', (1873, 3334))
        padded.alpha_composite(artwork, (25, 2404))
        fitted, position, metadata = self.fit(padded)
        tight, tight_position, _ = self.fit(artwork)
        self.assertEqual(fitted.size, tight.size)
        self.assertEqual(fitted.tobytes(), tight.tobytes())
        self.assertEqual(position, tight_position)
        self.assertEqual(metadata['source_bounds'], [25, 2404, 1803, 3164])
        self.assertGreaterEqual(position[1], 0)
        self.assertLessEqual(position[1] + fitted.height, 3184 - 90)

    def test_tall_banner_keeps_all_four_corners_inside_the_poster(self):
        image = Image.new('RGBA', (400, 2400), '#eab308')
        draw = ImageDraw.Draw(image)
        colors = ['red', 'green', 'blue', 'purple']
        for box, color in zip([(0, 0, 100, 100), (300, 0, 399, 100),
                               (0, 2300, 100, 2399), (300, 2300, 399, 2399)], colors):
            draw.rectangle(box, fill=color)
        fitted, (x, y), _ = self.fit(image)
        self.assertGreaterEqual(x, 90)
        self.assertGreaterEqual(y, 90)
        self.assertLessEqual(x + fitted.width, 1800 - 90)
        self.assertLessEqual(y + fitted.height, 3184 - 90)
        for point, color in zip([(0, 0), (fitted.width-1, 0),
                                 (0, fitted.height-1), (fitted.width-1, fitted.height-1)], colors):
            self.assertEqual(fitted.getpixel(point), Image.new('RGBA', (1, 1), color).getpixel((0, 0)))

    def test_existing_compact_banner_retains_its_size_and_anchor(self):
        image = Image.new('RGBA', (3600, 1525), 'gold')
        fitted, position, _ = self.fit(image)
        self.assertEqual(fitted.size, (1620, 686))
        self.assertEqual(position, (90, 2407))

    def test_fully_transparent_asset_does_not_create_visible_artwork(self):
        self.assertIsNone(self.fit(Image.new('RGBA', (1873, 3334))))


if __name__ == '__main__':
    unittest.main()
