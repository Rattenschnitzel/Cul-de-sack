"""Style lock test: eight single game pieces in the fixed style (style.py), to see whether they look
like one game. Each piece is painted with the two favourites as style references (two seeds), and once
without references for comparison. Then every result is evened out (cut out, pixel grid, palette).

    python tools/style_lock.py

Paintings: art/style-test/stylelock/<piece>_<variant>.png
Evened-out sprites: art/style-test/stylelock/snapped/<piece>_<variant>.png
Sheet: art/style-test/stylelock/stylelock.png (raw painting above, evened-out sprite below)
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3
import style

# Round 2 (stylelock2): references only, "no cast shadow" in the prompt, the wider palette and the
# better cut-out. Round 1 is kept in stylelock/ for comparison.
OUT = os.path.join(style.LOOKS, "stylelock2")
SNAP = os.path.join(OUT, "snapped")

PIECES = [
    ("raccoon", "a small mischievous raccoon with a ringed tail and a black eye mask, standing on its hind legs, "
                "holding a pebble ready to throw, a cheeky grin"),
    ("corgi", "a chubby orange and white corgi dog running, tongue out, ears up"),
    ("beagle", "a beagle dog running and barking, brown, black and white"),
    ("sheepdog", "a big shaggy grey and white sheepdog running, fur over its eyes"),
    ("house", "a small wooden Canadian bungalow with a dark brown gable roof, a little front porch, a door and two lit windows"),
    ("bin", "a blue curbside recycling bin on wheels with its lid closed"),
    ("pine", "a single tall pine tree"),
    ("car", "a small boxy old station wagon car, faded red"),
]
# (variant name, seed, with references?)
VARIANTS = [("ref_a", 7, True), ("ref_b", 8, True)]


def jobs():
    return [
        {"prompt": style.sprite_prompt(desc, with_refs), "seed": seed,
         "refs": style.STYLE_REFS if with_refs else [],
         "path": os.path.join(OUT, f"{name}_{variant}.png")}
        for name, desc in PIECES for variant, seed, with_refs in VARIANTS
    ]


def checker(w, h, s=8):
    """A light checkerboard, so see-through parts show."""
    im = Image.new("RGB", (w, h), (205, 205, 205))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range((y // s) % 2 * s, w, 2 * s):
            d.rectangle([x, y, x + s - 1, y + s - 1], fill=(235, 235, 235))
    return im


def sheet(path, cell=230):
    try:
        font = ImageFont.truetype("arialbd.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    head, gap, side = 26, 6, 120
    rows = [r for v, _, _ in VARIANTS for r in ((f"{v}\npainted", v, False), (f"{v}\nevened out", v, True))]
    W = side + len(PIECES) * (cell + gap)
    H = head + len(rows) * (cell + gap)
    im = Image.new("RGB", (W, H), (30, 32, 30))
    d = ImageDraw.Draw(im)
    for c, (name, _) in enumerate(PIECES):
        d.text((side + c * (cell + gap) + 4, 4), name, fill=(255, 220, 120), font=font)
    for r, (label, variant, snapped) in enumerate(rows):
        y = head + r * (cell + gap)
        d.multiline_text((6, y + 6), label, fill=(255, 220, 120) if not snapped else (160, 220, 255), font=font)
        for c, (name, _) in enumerate(PIECES):
            x = side + c * (cell + gap)
            src = os.path.join(SNAP if snapped else OUT, f"{name}_{variant}.png")
            if not os.path.exists(src):
                continue
            pic = Image.open(src)
            if snapped:
                # Show the small sprite big with hard pixel edges (no blur), on a checkerboard.
                bg = checker(cell, cell)
                k = max(1, min(cell // pic.width, cell // pic.height))
                big = pic.resize((pic.width * k, pic.height * k), Image.NEAREST)
                if big.width > cell or big.height > cell:
                    big.thumbnail((cell, cell), Image.NEAREST)
                bg.paste(big, ((cell - big.width) // 2, (cell - big.height) // 2), big)
                im.paste(bg, (x, y))
            else:
                im.paste(pic.convert("RGB").resize((cell, cell), Image.LANCZOS), (x, y))
    im.save(path)
    print("sheet:", path)


def main():
    flux3.run_jobs(jobs())
    for job in jobs():
        if os.path.exists(job["path"]):
            style.clean_up(job["path"], os.path.join(SNAP, os.path.basename(job["path"])))
    style.palette_swatch(os.path.join(OUT, "palette.png"))
    sheet(os.path.join(OUT, "stylelock.png"))


if __name__ == "__main__":
    main()
