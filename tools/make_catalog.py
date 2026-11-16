"""The art catalogue: about 290 game pieces in the Cul-de-sack look, ready to wire into the game later.

Painted in two stages with FLUX.3 Klein (both PCs, see flux3.py), in the fixed look (style.py):
  Stage 1  the bases: new critters, dogs, people, animals, cars, trees, props, pickups,
           projectiles, effects and floor decals.
  Stage 2  more poses of every character (back view, attack, walk ...) and the rear view of every
           car. Each one gets its stage 1 painting as an extra reference picture, so the character
           keeps its design and colours.
Then every painting is cleaned into a game sprite at its size in the game (style.clean_up), floor
decals are first turned into the isometric view (style.iso_flatten), and the script makes a
labelled sheet per category plus an index page.

    python tools/make_catalog.py              paint what's missing, clean, sheets, index
    python tools/make_catalog.py --clean      only clean, sheets and index (no painting)
    python tools/make_catalog.py --stage1     only paint stage 1

Paintings: art/style-test/catalog/<category>/<name>_s<seed>.png
Sprites:   art/catalog/<category>/<name>.png
Sheets:    art/catalog/sheets/<category>.png      Index: art/catalog/index.html

To repaint a weak piece: give it a new seed in REPAINT below and run the script again (the old
painting stays; the new seed makes a new file and the sprite is made from that one).
"""

import json
import os
import sys
import zlib

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flux3
import style

PAINT = os.path.join(style.LOOKS, "catalog")
OUT = os.path.join(style.PROJECT, "art", "catalog")
LOCK = os.path.join(style.LOOKS, "stylelock2")
RICH_REF = os.path.join(style.LOOKS, "looks", "ref_rich.png")
CAR_ANGLE = os.path.join(LOCK, "car_ref_a.png")   # the first car painting: angle and facing for every car

# Pieces that came out broken get a new seed here: name -> seed.
# (Seed numbers only need to differ from the piece's first try; every repaint here got seed 2.)
REPAINT = {n: 2 for n in """
    bus-shelter hose-reel newspaper-box boxes garbage-bags flower-bed
    tin-can bottle-cap tp-roll sock magnet fish-bone apple-core
    sparkle trash-burst splash level-up
    water-puddle footprints paw-trail banana-smear crack
    rv ice-cream-truck mail-van
""".split()}
# Paint these with only the rich reference and hipixel 22 as style pictures. The garbage-day picture
# shows a garbage truck, and for small or vague subjects the model sometimes paints that truck instead.
# Third tries (seed 3) for pieces that still came out wrong on the second try.
REPAINT.update({n: 3 for n in "boxes tp-roll sock trash-burst water-puddle crack".split()})
REPAINT["splash"] = 4   # fourth try, on dark blue (on pink it kept painting a whole scene)
LITE = set(REPAINT) - {"rv", "ice-cream-truck", "mail-van"}
# Back and rear views painted WITHOUT the character's own painting as a reference: with it, the model
# kept copying the front view. These get the full description instead (plus every dog and car).
TURN_AROUND = {"orange-cat", "black-cat", "skunk", "coyote"}

# Backgrounds. Grey is the default; pale and white subjects go on dark navy, and flat dark or grey
# marks (stains, smoke) on pink, so the cut-out code can tell piece from background.
BACKS = {
    "grey": "plain flat even light grey background",
    "dark": "plain flat even dark navy blue background",
    "pink": "plain flat even bright pink background",
}
FRONT = "in three-quarter view, facing toward the lower right of the picture"
BACK = ("seen from behind in three-quarter view, facing away toward the upper left of the picture, "
        "so we see its back and the back of its head")

# ---------------------------------------------------------------------------------------------
# What to paint. Each piece: (name, subject, size, options). size: ("h", pixels tall) or ("w", wide).
# options: bg (see BACKS), shape ("wide" / "tall" painting), keep (speck share, 0.03 for scattered
# pieces), attack (the attack pose for stage 2), short (how stage 2 names the character).

CRITTERS = [   # new player characters
    ("possum", "a cute grey-and-white opossum with a pink nose, pink ears and a long bare pink tail, standing upright", ("h", 46), {"bg": "dark"}),
    ("red-fox", "a cute red fox with a white chest, black socks and a big bushy white-tipped tail, standing upright", ("h", 46), {}),
    ("grey-squirrel", "a cute grey squirrel with a huge fluffy grey tail curled up behind it, standing upright", ("h", 44), {"bg": "dark"}),
    ("groundhog", "a cute chubby brown groundhog with small round ears and big front teeth, standing upright", ("h", 44), {}),
]
RACCOON_POSES = [
    ("back", BACK),
    ("walk-a", f"walking {FRONT}, mid-stride with its left leg forward and right leg back, tail swinging"),
    ("walk-b", f"walking {FRONT}, mid-stride with its right leg forward and left leg back, tail swinging"),
    ("throw", f"{FRONT}, winding up to throw a small pebble overhand, throwing arm raised high behind its head"),
    ("hurt", f"{FRONT}, flinching back hurt, eyes squeezed shut, arms up, fur ruffled"),
    ("cheer", f"{FRONT}, cheering with both arms raised high, big happy grin"),
    ("dig", f"{FRONT}, bent forward digging eagerly with both front paws, bits of trash flying"),
]
CRITTER_POSES = [("back", BACK), ("throw", f"{FRONT}, winding up to throw a small pebble overhand, throwing arm raised high")]

DOGS = [   # stage 1 for the new breeds; the first three already have paintings
    ("corgi", "an orange-and-white corgi dog with big pointy ears and short legs, running", ("h", 34), {"src": "corgi_ref_a"}),
    ("beagle", "a tricolour beagle dog, brown, black and white, with floppy ears, running", ("h", 36), {"src": "beagle_ref_a"}),
    ("sheepdog", "a big shaggy grey-and-white old english sheepdog with fur over its eyes, running", ("h", 46), {"src": "sheepdog_ref_b"}),
    ("dachshund", "a long low brown dachshund dog with floppy ears, running", ("h", 30), {}),
    ("poodle", "a fluffy white poodle dog with a pom-pom haircut and a pink collar, running", ("h", 36), {"bg": "dark"}),
    ("husky", "a grey-and-white husky dog with blue eyes and a curled tail, running", ("h", 46), {"bg": "dark"}),
    ("bulldog", "a stocky tan-and-white bulldog with a wrinkly face and an underbite, running", ("h", 34), {}),
    ("chihuahua", "a tiny fawn chihuahua dog with huge ears and bulging eyes, yapping", ("h", 26), {}),
    ("german-shepherd", "a black-and-tan german shepherd dog with pointy ears, running", ("h", 48), {}),
    ("golden-retriever", "a happy golden retriever dog with a fluffy golden coat, running", ("h", 46), {}),
    ("pug", "a chubby fawn pug dog with a black wrinkly face and a curly tail, running", ("h", 30), {}),
    ("great-dane", "a huge tall grey great dane dog with long legs, running", ("h", 54), {"shape": "tall"}),
]
DOG_POSES = [("back", BACK.replace("its head", "its head, running away")),
             ("bite", f"{FRONT}, leaping through the air with its mouth wide open to bite, front paws stretched forward")]

HUMANS = [
    ("neighbour", "an angry middle-aged neighbour in a fluffy pink bathrobe, slippers and hair curlers, holding a broom", ("h", 56), {"attack": "swinging the broom down hard"}),
    ("mail-carrier", "a mail carrier in a blue uniform and cap with a brown leather satchel full of letters", ("h", 56), {"attack": "flinging a bundle of letters"}),
    ("jogger", "a jogger in a bright teal tracksuit with big headphones, sweatband and running shoes", ("h", 56), {"attack": "sprinting forward in a fast lunge"}),
    ("kid-on-bike", "a kid in a red helmet riding a small yellow bicycle", ("h", 46), {"attack": "pedalling hard and ringing the bell, front wheel lifted in a wheelie", "shape": "wide"}),
    ("grandma", "a tiny feisty grandma in a purple cardigan and glasses, holding a wooden rolling pin", ("h", 50), {"attack": "swinging the rolling pin over her head"}),
    ("animal-control", "an animal control officer in a khaki uniform and cap holding a big net on a long pole", ("h", 58), {"attack": "swinging the net down to catch something", "shape": "tall"}),
    ("gardener", "a gardener in a green apron and straw hat holding a garden hose spraying water", ("h", 56), {"attack": "spraying a strong jet of water from the hose"}),
    ("hockey-teen", "a teenager in a red hockey jersey and toque holding a hockey stick", ("h", 54), {"attack": "taking a big slapshot swing with the stick"}),
    ("bbq-dad", "a dad in a striped apron, cargo shorts and sandals holding barbecue tongs and a spatula", ("h", 56), {"attack": "jabbing forward with the barbecue tongs"}),
    ("paper-kid", "a paper delivery kid in a cap with a canvas bag of rolled newspapers", ("h", 46), {"attack": "throwing a rolled newspaper overhand"}),
    ("crossing-guard", "a crossing guard in a bright orange safety vest holding up a round blank paddle sign with no writing", ("h", 56), {"attack": "swinging the blank paddle sign like a bat"}),
]
ANIMALS = [
    ("canada-goose", "an angry Canada goose with a black neck and white cheek patch, wings half spread, hissing", ("h", 38), {"attack": "charging forward with wings spread wide and beak open, hissing"}),
    ("seagull", "a greedy white-and-grey seagull with a yellow beak", ("h", 34), {"bg": "dark", "attack": "swooping down with wings spread and beak open"}),
    ("crow", "a glossy black crow with a sly look", ("h", 32), {"attack": "diving forward with wings spread and claws out"}),
    ("skunk", "a cute black skunk with a white stripe and a big fluffy raised tail", ("h", 34), {"attack": "turned around with its tail raised high, spraying a green stink cloud"}),
    ("acorn-squirrel", "a small red squirrel holding an acorn in its paws", ("h", 26), {"attack": "throwing the acorn overhand"}),
    ("orange-cat", "a chubby orange tabby cat with a grumpy face", ("h", 34), {"attack": "pouncing with claws out and back arched"}),
    ("black-cat", "a sleek black cat with yellow eyes and a raised tail", ("h", 34), {"attack": "hissing with an arched back and claws swiping"}),
    ("beaver", "a chubby brown beaver with big orange front teeth and a flat paddle tail", ("h", 36), {"attack": "slapping its flat tail down hard on the ground"}),
    ("porcupine", "a round brown porcupine with long cream-tipped quills", ("h", 34), {"attack": "curled up with its quills sticking out and flying off"}),
    ("coyote", "a lean scruffy grey-brown coyote with a bushy tail", ("h", 44), {"attack": "lunging forward with jaws open"}),
    ("moose", "a huge brown bull moose boss with giant flat antlers, a long face and a beard", ("h", 120), {"shape": "tall", "attack": "charging forward with its head down and antlers lowered"}),
    ("black-bear", "a huge black bear boss standing upright on its hind legs, tan muzzle, claws out", ("h", 110), {"shape": "tall", "attack": "swiping a giant paw with claws out, roaring"}),
]
CHAR_POSES = [("back", BACK)]
# The wording for back and rear views painted without the front view as a reference (see TURN_AROUND).
TURN_POSES = {
    "back": ("turned around and moving away from us: its rump and tail are closest to us at the lower right of the "
             "picture, its head points away toward the upper left and its face is hidden, we only see the back of its head"),
    "rear": ("turned around, seen from behind: its back end with the red tail lights, rear window and rear bumper is "
             "closest to us at the lower right of the picture, and its front with the headlights points away toward "
             "the upper left, hidden from view"),
}   # + the character's own attack pose

CAR_LEAD = "seen from exactly the same camera angle, facing the same way (toward the lower right) and at the same size as the car in image {n}, but a different vehicle"
CARS = [
    ("station-wagon", "a boxy 1980s red station wagon with fake wood side panels and little rust spots", ("w", 140), {}),
    ("pickup", "a boxy 1980s blue pickup truck with a dented open cargo bed", ("w", 140), {}),
    ("minivan", "a 1990s white minivan with a sliding side door", ("w", 140), {"bg": "dark"}),
    ("hatchback", "a small boxy yellow 1980s hatchback with round headlights", ("w", 120), {}),
    ("vintage-sedan", "a long green vintage 1970s sedan with chrome bumpers", ("w", 146), {}),
    ("suv", "a big black SUV with tinted windows and a roof rack", ("w", 142), {}),
    ("ice-cream-truck", "a white and pastel pink ice cream truck with a giant plastic cone on the roof, completely plain sides with no letters, no signs and no pictures", ("w", 150), {"bg": "dark"}),
    ("garbage-truck", "a big green garbage truck with a rear loader and a side arm, no writing", ("w", 160), {}),
    ("mail-van", "a small white boxy mail delivery van with a blue stripe, completely plain sides with no letters, no signs and no logos", ("w", 134), {"bg": "dark"}),
    ("patrol-car", "a generic black-and-white patrol car with a light bar on the roof, no writing, no badges", ("w", 140), {"bg": "dark"}),
    ("school-bus", "a long yellow school bus with black stripes and no writing", ("w", 170), {}),
    ("rv", "a big long boxy 1980s motorhome camper RV, cream with brown and orange stripes, small side windows, a side entry door and a ladder at the back, completely plain sides with no letters; not a van and not an ice cream truck", ("w", 166), {}),
]
WRECKS = [
    ("wreck-burnt", "a burnt-out car wreck, scorched black and rust-brown, no wheels, broken windows, a little smoke", ("w", 136), {}),
    ("wreck-rusty", "an abandoned rusty teal 1980s car on flat tyres with a smashed windshield and a missing door", ("w", 136), {}),
    ("wreck-crushed", "a crushed red car squashed flat with its roof caved in", ("w", 130), {}),
]
CAR_POSES = [("rear", "the same vehicle seen from the back in three-quarter view, driving away toward the upper left of the picture, so we see its rear and tail lights")]

TREES = [
    ("red-maple", "a round red maple tree in full autumn colour", ("h", 150), {"shape": "tall"}),
    ("orange-maple", "a round orange maple tree in autumn colour", ("h", 145), {"shape": "tall"}),
    ("yellow-birch", "a slim birch tree with white bark and yellow leaves", ("h", 150), {"shape": "tall"}),
    ("oak", "a big round lush green oak tree with a thick trunk", ("h", 165), {"shape": "tall"}),
    ("small-spruce", "a small deep emerald green spruce tree", ("h", 110), {"shape": "tall"}),
    ("dead-tree", "a spooky bare dead tree with twisted grey branches", ("h", 140), {"shape": "tall"}),
    ("cedar-hedge", "a dense rectangular trimmed cedar hedge, deep green", ("w", 90), {"shape": "wide"}),
    ("round-bush", "a round lush green bush", ("h", 40), {}),
    ("flowering-bush", "a round green bush covered in pink and magenta flowers", ("h", 42), {}),
    ("leaf-pile", "a raked pile of red, orange and yellow autumn leaves", ("h", 30), {}),
    ("pumpkin-patch", "a small patch of orange pumpkins on green vines", ("w", 70), {}),
    ("flower-bed", "a long narrow dense flower bed of purple, magenta, red and orange flowers in dark soil with a low wooden edging, no base plate", ("w", 80), {"shape": "wide"}),
    ("tall-grass", "a clump of tall wild grass with a few seed heads", ("h", 34), {}),
    ("stump", "an old tree stump with rings and a little moss", ("h", 26), {}),
    ("wildflowers", "a patch of wildflowers: purple, white, yellow and red dots in lush green grass", ("w", 50), {}),
]

PROPS = [
    ("mailbox", "a red mailbox on a wooden post", ("h", 34), {}),
    ("fire-hydrant", "a red fire hydrant with yellow caps", ("h", 24), {}),
    ("street-lamp", "an old globe street lamp on a dark green pole", ("h", 90), {"shape": "tall"}),
    ("power-pole", "a wooden power pole with a crossbar, glass insulators and a transformer", ("h", 120), {"shape": "tall"}),
    ("picket-fence", "a short straight section of white picket fence", ("w", 64), {"bg": "dark", "shape": "wide"}),
    ("plank-fence", "a short straight section of brown wooden plank fence", ("w", 64), {"shape": "wide"}),
    ("picnic-table", "a wooden picnic table with attached benches", ("w", 56), {}),
    ("barbecue", "a round black kettle barbecue grill on three legs, a little smoke", ("h", 34), {}),
    ("kiddie-pool", "a round blue inflatable kiddie pool with water and a rubber ring", ("w", 60), {}),
    ("trampoline", "a round backyard trampoline with a black mat and blue padding", ("w", 80), {}),
    ("gnome", "a garden gnome with a red pointy hat and white beard", ("h", 22), {}),
    ("flamingo", "a pink plastic lawn flamingo on wire legs", ("h", 28), {}),
    ("hockey-net", "a red street hockey net with white netting", ("w", 44), {}),
    ("basketball-hoop", "a portable basketball hoop on a stand with a blank white backboard", ("h", 80), {"shape": "tall"}),
    ("swing-set", "a backyard metal swing set with two swings and a slide", ("w", 80), {"shape": "wide"}),
    ("doghouse", "a little red wooden doghouse with a shingle roof", ("h", 40), {}),
    ("shed", "a small wooden garden shed with a green door", ("h", 70), {}),
    ("bench", "a green wooden park bench", ("w", 48), {}),
    ("bus-shelter", "a small glass bus shelter with a bench and no writing", ("w", 80), {"shape": "wide"}),
    ("traffic-cone", "an orange traffic cone with white stripes", ("h", 20), {}),
    ("sandbox", "a square wooden sandbox with sand, a bucket and a shovel", ("w", 50), {}),
    ("wheelbarrow", "a green metal wheelbarrow full of dirt", ("w", 42), {}),
    ("lawn-mower", "a red push lawn mower", ("w", 34), {}),
    ("hose-reel", "a green garden hose coiled on a reel cart", ("h", 24), {}),
    ("bicycle", "a parked blue bicycle with a basket", ("w", 40), {}),
    ("shopping-cart", "an abandoned metal shopping cart", ("w", 36), {"bg": "dark"}),
    ("old-couch", "an old ugly mustard-yellow couch left on the curb", ("w", 60), {}),
    ("boxes", "three plain brown cardboard boxes stacked on top of each other, the top one with its flaps open, no vehicle", ("h", 30), {}),
    ("garbage-bags", "a pile of black garbage bags, one torn", ("w", 40), {}),
    ("compost-heap", "a wooden-slat compost heap with food scraps and leaves", ("w", 44), {}),
    ("birdbath", "a stone birdbath fountain with water", ("h", 34), {"bg": "dark"}),
    ("scarecrow", "a funny scarecrow with a straw hat and a plaid shirt on a pole", ("h", 60), {"shape": "tall"}),
    ("hay-bale", "a round golden hay bale", ("h", 30), {}),
    ("jack-o-lantern", "a carved jack-o-lantern pumpkin with a glowing face", ("h", 20), {}),
    ("street-sign", "a green street name sign on a metal pole with no writing", ("h", 70), {"shape": "tall"}),
    ("stop-sign", "a red octagon stop sign on a metal pole with no writing on it", ("h", 70), {"shape": "tall"}),
    ("newspaper-box", "a blue metal newspaper vending box with no writing", ("h", 30), {}),
    ("muskoka-chair", "a wooden Muskoka chair painted red", ("h", 32), {}),
    ("canoe-rack", "a red canoe resting upside down on a wooden rack", ("w", 80), {"shape": "wide"}),
    ("firewood", "a neat stacked pile of firewood logs", ("w", 44), {}),
    ("rain-barrel", "a green plastic rain barrel under a little downspout", ("h", 30), {}),
]

PICKUP = "a small chunky game pickup item, simple and easy to read, slightly glowing"
PICKUPS = [(n, f"{PICKUP}: {d}", ("h", h), o) for n, d, h, o in [
    ("pizza-slice", "a slice of pepperoni pizza", 22, {}),
    ("soda-can", "a dented red soda can with no writing", 22, {}),
    ("sandwich", "half a sandwich with lettuce and ham", 20, {}),
    ("donut", "a pink frosted donut with sprinkles", 20, {}),
    ("apple-core", "an eaten apple core", 22, {}),
    ("banana-peel", "a yellow banana peel", 18, {}),
    ("fish-bone", "a cartoon fish skeleton: a fish head, a spine with rib bones and a tail fin", 18, {"bg": "dark"}),
    ("cheese", "a yellow wedge of cheese with holes", 20, {}),
    ("poutine", "a paper box of poutine: fries, cheese curds and gravy", 24, {}),
    ("maple-syrup", "a small glass bottle of maple syrup shaped like a maple leaf, no label", 26, {}),
    ("bottle-cap", "a shiny bottle cap", 18, {}),
    ("coin-stack", "a small stack of gold coins", 22, {}),
    ("gold-coin", "a big shiny gold coin with a maple leaf on it", 20, {}),
    ("marble", "a shiny glass marble with a blue swirl", 18, {}),
    ("first-aid", "a white first-aid kit box with a red cross", 22, {"bg": "dark"}),
    ("bandage", "a beige adhesive bandage", 18, {}),
    ("energy-drink", "a green energy drink can with a lightning bolt and no writing", 24, {}),
    ("magnet", "a big red U-shaped horseshoe magnet with shiny silver tips", 22, {}),
    ("treasure-chest", "a small wooden treasure chest with gold trim", 24, {}),
    ("golden-can", "a golden trash can shining", 28, {}),
    ("key", "an old brass key", 18, {}),
    ("toy-car", "a small toy race car", 18, {}),
    ("rubber-duck", "a yellow rubber duck", 20, {}),
    ("dog-bone", "a white dog biscuit bone", 18, {"bg": "dark"}),
    ("sock", "a smelly striped sock", 22, {}),
    ("old-boot", "a worn old brown boot", 24, {}),
    ("pinecone", "a brown pinecone", 20, {}),
    ("acorn", "an acorn with its cap", 18, {}),
    ("orb-blue", "a glowing round blue experience orb gem", 18, {}),
    ("orb-green", "a glowing round green experience orb gem", 20, {}),
    ("orb-gold", "a glowing round gold experience orb gem", 22, {}),
]]

SHOT = "a small thrown projectile for a video game, simple and easy to read"
PROJECTILES = [(n, f"{SHOT}: {d}", ("h", h), o) for n, d, h, o in [
    ("pebble", "a small grey pebble", 10, {}),
    ("banana-spin", "a yellow banana peel spinning, with motion lines", 16, {}),
    ("tin-can", "a dented tin can", 14, {}),
    ("rotten-apple", "a brown rotten apple with a worm", 14, {}),
    ("bottle-cap", "a spinning bottle cap", 10, {}),
    ("frisbee", "a red frisbee disc", 12, {}),
    ("water-balloon", "a blue water balloon", 14, {}),
    ("egg", "a white egg", 12, {"bg": "dark"}),
    ("acorn", "an acorn", 12, {}),
    ("puck", "a black hockey puck", 10, {}),
    ("paper-plane", "a folded white paper airplane", 14, {"bg": "dark"}),
    ("tp-roll", "a single white toilet paper roll with a loose strip of paper fluttering behind it, no vehicle", 16, {"bg": "dark"}),
    ("sock", "a single balled-up red-and-white striped sock, nothing else", 12, {}),
    ("trash-orb", "a glowing green orb of swirling trash", 18, {"bg": "dark"}),
    ("firecracker", "a red firecracker with a sparking fuse", 16, {}),
]]

FX = "a cartoon video game effect, bold and readable, only the effect itself with no vehicle, no character and no other object in it"
EFFECTS = [(n, f"{FX}: {d}", ("h", h), o) for n, d, h, o in [
    ("dust-a", "a small round puff of tan dust", 30, {"bg": "pink"}),
    ("dust-b", "a wide flat cloud of dust kicked up from running feet", 26, {"bg": "pink"}),
    ("dust-c", "a ring of little dust puffs in a circle", 30, {"bg": "pink", "keep": 0.03}),
    ("impact", "an orange-and-white impact starburst", 44, {}),
    ("sparkle", "a cluster of white and yellow twinkling sparkles", 36, {"bg": "dark", "keep": 0.03}),
    ("trash-burst", "an explosion of small paper scraps, bottle caps and candy wrappers flying outward from an empty centre, no vehicle and no bin", 54, {"keep": 0.03}),
    ("splash", "a splash of light blue and white water droplets bursting upward from an empty centre, no object in it", 40, {"bg": "dark", "keep": 0.03}),
    ("egg-splat", "an egg splatting with yolk and shell bits flying", 34, {"bg": "dark", "keep": 0.03}),
    ("stink-cloud", "a green stink cloud with wavy fumes", 48, {}),
    ("smoke", "a grey smoke puff", 40, {"bg": "pink"}),
    ("flame", "a flickering orange and yellow flame", 40, {}),
    ("zap", "a jagged electric zap bolt, bright blue and white", 50, {"bg": "pink"}),
    ("heart", "a red pixel heart with a shine", 30, {}),
    ("dizzy", "a ring of yellow dizzy stars circling", 30, {"bg": "dark", "keep": 0.03}),
    ("feathers", "a burst of white feathers flying", 44, {"bg": "dark", "keep": 0.03}),
    ("leaf-swirl", "a swirl of red and orange autumn leaves in the wind", 50, {"keep": 0.03}),
    ("coin-burst", "a burst of gold coins flying outward with sparkles", 50, {"keep": 0.03}),
    ("level-up", "a glowing golden ring of light with soft light rays shooting upward from it", 60, {"bg": "dark"}),
]]

DECALS = [   # painted top-down and flat, then turned isometric
    ("scorch", "a black scorch mark with sooty edges", ("w", 70), {}),
    ("oil-stain", "a dark oil stain with a rainbow sheen", ("w", 60), {}),
    ("water-puddle", "a small irregular puddle of blue water with a white shine, just the water and nothing else", ("w", 80), {"bg": "grey"}),
    ("mud-puddle", "a brown mud puddle", ("w", 70), {}),
    ("paw-trail", "a trail of small muddy brown animal paw prints walking in a straight line from the bottom to the top of the picture", ("w", 90), {"keep": 0.03}),
    ("footprints", "a trail of small muddy brown shoe prints, left and right, walking in a straight line from the bottom to the top of the picture", ("w", 90), {"keep": 0.03}),
    ("skid-marks", "two black curved tire skid marks", ("w", 110), {"keep": 0.03}),
    ("ketchup", "a red ketchup splat with drops", ("w", 50), {"keep": 0.03}),
    ("egg-splat", "a broken egg splat with yolk and shell bits", ("w", 44), {"keep": 0.03}),
    ("spilled-trash", "spilled garbage: scattered wrappers, a banana peel, cans and paper scraps", ("w", 100), {"keep": 0.03}),
    ("crack", "a small irregular patch of grey asphalt broken by thick dark jagged cracks like a spider web", ("w", 90), {"keep": 0.03}),
    ("pothole", "a round pothole with broken asphalt edges and a little water inside", ("w", 64), {}),
    ("leaf-scatter", "scattered red, orange and yellow fallen leaves", ("w", 90), {"keep": 0.03}),
    ("hopscotch", "a chalk hopscotch grid drawn in white and pink chalk lines, empty squares, no numbers, no writing", ("w", 100), {"bg": "dark", "keep": 0.03}),
    ("soda-spill", "a brown fizzy soda spill puddle with a tipped can", ("w", 60), {}),
    ("broken-glass", "scattered shards of broken green bottle glass", ("w", 50), {"keep": 0.03}),
    ("paint-splash", "a splash of spilled bright blue paint", ("w", 70), {"keep": 0.03}),
    ("crater", "a small burnt crater with scorched cracked edges", ("w", 90), {}),
    ("banana-smear", "a flat squashed banana smear, yellow and brown mush pressed flat", ("w", 50), {}),
    ("juice-splat", "an orange juice splat with drops", ("w", 50), {"keep": 0.03}),
]
# Decals: dark and grey marks go on pink, so the cut-out code doesn't take them for shadows.
for _n, _d, _s, _o in DECALS:
    _o.setdefault("bg", "pink")
    _o["decal"] = True
# The turned-around views were repainted the new way (see TURN_AROUND), so they get new seeds too.
for _n, *_ in DOGS:
    REPAINT.setdefault(f"{_n}-back", 2)
for _n, *_ in CARS:
    REPAINT.setdefault(f"{_n}-rear", 2)
for _n in TURN_AROUND:
    REPAINT.setdefault(f"{_n}-back", 2)


def seed_of(name):
    return REPAINT.get(name, 1000 + zlib.crc32(name.encode()) % 90000)


def style_refs():
    """The style pictures every job sees first: the rich-look reference (if it's been saved), then
    the two favourites."""
    return ([RICH_REF] if os.path.exists(RICH_REF) else []) + style.STYLE_REFS


def lite_refs():
    return [r for r in style_refs() if "garbageday" not in r]


def image_list(n):
    return ", ".join(f"image {i}" for i in range(1, n)) + f" and image {n}" if n > 1 else "image 1"


def shape_size(opts):
    return {"wide": (1216, 832), "tall": (832, 1216)}.get(opts.get("shape"), (1024, 1024))


def alone(bg):
    return style.ALONE.replace("plain flat even light grey background", BACKS[bg])


DECAL_STYLE = style.STYLE.replace("Seen from above at a 45 degree angle, an isometric video game view. ",
                                  "Seen from straight above, top-down, completely flat. ")


def job(cat, name, prompt, opts, refs, key=None):
    key = key or name
    w, h = shape_size(opts)
    return {"prompt": prompt, "seed": seed_of(key), "width": w, "height": h, "refs": refs,
            "path": os.path.join(PAINT, cat, f"{key}_s{seed_of(key)}.png")}


def stage1():
    """Every base piece: (category, name, size, opts, job or None for existing paintings)."""
    refs = style_refs()
    k = len(refs)
    lead = (f"Paint a new game sprite in exactly the same art style, colours and lighting as {image_list(k)}, "
            "but do not copy their scenes. ")
    out = []
    out.append(("critters", "raccoon", ("h", 46), {}, None, os.path.join(LOCK, "raccoon_ref_a.png")))
    for cat, items, facing in (("critters", CRITTERS, True), ("dogs", DOGS, True), ("humans", HUMANS, True),
                               ("animals", ANIMALS, True), ("trees", TREES, False), ("props", PROPS, False),
                               ("pickups", PICKUPS, False), ("projectiles", PROJECTILES, False),
                               ("effects", EFFECTS, False)):
        for name, desc, size, o in items:
            if o.get("src"):
                out.append((cat, name, size, o, None, os.path.join(LOCK, o["src"] + ".png")))
                continue
            subj = f"{desc}, {FRONT}" if facing else desc
            r = lite_refs() if name in LITE else refs
            lead1 = lead.replace(image_list(k), image_list(len(r)))
            j = job(cat, name, f"{lead1}{style.STYLE} The sprite: {subj}. {alone(o.get('bg', 'grey'))}", o, r)
            out.append((cat, name, size, o, j, j["path"]))
    for cat, items in (("cars", CARS), ("cars", WRECKS)):
        for name, desc, size, o in items:
            o.setdefault("shape", "wide")
            angle = CAR_LEAD.format(n=k + 1)
            j = job(cat, name, f"{lead}{style.STYLE} The sprite: {desc}, {angle}. {alone(o.get('bg', 'grey'))}",
                    o, refs + [CAR_ANGLE])
            out.append((cat, name, size, o, j, j["path"]))
    for name, desc, size, o in DECALS:
        r = lite_refs() if name in LITE else refs
        j = job("decals", name,
                f"Paint a flat ground decal for a video game in exactly the same art style and colours as {image_list(len(r))}, "
                f"but do not copy their scenes. {DECAL_STYLE} The decal: {desc}, lying flat on the ground. "
                f"One single flat mark seen from straight above, the whole of it visible with empty space all around, "
                f"on a {BACKS[o['bg']]}. No perspective, nothing standing up, no ground texture, no shadow, no text.",
                o, r)
        out.append(("decals", name, size, o, j, j["path"]))
    return out


def stage2(bases):
    """More poses, each with its stage 1 painting as the last reference picture."""
    refs = style_refs()
    k = len(refs)
    by_name = {(c, n): (size, o, path) for c, n, size, o, _, path in bases}
    lead = (f"Paint the same character as image {k + 1}, with exactly the same design, colours, markings, outfit "
            f"and proportions, in exactly the same art style as {image_list(k)}. ")
    out = []

    plain = (f"Paint a new game sprite in exactly the same art style, colours and lighting as {image_list(k)}, "
             "but do not copy their scenes. ")

    def add(cat, name, poses, short, full=None):
        size, o, base = by_name[(cat, name)]
        o2 = {kk: v for kk, v in o.items() if kk in ("bg", "shape", "keep")}
        for pose, desc in poses:
            key = f"{name}-{pose}"
            short = short.removeprefix("a ").removeprefix("an ")
            if pose in TURN_POSES and full and (cat in ("dogs", "cars") or name in TURN_AROUND):
                # Turned around: no reference to its front view (the model copies it), full description.
                body = full.split(", running")[0]
                j = job(cat, key, f"{plain}{style.STYLE} The sprite: {body}, {TURN_POSES[pose]}. {alone(o.get('bg', 'grey'))}",
                        o2, refs, key=key)
                out.append((cat, key, size, o2, j, j["path"]))
                continue
            j = job(cat, key, f"{lead}{style.STYLE} The sprite: the same {short}, {desc}. {alone(o.get('bg', 'grey'))}",
                    o2, refs + [base], key=key)
            out.append((cat, key, size, o2, j, j["path"]))

    add("critters", "raccoon", RACCOON_POSES, "raccoon")
    for name, *_ in CRITTERS:
        add("critters", name, CRITTER_POSES, name.replace("-", " "))
    for name, desc, *_ in DOGS:
        add("dogs", name, DOG_POSES, name.replace("-", " ") + " dog", full=desc)
    for cat, items in (("humans", HUMANS), ("animals", ANIMALS)):
        for name, desc, size, o in items:
            short = desc.split(",")[0].split(" holding")[0].split(" with")[0]
            add(cat, name, CHAR_POSES + [("attack", f"{FRONT}, {o['attack']}")], short, full=desc)
    for name, desc, *_ in CARS:
        add("cars", name, CAR_POSES, desc.split(" with")[0], full=desc)
    return out


def clean_all(pieces):
    made = []
    for cat, name, (kind, px), o, _, path in pieces:
        if not os.path.exists(path):
            print("missing painting:", name)
            continue
        out = os.path.join(OUT, cat, name + ".png")
        try:
            s = style.clean_up(path, out, height=px if kind == "h" else None, width=px if kind == "w" else None,
                               recolour=style.iso_flatten if o.get("decal") else None, keep_share=o.get("keep", 0.2),
                               holes=True, loose_shadow=True)
            made.append((cat, name, s.width, s.height))
        except Exception as e:
            print("clean-up failed:", name, e)
    return made


def sheets(made, max_width=1800):
    """One picture per category: every sprite on lawn green (at 2x, trees and cars at 1x), labelled
    with its name and size. Sprites are laid out left to right; each row is as tall as its tallest."""
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    os.makedirs(os.path.join(OUT, "sheets"), exist_ok=True)
    for cat in dict.fromkeys(c for c, *_ in made):
        items = [m for m in made if m[0] == cat]
        scale = 1 if cat in ("trees", "cars") else 2
        # Lay out: (x, row) for each sprite, and each row's height.
        cells, rows, x, row_h = [], [], 0, 0
        for _, name, w, h in items:
            cw = max(w * scale, d_len(name, w, h)) + 14
            if x and x + cw > max_width:
                rows.append(row_h); x, row_h = 0, 0
            cells.append((x, len(rows), cw))
            x += cw; row_h = max(row_h, h * scale + 24)
        rows.append(row_h)
        width = max(cx + cw for cx, _, cw in cells)
        tops = [sum(rows[:i]) for i in range(len(rows))]
        im = Image.new("RGBA", (width, sum(rows)), (78, 140, 58, 255))
        d = ImageDraw.Draw(im)
        for (cx, r, cw), (_, name, w, h) in zip(cells, items):
            s = Image.open(os.path.join(OUT, cat, name + ".png")).resize((w * scale, h * scale), Image.NEAREST)
            bottom = tops[r] + rows[r]
            im.alpha_composite(s, (cx + (cw - s.width) // 2, bottom - 20 - s.height))
            d.text((cx + 4, bottom - 17), f"{name} {w}x{h}", fill=(255, 240, 160), font=font)
        im.save(os.path.join(OUT, "sheets", cat + ".png"))
    print("sheets in", os.path.join(OUT, "sheets"))


def d_len(name, w, h):
    """Roughly how wide a sprite's label is, in pixels."""
    return 7 * len(f"{name} {w}x{h}")


def index(made):
    data = {}
    for cat, name, w, h in made:
        data.setdefault(cat, []).append([name, w, h])
    html = """<!doctype html><html><head><meta charset="utf-8"><title>Cul-de-sack art catalogue</title>
<style>
body{background:#2c3a26;color:#f2ecd0;font-family:system-ui,sans-serif;margin:16px}
h2{margin:28px 0 8px;color:#ffd77a}
.grid{display:flex;flex-wrap:wrap;gap:10px}
.c{background:#4e8c3a;border-radius:6px;padding:8px;text-align:center;font-size:12px;min-width:90px}
.c img{image-rendering:pixelated;display:block;margin:0 auto 4px}
label{font-size:14px}
</style></head><body>
<h1>Cul-de-sack art catalogue</h1>
<label>Zoom <select id="z"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
<div id="all"></div>
<script>
const DATA = __DATA__;
function draw(){
  const z = +document.getElementById('z').value, all = document.getElementById('all');
  let n = 0, out = '';
  for (const [cat, items] of Object.entries(DATA)) {
    n += items.length;
    out += `<h2>${cat} (${items.length})</h2><div class="grid">` + items.map(([name, w, h]) =>
      `<div class="c"><img src="${cat}/${name}.png?v=__V__" width="${w*z}" height="${h*z}">${name}<br>${w} x ${h}</div>`).join('') + '</div>';
  }
  all.innerHTML = `<p>${n} sprites</p>` + out;
}
document.getElementById('z').onchange = draw; draw();
</script></body></html>"""
    import time
    html = html.replace("__DATA__", json.dumps(data)).replace("__V__", str(int(time.time())))
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print(f"index: {len(made)} sprites")


def main():
    bases = stage1()
    poses = stage2(bases)
    if "--clean" not in sys.argv:
        flux3.run_jobs([b[4] for b in bases if b[4]])
        if "--stage1" not in sys.argv:
            poses = stage2(bases)
            flux3.run_jobs([p[4] for p in poses if os.path.exists(p[4]["refs"][-1])])
    made = clean_all(bases + poses)
    sheets(made)
    index(made)


if __name__ == "__main__":
    main()
