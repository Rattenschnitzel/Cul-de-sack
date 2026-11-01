"""Try one item (or character) in many art styles, to pick a look for the game.

    python tools/style_test.py                          the Boomerang in every style below
    python tools/style_test.py "Frying Pan"             another item
    python tools/style_test.py Raccoon --styles A3,B6   a character, only in these styles

--styles takes the labels from the style lineups (A1 = style 1, A2 = style 2, ... B1 = style 9, ...).
Every picture uses the same random start (seed), so only the style changes between them.
The pictures go to art/style-test/<name>/NN.png (NN = the style's number) and a labelled
lineup to art/lineups/styles-<name>.png.
The backgrounds are left as they are, so you see each style as it comes out.
"""

import string
import sys
import time

import make_icons
from lineup import make_lineup

# The cartoon style the first item pictures used (style A1 in the tests).
OUR_STYLE = (
    "{subject}, single game item icon, chunky hand-drawn cartoon style, thick dark outline, "
    "flat bright colors with soft shading, centered, large close-up filling most of the picture, "
    "whole object visible, only this one object, plain pure white background, no text, no shadow on the ground"
)

# Characters you could play as. Unlike items, they don't have to fit backpack squares.
CHARACTERS = {
    "Raccoon": "a scrappy raccoon character, full body, standing on two legs, wearing a small backpack, mischievous grin",
    "Possum": "a scruffy possum character, full body, standing on two legs, wearing a small backpack, sleepy cheeky look",
    "Rabbit": "a nervous but brave rabbit character, full body, standing on two legs, wearing a small backpack",
    "Rat": "a street-smart rat character, full body, standing on two legs, wearing a small backpack, sly smile",
}


# Mixes of three styles, each at a strength from 0 (none) to 3 (strong): Pixel art (B1),
# Junk-made (D3) and Punk zine (D2). The strength is in how much of each is described.
MIX_PARTS = {
    "Pixel": ["", "slightly pixelated edges", "pixel art style with visible square pixels",
              "pixel art game sprite, chunky square pixels, limited color palette"],
    "Junk": ["", "with a few duct-tape patches", "scrappy outfit built from junk and held together with duct tape",
             "dressed entirely in scrappy homemade junk armor made of bottle caps, cardboard, tin cans and duct tape"],
    "Punk": ["", "a few ink splatters", "rough black ink lines and spray paint splatter",
             "gritty punk zine illustration, heavy rough black ink, spray paint splatter, photocopied texture"],
}
MIXES = [  # (pixel, junk, punk)
    (0, 3, 1), (0, 3, 2), (0, 2, 3), (0, 1, 3),
    (3, 1, 0), (3, 2, 0), (3, 0, 1), (2, 2, 2),
    (1, 3, 2), (2, 3, 1), (1, 2, 3), (3, 3, 3),
]


# The mixes are written for characters. For items, these words are swapped for item wording.
ITEM_WORDING = {
    "cartoon character": "single game item icon, large close-up",
    "with a few duct-tape patches": "with a few duct-tape patches on it",
    "scrappy outfit built from junk and held together with duct tape": "patched up with junk and held together with duct tape",
    "dressed entirely in scrappy homemade junk armor made of": "rebuilt entirely from scrappy homemade junk:",
}


def item_prompt(prompt):
    """A style prompt reworded for an item (see ITEM_WORDING)."""
    for words, item_words in ITEM_WORDING.items():
        prompt = prompt.replace(words, item_words)
    return prompt


def style_number(tag):
    """A lineup label as a style number, e.g. "A3" -> 3, "B1" -> 9 (8 styles per row)."""
    return string.ascii_uppercase.index(tag[0].upper()) * 8 + int(tag[1:])

# (short name, prompt). {subject} is the item. The last ones mix our current style with others.
STYLES = [
    ("Our current style", OUR_STYLE),
    ("Funny", "funny cartoon {subject} with a goofy face and googly eyes, exaggerated, sticker style, white background"),
    ("Whimsical", "whimsical storybook illustration of {subject}, soft watercolor and ink, gentle pastel colors, white background"),
    ("Photoreal", "studio product photo of {subject}, photorealistic, soft lighting, plain white background"),
    ("Comic", "comic book style {subject}, bold black ink lines, halftone dots, vivid colors, white background"),
    ("Painterly", "painterly digital painting of {subject}, visible brush strokes, rich colors, plain light background"),
    ("Cel shaded", "cel shaded {subject}, anime game style, hard-edged two-tone shadows, clean outline, white background"),
    ("3D cute", "3D rendered {subject}, cute stylized game asset, soft studio lighting, smooth materials, white background"),
    ("Pixel art", "pixel art {subject}, 32x32 game sprite, limited palette, crisp square pixels, white background"),
    ("Low poly", "low poly 3D model of {subject}, flat shaded facets, simple colors, white background"),
    ("Claymation", "claymation {subject} made of plasticine, handmade look with fingerprints, white background"),
    ("Flat vector", "flat vector icon of {subject}, minimal geometric shapes, no outline, white background"),
    ("Sticker", "die-cut sticker of {subject}, thick white border, glossy cartoon, grey background"),
    ("RPG inventory", "fantasy RPG inventory icon of {subject}, detailed hand-painted, warm rim light, white background"),
    ("Linocut", "linocut print of {subject}, bold carved lines, two ink colors, white paper"),
    ("Watercolor", "loose watercolor sketch of {subject}, ink outline, splashes, white paper"),
    ("Kid's crayon", "child's crayon drawing of {subject}, wobbly lines, bright colors, white paper"),
    ("90s box art", "1990s video game box art style {subject}, airbrushed, shiny highlights, white background"),
    ("Paper cutout", "layered paper cutout craft of {subject}, soft shadows between layers, white background"),
    ("1930s cartoon", "1930s rubber hose cartoon style {subject}, black ink with cream and sepia tones, white background"),
    ("Isometric", "isometric game asset of {subject}, clean shading, crisp edges, white background"),
    ("Neon sign", "neon sign shaped like {subject}, glowing colored tubes, dark brick wall background"),
    ("Blueprint", "technical blueprint drawing of {subject}, white lines on blue paper, measurements"),
    ("Vinyl toy", "glossy vinyl collectible toy of {subject}, chunky proportions, studio light, white background"),
    ("Ukiyo-e", "ukiyo-e woodblock print of {subject}, flat colors, fine outlines, white background"),
    ("Punk zine", "gritty punk zine illustration of {subject}, rough ink, spray paint splatter, white background"),
    ("Junk-made", "scrappy homemade {subject} built from junk and held together with duct tape, cartoon, thick outline, white background"),
    ("Ours + whimsical", "{subject}, single game item icon, chunky hand-drawn cartoon style with whimsical storybook charm, "
                         "thick dark outline, soft pastel shading, centered, large close-up, plain white background, no text"),
    ("Ours + cel shaded", "{subject}, single game item icon, cel shaded with thick dark outline, bold flat colors, "
                          "hard two-tone shadows, centered, large close-up, plain white background, no text"),
    ("Ours + 3D", "{subject}, single game item icon, stylized 3D render with a thick cartoon outline, bright colors, "
                  "soft lighting, centered, large close-up, plain white background, no text"),
    ("Ours + painterly", "{subject}, single game item icon, thick dark outline, painterly brush texture inside, "
                         "warm rich colors, centered, large close-up, plain white background, no text"),
    ("Ours + funny", "{subject} with a cheeky little face, single game item icon, chunky hand-drawn cartoon style, "
                     "thick dark outline, flat bright colors, centered, large close-up, plain white background, no text"),
]

# The mixes (see MIXES) come after these, as styles 33 and up (labels E1, E2, ...).
for strengths in MIXES:
    parts = [MIX_PARTS[kind][level] for kind, level in zip(MIX_PARTS, strengths) if level]
    mix_name = " + ".join(f"{kind} {level}" for kind, level in zip(MIX_PARTS, strengths) if level)
    STYLES.append((mix_name, "{subject}, " + ", ".join(parts) +
                   ", cartoon character, thick outline, centered, plain white background, no text"))


def main():
    args = sys.argv[1:]
    numbers = list(range(1, len(STYLES) + 1))
    if "--styles" in args:
        at = args.index("--styles")
        numbers = [style_number(tag) for tag in args[at + 1].split(",")]
        del args[at:at + 2]
    name = args[0] if args else "Boomerang"
    subject = CHARACTERS.get(name) or make_icons.SUBJECTS[name]
    folder = make_icons.ART / "style-test" / make_icons.file_name(name)[:-4]
    seed = 1234  # the same for every style
    print(f"Trying {len(numbers)} styles for the {name} in {folder}")
    entries, tags = [], []
    for count, number in enumerate(numbers, 1):
        style_name, prompt = STYLES[number - 1]
        if name not in CHARACTERS:
            prompt = item_prompt(prompt)
        path = folder / f"{number:02d}.png"
        started = time.time()
        make_icons.generate(prompt.format(subject=subject), seed, path)
        entries.append((path, style_name))
        tags.append(make_lineup_tag(number))
        print(f"  {count}/{len(numbers)} {style_name} ({time.time() - started:.1f}s)")
    lineup_name = f"styles-{make_icons.file_name(name)[:-4]}"
    if len(numbers) < len(STYLES):  # only some styles: don't replace the lineup with all of them
        lineup_name += "-" + "-".join(tags)
    make_lineup(f"{name} in {len(numbers)} styles", entries, lineup_name, labels=tags)
    for tag, (_, style_name) in zip(tags, entries):
        print(f"  {tag}  {style_name}")
    print(f"Lineup: {make_icons.ART / 'lineups' / (lineup_name + '.png')}")


def make_lineup_tag(number):
    """A style number as its lineup label, e.g. 3 -> "A3", 9 -> "B1"."""
    return f"{string.ascii_uppercase[(number - 1) // 8]}{(number - 1) % 8 + 1}"


if __name__ == "__main__":
    main()
