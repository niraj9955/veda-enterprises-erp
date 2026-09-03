#!/usr/bin/env python3
"""
Generate PNG icons for Veda ERP PWA from the SVG logo.
Outputs: 192, 256, 384, 512 px square icons + 180x180 apple-touch-icon + 512x512 maskable.
"""
import subprocess
import sys
from pathlib import Path

# Use cairosvg + Pillow for high-quality SVG -> PNG rendering
try:
    import cairosvg
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cairosvg", "Pillow"])
    import cairosvg
    from PIL import Image

PUBLIC_DIR = Path("/home/z/my-project/public")
SRC_SVG = PUBLIC_DIR / "logo.svg"
ICON_DIR = PUBLIC_DIR / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)

# Standard PWA icon sizes
SIZES = [192, 256, 384, 512]

# Step 1: render SVG -> PNG at each size
print("[1/3] Rendering SVG -> PNG (192/256/384/512)...")
png_paths = {}
for size in SIZES:
    out = ICON_DIR / f"icon-{size}x{size}.png"
    cairosvg.svg2png(
        url=str(SRC_SVG),
        write_to=str(out),
        output_width=size,
        output_height=size,
    )
    png_paths[size] = out
    print(f"  -> {out.name} ({size}x{size})")

# Step 2: apple-touch-icon (180x180, no transparency - iOS fills with black otherwise)
print("[2/3] Generating apple-touch-icon (180x180, opaque)...")
apple_png = ICON_DIR / "apple-touch-icon.png"
apple_img = Image.open(png_paths[192]).convert("RGBA")
apple_img = apple_img.resize((180, 180), Image.LANCZOS)
# Composite on solid emerald background so iOS doesn't add black bars
bg = Image.new("RGBA", (180, 180), (5, 150, 105, 255))
bg.paste(apple_img, (0, 0), apple_img)
bg.convert("RGB").save(apple_png, "PNG", optimize=True)
print(f"  -> {apple_png.name}")

# Step 3: maskable icon (512x512 with safe padding - critical for Android adaptive icons)
print("[3/3] Generating maskable icon (512x512 with safe-zone padding)...")
maskable_png = ICON_DIR / "icon-maskable-512x512.png"
# Re-render SVG at 512, then composite on full-bleed emerald background so the
# "safe zone" (inner 80%) keeps the VEDA logo centered and visible.
src = Image.open(png_paths[512]).convert("RGBA")
canvas = Image.new("RGBA", (512, 512), (5, 150, 105, 255))
# Scale the logo down to ~80% (409px) so it sits inside the safe zone
logo_size = int(512 * 0.80)
logo = src.resize((logo_size, logo_size), Image.LANCZOS)
offset = ((512 - logo_size) // 2, (512 - logo_size) // 2)
canvas.paste(logo, offset, logo)
canvas.convert("RGB").save(maskable_png, "PNG", optimize=True)
print(f"  -> {maskable_png.name}")

# Step 4: favicon.ico (32x32 + 16x16 multi-res)
print("[+] Generating favicon.ico (multi-res 16+32)...")
fav32 = Image.open(png_paths[192]).convert("RGBA").resize((32, 32), Image.LANCZOS)
fav16 = Image.open(png_paths[192]).convert("RGBA").resize((16, 16), Image.LANCZOS)
fav32.save(PUBLIC_DIR / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])
print(f"  -> favicon.ico")

print("\nAll icons generated successfully:")
for f in sorted(ICON_DIR.iterdir()):
    print(f"  {f}")
print(f"  {PUBLIC_DIR / 'favicon.ico'}")
