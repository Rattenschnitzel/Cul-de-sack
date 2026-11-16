"""Repaint the grey squirrel's back view (the first one came out as a thin, browner side view).

Six tries: three painted from a full description only (way A: the model never sees the front view,
so it can't copy it), three with the front painting as a reference (way B: keeps its looks, with
stronger "from behind" wording). Each becomes a trial sprite; a sheet shows them beside the front view.

    python tools/repaint_squirrel.py              paint the tries, make sprites and the sheet
    python tools/repaint_squirrel.py --use a2     put try a2 in the game (art/catalog/critters/grey-squirrel-back.png)

Paintings and trial sprites: art/style-test/catalog/squirrel_tries/. Sheet: .../squirrel_tries/sheet.png
"""

import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3
import make_catalog as mc
import style

OUT = os.path.join(mc.PAINT, "squirrel_tries")
GAME = os.path.join(mc.OUT, "critters", "grey-squirrel-back.png")
FRONT_SPRITE = os.path.join(mc.OUT, "critters", "grey-squirrel.png")
DESC = "a cute grey squirrel with soft silver-grey fur, a white belly and a huge fluffy silver-grey tail, standing upright"
SEEDS = [11, 12, 13]


def front_painting():
    return os.path.join(mc.PAINT, "critters", f"grey-squirrel_s{mc.seed_of('grey-squirrel')}.png")


def jobs():
    refs = mc.style_refs()
    k = len(refs)
    plain = (f"Paint a new game sprite in exactly the same art style, colours and lighting as {mc.image_list(k)}, "
             "but do not copy their scenes. ")
    turned = ("turned around and walking away from us: its big round fluffy tail is closest to us at the lower right "
              "of the picture and covers most of its back, its head points away toward the upper left and its face is "
              "hidden, we only see the back of its head and its two round ears. The whole squirrel is the same "
              "silver-grey colour as from the front, not brown")
    out = []
    for s in SEEDS:   # way A: description only
        out.append({"prompt": f"{plain}{style.STYLE} The sprite: {DESC}, {turned}. {mc.alone('dark')}",
                    "seed": s, "refs": refs, "path": os.path.join(OUT, f"a{s - 10}.png")})
    lead = (f"Paint the same squirrel as image {k + 1}, with exactly the same silver-grey colours, fur and proportions, "
            f"in exactly the same art style as {mc.image_list(k)}, but now seen from behind. ")
    for s in SEEDS:   # way B: with the front painting
        out.append({"prompt": f"{lead}{style.STYLE} The sprite: the same grey squirrel, {turned}. {mc.alone('dark')}",
                    "seed": s, "refs": refs + [front_painting()], "path": os.path.join(OUT, f"b{s - 10}.png")})
    return out


def sprite_of(label):
    return os.path.join(OUT, "sprites", f"{label}.png")


def sheet():
    try:
        font = ImageFont.truetype("arialbd.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    labels = ["front"] + [os.path.basename(j["path"])[:-4] for j in jobs()]
    cell, scale = 150, 3
    im = Image.new("RGBA", (cell * len(labels), cell + 30), (78, 140, 58, 255))
    d = ImageDraw.Draw(im)
    for i, lab in enumerate(labels):
        p = FRONT_SPRITE if lab == "front" else sprite_of(lab)
        if os.path.exists(p):
            s = Image.open(p)
            s = s.resize((s.width * scale, s.height * scale), Image.NEAREST)
            im.alpha_composite(s, (i * cell + (cell - s.width) // 2, cell - s.height + 10))
        d.text((i * cell + 8, cell + 8), lab, fill=(255, 240, 160), font=font)
    path = os.path.join(OUT, "sheet.png")
    im.save(path)
    print("sheet:", path)


def main():
    if "--use" in sys.argv:
        lab = sys.argv[sys.argv.index("--use") + 1]
        shutil.copy(sprite_of(lab), GAME)
        print(f"{lab} -> {GAME}")
        return
    os.makedirs(os.path.join(OUT, "sprites"), exist_ok=True)
    flux3.run_jobs(jobs())
    for j in jobs():
        if os.path.exists(j["path"]):
            lab = os.path.basename(j["path"])[:-4]
            style.clean_up(j["path"], sprite_of(lab), height=44, holes=True, loose_shadow=True)
    sheet()


if __name__ == "__main__":
    main()
