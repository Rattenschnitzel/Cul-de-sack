# The art catalogue

A big box of game pieces (sprites) in the Cul-de-sack look, made while you were away. They live in
`art/catalog/`, and the street fight (`fight.js`) now uses them: the critter picker, all pests and
both bosses, thrown things, pickups, effects, ground marks, parked cars, trees and yard things.
Only four effects are not used yet: `level-up` (waits for a levelling system), `leaf-swirl`, and
the two weak ones, `splash` and `trash-burst`.

## What's in it

292 sprites (288 newly painted, plus the raccoon, corgi, beagle and sheepdog redone from their
existing paintings so they sit beside their new poses), each one a small PNG picture with a see-through background, already at the size
it would have in the game (one picture pixel = one screen pixel, like the raccoon and dogs now).

| Folder (`art/catalog/…`) | What | Size in the game |
|---|---|---|
| `critters/` | the raccoon in 8 poses (front, back, walk A, walk B, throw, hurt, cheer, dig); possum, red fox, grey squirrel and groundhog, each front + back + throw | about 46 tall |
| `dogs/` | 12 breeds (corgi, beagle, sheepdog plus 9 new), each front, back view and leaping bite | 26–54 tall |
| `humans/` | 11 neighbours (bathrobe neighbour with broom, mail carrier, jogger, kid on bike, grandma, animal control, gardener, hockey teen, barbecue dad, paper kid, crossing guard), each front, back and attack pose | 46–58 tall |
| `animals/` | goose, seagull, crow, skunk, squirrel with acorn, two cats, beaver, porcupine, coyote, and two bosses (moose, black bear), each front, back, attack | 26–120 tall |
| `cars/` | 12 vehicles front 3/4 and rear 3/4, plus 3 wrecks | 120–170 wide |
| `trees/` | maples, birch, oak, spruce, dead tree, hedge, bushes, leaf pile, pumpkins, flower bed, grass, stump, wildflowers | 26–165 |
| `props/` | 41 street and yard things: mailbox, hydrant, lamp, power pole, fences, picnic table, trampoline, shed, signs without text… | 20–120 |
| `pickups/` | 31 item drops: food, coins, first-aid kit, magnet, chest, golden trash can, experience orbs… | 18–28 tall |
| `projectiles/` | 15 thrown things: pebble, banana peel, egg, puck, paper plane… | 10–18 tall |
| `effects/` | 18 bursts and puffs: dust, impact star, sparkles, splash, stink cloud, flame, zap, coins… | 26–60 tall |
| `decals/` | 20 marks for the ground: scorch, puddles, paw prints, skid marks, crack, pothole, hopscotch… already squashed into the game's slanted (isometric) view | 44–110 wide |

**Front views face the lower right.** For the other direction the game can flip (mirror) the picture.
**Back views face the upper left**, for when a character walks away from the camera.

## Where to look

- `art/catalog/index.html`: every sprite with its name and size, zoomable. Open it through the
  little local web server: start the `small-game` preview (port 5500) and go to
  `http://localhost:5500/art/catalog/index.html`. (A *local web server* is a tiny program that
  hands files from this folder to your browser, the same way the game is opened.)
- `art/catalog/sheets/<category>.png`: one picture per folder with all its sprites on lawn green,
  labelled. Quickest way to judge them.
- The big original paintings (1024 pixels) are in `art/style-test/catalog/<category>/`. Their file
  names end in `_s<number>`: that number is the *seed*, the random starting point the painting model
  used. Same prompt + same seed = same painting.

## The richer look

You asked to match the richness of your new reference picture (lusher greens, more colour, more
detail). It is saved as `art/style-test/looks/ref_rich.png` and every piece was painted with it:

- `tools/style.py` now has a `RICH` line added to the style words every prompt uses: saturated,
  slightly cool late-summer colours, lush greens, emerald and teal, lots of small detail.
- The model sees `ref_rich.png` as the first style picture ("image 1") in every job, before the
  two earlier favourites.
- The palette (the fixed list of colours every sprite is snapped to) now also takes colours from
  `ref_rich.png`, and got 18 more fixed colours: lawn greens, emerald, teal and seafoam, flower
  purples and magentas, mustard, navy, orange. The old palette file was deleted so it was rebuilt
  (`art/style-test/palette86.png`; the number is how many colours it has).
- A handful of test pieces painted before the reference arrived are kept for comparison in
  `art/style-test/catalog_norich/`; they are not used.

**Expect the new pieces to look a bit brighter and greener than the sprites already in the game**
(`art/sprites/`). If we like the new look, we can repaint the old ones the same way.

## Weak pieces

I looked at every sheet and repainted the clearly broken pieces (up to three more tries each).
What is still not great:

- **`effects/splash`**: four tries, and every one has a tipped-over bin in the middle. Needs a
  different idea (or draw it in code as a few blue dots).
- **Back views that aren't quite from behind:** `dogs/poodle-back`, `dogs/bulldog-back`,
  `dogs/chihuahua-back`, `animals/acorn-squirrel-back`. They look more like side views.
- **`animals/black-bear-attack`** looks almost the same as the plain bear.
- **`animals/coyote`** (front) still has a small grey bit of painted shadow under it.
- **Small fake "writing" squiggles** on `cars/ice-cream-truck`, `cars/mail-van` and their rear
  views. Not readable, but not as clean as asked.
- **`cars/patrol-car-rear`** came out beige and black instead of white and black.
- **`cars/wreck-crushed`** isn't really crushed, just a dented red car.
- **Decals that are only so-so:** `decals/banana-smear` (a whole banana, not a smear),
  `decals/soda-spill` (has a can in it), `decals/spilled-trash` (busy and tall).
- **`effects/dust-b`, `effects/trash-burst`** have small object bits in the middle.
- **`projectiles/sock`** reads more as a striped candy than a sock.
- **New vs old look:** the new pieces are brighter, greener and more saturated than the sprites the
  game uses now (`art/sprites/`: raccoon, the three dogs, bins, houses, pines). That's the richer
  look you asked for, but side by side the old ones will look duller until they are repainted.

Things I learned about the painting model on the way (useful for later batches):

- With the old garbage-day picture as a style reference, vague small subjects (sparkles, tin can,
  bottle cap, bus shelter…) sometimes came out as a garbage truck. Those pieces are now painted
  with only the rich reference and hipixel 22 (`LITE` in the script).
- For back and rear views, showing the model the front painting made it copy the front again.
  Dogs, cars and a few animals are now painted from a full description instead (`TURN_AROUND`).
  The raccoon, critters and people did fine with their front painting as a reference.
- Painting on a pink background sometimes made it paint a whole little scene on a pink square.

## How to run it again

Both PCs' ComfyUI must be running (see `tools/start_comfy_main.bat`). Then, in a terminal in the
project folder:

```bash
C:/Users/mail/AppData/Local/Programs/Python/Python310/python.exe tools/make_catalog.py
```

It only paints what's missing, so running it again is cheap. Other options:

- `--clean`: don't paint, only rebuild the sprites, sheets and index from the paintings.
- To repaint one piece: give it a new seed in `REPAINT` near the top of `tools/make_catalog.py`,
  for example add the line `REPAINT["crow"] = 5`, and run the script again. The old painting stays
  in its folder; the sprite is made from the new one.
- To add a piece: add one line to the matching list (`PROPS`, `PICKUPS`, …) with a name, a
  description and its size in the game.

How a piece is made, in short: the script sends a *prompt* (the text description) plus the
style pictures to the painting model on both PCs. Pale things are painted on dark blue, dark marks
on pink, the rest on light grey, so the code can cut the background away cleanly. Then
`style.clean_up` cuts the piece out, shrinks it to its game size and snaps its colours to the
palette. Poses (back view, attack…) are painted with the character's first painting as an extra
picture, so it keeps its looks. Ground decals are painted flat from straight above, then
`style.iso_flatten` turns them 45 degrees and squashes them to half height, the same way the game
slants its ground.

Small tool changes made for this (the game itself, `fight.js`, was not touched):

- `tools/flux3.py`: a failed painting goes back to the end of the line for one more try, and a
  painting stuck for over 7 minutes is stopped and counts as failed (both PCs once hung for a
  quarter of an hour on one picture each). The second PC had short bursts of "CUDA error: device
  not ready" (a graphics card hiccup); the retries caught all of them.
- `tools/style.py`: the `RICH` style line, the wider palette, `iso_flatten()`, and three new
  options for `clean_up` that only the catalogue switches on: `holes` (clear background caught
  inside a piece, like sky between a tree's leaves), `loose_shadow` (also clear grainy painted
  shadows) and `keep_share` (keep pieces made of many small parts, like sparkles). `clean_up` now
  also re-measures after dropping loose specks, so a sprite always comes out at the asked size.
  Re-running the older scripts (`make_sprites.py`, `make_houses.py`) would now use the new palette.
- Test pictures from trying out the back-view wording are in `art/style-test/catalog_tests/`.

## Ideas for wiring them in (later steps, one at a time)

1. **Enemy variety:** add the new dog breeds as enemy types with their own speed and size: small
   fast chihuahua and dachshund, big slow great dane. Swap to the back-view picture when a dog moves
   up the screen.
2. **Raccoon animation:** switch between walk A and walk B every few frames while moving, show the
   throw pose for a moment on each pebble, hurt when hit, cheer when the round is won.
3. **Pickups:** dogs or bins drop experience orbs and food; the magnet pulls all pickups in.
4. **Effects and decals:** an impact star where a pebble hits, a dust puff behind running dogs,
   scorch marks and paw prints drawn on the ground layer under everything.
5. **Street dressing:** parked cars along the curb, trees, fences, lamps and mailboxes in the
   front yards, so each street looks different.
6. **Bosses:** the moose or the bear at the end of a round.
7. **People:** the neighbours as tougher enemies in later rounds (the bathrobe neighbour with a
   broom charges you when you raid their bin).
