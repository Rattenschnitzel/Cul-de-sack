"""Ground textures for the street fight: lawn, road, sidewalk and forest floor, in the game's look.

Each is painted with FLUX.3 (style words and references from style.py) as a flat texture seen from
straight above, in a few versions. Then each version is made seamless (its edges blended so copies
fit together without a visible seam), shrunk to the game's pixel size and snapped to the palette.

    python tools/make_ground.py            paint and make every version
    python tools/make_ground.py --pick lawn=2 road=1 ...   copy the chosen versions into art/ground/

Paintings: art/style-test/ground/<name>_<n>.png, finished versions: art/style-test/ground/tiles/,
a sheet of all of them: art/style-test/ground/ground.png. The game loads art/ground/<name>.png.
"""

import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3
import style

OUT = os.path.join(style.LOOKS, "ground")
TILES = os.path.join(OUT, "tiles")
GAME = os.path.join(style.PROJECT, "art", "ground")
SEEDS = [1, 2, 3]
TILE_SIZE = 512     # one texture covers 512 x 512 world pixels (16 x 16 ground squares) in the game

TEXTURE = ("A seamless tileable ground texture seen from straight above, filling the whole picture edge to edge, "
           "flat and evenly lit, no objects, no shadows, no horizon, no perspective, no text. ")

GROUNDS = [
    ("lawn", "A suburban front lawn: short green grass in small tufts, a few fallen orange and yellow maple "
             "leaves scattered on it, a little clover."),
    ("road", "Old dark grey asphalt road surface: fine gravel texture, a few small cracks and patches, faint wear."),
    ("sidewalk", "A light grey concrete sidewalk made of square slabs with thin joints between them, slightly worn."),
    ("forest", "A Canadian forest floor: brown pine needles, moss patches, small twigs, a few pine cones and ferns."),
]


def jobs():
    lead = ("Paint a ground texture in exactly the same art style and colours as image 1 and image 2, but do not "
            "copy their scenes. ")
    return [
        {"prompt": f"{lead}{style.STYLE} {TEXTURE}The ground: {desc}", "seed": seed, "refs": style.STYLE_REFS,
         "path": os.path.join(OUT, f"{name}_{seed}.png")}
        for name, desc in GROUNDS for seed in SEEDS
    ]


def flatten(im, radius=90):
    """Even out big soft light and dark patches (and darker corners): divide by a heavily blurred copy.
    Small detail (blades, leaves, cracks) stays; the blotches that make repeats easy to spot go."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    blur = np.asarray(im.convert("RGB").filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)
    out = a * (blur.reshape(-1, 3).mean(axis=0) / np.maximum(blur, 1))
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def seamless(im, band=6):
    """Blend the picture with a copy shifted by half its size, so its edges match up when repeated.
    Near the middle the picture itself shows; within a narrow band at its edges the shifted copy,
    which has no seam there. band: higher = narrower blend."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    b = np.roll(a, (h // 2, w // 2), axis=(0, 1))
    y = np.abs(np.linspace(-1, 1, h))[:, None]
    x = np.abs(np.linspace(-1, 1, w))[None, :]
    weight = np.clip((1 - np.maximum(x, y)) * band, 0, 1)[..., None]   # 1 in the middle, 0 at the edges
    return Image.fromarray((a * weight + b * (1 - weight)).astype(np.uint8), "RGB")


def finish(src, dst, colours=32):
    """Flatten, make seamless, shrink to the game's size, and limit to a few colours of its own
    (the sprites' shared palette has too few greys and greens for big ground areas)."""
    im = seamless(flatten(Image.open(src))).resize((TILE_SIZE, TILE_SIZE), Image.BOX)
    im = im.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst)


def tiled_preview(path, reps=2):
    """The texture repeated, to check for seams."""
    t = Image.open(path)
    out = Image.new("RGB", (t.width * reps, t.height * reps))
    for y in range(reps):
        for x in range(reps):
            out.paste(t, (x * t.width, y * t.height))
    return out


def main():
    if "--pick" in sys.argv:
        os.makedirs(GAME, exist_ok=True)
        for arg in sys.argv[sys.argv.index("--pick") + 1:]:
            name, n = arg.split("=")
            shutil.copy(os.path.join(TILES, f"{name}_{n}.png"), os.path.join(GAME, f"{name}.png"))
            print(f"{name}: version {n} -> art/ground/{name}.png")
        return
    flux3.run_jobs(jobs())
    for j in jobs():
        finish(j["path"], os.path.join(TILES, os.path.basename(j["path"])))
    # Sheet: each version shown repeated 2 x 2 (so seams would show), shrunk to fit.
    rows = []
    for name, _ in GROUNDS:
        paths = []
        for s in SEEDS:
            p = os.path.join(TILES, f"{name}_{s}_x2.png")
            tiled_preview(os.path.join(TILES, f"{name}_{s}.png")).save(p)
            paths.append(p)
        rows.append((f"{name}  (versions {', '.join(map(str, SEEDS))}, each repeated 2 x 2)", paths))
    flux3.contact_sheet(rows, os.path.join(OUT, "ground.png"), thumb=420)


if __name__ == "__main__":
    main()
