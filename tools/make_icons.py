"""Make one picture per game item with ComfyUI and FLUX.1 schnell, and save them in ../art.

ComfyUI must be running (it listens on http://127.0.0.1:8188). For each item, this script
sends ComfyUI a small "workflow" (load model -> describe picture -> draw -> shrink -> save),
waits until it's done, and downloads the picture as art/<item-name>.png, e.g. art/frying-pan.png.

Run it from a terminal:
    python tools/make_icons.py                 every item that has no picture yet
    python tools/make_icons.py Wrench Broom    only these items (redoes them if they exist)
    python tools/make_icons.py --all           redo every item
    python tools/make_icons.py Wrench --try 2  another version of the Wrench (a different random start)
    python tools/make_icons.py --clear         only make the white backgrounds of all pictures see-through

Each picture's white background is made see-through after it's saved (see clear_background).
Only Python's built-in parts are used, so there's nothing to install.
"""

import json
import struct
import sys
import time
import urllib.parse
import urllib.request
import zlib
from collections import deque
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
MODEL = "flux1-schnell-fp8.safetensors"
ART = Path(__file__).resolve().parent.parent / "art"
DRAW_SIZE = 1024  # FLUX draws at this size...
SAVE_SIZE = 256   # ...and ComfyUI shrinks it to this before saving (plenty for the game)

# The same style for every item, so they look like one set. {subject} is the item.
# This is style F1 from the style tests (a mix: a little pixel art, a lot of junk, some punk zine),
# worded for items. The white background is made see-through after (see clear_background).
STYLE = (
    "{subject}, slightly pixelated edges, rebuilt entirely from scrappy homemade junk: bottle caps, "
    "cardboard, tin cans and duct tape, rough black ink lines and spray paint splatter, "
    "single game item icon, large close-up, thick outline, centered, plain white background, no text"
)

# What to draw for each item (by its name in game.js). Long items say which way they lie,
# so the picture matches the item's shape in the backpack.
SUBJECTS = {
    "Dagger": "a short dagger pointing straight up",
    "Sword": "a simple steel sword pointing straight up, vertical",
    "Brass Knuckles": "a set of brass knuckles",
    "Wooden Board": "a long wooden plank with two nails in it, lying horizontally",
    "Frying Pan": "a black frying pan seen from above, handle pointing to the right, horizontal",
    "Broom": "a tall straw broom standing straight up, vertical",
    "Paper Helmet": "a folded newspaper hat",
    "Traffic Cone": "an orange traffic cone with white stripes",
    "Trash Can Lid": "a round dented metal trash can lid with a handle, seen at an angle, wide",
    "Spare Tire": "a black car tire",
    "Lemonade": "a glass of lemonade with a lemon slice and a straw",
    "Bandages": "a rolled white bandage next to a sticking plaster, horizontal",
    "Water Bottle": "a clear plastic water bottle with a blue cap, standing upright",
    "Bubble Wrap": "a square sheet of bubble wrap",
    "Greatsword": "a large two-handed greatsword pointing straight up, vertical",
    "Boomerang": "a V-shaped wooden boomerang with a sharp bend in the middle and painted stripes",
    "Axe": "a single wood-chopping axe on its own, handle pointing down",
    "Cricket Bat": "a wooden cricket bat standing straight up, vertical",
    "Darts": "three throwing darts with colourful feathered flights side by side, no dartboard",
    "Shield": "a round wooden shield with a metal rim",
    "Herb": "a sprig of fresh green herbs",
    "Watermelon": "a big slice of watermelon",
    "Hot Sauce": "a small bottle of red hot sauce with a chili on the label",
    "Lawn Chair": "a folding lawn chair with striped fabric",
    "Garden Gloves": "a pair of green gardening gloves side by side, horizontal",
    "Magnet": "a red horseshoe magnet with silver tips",
    "Flashlight": "a flashlight lying horizontally, shining to the right",
    "Fire Extinguisher": "a red fire extinguisher standing upright",
    "Holster": "a brown leather holster lying horizontally",
    "Wrench": "a steel wrench standing straight up, vertical",
    "Sledgehammer": "a heavy sledgehammer with the head at the top, standing upright",
    "Boombox": "a retro boombox with two speakers",
}


def file_name(name):
    """The picture's file name for an item, e.g. "Frying Pan" -> "frying-pan.png"."""
    return name.lower().replace(" ", "-") + ".png"


def workflow(prompt, seed, draw=(DRAW_SIZE, DRAW_SIZE), save=(SAVE_SIZE, SAVE_SIZE)):
    """The ComfyUI job for one picture, written the way ComfyUI's API expects:
    numbered steps ("nodes"), each saying which earlier step's output it uses, like ["1", 0].
    draw and save are (width, height) in pixels: the size FLUX draws at, and the size saved."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": MODEL}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {"class_type": "EmptySD3LatentImage",
              "inputs": {"width": draw[0], "height": draw[1], "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple",
            "denoise": 1.0, "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["4", 0]}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "ImageScale", "inputs": {
            "image": ["6", 0], "upscale_method": "lanczos",
            "width": save[0], "height": save[1], "crop": "disabled"}},
        "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": "smallgame/icon"}},
    }


def call(path, data=None):
    """Talk to ComfyUI: GET (no data) or POST (data as JSON). Returns the answer as bytes."""
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(COMFY + path, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as answer:
        return answer.read()


def make(name, seed):
    """Make one item's picture in our style and save it to art/, with a see-through background."""
    path = ART / file_name(name)
    generate(STYLE.format(subject=SUBJECTS[name]), seed, path)
    clear_background(path)


def generate(prompt, seed, path, draw=(DRAW_SIZE, DRAW_SIZE), save=(SAVE_SIZE, SAVE_SIZE)):
    """Queue one picture for this prompt, wait for it, and save it as `path` (sizes: see workflow)."""
    job = json.loads(call("/prompt", {"prompt": workflow(prompt, seed, draw, save)}))["prompt_id"]
    while True:
        history = json.loads(call(f"/history/{job}"))
        if job in history:
            break
        time.sleep(0.5)
    outputs = history[job]["outputs"]
    if "8" not in outputs:
        raise RuntimeError(f"ComfyUI didn't make a picture: {history[job].get('status')}")
    picture = outputs["8"]["images"][0]
    query = urllib.parse.urlencode(
        {"filename": picture["filename"], "subfolder": picture["subfolder"], "type": picture["type"]})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(call(f"/view?{query}"))


# ---------------------------------------------------------------------------
# Making the white background see-through. A PNG file is a list of "chunks": IHDR says the size
# and kind of picture, IDAT holds the pixels (zip-compressed, each row with a "filter" byte that says
# how it was stored), IEND ends it. We read the pixels, clear the background, and write it back.

def read_png(path):
    """Read a PNG (8 bits per channel, RGB or RGBA) into (width, height, rows of [r, g, b, a] pixels)."""
    data = path.read_bytes()
    position, compressed = 8, b""
    while position < len(data):
        length, kind = struct.unpack(">I4s", data[position:position + 8])
        body = data[position + 8:position + 8 + length]
        if kind == b"IHDR":
            width, height, depth, color = struct.unpack(">IIBB", body[:10])
            if depth != 8 or color not in (2, 6):
                raise ValueError(f"{path.name}: unsupported PNG kind")
        elif kind == b"IDAT":
            compressed += body
        position += 12 + length
    channels = 3 if color == 2 else 4
    raw = zlib.decompress(compressed)
    stride = width * channels
    rows, previous = [], bytearray(stride)
    for y in range(height):
        start = y * (stride + 1)
        kind, line = raw[start], bytearray(raw[start + 1:start + 1 + stride])
        for i in range(stride):  # undo the row's filter
            left = line[i - channels] if i >= channels else 0
            up = previous[i]
            upper_left = previous[i - channels] if i >= channels else 0
            if kind == 1:
                line[i] = (line[i] + left) & 255
            elif kind == 2:
                line[i] = (line[i] + up) & 255
            elif kind == 3:
                line[i] = (line[i] + (left + up) // 2) & 255
            elif kind == 4:
                guess = left + up - upper_left
                pa, pb, pc = abs(guess - left), abs(guess - up), abs(guess - upper_left)
                nearest = left if pa <= pb and pa <= pc else up if pb <= pc else upper_left
                line[i] = (line[i] + nearest) & 255
        previous = line
        rows.append([list(line[x * channels:x * channels + 3]) + [line[x * channels + 3] if channels == 4 else 255]
                     for x in range(width)])
    return width, height, rows


def write_png(path, width, height, rows):
    """Write rows of [r, g, b, a] pixels as an RGBA PNG."""
    raw = b"".join(b"\x00" + bytes(value for pixel in row for value in pixel) for row in rows)

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def is_white(pixel):
    """White, or a very light grey (like a faint ground shadow)."""
    r, g, b, _ = pixel
    return min(r, g, b) > 190 and max(r, g, b) - min(r, g, b) < 30


def is_green(pixel):
    """Bright green, for pictures drawn on a green background (when the thing itself has white parts)."""
    r, g, b, _ = pixel
    return g > 140 and g > r + 60 and g > b + 60


def clear_background(path, is_background=is_white):
    """Make the background see-through: starting from the picture's edges, spread over every
    background-coloured pixel that's connected to them. The item's dark outline stops the spread,
    so white parts inside the item (like a stripe) stay. is_background says which colour to clear:
    is_white (the default) or is_green."""
    width, height, rows = read_png(path)
    todo = deque((x, y) for x in range(width) for y in (0, height - 1))
    todo.extend((x, y) for y in range(height) for x in (0, width - 1))
    seen = set()
    while todo:
        x, y = todo.popleft()
        pixel = rows[y][x]
        # (Already see-through pixels count as background, so running this twice is harmless.)
        if (x, y) in seen or (pixel[3] != 0 and not is_background(pixel)):
            continue
        seen.add((x, y))
        pixel[3] = 0
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height:
                todo.append((nx, ny))
    # Tidy the edge, for pixels next to the cleared area. On white: light pixels become partly
    # see-through (softer edge). On green: greenish pixels (a green fringe) become see-through.
    for y in range(height):
        for x in range(width):
            pixel = rows[y][x]
            if pixel[3] != 255:
                continue
            beside = [rows[ny][nx] for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
                      if 0 <= nx < width and 0 <= ny < height]
            if not any(other[3] == 0 for other in beside):
                continue
            r, g, b = pixel[:3]
            if is_background is is_green:
                if g > max(r, b) + 30:
                    pixel[3] = 0
            elif min(r, g, b) >= 150:
                pixel[3] = 255 - min(r, g, b) + 60
    write_png(path, width, height, rows)


def main():
    args = sys.argv[1:]
    if "--clear" in args:
        for path in sorted(ART.glob("*.png")):
            clear_background(path)
            print(f"  cleared {path.name}")
        return
    variant = 0
    if "--try" in args:
        at = args.index("--try")
        variant = int(args[at + 1])
        del args[at:at + 2]
    redo_all = "--all" in args
    names = [arg for arg in args if arg != "--all"]
    for name in names:
        if name not in SUBJECTS:
            sys.exit(f'Unknown item "{name}". Known items: {", ".join(SUBJECTS)}')
    if not names:
        names = [name for name in SUBJECTS if redo_all or not (ART / file_name(name)).exists()]

    ART.mkdir(exist_ok=True)
    print(f"Making {len(names)} picture(s) in {ART}")
    for number, name in enumerate(names, 1):
        # The same item and try number always give the same picture, so a good one can be made again.
        seed = zlib.crc32(name.encode()) + variant
        started = time.time()
        make(name, seed)
        print(f"  {number}/{len(names)} {name} -> art/{file_name(name)} ({time.time() - started:.1f}s)")
    print("Done.")


if __name__ == "__main__":
    main()
