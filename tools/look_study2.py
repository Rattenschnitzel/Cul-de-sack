"""Look study, round 2: variations on the favourite from round 1 (hipixel, seed 22), with the
user's concept picture alongside as a second reference. Some sensible directions, some wild ones.

Both pictures are shown to FLUX.3 Klein while it paints: image 1 is the concept (the crisp voxel
pixel look, the busy fight, the sparkle effects), image 2 is the round 1 favourite (the autumn
palette, the houses and the layout). Each idea is painted with two seeds, wide like the game screen.

    python tools/look_study2.py

Pictures go to art/style-test/looks2/<idea>_<seed>.png, the sheet to art/style-test/looks2/looks2.png.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3

LOOKS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "art", "style-test", "looks")
OUT = os.path.join(os.path.dirname(LOOKS), "looks2")
REFS = [os.path.join(LOOKS, "ref_concept.png"), os.path.join(LOOKS, "hipixel_22.png")]
SEEDS = [5, 6]
W, H = 1408, 768   # about the shape of the game window

BASE = (
    "An isometric video game screenshot, seen from above at a 45 degree angle. Combine the art style of image 1 "
    "(crisp voxel pixel art, chunky little characters, glowing magical effects) with the colours, houses and "
    "Canadian suburb of image 2. A small raccoon hero is in the middle of the screen. Funny, whimsical, "
    "readable game art. No text, no user interface, no logos."
)

IDEAS = [
    ("blend", "A cul-de-sac in autumn. The raccoon stands by tipped-over curbside bins with trash spilled around, "
              "a few dogs trot towards it across the lawns. The camera is closer than in image 2: about five houses fill the screen."),
    ("fight", "The heat of a fight: a ring of scruffy dogs, angry neighbours in bathrobes and a mail carrier close in on "
              "the raccoon from all sides, while it flings glowing pebbles and banana peels in every direction. Sparkles, "
              "dust clouds and confetti-like trash bursts fill the street, like the busy action of image 1."),
    ("closeup", "A close camera to show the characters well: the raccoon, three dogs of different breeds (a corgi, a "
                "beagle, a big shaggy sheepdog) and two blue recycling bins and a green compost bin, all large on screen, "
                "on a sidewalk with fallen maple leaves."),
    ("winter", "The same suburb in deep Canadian winter: snowbanks along the street, snow on the roofs, icicles, "
               "Christmas lights on the houses, a kid's hockey net in a driveway, dogs in little sweaters chasing the raccoon."),
    ("night", "The suburb at night: warm porch lights, orange streetlights, the glow of television windows, fireflies, "
              "the raccoon's eyes shining as it raids the bins, dogs with flashlight-like glowing eyes in the dark."),
    ("garbageday", "Garbage day chaos: every driveway has overflowing bins and bags, a garbage truck stuck in the "
                   "cul-de-sac, a gang of Canada geese and seagulls fighting the raccoon for the trash."),
    ("canadaday", "Wild idea: a Canada Day street party gone wrong. Maple leaf flags, a barbecue on fire, fireworks "
                  "going off sideways, a confused moose walking through a garden, kids on bikes, and the raccoon "
                  "surfing on a trash can lid through the chaos."),
    ("trashtornado", "Wild idea: the raccoon spins in the middle of a whirling tornado of trash, pizza boxes, "
                     "tin cans and banana peels flying around it in a glowing ring, knocking dogs away, "
                     "like a super move in an arcade game."),
    ("diorama", "Wild idea: the whole scene is a real handmade tabletop miniature, built from tiny painted cubes and "
                "felt, photographed with a tilt-shift lens, with a giant human hand placing a toy dog at the edge."),
    ("neon", "Wild idea: an 1980s synthwave version of the suburb at dusk: hot pink and cyan lighting, glowing "
             "outlines on the houses, palm-like pine trees, the raccoon in tiny sunglasses, dogs with neon collars."),
]


def jobs():
    """Every picture this study paints: prompt, seed, size, references and where it goes."""
    return [
        {"prompt": f"{BASE} {desc}", "seed": seed, "refs": REFS, "width": W, "height": H,
         "path": os.path.join(OUT, f"{name}_{seed}.png")}
        for name, desc in IDEAS for seed in SEEDS
    ]


def main():
    missing = [p for p in REFS if not os.path.exists(p)]
    if missing:
        raise SystemExit(f"missing reference pictures: {missing}")
    flux3.run_jobs(jobs())
    rows = [("references: concept, hipixel 22", REFS)]
    rows += [(name, [os.path.join(OUT, f"{name}_{s}.png") for s in SEEDS]) for name, _ in IDEAS]
    flux3.contact_sheet(rows, os.path.join(OUT, "looks2.png"), thumb=560, thumb_h=305)


if __name__ == "__main__":
    main()
