"""See how each test style looks with several items together, in a small backpack like the game's.

    python tools/style_mockup.py                        every style
    python tools/style_mockup.py E2,E3 mixes-items      only these styles -> mixes-items-1.png

Uses the pictures from style_test.py (art/style-test/<item>/NN.png) for the items below, makes
see-through copies of them (in a "clear" folder next to them, like the game's pictures), and puts
one small backpack per style on art/lineups/style-mockup-1.png and -2.png (16 styles each),
labelled like the style lineups (A1 = style 1).
"""

import html
import shutil
import sys

import make_icons
from lineup import label, render
from style_test import STYLES, style_number

CELL = 96          # one backpack cell, in pixels
GAP = 4            # the gap between cells
STEP = CELL + GAP
COLUMNS = 4        # mockups per row
PER_IMAGE = 16     # mockups per image (so they stay big enough to see the details)
LABEL_COLUMNS = 8  # the labels follow the style lineups, which have 8 per row

# The items in each mockup: name, colour (as in game.js), shape, and top-left cell (col, row).
# A 4 x 2 backpack: Spare Tire (2 x 2), Sword (1 x 2), Lemonade and Brass Knuckles (1 x 1 each).
ITEMS = [
    ("Spare Tire", "#5d5d5d", ["XX", "XX"], 0, 0),
    ("Sword", "#b8c4cc", ["X", "X"], 2, 0),
    ("Lemonade", "#f2dc6b", ["X"], 3, 0),
    ("Brass Knuckles", "#d4b04a", ["X"], 3, 1),
]
PACK_COLUMNS, PACK_ROWS = 4, 2


def clear_copy(name, number):
    """A see-through copy of one style test picture (made once, then reused)."""
    folder = make_icons.ART / "style-test" / make_icons.file_name(name)[:-4]
    source = folder / f"{number:02d}.png"
    copy = folder / "clear" / f"{number:02d}.png"
    if not copy.exists():
        copy.parent.mkdir(exist_ok=True)
        shutil.copyfile(source, copy)
        make_icons.clear_background(copy)
    return copy


def item_html(name, color, shape, col, row, picture):
    """One item like in the game: coloured blocks for its shape, and its picture on top,
    as wide as its long side (the label cuts off what sticks out)."""
    width, height = len(shape[0]), len(shape)
    side = max(width, height) * STEP - 8
    return (f'<div class="item" style="left: {col * STEP}px; top: {row * STEP}px; '
            f'width: {width * STEP - GAP}px; height: {height * STEP - GAP}px; background: {color}">'
            f'<img src="{picture.resolve().as_uri()}" style="width: {side}px; height: {side}px"></div>')


def mockup_html(tag, title, picture):
    """One small backpack with all the items. picture(item name) gives each item's picture file."""
    cells = "".join(f'<div class="cell" style="left: {c * STEP}px; top: {r * STEP}px"></div>'
                    for r in range(PACK_ROWS) for c in range(PACK_COLUMNS))
    items = "".join(item_html(name, color, shape, col, row, picture(name))
                    for name, color, shape, col, row in ITEMS)
    return (f'<div class="mockup"><div class="title"><b>{tag}</b> {html.escape(title)}</div>'
            f'<div class="pack">{cells}{items}</div></div>')


def style_card(number, style_name):
    """A mockup card for one test style: (label, title, picture lookup)."""
    return (label(number - 1, LABEL_COLUMNS), style_name, lambda name: clear_copy(name, number))


def main():
    numbered = list(enumerate(STYLES, 1))
    name = "style-mockup"
    if len(sys.argv) > 1:  # only these styles, e.g. "E2,E3", and maybe an image name
        wanted = {style_number(tag) for tag in sys.argv[1].split(",")}
        numbered = [(number, style) for number, style in numbered if number in wanted]
        name = sys.argv[2] if len(sys.argv) > 2 else "style-mockup-picked"
    cards = [style_card(number, style_name) for number, (style_name, _) in numbered]
    for part, start in enumerate(range(0, len(cards), PER_IMAGE), 1):
        make_image(cards[start:start + PER_IMAGE], f"{name}-{part}")


def make_image(cards, name):
    """One image with a mockup per card. cards = list of (label, title, picture lookup)."""
    pack_width = PACK_COLUMNS * STEP - GAP
    pack_height = PACK_ROWS * STEP - GAP
    mockups = "\n".join(mockup_html(tag, title, picture) for tag, title, picture in cards)
    page = f"""<!doctype html>
<meta charset="utf-8">
<title>Style mockup</title>
<style>
  body {{ margin: 0; padding: 14px; background: #2b2118; color: #f3e6d0; font-family: sans-serif; }}
  h1 {{ margin: 0 0 10px; font-size: 20px; }}
  .grid {{ display: grid; grid-template-columns: repeat({COLUMNS}, auto); gap: 14px 12px; justify-content: start; }}
  .title {{ margin-bottom: 6px; font-size: 16px; }}
  .title b {{ padding: 1px 8px; border-radius: 6px; background: #f3c969; color: #2b2118; font-size: 18px; }}
  .pack {{ position: relative; width: {pack_width}px; height: {pack_height}px; padding: 8px;
          background: #6b4a2b; border: 3px solid #3d2914; border-radius: 10px; }}
  .cell, .item {{ position: absolute; margin: 8px; }}
  .cell {{ width: {CELL}px; height: {CELL}px; background: #8a6640; border-radius: 5px; }}
  .item {{ display: flex; align-items: center; justify-content: center; overflow: hidden;
          border: 3px solid rgba(0, 0, 0, 0.35); border-radius: 7px; box-sizing: border-box; }}
  .item img {{ flex: none; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.35)); }}
</style>
<h1>Lemonade, Sword, Brass Knuckles and Spare Tire together, in each style</h1>
<div class="grid">
{mockups}
</div>
"""
    rows = -(-len(cards) // COLUMNS)
    width = COLUMNS * (pack_width + 34) + 30
    height = rows * (pack_height + 64) + 70
    print(f"Mockup: {render(page, name, width, height)}")


if __name__ == "__main__":
    main()
