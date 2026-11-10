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
