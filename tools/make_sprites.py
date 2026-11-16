"""Make the street fight's sprites from the picked paintings of the style lock test.

Each sprite is made at its exact size in the game (one art pixel = one screen pixel), cut out and
snapped to the game palette by style.py. The green compost bin and black garbage bin are recoloured
from the blue recycling bin, so all three match.

    python tools/make_sprites.py

Sprites go to art/sprites/<name>.png (kept in git: the game loads them).
"""

import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import style

SRC = os.path.join(style.LOOKS, "stylelock2")
OUT = os.path.join(style.PROJECT, "art", "sprites")


def bin_recolour(hue_shift=0, sat=1.0, val=1.0):
    """Change only the bin's blue body (pixels with a blue hue), leaving the logo, lid trim and wheels."""
    def change(im):
        alpha = im.getchannel("A")
        hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(np.int16)
        h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        blue = (h >= 130) & (h <= 185) & (s >= 60)
        h2 = np.where(blue, (h + hue_shift) % 256, h)
        s2 = np.where(blue, np.clip(s * sat, 0, 255), s)
        v2 = np.where(blue, np.clip(v * val, 0, 255), v)
        out = Image.fromarray(np.dstack([h2, s2, v2]).astype(np.uint8), "HSV").convert("RGBA")
        out.putalpha(alpha)
        return out
    return change


# (sprite name, picked painting, size in the game: ("h", pixels tall) or ("w", pixels wide), recolour)
SPRITES = [
    ("raccoon", "raccoon_ref_a", ("h", 46), None),
    ("dog-corgi", "corgi_ref_a", ("h", 34), None),
    ("dog-beagle", "beagle_ref_a", ("h", 36), None),
    ("dog-sheepdog", "sheepdog_ref_b", ("h", 46), None),
    ("bin-recycling", "bin_ref_a", ("h", 34), None),
    ("bin-compost", "bin_ref_a", ("h", 34), bin_recolour(hue_shift=-62, sat=0.9, val=0.85)),
    ("bin-garbage", "bin_ref_a", ("h", 34), bin_recolour(sat=0.12, val=0.42)),
    ("house", "house_ref_b", ("w", 320), None),
    ("pine", "pine_ref_b", ("h", 120), None),
    ("pine-tall", "pine_ref_b", ("h", 150), None),
]


def main():
    for name, pick, (kind, size), recolour in SPRITES:
        src = os.path.join(SRC, pick + ".png")
        sprite = style.clean_up(src, os.path.join(OUT, name + ".png"),
                                height=size if kind == "h" else None, width=size if kind == "w" else None,
                                recolour=recolour)
        print(f"{name}: {sprite.width} x {sprite.height}  (from {pick})")


if __name__ == "__main__":
    main()
