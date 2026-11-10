"""Encode fresh browser screenshots for the public product pages."""
from pathlib import Path

from PIL import Image

for path in Path("frontend/qa-output").glob("shot-*.png"):
    with Image.open(path) as image:
        image.convert("RGB").save(Path("frontend/public") / (path.stem + ".webp"), "WEBP", quality=88)
