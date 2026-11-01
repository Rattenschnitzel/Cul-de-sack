"""See the characters side by side in each test style, like a character select screen.

    python tools/character_mockup.py A3,A5,A7,B1                    -> character-mockup-1.png, ...
    python tools/character_mockup.py E1,E2,E3 character-mixes       -> character-mixes-1.png, ...

Uses the pictures from style_test.py (art/style-test/<character>/NN.png), makes see-through copies
of them (like the game's pictures), and puts one row of characters per style on
art/lineups/character-mockup-1.png, -2.png, ... (6 styles per image), labelled like the style lineups.
"""

import html
import sys

from lineup import render
from style_mockup import clear_copy
from style_test import CHARACTERS, STYLES, make_lineup_tag, style_number

TILE = 200       # one character's square, in pixels
COLUMNS = 2      # styles per row
PER_IMAGE = 6    # styles per image


def style_html(tag, title, picture):
    """One row: its label and title, then each character on its own panel.
    picture(character name) gives each character's picture file."""
    tiles = "".join(
        f'<div class="tile"><img src="{picture(name).resolve().as_uri()}"><span>{name}</span></div>'
        for name in CHARACTERS)
    return (f'<div class="style"><div class="title"><b>{tag}</b> {html.escape(title)}</div>'
            f'<div class="row">{tiles}</div></div>')


def style_card(number):
    """A row for one test style: (label, title, picture lookup)."""
    return (make_lineup_tag(number), STYLES[number - 1][0], lambda name: clear_copy(name, number))


def make_image(cards, name):
    """One image with a row of characters per card. cards = list of (label, title, picture lookup)."""
    rows = "\n".join(style_html(tag, title, picture) for tag, title, picture in cards)
    count = len(CHARACTERS)
    page = f"""<!doctype html>
<meta charset="utf-8">
<title>Character styles</title>
<style>
  body {{ margin: 0; padding: 14px; background: #2b2118; color: #f3e6d0; font-family: sans-serif; }}
  h1 {{ margin: 0 0 10px; font-size: 20px; }}
  .grid {{ display: grid; grid-template-columns: repeat({COLUMNS}, auto); gap: 18px 24px; justify-content: start; }}
  .title {{ margin-bottom: 6px; font-size: 16px; }}
  .title b {{ padding: 1px 8px; border-radius: 6px; background: #f3c969; color: #2b2118; font-size: 18px; }}
  .row {{ display: grid; grid-template-columns: repeat({count}, {TILE}px); gap: 8px; padding: 10px;
         background: #6b4a2b; border: 3px solid #3d2914; border-radius: 12px; }}
  .tile {{ background: radial-gradient(circle at 50% 40%, #a8875a, #7a5a35); border-radius: 10px; text-align: center; }}
  .tile img {{ width: {TILE}px; height: {TILE}px; display: block; filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.4)); }}
  .tile span {{ display: block; padding: 2px 0 6px; font-size: 14px; font-weight: bold; }}
</style>
<h1>{" , ".join(CHARACTERS).replace(" ,", ",")} in each style</h1>
<div class="grid">
{rows}
</div>
"""
    style_rows = -(-len(cards) // COLUMNS)
    width = COLUMNS * (count * (TILE + 8) + 50) + 40
    height = style_rows * (TILE + 100) + 70
    print(f"Mockup: {render(page, name, width, height)}")


def main():
    cards = [style_card(style_number(tag)) for tag in sys.argv[1].split(",")]
    name = sys.argv[2] if len(sys.argv) > 2 else "character-mockup"  # e.g. "character-mixes"
    for part, start in enumerate(range(0, len(cards), PER_IMAGE), 1):
        make_image(cards[start:start + PER_IMAGE], f"{name}-{part}")


if __name__ == "__main__":
    main()
