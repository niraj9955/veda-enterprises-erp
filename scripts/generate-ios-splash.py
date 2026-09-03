#!/usr/bin/env python3
"""
Generate iOS apple-touch-startup-image splash screens for Veda ERP PWA.

iOS shows these as the launch screen when an installed PWA starts up,
before the JS has finished hydrating. Without them, iOS shows a plain
white screen which feels janky.

Each device size needs its own PNG with:
  - The exact pixel dimensions of that device's screen
  - A solid background color (the theme color #059669)
  - The Veda logo centered at ~30% of the screen width
"""
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

PUBLIC_DIR = Path("/home/z/my-project/public")
ICON_DIR = PUBLIC_DIR / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)

# Source: largest icon we have
SRC_ICON = ICON_DIR / "icon-512x512.png"
assert SRC_ICON.exists(), f"Missing source icon: {SRC_ICON}"

# Theme color (emerald-600)
BG_COLOR = (5, 150, 105, 255)  # #059669

# iOS device splash screen sizes (portrait, landscape pairs)
# Format: (filename, width, height, description)
DEVICES = [
    # iPhone — portrait
    ("apple-splash-320x568.png", 320, 568, "iPhone SE / 5"),
    ("apple-splash-375x667.png", 375, 667, "iPhone 6/7/8"),
    ("apple-splash-414x736.png", 414, 736, "iPhone 6/7/8 Plus"),
    ("apple-splash-375x812.png", 375, 812, "iPhone X/XS/11 Pro"),
    ("apple-splash-414x896.png", 414, 896, "iPhone XR/XS Max/11"),
    ("apple-splash-390x844.png", 390, 844, "iPhone 12/13/14"),
    ("apple-splash-428x926.png", 428, 926, "iPhone 12/13/14 Pro Max"),
    # iPad — portrait
    ("apple-splash-768x1024.png", 768, 1024, "iPad mini/Air"),
    ("apple-splash-834x1194.png", 834, 1194, "iPad Pro 11\""),
    ("apple-splash-1024x1366.png", 1024, 1366, "iPad Pro 12.9\""),
]

# Load source icon
src = Image.open(SRC_ICON).convert("RGBA")
print(f"Source icon: {SRC_ICON.name} ({src.width}x{src.height})")

print(f"\nGenerating {len(DEVICES)} iOS splash screens...")
for filename, w, h, desc in DEVICES:
    # Create canvas with theme color background
    canvas = Image.new("RGBA", (w, h), BG_COLOR)

    # Scale logo to ~30% of the smaller dimension
    logo_size = int(min(w, h) * 0.30)
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)

    # Center it
    offset = ((w - logo_size) // 2, (h - logo_size) // 2)
    canvas.paste(logo, offset, logo)

    # Save as opaque RGB (iOS doesn't like RGBA splash screens)
    out_path = ICON_DIR / filename
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"  -> {filename} ({w}x{h})  [{desc}]")

print(f"\nAll splash screens saved to: {ICON_DIR}")
