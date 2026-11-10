"""Build install/touch/browser icons from the same vector mark used by the site."""
from pathlib import Path
from io import BytesIO

import cairosvg
from PIL import Image

root = Path(__file__).resolve().parents[1] / "public"
svg = (root / "favicon.svg").read_bytes()
for name, size in (("icon-192.png", 192), ("icon-512.png", 512),
                   ("icon-maskable-512.png", 512), ("apple-touch-icon.png", 180)):
    cairosvg.svg2png(bytestring=svg, write_to=str(root / name), output_width=size, output_height=size)
image = Image.open(BytesIO(cairosvg.svg2png(bytestring=svg, output_width=64, output_height=64)))
image.save(root / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# Android launcher and splash resources use the same master artwork.
res = root.parents[1] / "mobile" / "android" / "app" / "src" / "main" / "res"
for path in res.glob("mipmap-*/*.png"):
    if path.name not in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        continue
    with Image.open(path) as current:
        width, height = current.size
    cairosvg.svg2png(bytestring=svg, write_to=str(path), output_width=width, output_height=height)
for path in res.glob("drawable*/splash.png"):
    with Image.open(path) as current:
        width, height = current.size
    canvas = Image.new("RGBA", (width, height), "#FAFAF8")
    size = max(24, int(min(width, height) * 0.24))
    logo = Image.open(BytesIO(cairosvg.svg2png(bytestring=svg, output_width=size, output_height=size))).convert("RGBA")
    canvas.alpha_composite(logo, ((width - size) // 2, (height - size) // 2))
    canvas.convert("RGB").save(path)
