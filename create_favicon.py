#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

# Create favicon with Prudential red color and certificate icon
def create_favicon():
    # Create multiple sizes for different uses
    sizes = [16, 32, 180, 192, 512]
    
    for size in sizes:
        # Create a new image with Prudential red background
        img = Image.new('RGB', (size, size), color='#ef4444')
        draw = ImageDraw.Draw(img)
        
        # Calculate proportions
        margin = size // 8
        
        # Draw a simple certificate icon in white
        # Rectangle for certificate
        cert_left = margin
        cert_top = margin
        cert_right = size - margin
        cert_bottom = size - margin
        
        # White certificate background
        draw.rectangle(
            [cert_left, cert_top, cert_right, cert_bottom],
            fill='white',
            outline='#ef4444',
            width=max(1, size // 32)
        )
        
        # Draw decorative lines (text lines on certificate)
        if size >= 32:
            line_margin = size // 4
            line_top = cert_top + size // 3
            line_spacing = size // 10
            
            for i in range(3):
                y = line_top + (i * line_spacing)
                draw.line(
                    [cert_left + line_margin, y, cert_right - line_margin, y],
                    fill='#ef4444',
                    width=max(1, size // 48)
                )
        
        # Save the favicon
        if size == 16:
            filename = f'frontend/public/favicon.ico'
            img.save(filename, format='ICO', sizes=[(16, 16)])
        else:
            filename = f'frontend/public/favicon-{size}x{size}.png'
            img.save(filename, format='PNG')
        
        print(f"Created: {filename}")

if __name__ == '__main__':
    create_favicon()
    print("\n✅ All favicons created successfully!")
