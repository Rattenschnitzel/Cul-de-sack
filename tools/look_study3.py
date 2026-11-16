"""Look study, round 3: text only (no reference pictures), built on the wording that gave the
round 1 favourite (hipixel, seed 22), with the crisp voxel feel of the user's concept added.
The same ideas as round 2, so the two rounds can be compared. Wide like the game screen.

    python tools/look_study3.py

Pictures go to art/style-test/looks3/<idea>_<seed>.png, the sheet to art/style-test/looks3/looks3.png.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "art", "style-test", "looks3")
SEEDS = [22, 41, 77]
W, H = 1408, 768

# The style line leads, so it isn't drowned out by the scene (round 1's lesson).
STYLE = (
    "Modern high-detail pixel art like a recent indie game, with a crisp chunky voxel feel: rich colours, tiny "
    "details, soft pixel lighting with a gentle bloom, small expressive characters, a lively crowd feel. "
    "An isometric video game screenshot seen from above at a 45 degree angle, of a leafy Canadian suburb. "
    "Funny, whimsical and cozy. No text, no user interface, no logos."
)

IDEAS = [
    ("autumn", "A quiet cul-de-sac in autumn: small wooden bungalows with gable roofs, front lawns, picket fences, "
               "parked cars, maples and pines, black, blue and green curbside bins. A mischievous raccoon tips over a bin "
               "while scruffy dogs run towards it."),
    ("closeup", "A close camera, three houses wide: a raccoon rummaging in a tipped blue recycling bin on a sidewalk "
                "with fallen maple leaves, a corgi, a beagle and a big shaggy sheepdog charging at it."),
    ("fight", "A frantic fight in the middle of the street: a ring of dogs, neighbours in bathrobes and a mail carrier "
              "close in on a raccoon that flings glowing pebbles and banana peels in every direction, sparkles, dust "
              "clouds and bursts of trash everywhere."),
    ("winter", "Deep Canadian winter: snowbanks, snowy roofs, icicles, Christmas lights, a hockey net in a driveway, "
               "dogs in little sweaters chasing a raccoon through the snow."),
    ("night", "Night time: warm porch lights, orange streetlights, glowing television windows, fireflies, a raccoon "
              "with shining eyes raiding the bins while dogs with glowing eyes prowl."),
    ("garbageday", "Garbage day chaos: overflowing bins and bags on every driveway, a garbage truck stuck in the "
                   "cul-de-sac, Canada geese and seagulls fighting a raccoon for the trash."),
    ("canadaday", "A Canada Day street party gone wrong: maple leaf flags, a barbecue on fire, fireworks going off "
                  "sideways, a confused moose in a garden, and a raccoon surfing on a trash can lid through the chaos."),
    ("trashtornado", "A raccoon spins in the middle of a glowing tornado of trash, pizza boxes, tin cans and banana "
                     "peels whirling round it and knocking dogs away, like a super move in an arcade game."),
    ("diorama", "The whole suburb is a real handmade tabletop miniature built from tiny painted cubes and felt, "
                "photographed with a tilt-shift lens, a giant human hand placing a toy dog at the edge."),
    ("neon", "An 1980s synthwave version of the suburb at dusk: hot pink and cyan lighting, glowing outlines on "
             "the houses, a raccoon in tiny sunglasses, dogs with neon collars."),
]


def jobs():
    """Every picture this study paints: prompt, seed, size, references and where it goes."""
    return [
        {"prompt": f"{STYLE} {desc}", "seed": seed, "width": W, "height": H,
         "path": os.path.join(OUT, f"{name}_{seed}.png")}
        for name, desc in IDEAS for seed in SEEDS
    ]


def main():
    flux3.run_jobs(jobs())
    rows = [(name, [os.path.join(OUT, f"{name}_{s}.png") for s in SEEDS]) for name, _ in IDEAS]
    flux3.contact_sheet(rows, os.path.join(OUT, "looks3.png"), thumb=470, thumb_h=256)


if __name__ == "__main__":
    main()
