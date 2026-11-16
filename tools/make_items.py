"""Item pictures for the backpack and the shop, in the game's rich pixel look.

Every item in items.js gets one painting (FLUX.3 on both PCs, with the same style pictures and words as
the art catalogue), cut out and shrunk onto a pixel grid with the game's colours. Long items are painted
standing up or lying down to match their squares in the backpack (the shop draws a picture as a square
as wide as the item's long side). The finished picture is 64 x 64 art pixels, blown up 4 times to
256 x 256 so the pixels stay crisp, like the old pictures' size.

    python tools/make_items.py              paint what's missing, make trial pictures and a sheet
    python tools/make_items.py --clean      only remake trial pictures and the sheet
    python tools/make_items.py --use        put every trial picture in the game (art/<id>.png)
    python tools/make_items.py --use axe toque ...   only these

The old smooth pictures are kept in art/old-smooth/ (copied there the first time --use replaces one).
Paintings and trials: art/style-test/items/. Sheet: art/style-test/items/sheet.png
"""

import os
import re
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3
import make_catalog as mc
import style

OUT = os.path.join(style.LOOKS, "items")
TRIAL = os.path.join(OUT, "sprites")
GAME = os.path.join(style.PROJECT, "art")
OLD = os.path.join(GAME, "old-smooth")
ART_SIZE = 64          # art pixels on the long side
SCALE = 4              # blown up this much (64 x 4 = 256)

# Repaints: id -> seed (the first try has seed 100).
REPAINT = {n: 101 for n in "paper-helmet bandages hockey-pads vampire-teeth fish-bone-darts whetstone pinecone-launcher acorn-gatling sprinkler".split()}
REPAINT.update({"paper-helmet": 102, "pinecone-launcher": 102})   # third tries

# What each item looks like. "dark": pale or white things, painted on dark blue so they cut out cleanly.
ITEMS = {
    "dagger": "a small steel kitchen knife with a wooden handle",
    "sword": "a toy-like steel sword with a brass cross guard and a leather-wrapped grip",
    "brass-knuckles": "shiny brass knuckles",
    "wooden-board": "a rough wooden plank with a couple of bent nails sticking out",
    "frying-pan": "a black cast iron frying pan with a handle",
    "broom": "a straw kitchen broom with a long wooden handle",
    "greatsword": "a huge two-handed steel greatsword with a big cross guard",
    "boomerang": "a curved wooden boomerang with painted red stripes",
    "axe": "a wood-chopping axe with a red head and a wooden handle",
    "cricket-bat": "a wooden cricket bat with a taped handle",
    "darts": "three pub darts with red feathered flights",
    "wrench": "a heavy steel pipe wrench",
    "sledgehammer": "a big heavy sledgehammer with a long wooden handle",
    "boombox": "a chunky 1980s silver boombox with two big speakers and a handle",
    "paper-helmet": "a folded paper hat shaped like a little boat, made of crumpled light grey paper with faint grey lines",
    "traffic-cone": "an orange traffic cone with white reflective stripes",
    "trash-can-lid": "a dented round grey metal trash can lid with a handle on top",
    "spare-tire": "a black car spare tire with a silver rim",
    "lemonade": "a glass of lemonade with ice, a lemon slice and a striped straw",
    "bandages": "a rolled-up cream bandage roll with a safety pin and two beige sticking plasters crossed on top",
    "water-bottle": "a blue reusable water bottle with a cap",
    "bubble-wrap": "a square sheet of shiny bubble wrap",
    "shield": "a round wooden shield with metal rim and a painted maple leaf",
    "herb": "a small potted green herb plant in a terracotta pot",
    "watermelon": "a whole round striped green watermelon with one slice cut out showing red inside",
    "hot-sauce": "a small bottle of red hot sauce with a chili pepper on the label",
    "lawn-chair": "a folding aluminium lawn chair with green and white woven straps",
    "garden-gloves": "a pair of green garden gloves",
    "magnet": "a big red horseshoe magnet with silver tips",
    "flashlight": "a yellow plastic flashlight shining a little beam",
    "fire-extinguisher": "a red fire extinguisher with a black hose",
    "holster": "a brown leather tool holster pouch with a belt loop",
    "slingshot": "a forked wooden slingshot with a red rubber band",
    "egg-carton": "an open cardboard egg carton with six white eggs",
    "water-pistol": "a bright blue and orange plastic water pistol",
    "roman-candle": "a long red and yellow striped firework roman candle tube with a fuse",
    "ricochet-puck": "a black rubber hockey puck with a little motion streak",
    "spinning-frisbees": "a stack of three colourful plastic frisbees, red, yellow and blue",
    "sprinkler": "a small round yellow garden lawn sprinkler head on the ground, spraying arcs of blue water drops",
    "pinecone-launcher": "a chunky wooden toy cannon on two small wheels with a big brown pinecone sticking out of its barrel",
    "acorn-gatling": "a toy hand crank gatling gun with six short barrels and a wooden grip, a pile of acorns beside it",
    "fish-bone-darts": "three white fish skeletons with heads and tails, lying side by side in a fan",
    "trash-bag-lobber": "a big tied black garbage bag full and bulging",
    "soda-can-shaker": "a red soda can fizzing and about to burst, foam spraying from the top",
    "tp-streamer": "a roll of white toilet paper unrolling a long streamer",
    "compost-cannon": "a small green compost bin turned into a cannon, apple cores and banana peels flying out",
    "bottle-cap-flicker": "a little pile of colourful metal bottle caps",
    "firecracker-pack": "a bundle of red firecrackers tied together with fuses",
    "extension-cord": "an orange coiled electrical extension cord with a plug",
    "mirror-shard": "a jagged sharp shard of broken mirror glass reflecting light",
    "lucky-penny": "a shiny copper Canadian penny coin with a maple leaf",
    "whetstone": "a flat grey sharpening stone block, two-tone grey and dark blue-grey, lying on a small wooden base",
    "coffee-mug": "a steaming coffee mug with a red plaid pattern",
    "kitchen-timer": "a red tomato-shaped kitchen timer",
    "megaphone": "a red and white plastic megaphone",
    "binoculars": "a pair of black binoculars with a strap",
    "mosquito-jar": "a glass jar with a lid, full of buzzing mosquitoes",
    "vampire-teeth": "a set of joke-shop plastic vampire teeth: a row of white teeth with two long pointy fangs and pink gums, seen from the front",
    "hockey-pads": "a pair of tall padded hockey goalie leg pads standing side by side, white with red stripes and brown straps",
    "toque": "a red knitted winter toque with a white pompom",
    "energy-drink": "a tall green energy drink can with a lightning bolt",
    "maple-syrup": "a glass bottle of amber maple syrup with a maple leaf label",
}
# (paper helmet, bandages, hockey pads and vampire teeth turned into a little white van on dark blue: grey works better)
DARK = {"bubble-wrap", "egg-carton", "tp-streamer", "lemonade", "mirror-shard"}


def shapes():
    """Each item's shape (rows of 'X' and '.'), read from items.js so the two can't drift apart."""
    text = open(os.path.join(style.PROJECT, "items.js"), encoding="utf-8").read()
    return {m.group(1): re.findall(r'"([X.]+)"', m.group(2))
            for m in re.finditer(r'\{ id: "([^"]+)".*?shape: \[([^\]]*)\]', text)}


def orientation(shape):
    w, h = len(shape[0]), len(shape)
    if h > w:
        return ", standing upright with its long side going straight up and down"
    if w > h:
        return ", lying flat with its long side going straight left to right"
    return ""


def seed_of(item_id):
    return REPAINT.get(item_id, 100)


def jobs():
    refs = mc.lite_refs()
    lead = (f"Paint a game item icon in exactly the same art style, colours and lighting as {mc.image_list(len(refs))}, "
            "but do not copy their scenes. ")
    sh = shapes()
    out = []
    for item_id, desc in ITEMS.items():
        if item_id not in sh:
            print("not in items.js, skipped:", item_id)
            continue
        bg = "dark" if item_id in DARK else "grey"
        prompt = (f"{lead}{style.STYLE} The sprite: one single object, {desc}{orientation(sh[item_id])}. "
                  f"The whole object visible, centred, filling most of the picture, nothing else around it. {mc.alone(bg)}")
        out.append({"prompt": prompt, "seed": seed_of(item_id), "refs": refs,
                    "path": os.path.join(OUT, f"{item_id}_s{seed_of(item_id)}.png"), "id": item_id})
    return out


def finish(job):
    """Cut out, shrink so the long side is ART_SIZE pixels, centre on a square, blow up crisp."""
    tmp = os.path.join(TRIAL, f"_{job['id']}.png")
    s = style.clean_up(job["path"], tmp, height=ART_SIZE, holes=True, loose_shadow=True)
    if s.width > ART_SIZE:
        s = style.clean_up(job["path"], tmp, width=ART_SIZE, holes=True, loose_shadow=True)
    square = Image.new("RGBA", (ART_SIZE, ART_SIZE), (0, 0, 0, 0))
    square.alpha_composite(s, ((ART_SIZE - s.width) // 2, (ART_SIZE - s.height) // 2))
    square = square.resize((ART_SIZE * SCALE, ART_SIZE * SCALE), Image.NEAREST)
    square.save(os.path.join(TRIAL, f"{job['id']}.png"))
    os.remove(tmp)


def sheet():
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    ids = list(ITEMS)
    cell, cols = 150, 10
    rows = (len(ids) + cols - 1) // cols
    im = Image.new("RGBA", (cols * cell, rows * (cell + 18)), (59, 42, 28, 255))   # backpack brown
    d = ImageDraw.Draw(im)
    for i, item_id in enumerate(ids):
        x, y = (i % cols) * cell, (i // cols) * (cell + 18)
        d.rounded_rectangle((x + 6, y + 6, x + cell - 6, y + cell - 6), 8, fill=(90, 65, 48, 255))
        p = os.path.join(TRIAL, f"{item_id}.png")
        if os.path.exists(p):
            im.alpha_composite(Image.open(p).resize((128, 128), Image.NEAREST), (x + 11, y + 11))
        d.text((x + 8, y + cell), item_id, fill=(255, 240, 160), font=font)
    path = os.path.join(OUT, "sheet.png")
    im.save(path)
    print("sheet:", path)


def use(ids):
    os.makedirs(OLD, exist_ok=True)
    for item_id in ids:
        src = os.path.join(TRIAL, f"{item_id}.png")
        if not os.path.exists(src):
            print("no trial picture:", item_id)
            continue
        dst = os.path.join(GAME, f"{item_id}.png")
        if os.path.exists(dst) and not os.path.exists(os.path.join(OLD, f"{item_id}.png")):
            shutil.copy(dst, os.path.join(OLD, f"{item_id}.png"))
        shutil.copy(src, dst)
    print("put in the game:", len(ids))


def main():
    os.makedirs(TRIAL, exist_ok=True)
    if "--use" in sys.argv:
        picked = sys.argv[sys.argv.index("--use") + 1:]
        use(picked or list(ITEMS))
        return
    all_jobs = jobs()
    if "--clean" not in sys.argv:
        flux3.run_jobs([j for j in all_jobs if not os.path.exists(j["path"])])
    for j in all_jobs:
        if os.path.exists(j["path"]):
            try:
                finish(j)
            except Exception as e:
                print("clean-up failed:", j["id"], e)
    sheet()


if __name__ == "__main__":
    main()
