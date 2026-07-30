"""
Generate Android launcher icons (ic_launcher.png + ic_launcher_round.png)
for all densities using the Veda logo SVG.

Also generates:
  - res/mipmap-anydpi-v26/ic_launcher.xml  (adaptive icon XML)
  - res/drawable/ic_launcher_foreground.xml (vector drawable for adaptive foreground)
  - res/drawable/ic_launcher_background.xml (color drawable for adaptive background)
"""

import os
import shutil
import subprocess
from pathlib import Path

SVG_PATH = "/home/z/my-project/public/veda-logo.svg"
RES_DIR = Path("/home/z/my-project/android-apk/app/src/main/res")

# Standard Android launcher icon sizes
DENSITIES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi":192,
}

def generate_icons():
    """Generate ic_launcher.png (square) and ic_launcher_round.png (circular)
    at every density."""
    # Remove old icons
    for folder, _ in DENSITIES.items():
        d = RES_DIR / folder
        if d.exists():
            for f in d.glob("ic_launcher*.png"):
                f.unlink()

    # Generate new icons
    for folder, size in DENSITIES.items():
        d = RES_DIR / folder
        d.mkdir(parents=True, exist_ok=True)

        # Square icon (legacy)
        square = d / "ic_launcher.png"
        subprocess.run([
            "cairosvg", SVG_PATH,
            "-o", str(square),
            "-W", str(size),
            "-H", str(size),
            "--output-width", str(size),
            "--output-height", str(size),
        ], check=True)
        print(f"  ✓ {square}")

        # Round icon (apply circular mask) — use PIL to mask
        round_path = d / "ic_launcher_round.png"
        apply_circular_mask(square, round_path, size)
        print(f"  ✓ {round_path}")

def apply_circular_mask(src: Path, dst: Path, size: int):
    """Apply a circular mask to make a round icon."""
    from PIL import Image, ImageDraw
    img = Image.open(src).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, (0, 0), mask)
    result.save(dst, "PNG")

def generate_adaptive_icon():
    """Generate adaptive icon XML for Android 8.0+ (API 26+).
    This gives a nicer icon on modern devices — squircle with foreground/background."""
    anydpi = RES_DIR / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)

    # ic_launcher.xml
    (anydpi / "ic_launcher.xml").write_text("""<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
""")

    # ic_launcher_round.xml
    (anydpi / "ic_launcher_round.xml").write_text("""<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
""")
    print(f"  ✓ {anydpi/'ic_launcher.xml'}")
    print(f"  ✓ {anydpi/'ic_launcher_round.xml'}")

    # Background color (emerald)
    drawable = RES_DIR / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    (drawable / "ic_launcher_background.xml").write_text("""<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#059669"/>
</shape>
""")
    print(f"  ✓ {drawable/'ic_launcher_background.xml'}")

    # Foreground — convert the SVG (white logo on transparent) to a vector drawable.
    # Easier: rasterize the Veda logo foreground (the house shape) at high res,
    # place it on transparent background, save as bitmap drawable.
    # For simplicity, generate a 432x432 PNG (adaptive icon "safe zone" is 66x66 of 108x108).
    foreground_png = drawable / "ic_launcher_foreground.png"
    # Generate a high-res Veda logo on transparent background.
    subprocess.run([
        "cairosvg", SVG_PATH,
        "-o", str(foreground_png),
        "--output-width", "432",
        "--output-height", "432",
    ], check=True)
    print(f"  ✓ {foreground_png}")

    # Bitmap drawable wrapping the foreground PNG
    (drawable / "ic_launcher_foreground.xml").write_text("""<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/ic_launcher_foreground.png"
    android:gravity="center"/>
""")
    print(f"  ✓ {drawable/'ic_launcher_foreground.xml'}")

if __name__ == "__main__":
    print("Generating Veda launcher icons at all densities...")
    generate_icons()
    print("\nGenerating adaptive icon (Android 8.0+)...")
    generate_adaptive_icon()
    print("\nDone.")
