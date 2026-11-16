"""The Cul-de-sack look, in one place. Every script that paints game art uses this, so all assets match.

Three parts:
  1. STYLE: the fixed style words (from the round 1 favourite, hipixel 22) plus fixed rules for
     camera, light and background. Pasted unchanged into every prompt.
  2. STYLE_REFS: the favourite pictures, shown to the model as style references.
  3. clean_up(): code that evens out every result: cuts the piece out of its grey background,
     puts it on one pixel grid and snaps its colours to one palette taken from hipixel 22.
"""

import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOKS = os.path.join(PROJECT, "art", "style-test")

# The favourites: hipixel 22 (round 1) leads, garbageday 22 (round 3) is the second.
STYLE_REFS = [os.path.join(LOOKS, "looks", "hipixel_22.png"), os.path.join(LOOKS, "looks3", "garbageday_22.png")]
# The user's "rich look" reference (lush grass, saturated colours). The palette also takes colours
# from it; make_catalog.py shows it to the model as the first style picture.
RICH_REF = os.path.join(LOOKS, "looks", "ref_rich.png")

# 1. The style words. The first sentence is the wording that made hipixel 22.
STYLE = (
    "Modern high-detail pixel art like a recent indie game: rich colours, tiny details, soft pixel lighting "
    "with a gentle bloom. Warm autumn colours. Seen from above at a 45 degree angle, an isometric video game view. "
    "Sunlight from the upper left. Funny, whimsical and cozy."
)
# The richness line (added for the catalogue, after the user's "rich look" reference picture): more
# saturated, slightly cool colours, lush greens instead of browns, lots of small detail.
RICH = (
    " Rich and saturated, slightly cool late-summer colours, lush vivid greens rather than browns, "
    "deep emerald and teal accents, crisp dark outlines and lots of small hand-placed detail."
)
STYLE = STYLE + RICH
# For single pieces (sprites): alone, whole, on a flat background that's easy to cut away. No shadow:
# the game draws its own under each piece.
ALONE = (
    "One single object alone in the middle of the picture, the whole of it visible with empty space all around, "
    "on a plain flat even light grey background with no light rays. No cast shadow on the ground, no ground, "
    "no grass, no scenery, no other objects, no text."
)


def sprite_prompt(subject, with_refs=True):
    """The full prompt for one game piece."""
    lead = ("Paint a new game sprite in exactly the same art style, colours and lighting as image 1 and image 2, "
            "but do not copy their scenes. " if with_refs else "")
    return f"{lead}{STYLE} The sprite: {subject}. {ALONE}"


# 3. Evening out the pixels.
PIXEL = 4          # one art pixel = 4 painted pixels (a 1024 picture becomes a 256 pixel-art picture)
FROM_REFS = 50     # colours taken from the favourite pictures...
# ...plus colours the game needs for sure, which an autumn scene hardly has: the bins' blue, compost
# green and black, a grey ramp from near-black to white, and a cool sky-ish blue for windows and water.
MUST_HAVE = [
    (24, 40, 72), (36, 72, 130), (58, 112, 182), (110, 160, 214),      # bin blues, dark to light
    (92, 26, 28), (150, 40, 38), (196, 66, 56), (226, 112, 96),        # reds (cars, roofs, flags), dark to light
    (40, 78, 40), (72, 128, 60),                                        # compost greens
    (22, 22, 26), (52, 54, 60), (92, 94, 100), (140, 142, 146),        # greys
    (190, 190, 192), (232, 230, 226), (252, 250, 246), (170, 205, 222), # light greys, whites, window blue
    # Added for the richer look: saturated lawn greens, emerald, teal, flower purples and magentas,
    # mustard, navy, a warm orange and a sunny yellow.
    (34, 92, 44), (58, 138, 52), (96, 172, 64), (146, 204, 88),        # lawn greens, dark to light
    (16, 70, 58), (28, 112, 84),                                        # emerald
    (20, 96, 110), (52, 150, 152), (120, 196, 184),                     # teal to seafoam
    (88, 50, 130), (140, 86, 182), (184, 52, 140), (230, 110, 180),    # purples and magentas
    (196, 156, 40), (236, 200, 72),                                     # mustard, sunny yellow
    (22, 32, 66), (232, 120, 40), (120, 72, 40),                        # navy, orange, wood brown
]
PALETTE_SIZE = FROM_REFS + len(MUST_HAVE)
PALETTE_FILE = os.path.join(LOOKS, f"palette{PALETTE_SIZE}.png")


def palette():
    """The game's colours: the FROM_REFS colours that best cover both favourites, plus MUST_HAVE.
    Made once, then reused (delete the file to make it again)."""
    if not os.path.exists(PALETTE_FILE):
        sources = STYLE_REFS + ([RICH_REF] if os.path.exists(RICH_REF) else [])
        refs = [Image.open(p).convert("RGB").resize((512, 512), Image.LANCZOS) for p in sources]
        both = Image.new("RGB", (512 * len(refs), 512))
        for i, r in enumerate(refs):
            both.paste(r, (512 * i, 0))
        q = both.quantize(colors=FROM_REFS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        colours = q.getpalette()[:FROM_REFS * 3]
        for c in MUST_HAVE:
            colours += list(c)
        pal = Image.new("P", (1, 1))
        # Pad unused slots with the first colour so nothing ever snaps to an accidental black.
        flat = colours + colours[:3] * (256 - PALETTE_SIZE)
        pal.putpalette(flat)
        pal.save(PALETTE_FILE)
    return Image.open(PALETTE_FILE)


def palette_swatch(path, size=36):
    """A strip of the palette's colours, for looking at."""
    pal = palette().getpalette()[:PALETTE_SIZE * 3]
    cols = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
    im = Image.new("RGB", (size * len(cols), size))
    for i, c in enumerate(cols):
        im.paste(c, (i * size, 0, (i + 1) * size, size))
    im.save(path)


def local_spread(lum, r=3):
    """How much the brightness varies around each pixel (its standard deviation over a (2r+1) square).
    Low on smooth background and soft shadows, high on textured paint."""
    pad = np.pad(lum.astype(np.float64), r + 1, mode="edge")
    s1 = pad.cumsum(0).cumsum(1)
    s2 = (pad ** 2).cumsum(0).cumsum(1)
    k = 2 * r + 1
    def box(s):
        return s[k:, k:] - s[:-k, k:] - s[k:, :-k] + s[:-k, :-k]
    n = k * k
    mean = box(s1) / n
    var = box(s2) / n - mean ** 2
    h, w = lum.shape
    return np.sqrt(np.maximum(var, 0))[:h, :w]


def cut_out(im, tolerance=30, holes=False, loose_shadow=False):
    """Make the plain background see-through: start from the picture's edges and take every pixel that
    is close to the background colour, or is a shadow on it, and touches the edge (so grey parts inside
    the piece are kept). The game draws its own shadows, so painted ones go.
    holes: also clear closed-in patches that are exactly the background colour (sky between a tree's
    leaves), when they are big enough not to be a grey detail. loose_shadow: accept slightly tinted
    shadows too (painted shadows aren't always an even darkening)."""
    rgb = np.asarray(im.convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    near = np.abs(rgb - bg).max(axis=2) <= tolerance
    # A shadow is the background colour made darker: all three channels shrink by about the same share.
    ratio = rgb / np.maximum(bg, 1)
    shade = ratio.mean(axis=2)
    even = (ratio.max(axis=2) - ratio.min(axis=2)) <= (0.16 if loose_shadow else 0.10)
    near |= even & (shade >= 0.35) & (shade <= (0.97 if loose_shadow else 0.95))
    # Background and shadows are smooth; fur, wood and paint have texture. Only smooth pixels may go,
    # so a grey dog or white fur that happens to match the background colour stays.
    smooth = local_spread(rgb.mean(axis=2)) <= 7
    if loose_shadow:
        # Painted shadows often have fine grain, so they fail the smoothness test. Take grainy pixels
        # too when they are a very exact darker copy of the background colour (fur and paint almost
        # never are).
        exact = (ratio.max(axis=2) - ratio.min(axis=2)) <= 0.035
        near = (near & smooth) | (exact & (shade >= 0.4) & (shade <= 1.05))
    else:
        near &= smooth
    outside = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not outside[y, x]:
                outside[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not outside[y, x]:
                outside[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True; q.append((ny, nx))
    if holes:
        spread = local_spread(rgb.mean(axis=2))
        cand = (np.abs(rgb - bg).max(axis=2) <= 14) & (spread <= 4) & ~outside
        seen = np.zeros((h, w), bool)
        min_size = int(0.0004 * h * w)
        for sy, sx in zip(*np.nonzero(cand)):
            if seen[sy, sx]:
                continue
            seen[sy, sx] = True
            blob, q = [(sy, sx)], deque([(sy, sx)])
            while q:
                y, x = q.popleft()
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx)); blob.append((ny, nx))
            if len(blob) >= min_size:
                ys, xs = zip(*blob)
                outside[list(ys), list(xs)] = True
    rgba = np.dstack([rgb.astype(np.uint8), np.where(outside, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def keep_main_shape(alpha, keep_share=0.2):
    """Remove stray specks: find the separate solid shapes and keep the biggest one, plus any other
    shape at least keep_share of its size (a loose part that belongs, like a lid lying beside a bin)."""
    a = np.asarray(alpha) > 0
    h, w = a.shape
    label = np.zeros((h, w), np.int32)
    sizes = [0]
    for sy in range(h):
        for sx in range(w):
            if a[sy, sx] and not label[sy, sx]:
                n = len(sizes)
                label[sy, sx] = n
                q, count = deque([(sy, sx)]), 0
                while q:
                    y, x = q.popleft(); count += 1
                    for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                        if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not label[ny, nx]:
                            label[ny, nx] = n; q.append((ny, nx))
                sizes.append(count)
    if len(sizes) == 1:
        return alpha
    biggest = max(sizes)
    keep = [i for i, s in enumerate(sizes) if i and s >= biggest * keep_share]
    return Image.fromarray(np.where(np.isin(label, keep), 255, 0).astype(np.uint8), "L")


def clean_up(path, out_path, height=None, width=None, recolour=None, keep_share=0.2, holes=False, loose_shadow=False):
    """The whole evening-out: cut out, crop to the piece, shrink onto the pixel grid, snap to the palette.
    Saves the small pixel-art sprite (with see-through background) and returns it.
    height / width: make the sprite exactly this many pixels tall / wide (its size in the game, one art
    pixel per screen pixel); otherwise it shrinks by PIXEL. recolour: a function that changes the
    full-size cut-out first (used to make the green and black bins from the blue one).
    keep_share: loose parts smaller than this share of the biggest part are dropped as specks; use 0
    for pieces made of many small parts (sparkles, footprints, broken glass)."""
    im = cut_out(Image.open(path), holes=holes, loose_shadow=loose_shadow)
    # Trim a thin ring off the edge: those pixels are blended with the grey background and would show
    # as a light rim around the sprite.
    im.putalpha(im.getchannel("A").filter(ImageFilter.MinFilter(5)))
    if recolour:
        im = recolour(im)
    box = im.getchannel("A").getbbox() or (0, 0, im.width, im.height)
    im = im.crop(box)
    # Twice: if dropping loose specks shrinks the piece, crop the big picture to what's left and size
    # it again, so the sprite still comes out at exactly the asked size.
    for attempt in (1, 2):
        if height:
            small = (max(1, round(im.width * height / im.height)), height)
        elif width:
            small = (width, max(1, round(im.height * width / im.width)))
        else:
            small = (max(1, im.width // PIXEL), max(1, im.height // PIXEL))
        rgb = im.convert("RGB").resize(small, Image.BOX)
        alpha = im.getchannel("A").resize(small, Image.BOX).point(lambda a: 255 if a >= 128 else 0)
        if keep_share > 0:
            alpha = keep_main_shape(alpha, keep_share)
        bb = alpha.getbbox()
        if attempt == 2 or not bb or bb == (0, 0, small[0], small[1]):
            break
        fx, fy = im.width / small[0], im.height / small[1]
        im = im.crop((int(bb[0] * fx), int(bb[1] * fy), int(round(bb[2] * fx)), int(round(bb[3] * fy))))
    snapped = rgb.quantize(palette=palette(), dither=Image.Dither.NONE).convert("RGB")
    sprite = snapped.convert("RGBA")
    sprite.putalpha(alpha)
    # Crop again to what's left, so every sprite sits tight in its picture.
    sprite = sprite.crop(alpha.getbbox() or (0, 0, sprite.width, sprite.height))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    sprite.save(out_path)
    return sprite


def iso_flatten(im):
    """Turn a flat picture painted from straight above into the game's isometric view, the way
    buildGround in fight.js turns the ground: rotate it 45 degrees, then squash its height to half."""
    im = im.convert("RGBA")
    turned = im.rotate(45, resample=Image.BICUBIC, expand=True)
    return turned.resize((turned.width, max(1, turned.height // 2)), Image.LANCZOS)
