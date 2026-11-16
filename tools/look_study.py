"""Look study for the street fight: the same scene painted in several art styles, to pick a look.

The scene: an isometric game screenshot of a Canadian suburb cul-de-sac, a raccoon rummaging
through curbside bins while dogs close in. Each style is painted with a few seeds (different
random starts). All painted with FLUX.3 Klein on both PCs (see flux3.py).

    python tools/look_study.py

Pictures go to art/style-test/looks/<style>_<seed>.png, and the sheet to
art/style-test/looks/looks.png (one row per style).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "art", "style-test", "looks")
SEEDS = [11, 22, 33]

SCENE = (
    "An isometric video game screenshot seen from high above at a 45 degree angle, of a leafy Canadian "
    "suburb in autumn: a quiet cul-de-sac with small wooden bungalows with gable roofs, front lawns, picket "
    "fences, a few parked cars, maple and pine trees, and black, blue and green curbside trash bins at the "
    "end of each driveway. In the middle a small mischievous raccoon tips over a trash bin and trash spills "
    "out, while three scruffy neighbourhood dogs run towards it across the lawns. Funny, whimsical and cozy. "
    "No text, no user interface, no logos."
)

STYLES = [
    ("voxel", "Chunky voxel diorama art: everything built from small cubes, like a tiny toy world, rendered as crisp "
              "pixel art with soft ambient occlusion, warm sunlight and long soft shadows."),
    ("pixel16", "Clean 16-bit era pixel art with a limited palette, crisp hand-placed pixels, no blur, "
                "readable silhouettes, dithered shading."),
    ("hipixel", "Modern high-detail pixel art like a recent indie game: rich colours, tiny details, "
                "soft pixel lighting with a gentle bloom, a lively crowd feel."),
    ("storybook", "Hand-painted cozy storybook illustration, gouache and watercolour textures, soft edges, "
                  "warm golden-hour light."),
    ("lowpoly", "Stylised low-poly 3D like a small toy town: flat-shaded facets, clean pastel colours, "
                "soft shadows, a tilt-shift miniature look."),
    ("cartoon", "Bold cartoon game art with thick dark outlines, flat bright colours and simple cel shading, "
                "playful and exaggerated shapes."),
]


def jobs():
    """Every picture this study paints: prompt, seed, size, references and where it goes."""
    return [
        {"prompt": f"{SCENE} Art style: {desc}", "seed": seed, "path": os.path.join(OUT, f"{name}_{seed}.png")}
        for name, desc in STYLES for seed in SEEDS
    ]


def main():
    flux3.run_jobs(jobs())
    rows = [(name, [os.path.join(OUT, f"{name}_{s}.png") for s in SEEDS]) for name, _ in STYLES]
    flux3.contact_sheet(rows, os.path.join(OUT, "looks.png"), thumb=360)


if __name__ == "__main__":
    main()
