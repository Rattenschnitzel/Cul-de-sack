"""Put pictures side by side on one lineup image, each with a grid label (A1, A2, ... B1, ...)
so you can say which ones you mean.

    python tools/lineup.py      a lineup of all item pictures: art/lineups/items.png

It writes a small web page with the pictures in a grid, then has Microsoft Edge (without a window)
take a screenshot of it. Both files are kept: the .html can be opened in a browser too.
style_test.py uses make_lineup for its lineup.
"""

import html
import string
import subprocess
from pathlib import Path

import make_icons

LINEUPS = make_icons.ART / "lineups"
EDGE_PATHS = [
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
]


def label(index, columns):
    """The grid label for the picture at this position: row letter + column number, e.g. B3."""
    return f"{string.ascii_uppercase[index // columns]}{index % columns + 1}"


def make_lineup(title, entries, name, columns=8, tile=150, note_lines=1, labels=None):
    """Make art/lineups/<name>.html and .png. entries = list of (picture path, caption).
    note_lines = how many lines of caption text to leave room for.
    labels = the tags to show (left out: A1, A2, ... by position). Returns the labels."""
    LINEUPS.mkdir(parents=True, exist_ok=True)
    labels = labels or [label(i, columns) for i in range(len(entries))]
    tiles = "\n".join(
        f'<div class="tile"><img src="{path.resolve().as_uri()}"><b>{tag}</b>'
        f'<span>{html.escape(caption)}</span></div>'
        for (path, caption), tag in zip(entries, labels))
    rows = -(-len(entries) // columns)  # rounded up
    caption_px = 16 * note_lines
    width = columns * (tile + 10) + 30
    height = rows * (tile + caption_px + 34) + 70
    page = f"""<!doctype html>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<style>
  body {{ margin: 0; padding: 14px; background: #2b2118; color: #f3e6d0; font-family: sans-serif; }}
  h1 {{ margin: 0 0 10px; font-size: 20px; }}
  .grid {{ display: grid; grid-template-columns: repeat({columns}, {tile}px); gap: 10px; }}
  .tile {{ position: relative; background: #8a6640; border-radius: 8px; padding: 0 0 6px; text-align: center; }}
  .tile img {{ width: {tile}px; height: {tile}px; display: block; border-radius: 8px 8px 0 0;
              object-fit: contain; /* wide or tall pictures keep their shape */ }}
  .tile b {{ position: absolute; top: 4px; left: 4px; padding: 1px 6px; border-radius: 6px;
            background: #f3c969; color: #2b2118; font-size: 15px; }}
  .tile span {{ display: block; height: {caption_px}px; padding: 4px 4px 0; font-size: 12px; line-height: 16px; overflow: hidden; }}
</style>
<h1>{html.escape(title)}</h1>
<div class="grid">
{tiles}
</div>
"""
    render(page, name, width, height)
    return labels


def render(page, name, width, height):
    """Save a web page as art/lineups/<name>.html and a width x height screenshot of it as <name>.png."""
    LINEUPS.mkdir(parents=True, exist_ok=True)
    page_path = LINEUPS / f"{name}.html"
    png_path = LINEUPS / f"{name}.png"
    page_path.write_text(page, encoding="utf-8")
    edge = next(path for path in EDGE_PATHS if path.exists())
    subprocess.run([str(edge), "--headless", "--disable-gpu", "--hide-scrollbars",
                    f"--screenshot={png_path}", f"--window-size={width},{height}",
                    "--virtual-time-budget=4000", page_path.resolve().as_uri()],
                   check=True, capture_output=True, timeout=120)
    return png_path


def main():
    names = list(make_icons.SUBJECTS)
    entries = [(make_icons.ART / make_icons.file_name(name), name) for name in names]
    labels = make_lineup("Item pictures", entries, "items")
    for tag, name in zip(labels, names):
        print(f"  {tag}  {name}")
    print(f"Lineup: {LINEUPS / 'items.png'}")


if __name__ == "__main__":
    main()
