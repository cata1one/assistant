"""Объёмные стикеры Fluent Emoji 3D (Microsoft, лицензия MIT) для доски, обложек и Искорки.

Берёт эмодзи из наборов в src/board/stickers.js (EMOJI и ART), копирует нужные картинки в public
как fe-<код>.webp и пишет src/board/fluent.js со списком. Запуск после изменения наборов:

    npm pack @lobehub/fluent-emoji-3d && mkdir -p /tmp/f3d && tar -xzf lobehub-fluent-emoji-3d-*.tgz -C /tmp/f3d
    python3 scripts/fluent-stickers.py /tmp/f3d/package/assets
"""
import json
import os
import re
import shutil
import sys

SRC = sys.argv[1]
FRONT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
js = open(f"{FRONT}/src/board/stickers.js", encoding="utf-8").read()
blocks = [js[js.index(start):js.index("];" if start.startswith("export const ART") else "};", js.index(start))]
          for start in ("const EMOJI = {", "export const ART = [")]
emojis = [e for block in blocks for e in re.findall(r'"([^"\w\s,:!-][^"]*)"', block)]
codes, missing = set(), []
for e in emojis:
    code = "-".join(f"{ord(c):x}" for c in e)
    hit = next((c for c in (code, code.replace("-fe0f", "")) if os.path.exists(f"{SRC}/{c}.webp")), None)
    codes.add(hit) if hit else missing.append(e)
pub = f"{FRONT}/public"
for f in os.listdir(pub):
    if f.startswith("fe-") and f[3:-5] not in codes:
        os.remove(f"{pub}/{f}")
for c in codes:
    shutil.copyfile(f"{SRC}/{c}.webp", f"{pub}/fe-{c}.webp")
open(f"{FRONT}/src/board/fluent.js", "w", encoding="utf-8").write(
    "// Какие объёмные стикеры Fluent Emoji 3D (MIT) лежат в public как fe-<код>.webp. Файл собирает\n"
    "// scripts/fluent-stickers.py.\n"
    f"export const FLUENT = new Set({json.dumps(sorted(codes))});\n")
print(f"{len(codes)} картинок", "· нет в наборе: " + " ".join(missing) if missing else "")
