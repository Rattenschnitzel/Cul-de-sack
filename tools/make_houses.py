"""More houses for the street fight, so the street doesn't look cloned.

Each house type is painted in the fixed look (style.py), with the house already in the game as an
extra reference (image 3) so the angle, size and footprint match. Two seeds per type. Every result
becomes a game sprite (320 pixels wide, like the first house) and goes on a sheet to judge.

    python tools/make_houses.py                 paint, make sprites, make the sheet
    python tools/make_houses.py --use 1a 2b ... put the chosen ones in the game as art/sprites/house-<n>.png

Paintings and trial sprites: art/style-test/houses/. Sheet: art/style-test/houses/houses.png
"""

import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3
import style

OUT = os.path.join(style.LOOKS, "houses")
TRIAL = os.path.join(OUT, "sprites")
GAME = os.path.join(style.PROJECT, "art", "sprites")
FIRST_HOUSE = os.path.join(style.LOOKS, "stylelock2", "house_ref_b.png")
SEEDS = {"a": 31, "b": 32}

HOUSES = [
    ("1", "a pale blue wooden bungalow with white trim, a dark grey roof and a small covered front porch"),
    ("2", "a pale yellow two-storey house with white window frames, a brown roof and a red front door"),
    ("3", "a white clapboard farmhouse-style house with a wide front porch, green shutters and a grey roof"),
    ("4", "a red brick split-level house with an attached single garage and a dark roof"),
    ("5", "a sage green cottage with a steep roof, a little dormer window and flower boxes"),
    ("6", "a beige 1970s side-split house with brown wood panels, a carport and a low wide roof"),
    ("7", "a dark wooden A-frame cabin-style house with a big triangular window front"),
    ("8", "a grey-blue modern two-storey house with large windows and a flat roof terrace"),
]


def jobs():
    lead = ("Paint a new house for the same game, in exactly the same art style, colours and lighting as image 1 and "
            "image 2, and seen from exactly the same camera angle, at the same size and on the same small square lawn "
            "plot as the house in image 3. Do not copy the scenes. ")
    return [
        {"prompt": f"{lead}{style.STYLE} The sprite: {desc}. {style.ALONE}", "seed": seed,
         "refs": style.STYLE_REFS + [FIRST_HOUSE], "path": os.path.join(OUT, f"house{num}{v}.png")}
        for num, desc in HOUSES for v, seed in SEEDS.items()
    ]


def sheet(path):
    """Every trial sprite on a lawn-green background, at game size, labelled 1a, 1b, ..."""
    try:
        font = ImageFont.truetype("arialbd.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    cell_w, cell_h, cols = 340, 310, 4
    labels = [f"{n}{v}" for n, _ in HOUSES for v in SEEDS]
    rows = (len(labels) + cols - 1) // cols
    im = Image.new("RGBA", (cols * cell_w, rows * cell_h), (86, 120, 58, 255))
    d = ImageDraw.Draw(im)
    for i, lab in enumerate(labels):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        p = os.path.join(TRIAL, f"house-{lab}.png")
        if os.path.exists(p):
            s = Image.open(p)
            im.alpha_composite(s, (x + (cell_w - s.width) // 2, y + cell_h - s.height - 6))
        d.text((x + 8, y + 6), lab, fill=(255, 235, 140), font=font)
    im.save(path)
    print("sheet:", path)


def main():
    if "--use" in sys.argv:
        picks = sys.argv[sys.argv.index("--use") + 1:]
        for n, lab in enumerate(picks, start=1):
            shutil.copy(os.path.join(TRIAL, f"house-{lab}.png"), os.path.join(GAME, f"house-{n}.png"))
            print(f"house-{n}.png <- {lab}")
        return
    flux3.run_jobs(jobs())
    for j in jobs():
        if not os.path.exists(j["path"]):   # a painting that failed: run the script again to retry it
            continue
        lab = os.path.basename(j["path"])[5:-4]
        style.clean_up(j["path"], os.path.join(TRIAL, f"house-{lab}.png"), width=320)
    sheet(os.path.join(OUT, "houses.png"))


if __name__ == "__main__":
    main()
