import os
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
from rembg import remove

# ===================== CONFIGURATION =====================
CSV_PATH = "Sample Data.csv"
OUTPUT_DIR = "output_certificates"

# Directory structure
BACKGROUNDS_DIR = "backgrounds"      # Background images for each tier
AGENT_PHOTOS_DIR = "agent_photos"    # Original agent photos
BADGES_DIR = "badges"                # Badge PNG overlays (LM, HR, QC)
FONTS_DIR = "fonts"                  # Font files for names

# Background mapping (based on category.txt)
TIER_BACKGROUNDS = {
    "MDRT": "mdrt_red.png",
    "COT": "cot_purple.png",
    "TOT": "tot_gold.png"
}

# Badge file mapping
BADGE_FILES = {
    "LM": "life_member.png",      # Life Member (10 years)
    "HR": "honor_roll.png",       # Honor Roll (15 years)
    "QC": "quarter_century.png"   # Quarter Century (25 years)
}

# ===================== POSITIONING COORDINATES =====================
# Adjust these based on your background template dimensions

# Agent photo positioning (center coordinates)
AGENT_PHOTO_CONFIG = {
    "position": (400, 500),        # (x, y) center position
    "max_height": 600,             # Maximum height for agent photo
    "max_width": 500               # Maximum width for agent photo
}

# Name text positioning
NAME_TEXT_CONFIG = {
    "position": (400, 850),        # (x, y) center position
    "font_size": 60,
    "font_file": "Arial_Bold.ttf", # Font filename in fonts/ directory
    "color": "white",
    "stroke_width": 2,             # Outline width
    "stroke_color": "black"        # Outline color
}

# Badge positioning (stacked vertically on left side)
BADGE_CONFIG = {
    "start_position": (50, 400),   # (x, y) for first badge
    "vertical_spacing": 120,       # Space between badges
    "badge_size": (100, 100)       # Resize badges to this size
}

# ===================== HELPER FUNCTIONS =====================

def ensure_directories():
    """Create output directory if it doesn't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
def remove_background(image_path):
    """Remove background from agent photo using rembg"""
    print(f"  → Removing background from {os.path.basename(image_path)}...")
    with Image.open(image_path) as img:
        # Remove background
        no_bg = remove(img)
        return no_bg.convert("RGBA")

def resize_agent_photo(img, max_width, max_height):
    """Resize agent photo proportionally to fit within max dimensions"""
    img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    return img

def paste_centered(background, overlay, center_pos):
    """Paste overlay image centered at given position"""
    x, y = center_pos
    overlay_x = x - overlay.width // 2
    overlay_y = y - overlay.height // 2
    background.alpha_composite(overlay, dest=(overlay_x, overlay_y))

def draw_name_text(draw, name, position, font, color, stroke_width, stroke_color):
    """Draw name text centered at position with outline"""
    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), name, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x, y = position
    text_x = x - text_width // 2
    text_y = y - text_height // 2
    
    # Draw text with stroke (outline)
    draw.text(
        (text_x, text_y), 
        name, 
        fill=color, 
        font=font,
        stroke_width=stroke_width,
        stroke_fill=stroke_color
    )

# ===================== MAIN PROCESSING =====================

def process_certificate(row):
    """Process a single certificate for one agent"""
    
    # Extract data from CSV row
    client_code = row['Client Cd']
    agent_name = row['Agent Name']
    tier = row['MDRT Title']  # MDRT, COT, or TOT
    
    # Badge flags
    has_lm = pd.notna(row['Life Member']) and str(row['Life Member']).strip() != ''
    has_hr = pd.notna(row['Honor Roll']) and str(row['Honor Roll']).strip() != ''
    has_qc = pd.notna(row['Quarter Century']) and str(row['Quarter Century']).strip() != ''
    
    print(f"\n{'='*60}")
    print(f"Processing: {agent_name} ({tier})")
    print(f"Badges: LM={has_lm}, HR={has_hr}, QC={has_qc}")
    
    try:
        # 1. Load background based on tier
        bg_filename = TIER_BACKGROUNDS.get(tier)
        if not bg_filename:
            print(f"  ✗ Unknown tier '{tier}'. Skipping.")
            return False
            
        bg_path = os.path.join(BACKGROUNDS_DIR, bg_filename)
        if not os.path.exists(bg_path):
            print(f"  ✗ Background not found: {bg_path}")
            return False
            
        canvas = Image.open(bg_path).convert("RGBA")
        print(f"  ✓ Loaded background: {bg_filename}")
        
        # 2. Load and process agent photo
        # Try different possible photo formats
        photo_found = False
        for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
            photo_path = os.path.join(AGENT_PHOTOS_DIR, f"{client_code}{ext}")
            if os.path.exists(photo_path):
                photo_found = True
                break
        
        if not photo_found:
            print(f"  ✗ Agent photo not found for client code: {client_code}")
            return False

        # Remove background from agent photo
        agent_no_bg = remove_background(photo_path)

        # Resize agent photo
        agent_no_bg = resize_agent_photo(
            agent_no_bg,
            AGENT_PHOTO_CONFIG["max_width"],
            AGENT_PHOTO_CONFIG["max_height"]
        )
        print(f"  ✓ Processed agent photo")

        # 3. Paste agent photo onto background
        paste_centered(canvas, agent_no_bg, AGENT_PHOTO_CONFIG["position"])
        print(f"  ✓ Placed agent on background")

        # 4. Add badges (if any)
        badges_to_add = []
        if has_lm:
            badges_to_add.append("LM")
        if has_hr:
            badges_to_add.append("HR")
        if has_qc:
            badges_to_add.append("QC")

        for idx, badge_key in enumerate(badges_to_add):
            badge_file = BADGE_FILES[badge_key]
            badge_path = os.path.join(BADGES_DIR, badge_file)

            if os.path.exists(badge_path):
                badge_img = Image.open(badge_path).convert("RGBA")
                # Resize badge
                badge_img = badge_img.resize(BADGE_CONFIG["badge_size"], Image.Resampling.LANCZOS)

                # Calculate position (stack vertically)
                badge_x = BADGE_CONFIG["start_position"][0]
                badge_y = BADGE_CONFIG["start_position"][1] + (idx * BADGE_CONFIG["vertical_spacing"])

                canvas.alpha_composite(badge_img, dest=(badge_x, badge_y))
                print(f"  ✓ Added badge: {badge_key}")
            else:
                print(f"  ⚠ Badge file not found: {badge_path}")

        # 5. Draw agent name
        draw = ImageDraw.Draw(canvas)

        # Load font
        font_path = os.path.join(FONTS_DIR, NAME_TEXT_CONFIG["font_file"])
        if os.path.exists(font_path):
            font = ImageFont.truetype(font_path, size=NAME_TEXT_CONFIG["font_size"])
        else:
            print(f"  ⚠ Font not found, using default: {font_path}")
            font = ImageFont.load_default()

        draw_name_text(
            draw,
            agent_name,
            NAME_TEXT_CONFIG["position"],
            font,
            NAME_TEXT_CONFIG["color"],
            NAME_TEXT_CONFIG["stroke_width"],
            NAME_TEXT_CONFIG["stroke_color"]
        )
        print(f"  ✓ Added name text")

        # 6. Save final certificate
        output_filename = f"{client_code}_{agent_name.replace(' ', '_')}_{tier}.png"
        output_path = os.path.join(OUTPUT_DIR, output_filename)

        # Convert to RGB for cleaner output (or keep RGBA for transparency)
        canvas.save(output_path, "PNG")
        print(f"  ✓ Saved: {output_filename}")

        return True

    except Exception as e:
        print(f"  ✗ Error processing {agent_name}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main execution function"""
    print("="*60)
    print("MDRT Certificate Generator")
    print("="*60)

    # Ensure output directory exists
    ensure_directories()

    # Read CSV
    if not os.path.exists(CSV_PATH):
        print(f"✗ CSV file not found: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH)
    print(f"\n✓ Loaded {len(df)} records from {CSV_PATH}")

    # Process each agent
    success_count = 0
    failed_count = 0

    for index, row in df.iterrows():
        success = process_certificate(row)
        if success:
            success_count += 1
        else:
            failed_count += 1

    # Summary
    print("\n" + "="*60)
    print("PROCESSING COMPLETE")
    print("="*60)
    print(f"✓ Successful: {success_count}")
    print(f"✗ Failed: {failed_count}")
    print(f"📁 Output directory: {OUTPUT_DIR}")
    print("="*60)

if __name__ == "__main__":
    main()
