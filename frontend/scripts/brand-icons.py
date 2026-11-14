"""Build install/touch/browser icons from the same vector mark used by the site."""
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1] / "public"
source = Image.open(root / "bright-mark.png").convert("RGBA")
def image_at(size):
    return source.resize((size, size), Image.Resampling.LANCZOS)
for name, size in (("icon-192.png", 192), ("icon-512.png", 512),
                   ("icon-maskable-512.png", 512), ("apple-touch-icon.png", 180)):
    image_at(size).save(root / name)
# A maskable icon keeps the original mark inside the platform's safe zone.
mask = Image.new("RGBA", (512, 512), "#FAFAF8")
mark = image_at(320)
mask.alpha_composite(mark, (96, 96))
mask.save(root / "icon-maskable-512.png")
image_at(32).save(root / "favicon-32.png")
image = image_at(64)
image.save(root / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# Android launcher and splash resources use the same master artwork.
res = root.parents[1] / "mobile" / "android" / "app" / "src" / "main" / "res"
for path in res.glob("mipmap-*/*.png"):
    if path.name not in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        continue
    with Image.open(path) as current:
        width, height = current.size
    foreground = path.name == "ic_launcher_foreground.png"
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0) if foreground else "#FAFAF8")
    size = int(min(width, height) * (0.62 if foreground else 0.8))
    mark = image_at(size)
    canvas.alpha_composite(mark, ((width - size) // 2, (height - size) // 2))
    canvas.save(path)
for path in res.glob("drawable*/splash.png"):
    with Image.open(path) as current:
        width, height = current.size
    canvas = Image.new("RGBA", (width, height), "#FAFAF8")
    size = max(24, int(min(width, height) * 0.24))
    logo = image_at(size)
    canvas.alpha_composite(logo, ((width - size) // 2, (height - size) // 2))
    canvas.convert("RGB").save(path)
