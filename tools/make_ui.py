"""Make the pictures besides the items: one per backpack (for the shop), and the interface pieces
(plank buttons, pocket patches). Panels and the backpack keep their plain colours (pictures there
were too busy).

    python tools/make_ui.py            everything that has no picture yet
    python tools/make_ui.py --all      redo everything

Backpacks go to art/backpacks/<name>.png, interface pieces to art/ui/<name>.png (a few
versions of each, -1, -2, ...), with lineups in art/lineups/ (backpacks.png, ui.png) and a
mockup of them together (ui-mockup.png). ComfyUI must be running, as for make_icons.py.
"""

import sys
import time

import make_icons
from lineup import LINEUPS, make_lineup, render

BAGS = make_icons.ART / "backpacks"
UI = make_icons.ART / "ui"

# What to draw for each backpack (by its name in game.js), in the item style.
BAG_SUBJECTS = {
    "School Backpack": "a worn school backpack",
    "Hiking Pack": "a tall hiking backpack with a rolled sleeping mat on top",
    "Rolling Suitcase": "a rolling suitcase with two wheels and a pull handle",
    "Shopping Cart": "a supermarket shopping cart",
    "Tote Bag": "a canvas tote bag with two handles",
    "Briefcase": "a leather briefcase",
    "Picnic Basket": "a wicker picnic basket with a checkered cloth",
    "Utility Vest": "a utility vest with many pockets",
    "Gym Bag": "a sports gym duffel bag",
    "Guitar Case": "a guitar case",
    "Lone Wolf Sling": "a single-strap sling bag with a wolf head patch",
}

# The planks for buttons: handmade, with white paint peeling off. {shape} says how big.
# Drawn on bright green, so the white paint isn't mistaken for background when that's cleared.
PLANK = ("a single handmade wooden plank sign, {shape}, rough sawn uneven edges, old white paint on the front "
         "peeling off in places showing bare brown wood underneath, two small nails, front view, flat, "
         "blank with no writing, thick dark outline, rough black ink lines, "
         "isolated on a plain solid bright green background, no text")
INK = "thick dark outline, rough black ink lines, cartoon game art"

# Interface pieces: name, prompt, (draw width, height), (saved width, height),
# which background to make see-through ("white", "green" or None), and how many versions.
UI_PARTS = [
    ("button-long", PLANK.format(shape="long and narrow, horizontal"), (1024, 320), (512, 160), "green", 3),
    ("button-medium", PLANK.format(shape="medium length, horizontal"), (768, 320), (384, 160), "green", 2),
    ("button-square", PLANK.format(shape="small and square"), (512, 512), (192, 192), "green", 2),
    ("pocket", "a single square olive green canvas pocket patch stitched on with thick tan thread, front view, flat, "
               f"{INK}, centered, plain white background, no text",
     (512, 512), (128, 128), "white", 2),
]
CLEARERS = {"white": make_icons.is_white, "green": make_icons.is_green}

# The characters on screen, in style F1 (worded for characters), at 512 x 512.
CHARACTER_STYLE = ("{subject}, slightly pixelated edges, dressed entirely in scrappy homemade junk armor made of "
                   "bottle caps, cardboard, tin cans and duct tape, rough black ink lines and spray paint splatter, "
                   "cartoon character, thick outline, centered, plain white background, no text")
CHARACTER_PICTURES = {
    "raccoon": "a scrappy raccoon character, full body, standing on two legs, wearing a small backpack, mischievous grin",
    "possum": "a scruffy possum shopkeeper character, full body, standing on two legs, wearing a brown apron, "
              "pointy white face, pink nose, long pink hairless tail, sly friendly grin",
}
CHARACTERS = make_icons.ART / "characters"


def make_characters(redo):
    entries = []
    for name, subject in CHARACTER_PICTURES.items():
        for version in (1, 2):
            path = CHARACTERS / f"{name}-{version}.png"
            if redo or not path.exists():
                started = time.time()
                make_icons.generate(CHARACTER_STYLE.format(subject=subject), 1234 + version - 1, path,
                                    (1024, 1024), (512, 512))
                make_icons.clear_background(path)
                print(f"  {path.name} ({time.time() - started:.1f}s)")
            entries.append((path, path.stem))
    make_lineup("Characters", entries, "characters", columns=4, tile=220)


def make_bags(redo):
    entries = []
    for name, subject in BAG_SUBJECTS.items():
        path = BAGS / make_icons.file_name(name)
        if redo or not path.exists():
            started = time.time()
            make_icons.generate(make_icons.STYLE.format(subject=subject), 7, path)
            make_icons.clear_background(path)
            print(f"  {name} ({time.time() - started:.1f}s)")
        entries.append((path, name))
    make_lineup("Backpacks", entries, "backpacks", columns=6)


def make_ui(redo):
    entries = []
    for name, prompt, draw, save, background, versions in UI_PARTS:
        for version in range(1, versions + 1):
            path = UI / f"{name}-{version}.png"
            if redo or not path.exists():
                started = time.time()
                make_icons.generate(prompt, 100 + version, path, draw, save)
                if background:
                    make_icons.clear_background(path, CLEARERS[background])
                print(f"  {path.name} ({time.time() - started:.1f}s)")
            entries.append((path, path.stem))
    make_lineup("Interface pieces", entries, "ui", columns=6, tile=200)


def make_mockup():
    """The pieces together: a panel with plank buttons, and a backpack with pockets
    (both in the game's plain colours)."""
    def uri(name):
        return (UI / f"{name}.png").resolve().as_uri()
    pockets = "".join(f'<div class="pocket"></div>' for _ in range(12))
    page = f"""<!doctype html>
<meta charset="utf-8">
<title>Interface mockup</title>
<style>
  body {{ margin: 0; padding: 20px; background: #2b2118; color: #f3e6d0; font-family: sans-serif;
         display: flex; gap: 30px; align-items: flex-start; }}
  .pack {{ display: grid; grid-template-columns: repeat(4, 80px); gap: 6px; padding: 18px;
          background: #6b4a2b; border-radius: 12px; border: 4px solid #3d2914; }}
  .pocket {{ width: 80px; height: 80px; background: url({uri("pocket-1")}) center / contain no-repeat; }}
  .panel {{ width: 340px; padding: 22px; border-radius: 12px; background: #34261a; border: 2px solid #6b4a2b; }}
  .panel h2 {{ margin: 0 0 14px; font-size: 26px; }}
  .plank {{ display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
           font-weight: bold; color: #2b2118; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6); }}
  .long {{ width: 300px; height: 94px; font-size: 22px; background: url({uri("button-long-1")}) center / 100% 100%; }}
  .medium {{ width: 200px; height: 84px; font-size: 18px; background: url({uri("button-medium-1")}) center / 100% 100%; }}
  .square {{ width: 84px; height: 84px; font-size: 26px; background: url({uri("button-square-1")}) center / 100% 100%; }}
  .row {{ display: flex; gap: 12px; align-items: center; }}
</style>
<div class="pack">{pockets}</div>
<div class="panel">
  <h2>Shop</h2>
  <div class="plank long">🎒 Go scavenge →</div>
  <div class="row"><div class="plank medium">🎲 Reroll</div><div class="plank square">✕</div></div>
  <div class="plank medium">← Back</div>
</div>
"""
    print(f"Mockup: {render(page, 'ui-mockup', 860, 420)}")


def main():
    redo = "--all" in sys.argv
    print("Backpacks:")
    make_bags(redo)
    print("Interface pieces:")
    make_ui(redo)
    print("Characters:")
    make_characters(redo)
    make_mockup()
    print(f"Lineups in {LINEUPS}")


if __name__ == "__main__":
    main()
