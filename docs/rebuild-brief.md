# Build "Cul-de-sack (a trashure hunt game)"

Please build this browser game from scratch, following the description below as closely as you can.

## Ground rules

- Plain HTML, CSS and JavaScript: one `index.html`, one `style.css`, one `game.js`.
  No libraries, no build step, no install. Opening `index.html` in a browser plays the game.
- It is an original backpack / inventory game: items have shapes and sit on grids, and where you
  put them decides how well you fight. Fights play out by themselves on timers.
- Use the emoji given for each thing as its picture. (If a folder `art/` with PNG pictures exists,
  use `art/<name-in-lowercase-with-dashes>.png` for items, `art/gear/…` for gear, `art/sacks/…` for
  sacks, and fall back to the emoji when a file is missing.)
- Build it in this order and make each step work before the next:
  1. the two grids and dragging items around;
  2. the shop;
  3. the scavenge map and the fight;
  4. boosts, rage and exhaustion;
  5. gear;
  6. the looks and effects.

## The screen

A dark garage / workshop look (dark browns, wooden planks for buttons, yellow `#f3c969` for
titles and numbers). Laid out as a top bar plus three columns:

- **Top bar** (full width): the name "Cul-de-sack" with "a trashure hunt game" in small letters
  next to it, and on the right a plank button "🎒 Go scavenge →".
- **Left column (about 180 px):** a raccoon character picture (🦝), a plaque "Raccoon", and a list
  of your numbers, label on the left and value on the right:
  - 💰 Gold
  - ❤️ Health
  - ⚔️ Damage/s
  - 🛡️ Block/s
  - 🌿 Heal/s
  - 😓 Tiring/s
  - 😮‍💨 Recovery/s
  - 💪 Power
- **Middle:** two grids side by side.
  - **Carry sack** (leather brown, two straps on top), titled "Carry sack (doesn't fight)". Under
    it, a big wooden crate: "💰 Sell: drop an item or gear here".
  - **Outfit** (canvas green). Under it, a line "In your hands: 🗡️ Sword, 🔪 Dagger" and a small
    colour key (Vest / Belt / Pockets).
  - Under both, a line for hints in red (why something can't go where you're dragging it).
- **Right column (takes the rest of the width):** the shop. During a fight, the fight panel
  replaces it.

Grid squares are 48 × 48 px with a 4 px gap.

## Items

Each item has a shape. Shapes are written as text rows, `X` = a filled square, `.` = empty.

Each item does one of these:
- an **effect** (`damage`, `block` or `heal`) of `amount`, once every `every` seconds;
- or works all the time: `recovery` (exhaustion drops faster) or `rageGain` (rage per second).

Weapons (effect `damage`) also add `rage` and exhaustion (`exhaust`) with every hit.

| Item | Emoji | Rarity | Shape | Does | Cost |
|---|---|---|---|---|---|
| Dagger | 🔪 | common | `X` | 2 damage / 1s, rage 4, exhaust 5 | 4 |
| Sword | 🗡️ | common | `X`,`X` | 5 damage / 2s, rage 10, exhaust 10 | 6 |
| Brass Knuckles | 👊 | common | `X` | 3 damage / 1.2s, rage 6, exhaust 5 | 5 |
| Wooden Board | 🪵 | common | `XXX` | 6 damage / 2.2s, rage 10, exhaust 12 | 5 |
| Frying Pan | 🍳 | common | `XX` | 6 damage / 2.5s, rage 12, exhaust 12 | 6 |
| Broom | 🧹 | common | `X`,`X`,`X`,`X` | 4 damage / 1.4s, rage 5, exhaust 4 | 5 |
| Paper Helmet | 🪖 | common | `X` | 2 block / 2s | 3 |
| Traffic Cone | 🚧 | common | `.X.`,`XXX` | 4 block / 2.5s | 6 |
| Trash Can Lid | 🗑️ | common | `XX` | 2 block / 1.5s | 5 |
| Spare Tire | 🛞 | common | `XX`,`XX` | 4 block / 3s | 5 |
| Lemonade | 🍋 | common | `X` | 3 heal / 3s | 4 |
| Bandages | 🩹 | common | `XX` | 4 heal / 3s | 5 |
| Water Bottle | 💧 | common | `X`,`X` | recovery 3 | 4 |
| Bubble Wrap | 🫧 | common | `X` | gives +1 block to touching blocking items | 4 |
| Greatsword | ⚔️ | rare | `X`,`X`,`X` | 9 damage / 2.5s, rage 16, exhaust 18 | 9 |
| Boomerang | 🪃 | rare | `X.`,`XX`,`.X` | 4 damage / 1.5s, rage 8, exhaust 6 | 7 |
| Axe | 🪓 | rare | `XX`,`XX` | 9 damage / 3s, rage 16, exhaust 18 | 8 |
| Cricket Bat | 🏏 | rare | `X`,`X`,`X` | 7 damage / 2s, rage 12, exhaust 14 | 7 |
| Darts | 🎯 | rare | `X` | 3 damage / 0.8s, rage 3, exhaust 4 | 7 |
| Shield | 🛡️ | rare | `XX`,`XX` | 3 block / 3s; gives +1 damage to touching weapons | 6 |
| Herb | 🌿 | rare | `X` | 2 heal / 2.5s; touching items act 25% faster | 5 |
| Watermelon | 🍉 | rare | `XX`,`XX` | 6 heal / 4s; +1 heal to healing items in its rows | 8 |
| Hot Sauce | 🌶️ | rare | `X` | rageGain 3 | 5 |
| Lawn Chair | 🪑 | rare | `X.`,`XX` | recovery 5 | 6 |
| Garden Gloves | 🧤 | rare | `XX` | touching weapons cause 4 less exhaustion | 5 |
| Magnet | 🧲 | rare | `X` | items in its row act 15% faster | 7 |
| Flashlight | 🔦 | rare | `XX` | +1 damage to weapons in its columns | 7 |
| Fire Extinguisher | 🧯 | rare | `X`,`X` | weapons in its columns cause 3 less exhaustion | 6 |
| Holster | 👝 | rare | `XX` | a weapon sitting right on top of it doesn't need your hands | 6 |
| Wrench | 🔧 | epic | `X`,`X` | 4 damage / 1.3s, rage 6, exhaust 7; +1 heal to touching healing items | 9 |
| Sledgehammer | 🔨 | epic | `XXX`,`.X.`,`.X.` | 14 damage / 3s, rage 20, exhaust 25; weapons in its rows +3 rage per hit | 10 |
| Boombox | 📻 | epic | `XX`,`XX` | rageGain 2; weapons in its rows +4 rage per hit | 11 |

Give every item its own colour for its squares; on the grids it shows as a coloured shape with
the picture on top.

**Rarities:**
- Outline colour: common keeps a dark outline, rare is blue `#5aa0f0`, epic is purple `#c07af0`.
- Shop chance: common is weight 6, rare 3, epic 1.

**Boosts** (`gives`) reach other items in one of three ways:
- `touch` (the default): items sharing a side with it;
- `row`: items in any of the same rows;
- `column`: items in any of the same columns.

A boost only works on items it makes sense for:
- damage, calm (less exhaustion) and rage go to weapons;
- heal goes to healing items, and block to blocking items;
- speed goes to anything on a timer.

Boosts stack. Only items on the Outfit give or get boosts.

## The two grids

**Carry sack:** storage only. Nothing in it fights or counts toward your numbers. You start with
the Pillowcase.

**Sacks** (bought in the shop; each is stood upright, turned if it's wider than tall):

| Sack | Emoji | Cost | Shape (before turning) |
|---|---|---|---|
| Pillowcase | 🛏️ | 0 | 6 × 4 full |
| Potato Sack | 🥔 | 12 | `.XXXX.` + 4 rows of `XXXXXX` |
| Laundry Sack | 🧺 | 16 | 4 rows `XXXXXXX` + `.X...X.` |
| Giant Trash Bag | 🗑️ | 20 | `XXXXXXXX`,`XXXXXXXX`,`.XXXXXXX`,`..XXXXXX`,`..X...X.` |
| Grocery Sack | 🛍️ | 10 | `XX..XX` + 3 rows `XXXXXX` + `.XXXX.` |
| Mail Sack | ✉️ | 12 | `..XX..` + 4 rows `XXXXXX` |
| Flour Sack | 🌾 | 14 | `X....X` + 4 rows `XXXXXX` |
| Duffel Sack | 🎽 | 14 | `.XXXXXX.`,`XXXXXXXX`,`XXXXXXXX`,`.XXXXXX.` |
| Sleeping Bag | 🛌 | 15 | `XXXX.....`,`XXXXXXXXX`,`XXXXXXXXX`,`XXXX.....` |

Switching sacks keeps items where they fit and moves the others to the first free spot. Items with
no room left are sold for their full price.

**Outfit:** a 10 × 9 grid, columns and rows counted from 0.
- **Hands:** the 4 squares at columns 4–5, rows 3–4, edged in gold. You always have them.
- **Gear:** every other usable square comes from gear you wear.
- **Weapon rule:** every weapon on the Outfit must cover at least one hand square, unless it is
  holstered (one of its squares sits directly above a Holster square). Moving a Holster away
  mustn't leave a weapon out of your hands either.

## Gear (vests, belts, trousers)

Gear pieces are dragged onto the Outfit, and each one adds its squares to it. Items can then sit
on those squares. Every piece of gear is common.

| Gear | Kind | Shape | Cost |
|---|---|---|---|
| Thrift Vest 🦺 | Vest | `XX` | 5 |
| Fishing Vest 🦺 | Vest | 2 × 2 | 9 |
| Hunting Vest 🦺 | Vest | 3 × 2 (`XXX`,`XXX`) | 14 |
| Rope Belt 🪢 | Belt | `X`,`X` | 4 |
| Tool Belt 🧰 | Belt | 2 × 2 | 8 |
| Utility Belt 🧰 | Belt | 2 wide × 3 tall | 14 |
| Jeans 👖 | Pockets | `XX` | 4 |
| Cargo Shorts 🩳 | Pockets | 2 × 2 | 9 |
| Cargo Pants 👖 | Pockets | 3 × 2 | 14 |

**Connection points:** each kind attaches at its own squares around the hands. On the right side
they are (col,row):
- Vest: (5,2) (6,2) (6,3)
- Belt: (6,3) (7,3) (6,4) (7,4)
- Pockets: (6,4) (5,5) (6,5)

They are mirrored onto the left side (col → 9 − col). Some squares take two kinds.

**Where gear can go:** a piece fits on the Outfit when all of these are true:
- it stays inside the 10 × 9 grid;
- it covers no hand square;
- it overlaps no other gear;
- it covers at least one connection point of its own kind.

Within those rules it can stick out as far as it likes. You can wear as many pieces as fit.

**Moving and storing gear:**
- Gear can also be stored in the carry sack like any item. It adds nothing there.
- Gear with an item on it can't be moved or sold. Say "Take the X off the Y first."

**Colours by kind:** Vest `#e0803a`, Belt `#d8b04a`, Pockets `#4a8ad8`.
- **Worn gear:** its kind colour mixed 25% into the grid's own colour, with faint dashed stitching
  and no picture (hover shows its name).
- **Free connection squares:** a faint tint of their kind colour (split corner to corner where a
  square takes two kinds).
- **Corner marks:** each free connection square also gets the 4 corners of a box drawn in faint
  cream.
- **While dragging gear:** only that kind's corner marks show, fully bright in its colour.
- Nothing is drawn under gear you wear.

## Dragging

- **Pointer drag:** use pointer events with pointer capture (not the browser's HTML drag and
  drop). Set `draggable=false` on pictures.
- **Ghost:** while dragging, a ghost outline shows where the thing would land. It is green if it
  fits and red if not, with the reason in the hint line.
- **Rotating:** right-click while dragging (or press R) turns it a quarter turn clockwise. The
  picture turns with it.
- **Dropping:** dropping on a red spot or outside puts it back as it was. Dropping on the Sell
  crate sells it for its full price.
- **Boost preview** while dragging an item over the Outfit:
  - the squares its boost would reach are tinted;
  - items it would boost, or be boosted by, glow gold;
  - those items get small badges like "+1 dmg", "+15% speed", "-4 tired", "+3 rage" or
    "holstered".

## Shop

- **Gold:** you start with 10. There's a small "+10g" testing button next to the gold.
- **The possum:** a shopkeeper (🐀 or a possum picture) with a speech bubble saying what just
  happened, and a "🎲 Reroll, 1g" button that rolls new offers.
- **Shelves:** wooden shelves, 5 things per shelf, each with its picture, name and a yellow price
  tag:
  - **Items:** 5 random, different item types, picked using the rarity weights. New offers come
    after every fight, or on Reroll. A bought offer shows "sold".
  - **Gear:** all 9 pieces, always.
  - **Sacks:** all 9; the one you have says "carrying". Sacks can only be bought by clicking the
    tag, and show their number of squares.
- **Shapes on the shelf:** items and gear sit on a small drawing of their shape (22 px squares in
  their colour), with the picture on top, so you can see their size.
- **Buying:**
  - Drag an item or gear off a shelf onto a grid to buy it there.
  - Clicking an item's tag puts it in the first free spot (carry sack first).
  - Clicking a gear tag puts it on the first spot where it fits on the Outfit, else in the carry
    sack.
- **Hovering:** shows an info card with the name, rarity and what it does (bonuses in green).

## Your numbers (left column)

- **Damage/s, Block/s, Heal/s:** for each item on the Outfit with an effect,
  (amount + bonus) × speed ÷ every, added up.
- **Tiring/s:** the same for weapons' exhaustion per hit.
- **Recovery/s:** 5 + every worn item's recovery.
- **Health:** 30.
- **Power:** 30 + 10 × (Damage/s + Block/s + Heal/s).

## Scavenge map

"Go scavenge" opens a screen with three area cards and a "← Back to the shop" button:

| Area | Level | Enemy | Health | Hits for | Every |
|---|---|---|---|---|---|
| 🏡 Backyard | Easy | 🦝 Raccoon | 22 | 3 | 1.2s |
| 🏚️ Back Alley | Medium | 🐕 Guard Dog | 40 | 6 | 1.5s |
| 🌲 Edge of the Woods | Hard | 🐻 Black Bear | 70 | 10 | 2s |

- **Getting harder:** each win makes every enemy's health and damage 20% stronger, counted from
  the base values (× (1 + 0.2 × wins), rounded).
- **Enemy power:** health + 10 × damage ÷ every.
- **What each card shows:**
  - the enemy and its stats;
  - bars comparing your power and its power;
  - a verdict from enemy power ÷ your power: below 0.6 "Easy win", below 0.9 "Should win", below
    1.1 "Close fight", below 1.4 "Risky", else "Very dangerous";
  - the rewards: win = enemy power ÷ 8 gold (rounded), lose = 2 gold.
- A button on each card starts that fight.

## Fight

**How it runs:** the fight runs by itself, with one tick every 100 ms. Only items on the Outfit
fight.
- **Item timers:** each item's timer goes up by 100 ms × its speed. When the timer reaches
  every × 1000, the item acts and the timer drops back by that much.
- **Weapons:** deal (amount + bonus) × rage multiplier, rounded. Then add their rage (+ rage
  bonus) and their exhaustion (exhaust − calm, not below 0).
- **Block:** adds to your block. Block soaks up enemy damage before health, and is used up as it
  does.
- **Heal:** heals, up to your maximum health.
- **The enemy:** hits for its damage every `every` seconds.

**Rage** (0–100):
- the damage multiplier goes from 1× at 0 rage to 3× at 100;
- it drops 2 per second, and rageGain items add to it.

**Exhaustion** (0–100):
- it drops by Recovery/s;
- when it reaches 100 you're worn out: weapons wait, fully charged, until it is back down to 50.

**Fight panel:**
- the round number and area;
- your health bar, rage bar and exhaustion bar, with text;
- the enemy's health bar and text;
- a log, newest first.

**The end:** the fight ends when someone reaches 0 health. You get the reward gold, the shop gets
new offers, and a "🛒 Back to the shop" button appears. While fighting, nothing can be dragged or
bought.

**Effects:**
- **Charging:** worn items go dark, and their own colour fills them from the bottom to the top
  (across the whole shape) as their timer fills, sliding smoothly.
- **Acting:** when an item acts, it grows to about 1.18× and flashes bright for about 0.35 s.
- **Floating numbers:** what it did floats up from it and fades out over 2 seconds:
  - "💥5" damage in red;
  - "😮‍💨+10" exhaustion in purple, smaller, under the damage;
  - "🛡️+2" block in blue;
  - "❤️+3" heal in green.

## Starting state

- 10 gold and the Pillowcase.
- On the Outfit: Sword at (4,3) and Dagger at (5,3), both in your hands.
- In the carry sack: Shield at (0,0) and Boomerang at (2,0).
