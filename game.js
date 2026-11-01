const PLAYER_HEALTH = 30; // your health at the start of every fight

const CELL = 48; // one sack square, in pixels (as in style.css)
const STEP = CELL + 4; // one square plus the gap between squares

// Rage and exhaustion. Every weapon hit adds some of both (each weapon its own amounts).
// Rage makes weapons hit harder: from 1x at 0 rage up to 3x at 100.
// Exhaustion at 100 means you're worn out: no weapon is used until it drops back to 50.
// Both drop by themselves over time.
const RAGE_MAX = 100;
const RAGE_DECAY = 2;           // rage lost per second
const MAX_RAGE_MULTIPLIER = 3;  // damage multiplier at full rage
const EXHAUSTION_MAX = 100;
const BASE_RECOVERY = 5;        // exhaustion lost per second, before items
const RECOVERED_AT = 50;        // worn out until exhaustion is down to this

// Every kind of item in the game. shape is one text line per row of cells:
// "X" = the item covers that cell, "." = it doesn't.
// In a fight, an item does its effect (damage, block or heal) by amount,
// once every `every` seconds. cost is its price in the shop, in gold.
// Weapons (effect "damage") also add `rage` and `exhaust` (exhaustion) with every hit.
// Some items work all the time instead (no effect): recovery = exhaustion drops that much
// faster per second, rageGain = that much rage per second.
//
// Items with `gives` boost other items near them. reach says which ones:
//   "touch" (the default) = items sharing a side with it,
//   "row" = items in the same row(s), "column" = items in the same column(s).
// And one boost, which only works on the items it makes sense for:
//   damage = extra damage (weapons), heal = extra heal (healing items), block = extra block (blocking items),
//   speed = act that much faster (0.25 = 25%; items that act on a timer),
//   calm = that much less exhaustion per hit (weapons), rage = that much more rage per hit (weapons).
// A holster lets the weapon sitting right on top of it hang there without taking up a hand.
//
// rarity is how strong an item is: "common", "rare" or "epic". Rarer items show up less in the shop.
const ITEM_TYPES = [
  // Common: simple, one thing each.
  { name: "Dagger", icon: "🔪", rarity: "common", color: "#a9b7c0", shape: ["X"], effect: "damage", amount: 2, every: 1, rage: 4, exhaust: 5, cost: 4 },
  { name: "Sword", icon: "🗡️", rarity: "common", color: "#b8c4cc", shape: ["X", "X"], effect: "damage", amount: 5, every: 2, rage: 10, exhaust: 10, cost: 6 },
  { name: "Brass Knuckles", icon: "👊", rarity: "common", color: "#d4b04a", shape: ["X"], effect: "damage", amount: 3, every: 1.2, rage: 6, exhaust: 5, cost: 5 },
  { name: "Wooden Board", icon: "🪵", rarity: "common", color: "#b98a55", shape: ["XXX"], effect: "damage", amount: 6, every: 2.2, rage: 10, exhaust: 12, cost: 5 },
  { name: "Frying Pan", icon: "🍳", rarity: "common", color: "#7d848a", shape: ["XX"], effect: "damage", amount: 6, every: 2.5, rage: 12, exhaust: 12, cost: 6 },
  { name: "Broom", icon: "🧹", rarity: "common", color: "#d8b56a", shape: ["X", "X", "X", "X"], effect: "damage", amount: 4, every: 1.4, rage: 5, exhaust: 4, cost: 5 },
  { name: "Paper Helmet", icon: "🪖", rarity: "common", color: "#e8e1cf", shape: ["X"], effect: "block", amount: 2, every: 2, cost: 3 },
  { name: "Traffic Cone", icon: "🚧", rarity: "common", color: "#e9773a", shape: [".X.", "XXX"], effect: "block", amount: 4, every: 2.5, cost: 6 },
  { name: "Trash Can Lid", icon: "🗑️", rarity: "common", color: "#9aa3a8", shape: ["XX"], effect: "block", amount: 2, every: 1.5, cost: 5 },
  { name: "Spare Tire", icon: "🛞", rarity: "common", color: "#5d5d5d", shape: ["XX", "XX"], effect: "block", amount: 4, every: 3, cost: 5 },
  { name: "Lemonade", icon: "🍋", rarity: "common", color: "#f2dc6b", shape: ["X"], effect: "heal", amount: 3, every: 3, cost: 4 },
  { name: "Bandages", icon: "🩹", rarity: "common", color: "#f0d2b0", shape: ["XX"], effect: "heal", amount: 4, every: 3, cost: 5 },
  { name: "Water Bottle", icon: "💧", rarity: "common", color: "#7fc4e8", shape: ["X", "X"], recovery: 3, cost: 4 },
  { name: "Bubble Wrap", icon: "🫧", rarity: "common", color: "#cfe6f2", shape: ["X"], cost: 4, gives: { block: 1 } },
  // Rare: stronger, or they help other items.
  { name: "Greatsword", icon: "⚔️", rarity: "rare", color: "#9fb0bd", shape: ["X", "X", "X"], effect: "damage", amount: 9, every: 2.5, rage: 16, exhaust: 18, cost: 9 },
  { name: "Boomerang", icon: "🪃", rarity: "rare", color: "#d08a4e", shape: ["X.", "XX", ".X"], effect: "damage", amount: 4, every: 1.5, rage: 8, exhaust: 6, cost: 7 },
  { name: "Axe", icon: "🪓", rarity: "rare", color: "#a88a68", shape: ["XX", "XX"], effect: "damage", amount: 9, every: 3, rage: 16, exhaust: 18, cost: 8 },
  { name: "Cricket Bat", icon: "🏏", rarity: "rare", color: "#c9a26b", shape: ["X", "X", "X"], effect: "damage", amount: 7, every: 2, rage: 12, exhaust: 14, cost: 7 },
  { name: "Darts", icon: "🎯", rarity: "rare", color: "#d9534f", shape: ["X"], effect: "damage", amount: 3, every: 0.8, rage: 3, exhaust: 4, cost: 7 },
  { name: "Shield", icon: "🛡️", rarity: "rare", color: "#c9a25a", shape: ["XX", "XX"], effect: "block", amount: 3, every: 3, cost: 6, gives: { damage: 1 } },
  { name: "Herb", icon: "🌿", rarity: "rare", color: "#8fbf75", shape: ["X"], effect: "heal", amount: 2, every: 2.5, cost: 5, gives: { speed: 0.25 } },
  { name: "Watermelon", icon: "🍉", rarity: "rare", color: "#6fae5a", shape: ["XX", "XX"], effect: "heal", amount: 6, every: 4, cost: 8, gives: { reach: "row", heal: 1 } },
  { name: "Hot Sauce", icon: "🌶️", rarity: "rare", color: "#e0503c", shape: ["X"], rageGain: 3, cost: 5 },
  { name: "Lawn Chair", icon: "🪑", rarity: "rare", color: "#6fb8a0", shape: ["X.", "XX"], recovery: 5, cost: 6 },
  { name: "Garden Gloves", icon: "🧤", rarity: "rare", color: "#a3c46a", shape: ["XX"], cost: 5, gives: { calm: 4 } },
  { name: "Magnet", icon: "🧲", rarity: "rare", color: "#c45a5a", shape: ["X"], cost: 7, gives: { reach: "row", speed: 0.15 } },
  { name: "Flashlight", icon: "🔦", rarity: "rare", color: "#e3c25a", shape: ["XX"], cost: 7, gives: { reach: "column", damage: 1 } },
  { name: "Fire Extinguisher", icon: "🧯", rarity: "rare", color: "#d6453a", shape: ["X", "X"], cost: 6, gives: { reach: "column", calm: 3 } },
  { name: "Holster", icon: "👝", rarity: "rare", color: "#8a5a3a", shape: ["XX"], cost: 6, holster: true },
  // Epic: strong and they help other items too.
  { name: "Wrench", icon: "🔧", rarity: "epic", color: "#8d969e", shape: ["X", "X"], effect: "damage", amount: 4, every: 1.3, rage: 6, exhaust: 7, cost: 9, gives: { heal: 1 } },
  { name: "Sledgehammer", icon: "🔨", rarity: "epic", color: "#8a7a6a", shape: ["XXX", ".X.", ".X."], effect: "damage", amount: 14, every: 3, rage: 20, exhaust: 25, cost: 10, gives: { reach: "row", rage: 3 } },
  { name: "Boombox", icon: "📻", rarity: "epic", color: "#4a4f6a", shape: ["XX", "XX"], cost: 11, rageGain: 2, gives: { reach: "row", rage: 4 } },
];

// How the rarities look, and how often each shows up in the shop (out of 10).
const RARITIES = {
  common: { label: "Common", color: "#c9c2b4", weight: 6 },
  rare: { label: "Rare", color: "#5aa0f0", weight: 3 },
  epic: { label: "Epic", color: "#c07af0", weight: 1 },
};

// width and height (in cells) of the box around each shape.
for (const type of ITEM_TYPES) {
  type.width = type.shape[0].length;
  type.height = type.shape.length;
}

function itemType(name) {
  return ITEM_TYPES.find((type) => type.name === name);
}

// ---------------------------------------------------------------------------
// The two sacks. On the left, the carry sack: it just holds things, and items in it
// do nothing in a fight. On the right, what you wear on your body: only items there
// fight. You start with just your hands there (the 2 x 2 squares in the middle);
// vests, belts and trouser pockets are pieces of gear you put on around them,
// and each adds its squares.

// Every carry sack. shape works like an item's: "X" = a cell you can put things in.
const SACKS = [
  { name: "Pillowcase", icon: "🛏️", cost: 0,
    shape: ["XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX"] },
  { name: "Potato Sack", icon: "🥔", cost: 12,
    shape: [".XXXX.", "XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX"] },
  { name: "Laundry Sack", icon: "🧺", cost: 16,
    shape: ["XXXXXXX", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".X...X."] },
  { name: "Giant Trash Bag", icon: "🗑️", cost: 20,
    shape: ["XXXXXXXX", "XXXXXXXX", ".XXXXXXX", "..XXXXXX", "..X...X."] },
  { name: "Grocery Sack", icon: "🛍️", cost: 10,
    shape: ["XX..XX", "XXXXXX", "XXXXXX", "XXXXXX", ".XXXX."] },
  { name: "Mail Sack", icon: "✉️", cost: 12,
    shape: ["..XX..", "XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX"] },
  { name: "Flour Sack", icon: "🌾", cost: 14,
    shape: ["X....X", "XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX"] },
  { name: "Duffel Sack", icon: "🎽", cost: 14,
    shape: [".XXXXXX.", "XXXXXXXX", "XXXXXXXX", ".XXXXXX."] },
  { name: "Sleeping Bag", icon: "🛌", cost: 15,
    shape: ["XXXX.....", "XXXXXXXXX", "XXXXXXXXX", "XXXX....."] },
];

// Each carry sack stands upright (turned if it's wider than tall), and its size and number of cells.
for (const sack of SACKS) {
  if (sack.shape[0].length > sack.shape.length) sack.shape = rotateShape(sack.shape);
  sack.width = sack.shape[0].length;
  sack.height = sack.shape.length;
  sack.cellCount = sack.shape.join("").split("X").length - 1;
  sack.folder = "sacks";
}

let pack = SACKS[0]; // the carry sack you have

// The body: a 10 x 9 grid, big so gear (and items on it) can stick out far to every side.
// Your hands are the 2 x 2 squares in the middle (columns 4-5, rows 3-4, counted from 0).
// Every weapon you wear must cover at least one hand square.
const BODY_COLS = 10;
const BODY_ROWS = 9;
const HAND_CELLS = new Set(["4,3", "4,4", "5,3", "5,4"]);

// Where gear attaches: each piece of gear must cover at least one of the connection points for its
// kind. They sit around the hands, the same on both sides (some squares take two kinds).
const RIGHT_POINTS = {
  Vest: ["5,2", "6,2", "6,3"],
  Belt: ["6,3", "7,3", "6,4", "7,4"],
  Pockets: ["6,4", "5,5", "6,5"],
};
const CONNECTION_POINTS = {};
for (const [kind, keys] of Object.entries(RIGHT_POINTS)) {
  const mirrored = keys.map((key) => {
    const [col, row] = key.split(",").map(Number);
    return `${BODY_COLS - 1 - col},${row}`;
  });
  CONNECTION_POINTS[kind] = new Set([...keys, ...mirrored]);
}

// Every kind of gear. shape works like an item's; each "X" is a square it adds to your body.
// Gear can be bought as often as you like (a belt on each side, say), as long as there's room:
// pieces of gear can't overlap each other. Each piece has the colour of its kind.
const GEAR_COLORS = { Vest: "#e0803a", Belt: "#d8b04a", Pockets: "#4a8ad8" };
const GEAR = [
  { name: "Thrift Vest", icon: "🦺", kind: "Vest", cost: 5, shape: ["XX"] },
  { name: "Fishing Vest", icon: "🦺", kind: "Vest", cost: 9, shape: ["XX", "XX"] },
  { name: "Hunting Vest", icon: "🦺", kind: "Vest", cost: 14, shape: ["XXX", "XXX"] },
  { name: "Rope Belt", icon: "🪢", kind: "Belt", cost: 4, shape: ["X", "X"] },
  { name: "Tool Belt", icon: "🧰", kind: "Belt", cost: 8, shape: ["XX", "XX"] },
  { name: "Utility Belt", icon: "🧰", kind: "Belt", cost: 14, shape: ["XX", "XX", "XX"] },
  { name: "Jeans", icon: "👖", kind: "Pockets", cost: 4, shape: ["XX"] },
  { name: "Cargo Shorts", icon: "🩳", kind: "Pockets", cost: 9, shape: ["XX", "XX"] },
  { name: "Cargo Pants", icon: "👖", kind: "Pockets", cost: 14, shape: ["XXX", "XXX"] },
];
for (const type of GEAR) {
  type.color = GEAR_COLORS[type.kind];
  type.isGear = true;
  type.width = type.shape[0].length;
  type.height = type.shape.length;
  type.folder = "gear";
  type.rarity = "common";
}

function gearType(name) {
  return GEAR.find((type) => type.name === name);
}

// The gear you wear: copies of gear types with col and row on the body.
// (Gear stored in the carry sack is in `items` instead, like any item there.)
const gearPieces = [];
let bodyCells = new Set(HAND_CELLS); // the squares you have on your body

// Work out your body squares again: your hands plus the squares of every piece of gear you wear.
function updateBodyCells() {
  bodyCells = new Set(HAND_CELLS);
  for (const piece of gearPieces) {
    for (const cell of cellsOf(piece, piece.col, piece.row)) bodyCells.add(`${cell.col},${cell.row}`);
  }
}

// The two grids on the page, by name: "carry" and "body".
const bags = {
  carry: document.getElementById("carry"),
  body: document.getElementById("body"),
};

// A grid's size in cells.
function bagSize(bag) {
  return bag === "carry" ? { width: pack.width, height: pack.height } : { width: BODY_COLS, height: BODY_ROWS };
}

// True if (col, row) is a cell items can go on in this grid.
function inBag(bag, col, row) {
  if (bag === "carry") return row >= 0 && row < pack.height && pack.shape[row][col] === "X";
  return bodyCells.has(`${col},${row}`);
}

// Weapons are the items that do damage. Only weapons you wear fight, and each must
// be in your hands: cover at least one hand square.
function isWeapon(item) {
  return item.effect === "damage";
}

// Which boost a `gives` has (its one key besides reach), e.g. "damage".
function boostOf(gives) {
  return ["damage", "heal", "block", "speed", "calm", "rage"].find((key) => gives[key]);
}

// The words for what an item gives the items near it, e.g. "+1 damage to touching weapons"
// or "weapons in its column cause 3 less exhaustion".
function givesText(gives) {
  const boost = boostOf(gives);
  const noun = { damage: "weapons", calm: "weapons", rage: "weapons", heal: "healing items", block: "blocking items", speed: "items" }[boost];
  const reach = gives.reach || "touch";
  const who = reach === "row" ? `${noun} in its row` : reach === "column" ? `${noun} in its column` : `touching ${noun}`;
  const n = gives[boost];
  if (boost === "speed") return `${who} act ${Math.round(n * 100)}% faster`;
  if (boost === "calm") return `${who} cause ${n} less exhaustion`;
  if (boost === "rage") return `${who} give +${n} rage per hit`;
  return `+${n} ${boost} to ${who}`;
}

// All your items (not gear). Each is a copy of an item type plus bag ("carry" or "body"),
// col and row (its top-left cell in that grid) and timer (for fights).
const items = [];

// The items in one grid.
function itemsIn(bag) {
  return items.filter((item) => item.bag === bag);
}

let fighting = false; // true while a fight runs; items and the shop are locked then

// Put a box (an item, a piece of gear or the ghost) over the cells around its shape, top-left at (col, row).
function placeBox(el, item, col, row) {
  el.style.gridColumn = `${col + 1} / span ${item.width}`;
  el.style.gridRow = `${row + 1} / span ${item.height}`;
}

function placeItem(item) {
  placeBox(item.el, item, item.col, item.row);
}

// The cells an item (or piece of gear) covers when its top-left is at (col, row).
function cellsOf(item, col, row) {
  const cells = [];
  item.shape.forEach((line, r) => {
    [...line].forEach((mark, c) => {
      if (mark === "X") cells.push({ col: col + c, row: row + r });
    });
  });
  return cells;
}

// True if item fits in this grid with its top-left at (col, row). For an item: all its cells
// are cells of the grid, none is used by another item, and (on the body) the hand rule allows it.
// For gear on the body: see gearProblem (in the carry sack, gear is stored like any item).
function fits(item, bag, col, row) {
  if (item.isGear && bag === "body") return !gearProblem(item, col, row);
  const taken = new Set();
  for (const other of itemsIn(bag)) {
    if (other === item) continue;
    for (const cell of cellsOf(other, other.col, other.row)) taken.add(`${cell.col},${cell.row}`);
  }
  const free = cellsOf(item, col, row).every((cell) =>
    inBag(bag, cell.col, cell.row) && !taken.has(`${cell.col},${cell.row}`)
  );
  return free && (bag !== "body" || !handProblem(item, col, row));
}

// Why a piece of gear can't go on the body at (col, row), in words; null if it can.
// It must stay inside the body, keep off your hands and other gear, and cover at least one
// connection point for its kind.
function gearProblem(piece, col, row) {
  const cells = cellsOf(piece, col, row);
  const inside = cells.every((cell) => cell.col >= 0 && cell.col < BODY_COLS && cell.row >= 0 && cell.row < BODY_ROWS);
  if (!inside) return `The ${piece.name} has to stay on your body.`;
  if (cells.some((cell) => HAND_CELLS.has(`${cell.col},${cell.row}`))) return `Gear can't go over your hands.`;
  const keys = new Set(cells.map((cell) => `${cell.col},${cell.row}`));
  const other = gearPieces.find((other) => other !== piece &&
    cellsOf(other, other.col, other.row).some((cell) => keys.has(`${cell.col},${cell.row}`)));
  if (other) return `The ${piece.name} can't go over the ${other.name}.`;
  const points = CONNECTION_POINTS[piece.kind];
  if (!cells.some((cell) => points.has(`${cell.col},${cell.row}`))) {
    return `Put the ${piece.name} on at least one of the lit-up ${piece.kind.toLowerCase()} squares.`;
  }
  return null;
}

// Why a piece of gear you wear can't be taken off (moved or sold) now; null if it can.
// Not while an item sits on any of its squares.
function gearInUse(piece) {
  const keys = new Set(cellsOf(piece, piece.col, piece.row).map((cell) => `${cell.col},${cell.row}`));
  const onIt = itemsIn("body").find((item) =>
    cellsOf(item, item.col, item.row).some((cell) => keys.has(`${cell.col},${cell.row}`)));
  return onIt ? `Take the ${onIt.name} off the ${piece.name} first.` : null;
}

// True if a placed item covers at least one of your hand squares.
function inHands(item, col, row) {
  return cellsOf(item, col, row).some((cell) => HAND_CELLS.has(`${cell.col},${cell.row}`));
}

// The weapons you hold (not counting holstered ones).
function weaponsInHands() {
  return itemsIn("body").filter((item) => isWeapon(item) && !item.holstered);
}

// Where everything on the body would be if `item` went to (col, row) there and everything
// else stayed: a list of { item, col, row }, with the moved item first.
function layoutWith(item, col, row) {
  const others = itemsIn("body").filter((other) => other !== item)
    .map((other) => ({ item: other, col: other.col, row: other.row }));
  return [{ item, col, row }, ...others];
}

// True if a placed weapon sits right on top of a holster (one of its cells just above a holster cell).
function isHolstered(placed, layout) {
  const holsterCells = new Set();
  for (const spot of layout) {
    if (!spot.item.holster) continue;
    for (const cell of cellsOf(spot.item, spot.col, spot.row)) holsterCells.add(`${cell.col},${cell.row}`);
  }
  return cellsOf(placed.item, placed.col, placed.row).some((cell) => holsterCells.has(`${cell.col},${cell.row + 1}`));
}

// Why `item` can't go at (col, row) on the body because of the hand rule, in words; null if it can.
// Every weapon you wear that isn't holstered must cover at least one hand square.
// Moving a holster counts too: it mustn't leave a weapon out of your hands.
function handProblem(item, col, row) {
  if (!isWeapon(item) && !item.holster) return null;
  const layout = layoutWith(item, col, row);
  for (const spot of layout) {
    if (!isWeapon(spot.item) || isHolstered(spot, layout) || inHands(spot.item, spot.col, spot.row)) continue;
    return spot.item === item
      ? `A weapon you wear goes in your hands: let the ${spot.item.name} cover at least one hand square (or hang it on a holster).`
      : `Moving the ${item.name} would leave the ${spot.item.name} out of your hands.`;
  }
  return null;
}

// The first free spot (top-left first) in this grid where the item (or gear) fits, or null.
function findFreeSpot(item, bag) {
  const { width, height } = bagSize(bag);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (fits(item, bag, col, row)) return { col, row };
    }
  }
  return null;
}

// Fill a box with one block per filled cell of the shape. Each block only gets
// an outline and round corners on the sides with no neighbouring block,
// so the whole shape reads as one piece.
function drawShape(box, shape) {
  box.style.gridTemplateColumns = `repeat(${shape[0].length}, 1fr)`;
  box.style.gridTemplateRows = `repeat(${shape.length}, 1fr)`;
  const filled = (r, c) => shape[r] !== undefined && shape[r][c] === "X";
  shape.forEach((line, r) => {
    [...line].forEach((mark, c) => {
      if (mark !== "X") return;
      const up = filled(r - 1, c), down = filled(r + 1, c);
      const left = filled(r, c - 1), right = filled(r, c + 1);
      const block = document.createElement("div");
      block.className = "block";
      block.style.gridRow = r + 1;
      block.style.gridColumn = c + 1;
      // Which row it is, of how many: so in a fight, the colour can fill the whole shape from the bottom.
      block.style.setProperty("--r", r);
      block.style.setProperty("--rows", shape.length);
      if (up) block.style.borderTopWidth = "0";
      if (right) block.style.borderRightWidth = "0";
      if (down) block.style.borderBottomWidth = "0";
      if (left) block.style.borderLeftWidth = "0";
      const round = (a, b) => (!a && !b ? "8px" : "0");
      block.style.borderRadius = `${round(up, left)} ${round(up, right)} ${round(down, right)} ${round(down, left)}`;
      box.appendChild(block);
    });
  });
}

// The ghost: an outline of the dragged item's shape where it would land (in either grid).
const ghost = document.createElement("div");
ghost.className = "ghost";
ghost.hidden = true;

// Draw a grid. On the body: your hand squares, the gear you wear (under the items), a square
// on top of every gear square (so items can sit there), and the connection points (which
// light up while you drag a piece of gear of their kind). Then the items.
// Each square gets a fixed spot, so items can sit on top of squares.
function buildBag(bag) {
  const el = bags[bag];
  const { width, height } = bagSize(bag);
  el.innerHTML = "";
  // Every row and column is exactly one cell, so items can't stretch them.
  el.style.gridTemplateColumns = `repeat(${width}, ${CELL}px)`;
  el.style.gridTemplateRows = `repeat(${height}, ${CELL}px)`;
  const square = (className, col, row) => {
    const cell = document.createElement("div");
    cell.className = className;
    cell.dataset.row = row;
    cell.dataset.col = col;
    cell.style.gridRow = row + 1;
    cell.style.gridColumn = col + 1;
    el.appendChild(cell);
    return cell;
  };
  if (bag === "body") {
    for (const piece of gearPieces) {
      el.appendChild(piece.el);
      placeItem(piece);
    }
    // One box per connection square, with a class for each kind it takes, tinted in the colours
    // of those kinds (--tint-a and --tint-b; the same one twice if it takes one kind).
    // None under gear you wear.
    const worn = new Set(gearPieces.flatMap((piece) =>
      cellsOf(piece, piece.col, piece.row).map((cell) => `${cell.col},${cell.row}`)));
    const kindsAt = {};
    for (const [kind, keys] of Object.entries(CONNECTION_POINTS)) {
      for (const key of keys) (kindsAt[key] ||= []).push(kind);
    }
    for (const [key, kinds] of Object.entries(kindsAt)) {
      if (worn.has(key)) continue;
      const [col, row] = key.split(",").map(Number);
      const point = square(`point ${kinds.map((kind) => `point-${kind.toLowerCase()}`).join(" ")}`, col, row);
      point.style.setProperty("--tint-a", GEAR_COLORS[kinds[0]]);
      point.style.setProperty("--tint-b", GEAR_COLORS[kinds[kinds.length - 1]]);
    }
  }
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!inBag(bag, col, row)) continue;
      const hand = bag === "body" && HAND_CELLS.has(`${col},${row}`);
      square(hand ? "cell hand" : bag === "body" ? "cell on-gear" : "cell", col, row);
    }
  }
  for (const item of itemsIn(bag)) {
    el.appendChild(item.el);
    placeItem(item);
  }
}

// Where cell (0, 0) of a grid is on the page, in pixels (even when that cell isn't drawn).
function gridOrigin(bag) {
  const cell = bags[bag].querySelector(".cell");
  const box = cell.getBoundingClientRect();
  return { left: box.left - cell.dataset.col * STEP, top: box.top - cell.dataset.row * STEP };
}

// Show the ghost in a grid at (col, row): green if the item fits there, red if not.
// Hidden when the shape would stick out of the grid's outline.
function showGhost(item, bag, col, row) {
  const { width, height } = bagSize(bag);
  const inside = col >= 0 && row >= 0 && col + item.width <= width && row + item.height <= height;
  ghost.hidden = !inside;
  if (!inside) return;
  if (ghost.parentElement !== bags[bag]) bags[bag].appendChild(ghost);
  ghost.innerHTML = "";
  drawShape(ghost, item.shape);
  placeBox(ghost, item, col, row);
  ghost.classList.toggle("blocked", !fits(item, bag, col, row));
}

// Turn a shape a quarter turn clockwise: its columns, read bottom to top, become its rows.
function rotateShape(shape) {
  const turned = [];
  for (let c = 0; c < shape[0].length; c++) {
    let line = "";
    for (let r = shape.length - 1; r >= 0; r--) line += shape[r][c];
    turned.push(line);
  }
  return turned;
}

// The picture file for an item, piece of gear or sack (made by the tools), e.g. "art/frying-pan.png"
// or "art/gear/tool-belt.png".
function pictureFile(thing) {
  const folder = thing.folder ? `${thing.folder}/` : "";
  return `art/${folder}${thing.name.toLowerCase().replaceAll(" ", "-")}.png`;
}

const missingPictures = new Set(); // things with no picture file: they use their emoji

// A picture, sizePx wide and tall, turned `turns` quarter turns clockwise.
// If its file is missing, its emoji (emojiPx big) takes its place.
function makePicture(thing, sizePx, emojiPx, turns = 0) {
  const emoji = document.createElement("span");
  emoji.className = "icon";
  emoji.style.fontSize = `${emojiPx}px`;
  emoji.textContent = thing.icon;
  if (missingPictures.has(thing.name)) return emoji;
  const picture = document.createElement("img");
  picture.className = "picture";
  picture.src = pictureFile(thing);
  picture.alt = thing.name;
  picture.draggable = false; // otherwise the browser's own image dragging gets in the way of ours
  picture.style.width = picture.style.height = `${sizePx}px`;
  picture.style.transform = `rotate(${turns * 90}deg)`;
  picture.addEventListener("error", () => {
    missingPictures.add(thing.name);
    picture.replaceWith(emoji);
  });
  return picture;
}

// Give an item (or piece of gear) a (new) shape: update its size and redraw its blocks and
// picture. The picture is square and as wide as the shape's long side, so a long item's
// drawing (a sword standing up, a plank lying down) fills it; the empty sides of the square are
// cut off. The emoji (when there's no picture) is as big as the shape allows: as wide as its narrow
// side, or a bit smaller for shapes with empty corners, so it stays on the filled cells.
// Gear has no picture (just its colour), so the items on it stay easy to see.
function setShape(item, shape) {
  item.shape = shape;
  item.width = shape[0].length;
  item.height = shape.length;
  item.el.innerHTML = "";
  drawShape(item.el, shape);
  const filled = shape.join("").split("X").length - 1;
  const hasGaps = filled < item.width * item.height;
  const emojiPx = hasGaps ? Math.sqrt(filled) * 33 : Math.min(item.width, item.height) * 44;
  const picturePx = Math.max(item.width, item.height) * STEP - 8;
  const label = document.createElement("div");
  label.className = "label";
  if (!item.isGear) label.appendChild(makePicture(item, picturePx, emojiPx, item.turns));
  item.el.appendChild(label);
}

// Seconds between actions, after speed bonuses, rounded to one decimal.
function seconds(item) {
  return Math.round((item.every / (item.speed || 1)) * 10) / 10;
}

// How much exhaustion one hit of this weapon causes, after gloves and extinguishers.
function exhaustPerHit(item) {
  return Math.max(0, item.exhaust - (item.exhaustCut || 0));
}

// What an item (or piece of gear) does, in words, one line each, with bonuses in green.
// Works for things you have (with their bonuses) and for types in the shop.
function describe(item) {
  if (item.isGear) {
    const lines = [`${item.kind}: adds ${cellsOf(item, 0, 0).length} squares to your body`,
      `<span class="gives">put it on a ${item.kind.toLowerCase()} connection point next to your hands</span>`];
    if (item.bag === "carry") lines.unshift(`<span class="gives">in the carry sack: not worn</span>`);
    return lines;
  }
  const lines = [];
  if (item.bag === "carry") lines.push(`<span class="gives">in the carry sack: doesn't fight</span>`);
  if (item.effect) {
    const bonus = item.bonus ? `<b class="bonus">+${item.bonus}</b>` : "";
    const time = (item.speed || 1) > 1 ? `<b class="bonus">${seconds(item)}</b>` : seconds(item);
    lines.push(`${item.amount}${bonus} ${item.effect} every ${time}s`);
  }
  if (isWeapon(item)) {
    const tire = exhaustPerHit(item);
    const tireText = tire < item.exhaust ? `<b class="bonus">${tire}</b>` : tire;
    const rage = item.rageBonus ? `${item.rage}<b class="bonus">+${item.rageBonus}</b>` : item.rage;
    lines.push(`+${rage} rage, +${tireText} exhaustion per hit`);
  }
  if (item.recovery) lines.push(`exhaustion drops ${item.recovery}/s faster`);
  if (item.rageGain) lines.push(`+${item.rageGain} rage per second`);
  if (item.gives) lines.push(`<span class="gives">${givesText(item.gives)}</span>`);
  if (item.holster) lines.push(`<span class="gives">a weapon right on top of it doesn't need your hands</span>`);
  if (item.holstered) lines.push(`<span class="gives">holstered: doesn't need your hands</span>`);
  return lines;
}

// The rarity tag, e.g. a purple "Epic". (Gear has none.)
function rarityTag(type) {
  if (type.isGear) return "";
  const rarity = RARITIES[type.rarity];
  return `<span class="rarity" style="color: ${rarity.color}">${rarity.label}</span>`;
}

// The info card that shows while the pointer is over an item: its name and what it does.
const tooltip = document.getElementById("tooltip");

// Show the info card for an item (or a type in the shop) beside the element `el` on the page.
function showTooltip(item, el = item.el) {
  if (drag) return;
  tooltip.innerHTML = `<b>${item.icon} ${item.name}</b> ${rarityTag(item)}<br>${describe(item).join("<br>")}`;
  tooltip.hidden = false;
  // Beside it: on its right, or on its left if there's no room on the right.
  const box = el.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const left = box.right + 8 + tip.width < window.innerWidth ? box.right + 8 : box.left - 8 - tip.width;
  tooltip.style.left = `${Math.max(4, left)}px`;
  tooltip.style.top = `${box.top}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

// Make a new item (or piece of gear) of this type, in grid `bag` with its top-left at (col, row),
// that can be dragged. It isn't in that grid yet (see addItem / putGear). bonus, speed, exhaustCut
// and rageBonus come from the items near it (see updateBonuses).
function makeItem(type, bag, col, row) {
  // turns = how many quarter turns it's been rotated (so its picture turns too).
  const item = { ...type, bag, col, row, turns: 0, timer: 0, bonus: 0, speed: 1, exhaustCut: 0, rageBonus: 0, holstered: false };
  item.el = document.createElement("div");
  item.el.className = item.isGear ? `item gear gear-${item.kind.toLowerCase()}` : `item ${item.rarity}`;
  item.el.style.setProperty("--color", item.color);
  setShape(item, item.shape);
  item.el.addEventListener("pointerdown", (event) => startDrag(item, event));
  item.el.addEventListener("pointerenter", () => showTooltip(item));
  item.el.addEventListener("pointerleave", hideTooltip);
  return item;
}

// Put an item into its grid at its col and row.
function putItem(item) {
  items.push(item);
  bags[item.bag].appendChild(item.el);
  placeItem(item);
  updateBonuses();
}

// Put a new item of this type into a grid at (col, row).
function addItem(type, bag, col, row) {
  const item = makeItem(type, bag, col, row);
  putItem(item);
  return item;
}

// Put on a piece of gear at its col and row: its squares are added to your body.
function putGear(piece) {
  gearPieces.push(piece);
  updateBodyCells();
  buildBag("body");
  updateBonuses();
}

// Take off a piece of gear (to sell it), or take it out of the carry sack.
function removeGear(piece) {
  if (piece.bag === "carry") items.splice(items.indexOf(piece), 1);
  else gearPieces.splice(gearPieces.indexOf(piece), 1);
  piece.el.remove();
  updateBodyCells();
  buildBag("body");
  updateBonuses();
}

// Switch to another carry sack. Items in it stay where they are if they fit there;
// the others go to the first free spot. Items with no room left are sold
// (for their full price). Returns those items.
function switchSack(sack) {
  const carried = itemsIn("carry");
  for (const item of carried) items.splice(items.indexOf(item), 1); // take them out
  pack = sack;
  buildBag("carry");
  const moved = [];
  for (const item of carried) {
    if (fits(item, "carry", item.col, item.row)) items.push(item);
    else moved.push(item);
  }
  const lost = [];
  for (const item of moved) {
    const spot = findFreeSpot(item, "carry");
    if (!spot) {
      lost.push(item);
      continue;
    }
    item.col = spot.col;
    item.row = spot.row;
    items.push(item);
  }
  for (const item of itemsIn("carry")) {
    bags.carry.appendChild(item.el);
    placeItem(item);
  }
  for (const item of lost) gold += sellPrice(item);
  updateBonuses();
  return lost;
}

// ---------------------------------------------------------------------------
// Bonuses from neighbours, the hands, and your totals. Only what you wear counts.

// True if item a, with its top-left at (col, row), shares a side with item b.
function touches(a, col, row, b) {
  const bCells = new Set(cellsOf(b, b.col, b.row).map((cell) => `${cell.col},${cell.row}`));
  return cellsOf(a, col, row).some((cell) =>
    bCells.has(`${cell.col + 1},${cell.row}`) || bCells.has(`${cell.col - 1},${cell.row}`) ||
    bCells.has(`${cell.col},${cell.row + 1}`) || bCells.has(`${cell.col},${cell.row - 1}`)
  );
}

// True if item a at (aCol, aRow) and item b at (bCol, bRow) are close enough for a boost
// with this reach: touching, sharing a row, or sharing a column. (It works both ways round.)
function near(reach, a, aCol, aRow, b, bCol, bRow) {
  if (reach === "row" || reach === "column") {
    const key = reach === "row" ? "row" : "col";
    const lines = new Set(cellsOf(a, aCol, aRow).map((cell) => cell[key]));
    return cellsOf(b, bCol, bRow).some((cell) => lines.has(cell[key]));
  }
  return touches(a, aCol, aRow, Object.assign({}, b, { col: bCol, row: bRow }));
}

// True if item a's boost works on item b at all (wherever they are):
// damage, calm and rage on weapons, heal on healing items, block on blocking items,
// speed on anything that acts on a timer.
function gives(a, b) {
  if (!a.gives) return false;
  const boost = boostOf(a.gives);
  if (boost === "speed") return Boolean(b.effect);
  if (boost === "heal" || boost === "block") return b.effect === boost;
  return isWeapon(b);
}

// True if `giver` at (gCol, gRow) boosts `target` at (tCol, tRow).
function boosts(giver, gCol, gRow, target, tCol, tRow) {
  return gives(giver, target) && near(giver.gives.reach, giver, gCol, gRow, target, tCol, tRow);
}

// Work out every worn item's bonuses from the worn items that reach it and whether it's holstered,
// show which weapons are in your hands, and update your totals. Items in the carry sack get none.
// bonus = extra damage, heal or block; speed = timer speed (1 = normal);
// exhaustCut = less exhaustion per hit; rageBonus = more rage per hit.
function updateBonuses() {
  const worn = itemsIn("body");
  const layout = worn.map((item) => ({ item, col: item.col, row: item.row }));
  for (const item of items) {
    item.bonus = 0;
    item.speed = 1;
    item.exhaustCut = 0;
    item.rageBonus = 0;
    item.holstered = false;
  }
  for (const spot of layout) {
    const item = spot.item;
    item.holstered = isWeapon(item) && isHolstered(spot, layout);
    for (const other of worn) {
      if (other === item || !boosts(other, other.col, other.row, item, item.col, item.row)) continue;
      const g = other.gives;
      item.bonus += g.damage || g.heal || g.block || 0;
      item.speed += g.speed || 0;
      item.exhaustCut += g.calm || 0;
      item.rageBonus += g.rage || 0;
    }
  }
  for (const item of items) item.el.classList.toggle("holstered", item.holstered);
  const held = weaponsInHands().map((item) => `${item.icon} ${item.name}`);
  document.getElementById("hands").textContent = `In your hands: ${held.join(", ") || "nothing"}`;
  showTotals();
}

// How much damage, block and heal all your worn items make together per second
// (damage per second = DPS), bonuses included but not rage. Also how much
// exhaustion your weapons cause per second (tiring) and how fast it drops (recovery).
function perSecond() {
  const totals = { damage: 0, block: 0, heal: 0, tiring: 0, recovery: recoveryPerSecond() };
  for (const item of itemsIn("body")) {
    if (!item.effect) continue;
    const timesPerSecond = item.speed / item.every;
    totals[item.effect] += hitAmount(item, 1) * timesPerSecond;
    if (isWeapon(item)) totals.tiring += exhaustPerHit(item) * timesPerSecond;
  }
  return totals;
}

// How much exhaustion drops per second: the base amount plus what worn items add.
function recoveryPerSecond() {
  return BASE_RECOVERY + itemsIn("body").reduce((sum, item) => sum + (item.recovery || 0), 0);
}

// How much rage you get per second without hitting anything (from worn items).
function rageGainPerSecond() {
  return itemsIn("body").reduce((sum, item) => sum + (item.rageGain || 0), 0);
}

// How much an item does when it acts: its amount plus bonuses, and for a weapon
// also times the rage multiplier.
function hitAmount(item, rageMultiplier) {
  if (!isWeapon(item)) return item.amount + item.bonus;
  return Math.round((item.amount + item.bonus) * rageMultiplier);
}

// A rough strength score, for comparing you with an enemy: all the stats added up,
// with each "per second" number counted 10 times (about what it adds over a fight).
// Power = health + 10 x (DPS + block/s + heal/s).
function playerPower() {
  const totals = perSecond();
  return Math.round(PLAYER_HEALTH + 10 * (totals.damage + totals.block + totals.heal));
}

// The list on the left: your gold, health, per-second numbers and power.
function showTotals() {
  const totals = perSecond();
  const show = (n) => n.toFixed(1);
  const line = (tip, label, value) => `<li title="${tip}"><span>${label}</span><b>${value}</b></li>`;
  document.getElementById("totals").innerHTML = [
    line("Gold to spend in the shop", "💰 Gold", gold),
    line("Your health at the start of a fight", "❤️ Health", PLAYER_HEALTH),
    line("Damage per second from all weapons you wear, without rage", "⚔️ Damage/s", show(totals.damage)),
    line("Block per second", "🛡️ Block/s", show(totals.block)),
    line("Healing per second", "🌿 Heal/s", show(totals.heal)),
    line("Exhaustion your weapons cause per second", "😓 Tiring/s", show(totals.tiring)),
    line("Exhaustion that drops by itself per second", "😮‍💨 Recovery/s", show(totals.recovery)),
    line("Health + 10 x (damage + block + heal per second)", "💪 Power", playerPower()),
  ].join("");
}

// A boost in a few words, for the badges while dragging, e.g. "+1 dmg" or "+15% speed".
function boostBadge(gives) {
  const boost = boostOf(gives);
  const n = gives[boost];
  return {
    damage: `+${n} dmg`, heal: `+${n} heal`, block: `+${n} block`,
    speed: `+${Math.round(n * 100)}% speed`, calm: `-${n} tired`, rage: `+${n} rage`,
  }[boost];
}

// Put a small badge on top of an item (texts side by side), or take it away when there are none.
function setBadge(item, texts) {
  let badge = item.el.querySelector(".badge");
  if (texts.length === 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "badge";
    item.el.appendChild(badge);
  }
  badge.textContent = texts.join("  ");
}

// While dragging, if the dragged item landed at (col, row) on the body:
// worn items it would boost, or that would boost it, glow gold and get a badge saying what they'd get
// (the dragged item's badge says what it would get). The same goes for weapons a holster would hold.
function showLinks(item, col, row, landsHere) {
  const layout = landsHere ? layoutWith(item, col, row) : null;
  const received = [];
  for (const other of itemsIn("body")) {
    if (other === item) continue;
    const texts = [];
    if (landsHere) {
      if (boosts(item, col, row, other, other.col, other.row)) texts.push(boostBadge(item.gives));
      if (boosts(other, other.col, other.row, item, col, row)) received.push(boostBadge(other.gives));
      const nowHeld = isWeapon(other) && !other.holstered &&
        isHolstered({ item: other, col: other.col, row: other.row }, layout);
      if (item.holster && nowHeld) texts.push("holstered");
    }
    const linked = texts.length > 0 ||
      (landsHere && boosts(other, other.col, other.row, item, col, row));
    other.el.classList.toggle("linked", linked);
    setBadge(other, texts);
  }
  if (landsHere && isWeapon(item) && isHolstered({ item, col, row }, layout)) received.push("holstered");
  setBadge(item, received);
}

// The body cells an item at (col, row) would reach with its boost: the cells touching it,
// its rows or its columns; for a holster, the cells just above it.
function reachCells(item, col, row) {
  const keys = new Set();
  if (!item.gives && !item.holster) return keys;
  const own = cellsOf(item, col, row);
  const ownKeys = new Set(own.map((cell) => `${cell.col},${cell.row}`));
  const reach = item.holster ? "above" : item.gives.reach || "touch";
  for (const cell of bags.body.querySelectorAll(".cell:not(.locked)")) {
    const c = Number(cell.dataset.col), r = Number(cell.dataset.row);
    const key = `${c},${r}`;
    if (ownKeys.has(key)) continue;
    const reached = own.some((o) => {
      if (reach === "row") return o.row === r;
      if (reach === "column") return o.col === c;
      if (reach === "above") return o.col === c && o.row - 1 === r;
      return Math.abs(o.col - c) + Math.abs(o.row - r) === 1; // touching
    });
    if (reached) keys.add(key);
  }
  return keys;
}

// While dragging: tint the body cells the dragged item would reach (or none, when show is false).
function showReach(item, col, row, show) {
  const keys = show ? reachCells(item, col, row) : new Set();
  for (const cell of bags.body.querySelectorAll(".cell")) {
    cell.classList.toggle("reach", keys.has(`${cell.dataset.col},${cell.dataset.row}`));
  }
}

// ---------------------------------------------------------------------------
// Dragging. Only one item (or piece of gear) is dragged at a time, so it lives in `drag`:
// the item, where in it it was grabbed (dx, dy, in pixels), the last pointer
// position (x, y), the grid it's over (bag: "carry", "body" or null) and the cell its
// top-left would land on there (col, row), whether it is over the Sell spot, its shape
// before dragging (to undo a rotation), and whether it comes from the shop (fromShop),
// with which offer (shopIndex; null for gear and for things you already have).

let drag = null;
const sellSpot = document.getElementById("sell");
const packHint = document.getElementById("pack-hint"); // the line under the sacks
const SELL_IDLE_TEXT = "💰 Sell: drop an item or gear here";

// For now you get back the full price, so you can try things out freely.
function sellPrice(item) {
  return item.cost;
}

// Pick up an item or piece of gear. grab = where in it the pointer holds it (in pixels);
// left out, it's where the pointer is on it.
function startDrag(item, event, fromShop = false, shopIndex = null, grab = null) {
  if (fighting || drag) return; // things stay put during a fight
  if (event.button !== 0) return; // left button picks up; right button rotates (see below)
  if (item.isGear && !fromShop && item.bag === "body" && gearInUse(item)) {
    packHint.textContent = gearInUse(item);
    return;
  }
  hideTooltip();
  const box = item.el.getBoundingClientRect();
  drag = {
    item,
    dx: grab ? grab.dx : event.clientX - box.left,
    dy: grab ? grab.dy : event.clientY - box.top,
    x: event.clientX,
    y: event.clientY,
    bag: null,
    bagBefore: item.bag, // where it was ("carry" or "body")
    col: item.col,
    row: item.row,
    overSell: false,
    rightDown: false,
    shapeBefore: item.shape,
    turnsBefore: item.turns,
    fromShop,
    shopIndex,
  };
  event.target.setPointerCapture(event.pointerId);
  // Lift it out of the grid so it can follow the pointer anywhere.
  item.el.style.position = "fixed";
  item.el.classList.add("dragging");
  sizeFloating(item);
  // While holding gear, its connection points on the body light up.
  if (item.isGear) bags.body.dataset.gear = item.kind;
  if (!fromShop) sellSpot.textContent = `💰 Sell ${item.name} for ${sellPrice(item)} gold`;
  moveDrag(event.clientX, event.clientY);
}

// While floating, the box size in pixels comes from the shape.
function sizeFloating(item) {
  item.el.style.width = `${item.width * STEP - 4}px`;
  item.el.style.height = `${item.height * STEP - 4}px`;
}

// The grid the pointer is over ("carry" or "body"), or null.
function bagUnder(x, y) {
  return Object.keys(bags).find((bag) => {
    const box = bags[bag].getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }) || null;
}

// Nothing to show while it isn't over a grid.
function clearDropPreview(item) {
  ghost.hidden = true;
  showLinks(item, 0, 0, false);
  showReach(item, 0, 0, false);
  packHint.textContent = "";
}

// Move the dragged thing to follow the pointer and update the ghost or the Sell spot.
function moveDrag(x, y) {
  const { item } = drag;
  drag.x = x;
  drag.y = y;
  const left = x - drag.dx;
  const top = y - drag.dy;
  item.el.style.left = `${left}px`;
  item.el.style.top = `${top}px`;
  const spot = sellSpot.getBoundingClientRect();
  // (Something from the shop isn't yours yet, so it can't be sold.)
  drag.overSell = !drag.fromShop &&
    x >= spot.left && x <= spot.right && y >= spot.top && y <= spot.bottom;
  sellSpot.classList.toggle("hover", drag.overSell);
  drag.bag = drag.overSell ? null : bagUnder(x, y);
  if (!drag.bag) return clearDropPreview(item);
  // The nearest cell to the top-left corner, in the grid under the pointer.
  const origin = gridOrigin(drag.bag);
  drag.col = Math.round((left - origin.left) / STEP);
  drag.row = Math.round((top - origin.top) / STEP);
  showGhost(item, drag.bag, drag.col, drag.row);
  if (item.isGear) {
    const onBody = drag.bag === "body" && !ghost.hidden;
    packHint.textContent = onBody ? gearProblem(item, drag.col, drag.row) || "" : "";
    return;
  }
  // Boosts and the hand rule only matter on the body.
  const onBody = drag.bag === "body" && !ghost.hidden;
  showLinks(item, drag.col, drag.row, onBody && fits(item, "body", drag.col, drag.row));
  showReach(item, drag.col, drag.row, onBody);
  // Say why a weapon can't go here.
  packHint.textContent = onBody ? handProblem(item, drag.col, drag.row) || "" : "";
}

// Turn the dragged thing a quarter turn clockwise, around the pointer.
function rotateDrag() {
  const { item } = drag;
  const heightPx = item.height * STEP - 4;
  item.turns = (item.turns + 1) % 4;
  setShape(item, rotateShape(item.shape));
  // The grab point turns with it, so it stays under the pointer.
  [drag.dx, drag.dy] = [heightPx - drag.dy, drag.dx];
  sizeFloating(item);
  moveDrag(drag.x, drag.y);
}

// Let go: sell it on the Sell spot, drop it on a green ghost (in either grid), or put it back as it was.
// Something from the shop is bought when it lands on a green ghost, and goes back to the shop otherwise.
function endDrag(dropped) {
  if (!drag) return;
  const { item, fromShop, shopIndex, bag, bagBefore } = drag;
  const sold = dropped && drag.overSell;
  const landed = dropped && !sold && bag && !ghost.hidden && fits(item, bag, drag.col, drag.row);
  if (landed) {
    item.bag = bag;
    item.col = drag.col;
    item.row = drag.row;
    bags[bag].appendChild(item.el);
  } else if (!sold && item.shape !== drag.shapeBefore) {
    item.turns = drag.turnsBefore; // undo any rotation
    setShape(item, drag.shapeBefore);
  }
  drag = null;
  delete bags.body.dataset.gear;
  Object.assign(item.el.style, { position: "", left: "", top: "", width: "", height: "" });
  item.el.classList.remove("dragging");
  clearDropPreview(item);
  sellSpot.classList.remove("hover");
  sellSpot.textContent = SELL_IDLE_TEXT;
  if (item.isGear) return endGearDrag(item, fromShop, landed, sold, bagBefore);
  if (fromShop) {
    if (landed) buyInto(shopIndex, item);
    else item.el.remove();
  } else if (sold) sellItem(item);
  else placeItem(item);
  updateBonuses();
}

// The end of dragging a piece of gear: buy it, move it (on the body, in the carry sack, or
// from one to the other), sell it, or put it back. bagBefore = where it was.
function endGearDrag(piece, fromShop, landed, sold, bagBefore) {
  if (fromShop) {
    if (landed) buyGear(piece);
    else piece.el.remove();
    return;
  }
  if (sold) return sellGear(piece);
  if (!landed) return placeItem(piece);
  // Worn gear is in gearPieces, stored gear in items: move it to the right list.
  if (bagBefore === "body") gearPieces.splice(gearPieces.indexOf(piece), 1);
  else items.splice(items.indexOf(piece), 1);
  if (piece.bag === "body") gearPieces.push(piece);
  else items.push(piece);
  placeItem(piece);
  updateBodyCells();
  buildBag("body");
  updateBonuses();
}

// The pointer is captured by the dragged thing, so these events reach the page from there.
document.addEventListener("pointermove", (event) => {
  if (!drag) return;
  // Pressing the right button while holding the left one shows up here, as a change in `buttons`.
  const rightDown = (event.buttons & 2) !== 0;
  if (rightDown && !drag.rightDown) rotateDrag();
  drag.rightDown = rightDown;
  moveDrag(event.clientX, event.clientY);
});
document.addEventListener("pointerup", () => endDrag(true));
document.addEventListener("pointercancel", () => endDrag(false));

// R also rotates (handy on a touchpad).
document.addEventListener("keydown", (event) => {
  if (drag && (event.key === "r" || event.key === "R")) rotateDrag();
});

// No right-click menu over the sacks or while dragging, so right click can rotate.
document.addEventListener("contextmenu", (event) => {
  if (drag || bags.carry.contains(event.target) || bags.body.contains(event.target)) event.preventDefault();
});

// ---------------------------------------------------------------------------
// The shop: three sets of shelves, all on show at once.
// Items: 5 random item types; drag one onto either sack to buy it, or click its price tag to put it
// in the first free spot (carry sack first). New offers after every fight, or any time with Reroll.
// Gear: every vest, belt and pair of trousers, always in stock; drag one onto your body to buy it
// and put it on (or click its tag). Sacks: every carry sack; click a tag to switch to it.

const OFFER_COUNT = 5;
const REROLL_COST = 1;

let gold = 10;
let offers = []; // the item types for sale right now; null where one was bought

const shopMessage = document.getElementById("shop-message");
const rerollButton = document.getElementById("reroll");
rerollButton.textContent = `🎲 Reroll, ${REROLL_COST}g`;
rerollButton.addEventListener("click", reroll);

// For testing: 10 free gold.
document.getElementById("free-gold").addEventListener("click", () => {
  gold += 10;
  showShop();
});

// Pick OFFER_COUNT different item types at random. Each item's chance depends on
// its rarity's weight: a common item is 6 times as likely as an epic one.
function newOffers() {
  const pool = [...ITEM_TYPES];
  offers = [];
  for (let i = 0; i < OFFER_COUNT && pool.length > 0; i++) {
    const total = pool.reduce((sum, type) => sum + RARITIES[type.rarity].weight, 0);
    let roll = Math.random() * total;
    let pick = 0;
    while (roll >= RARITIES[pool[pick].rarity].weight) {
      roll -= RARITIES[pool[pick].rarity].weight;
      pick++;
    }
    offers.push(pool.splice(pick, 1)[0]);
  }
}

// Buy with the price tag: the item goes to the first free spot in the carry sack, or else on the body.
function buy(index) {
  const type = offers[index];
  for (const bag of ["carry", "body"]) {
    const spot = findFreeSpot(type, bag);
    if (spot) return buyInto(index, makeItem(type, bag, spot.col, spot.row));
  }
  shopMessage.textContent = `No room for the ${type.name}.`;
}

// Pay for offer `index` and put its item (already given a grid, col and row) there.
function buyInto(index, item) {
  gold -= item.cost;
  putItem(item);
  offers[index] = null;
  shopMessage.textContent = `You bought the ${item.name}.`;
  showShop();
}

// Where the pointer holds something taken off a shelf: the middle of its first filled cell.
function shelfGrab(type) {
  return { dx: type.shape[0].indexOf("X") * STEP + CELL / 2, dy: CELL / 2 };
}

// Pick up offer `index` to drag it onto a sack.
function dragFromShop(index, event) {
  if (fighting || drag || event.button !== 0) return;
  if (event.target.closest("button")) return; // the price tag has its own click
  const type = offers[index];
  if (gold < type.cost) {
    shopMessage.textContent = `Not enough gold for the ${type.name}.`;
    return;
  }
  const item = makeItem(type, "carry", 0, 0);
  bags.carry.appendChild(item.el);
  startDrag(item, event, true, index, shelfGrab(type));
}

// Pick up a piece of gear from the shelf to drag it onto your body.
function dragGearFromShop(type, event) {
  if (fighting || drag || event.button !== 0) return;
  if (event.target.closest("button")) return;
  if (gold < type.cost) {
    shopMessage.textContent = `Not enough gold for the ${type.name}.`;
    return;
  }
  const piece = makeItem(type, "body", 0, 0);
  bags.body.appendChild(piece.el);
  startDrag(piece, event, true, null, shelfGrab(type));
}

// Pay for a piece of gear (already given a place on the body or in the carry sack) and put it there.
function buyGear(piece) {
  gold -= piece.cost;
  if (piece.bag === "body") {
    putGear(piece);
    shopMessage.textContent = `You put on the ${piece.name}.`;
  } else {
    putItem(piece);
    shopMessage.textContent = `You put the ${piece.name} in your carry sack.`;
  }
  showShop();
}

// Buy gear with the price tag: it goes to the first spot on your body where it fits,
// or else to the first free spot in the carry sack.
function buyGearByTag(type) {
  for (const bag of ["body", "carry"]) {
    const spot = findFreeSpot(type, bag);
    if (spot) return buyGear(makeItem(type, bag, spot.col, spot.row));
  }
  shopMessage.textContent = `No spot left for the ${type.name}.`;
}

// Take off a piece of gear and pay for it.
function sellGear(piece) {
  removeGear(piece);
  gold += sellPrice(piece);
  shopMessage.textContent = `You sold the ${piece.name} for ${sellPrice(piece)} gold.`;
  showShop();
}

// New offers for REROLL_COST gold.
function reroll() {
  gold -= REROLL_COST;
  newOffers();
  shopMessage.textContent = "New items on the shelves.";
  showShop();
}

// Take an item out of its sack and pay for it.
function sellItem(item) {
  items.splice(items.indexOf(item), 1);
  item.el.remove();
  gold += sellPrice(item);
  shopMessage.textContent = `You sold the ${item.name} for ${sellPrice(item)} gold.`;
  updateBonuses();
  showShop();
}

// Pay for a carry sack and switch to it, and say what happened to the items that didn't fit.
function buySack(sack) {
  gold -= sack.cost;
  const lost = switchSack(sack);
  let text = `You now carry the ${sack.name}.`;
  if (lost.length > 0) {
    const refund = lost.reduce((sum, item) => sum + sellPrice(item), 0);
    text += ` No room for the ${lost.map((item) => item.name).join(", ")}: sold for ${refund} gold.`;
  }
  shopMessage.textContent = text;
  showShop();
}

// A small drawing of a shape: one little square per cell, coloured where the shape covers it.
// The tooltip gives its size in words.
function miniShape(shape, color, cellPx = 12) {
  const box = document.createElement("span");
  box.className = "mini-shape";
  box.style.gridTemplateColumns = `repeat(${shape[0].length}, ${cellPx}px)`;
  box.title = `${shape[0].length} wide, ${shape.length} tall`;
  for (const line of shape) {
    for (const mark of line) {
      const cell = document.createElement("span");
      cell.style.width = cell.style.height = `${cellPx}px`;
      if (mark === "X") cell.style.background = color;
      box.appendChild(cell);
    }
  }
  return box;
}

// Show your gold and all the shelves.
function showShop() {
  hideTooltip(); // its item may be about to be redrawn (or gone), so the pointer can't "leave" it
  document.getElementById("gold").textContent = `💰 ${gold} gold`;
  rerollButton.disabled = fighting || gold < REROLL_COST;
  showOffers();
  showGearShelf();
  showSacks();
  showTotals(); // the gold in the list on the left
}

const SHELF_CELL = 22; // one square of an item's shape on the shelf, in pixels

// An item's (or piece of gear's) shape drawn small, one square per cell, with its picture on top,
// sized as in the sacks (as wide as the shape's long side). So you can see how big it is.
function shapePicture(type) {
  const box = document.createElement("div");
  box.className = "shelf-picture";
  box.appendChild(miniShape(type.shape, type.color, SHELF_CELL));
  const sizePx = Math.max(type.width, type.height) * (SHELF_CELL + 2) - 4;
  box.appendChild(makePicture(type, sizePx, sizePx * 0.6));
  return box;
}

// One thing on a shelf: its picture (an element), name, an optional note, and a price tag
// (or `owned` text). Clicking the tag calls onBuy; pressing on the rest calls onPress (to drag it), if given.
function shelfItem(thing, picture, note, owned, onBuy, onPress) {
  const spot = document.createElement("div");
  spot.className = `shelf-item ${thing.rarity || ""}`;
  spot.appendChild(picture);
  spot.insertAdjacentHTML("beforeend", `<span class="shelf-name">${thing.name}</span>`);
  if (note) spot.appendChild(note);
  const tag = document.createElement("button");
  tag.className = "price-tag";
  if (owned) {
    tag.textContent = owned;
    tag.disabled = true;
  } else {
    tag.textContent = `${thing.cost}g`;
    tag.title = `Buy the ${thing.name} for ${thing.cost} gold`;
    tag.disabled = fighting || gold < thing.cost;
    tag.addEventListener("click", onBuy);
  }
  spot.appendChild(tag);
  if (onPress) spot.addEventListener("pointerdown", onPress);
  else spot.classList.add("click-only");
  if (thing.amount !== undefined || thing.isGear || thing.recovery || thing.rageGain || thing.gives || thing.holster) {
    spot.addEventListener("pointerenter", () => showTooltip(thing, spot));
    spot.addEventListener("pointerleave", hideTooltip);
  }
  return spot;
}

// Fill a shelf area with things, `perShelf` to a row.
function fillShelves(list, perShelf, spots) {
  list.innerHTML = "";
  let shelf = null;
  spots.forEach((spot, index) => {
    if (index % perShelf === 0) {
      shelf = document.createElement("div");
      shelf.className = "shelf";
      shelf.style.gridTemplateColumns = `repeat(${perShelf}, 1fr)`;
      list.appendChild(shelf);
    }
    shelf.appendChild(spot);
  });
}

// The items for sale. Hover for what it does, drag it onto a sack to buy it, or click the tag.
function showOffers() {
  const spots = offers.map((type, index) => {
    if (!type) {
      const sold = document.createElement("div");
      sold.className = "shelf-item sold";
      sold.textContent = "sold";
      return sold;
    }
    return shelfItem(type, shapePicture(type), null, null, () => buy(index), (event) => dragFromShop(index, event));
  });
  fillShelves(document.getElementById("offers"), 5, spots);
}

// The gear: always all of it. Each shows its shape; drag it onto your body to buy and put it on.
function showGearShelf() {
  const spots = GEAR.map((type) => shelfItem(type, shapePicture(type), null, null,
    () => buyGearByTag(type), (event) => dragGearFromShop(type, event)));
  fillShelves(document.getElementById("gear"), 5, spots);
}

// The carry sacks: always all of them. Click a tag to switch to that sack.
function showSacks() {
  const spots = SACKS.map((sack) => {
    const note = document.createElement("span");
    note.className = "shelf-note";
    note.textContent = `${sack.cellCount} squares`;
    return shelfItem(sack, makePicture(sack, 44, 26), note, sack === pack && "carrying", () => buySack(sack), null);
  });
  fillShelves(document.getElementById("sacks"), 5, spots);
}

// ---------------------------------------------------------------------------
// Scavenging: from the shop you go out to one of a few areas, each with its own
// enemy. Harder areas have stronger enemies and pay more gold. Every win makes
// all enemies a bit stronger.

// level is how hard the area is. Each enemy hits for `damage` once every `every` seconds.
const AREAS = [
  { name: "Backyard", icon: "🏡", level: "Easy",
    enemy: { name: "Raccoon", icon: "🦝", health: 22, damage: 3, every: 1.2 } },
  { name: "Back Alley", icon: "🏚️", level: "Medium",
    enemy: { name: "Guard Dog", icon: "🐕", health: 40, damage: 6, every: 1.5 } },
  { name: "Edge of the Woods", icon: "🌲", level: "Hard",
    enemy: { name: "Black Bear", icon: "🐻", health: 70, damage: 10, every: 2 } },
];

const GROWTH_PER_WIN = 0.2; // each win makes enemies 20% stronger
const GOLD_FOR_LOSS = 2;    // a little gold even when you lose

let wins = 0;
let round = 1; // counts every fight, won or lost

// An area's enemy as you'd meet it now: its health and damage grow with your wins.
function enemyIn(area) {
  const growth = 1 + GROWTH_PER_WIN * wins;
  const base = area.enemy;
  return {
    name: base.name,
    icon: base.icon,
    maxHealth: Math.round(base.health * growth),
    damage: Math.round(base.damage * growth),
    every: base.every,
  };
}

// The same kind of strength score as yours (see playerPower): health + 10 x DPS.
function enemyPower(foe) {
  return Math.round(foe.maxHealth + (10 * foe.damage) / foe.every);
}

// Gold for beating an enemy: stronger enemies pay more.
function winReward(foe) {
  return Math.round(enemyPower(foe) / 8);
}

// A guess at how the fight will go, from the enemy's power compared to yours.
function verdict(yours, theirs) {
  const ratio = theirs / yours;
  if (ratio < 0.6) return { text: "Easy win", color: "#7fd16a" };
  if (ratio < 0.9) return { text: "Should win", color: "#b8d86a" };
  if (ratio < 1.1) return { text: "Close fight", color: "#f3c969" };
  if (ratio < 1.4) return { text: "Risky", color: "#f39a5a" };
  return { text: "Very dangerous", color: "#ff7a6a" };
}

// The scavenge screen: one card per area, with its enemy, its power next to yours, and the rewards.
function showMap() {
  const yours = playerPower();
  document.getElementById("map-power").innerHTML =
    `Your power: <b>${yours}</b>. Power = health + 10 × (damage + block + heal per second).`;
  const list = document.getElementById("areas");
  list.innerHTML = "";
  for (const area of AREAS) {
    const foe = enemyIn(area);
    const theirs = enemyPower(foe);
    const guess = verdict(yours, theirs);
    const most = Math.max(yours, theirs); // the longer bar is full width
    const card = document.createElement("div");
    card.className = "area";
    card.innerHTML = `
      <div class="area-head">
        <span class="area-icon">${area.icon}</span>
        <span><b>${area.name}</b><br><span class="level level-${area.level.toLowerCase()}">${area.level}</span></span>
      </div>
      <div class="area-enemy">
        <span class="area-enemy-icon">${foe.icon}</span>
        <span><b>${foe.name}</b><br>${foe.maxHealth} health, hits for ${foe.damage} every ${foe.every}s</span>
      </div>
      <div class="compare">
        <span>You</span><span class="compare-bar"><span style="width: ${(100 * yours) / most}%"></span></span><b>${yours}</b>
        <span>${foe.name}</span><span class="compare-bar enemy"><span style="width: ${(100 * theirs) / most}%"></span></span><b>${theirs}</b>
      </div>
      <div class="verdict" style="color: ${guess.color}">${guess.text}</div>
      <div class="reward">Win: <b>+${winReward(foe)} gold</b> · Lose: +${GOLD_FOR_LOSS} gold</div>`;
    const button = document.createElement("button");
    button.textContent = `Go to the ${area.name}`;
    button.addEventListener("click", () => startFight(area));
    card.appendChild(button);
    list.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// The fight. It runs by itself: every tick, each item's and the enemy's timer
// goes up, and when a timer is full that one acts and starts again from zero.

const TICK_MS = 100; // one tick every 100 milliseconds = 10 ticks a second

// Block soaks up damage before health does, and is used up as it does.
// rage and exhaustion go from 0 to 100; worn = worn out (exhaustion hit 100, not yet back to 50).
// The enemy is filled in from an area when a fight starts.
const player = { maxHealth: PLAYER_HEALTH, health: PLAYER_HEALTH, block: 0, rage: 0, exhaustion: 0, worn: false };
let enemy = null;
let area = null; // where the current fight happens
let loopId = null; // lets us stop the game loop when the fight is over

const scavengeButton = document.getElementById("scavenge-button");
const fightResult = document.getElementById("fight-result");
const log = document.getElementById("log");

// Hit a fighter for some damage. Returns how much of it the block stopped.
function hit(target, damage) {
  const blocked = Math.min(target.block, damage);
  target.block -= blocked;
  target.health = Math.max(target.health - (damage - blocked), 0);
  return blocked;
}

// Add a line to the top of the fight log.
function addLog(text) {
  const line = document.createElement("li");
  line.textContent = text;
  log.prepend(line);
}

// How much rage multiplies weapon damage right now: 1x at 0 rage, up to 3x at full rage.
function rageMultiplier() {
  return 1 + ((MAX_RAGE_MULTIPLIER - 1) * player.rage) / RAGE_MAX;
}

// Show the current numbers: round, health, rage and exhaustion bars, text and how charged each item is.
function showFight() {
  document.getElementById("round").textContent = `Round ${round}: ${area.icon} ${area.name}`;
  document.getElementById("enemy-name").textContent = `${enemy.icon} ${enemy.name}`;
  document.getElementById("player-bar").style.width = `${(100 * player.health) / player.maxHealth}%`;
  document.getElementById("enemy-bar").style.width = `${(100 * enemy.health) / enemy.maxHealth}%`;
  document.getElementById("player-text").textContent =
    `${player.health} / ${player.maxHealth} health, ${player.block} block`;
  document.getElementById("enemy-text").textContent =
    `${enemy.health} / ${enemy.maxHealth} health, hits for ${enemy.damage} every ${enemy.every}s`;
  document.getElementById("rage-bar").style.width = `${(100 * player.rage) / RAGE_MAX}%`;
  document.getElementById("rage-text").textContent =
    `${Math.round(player.rage)} rage: weapons do ×${rageMultiplier().toFixed(1)} damage`;
  document.getElementById("exhaustion-bar").style.width = `${(100 * player.exhaustion) / EXHAUSTION_MAX}%`;
  document.getElementById("exhaustion-bar").classList.toggle("worn", player.worn);
  document.getElementById("exhaustion-text").textContent = player.worn
    ? `Worn out! No weapons until exhaustion is down to ${RECOVERED_AT}`
    : `${Math.round(player.exhaustion)} exhaustion`;
  showTimers();
}

// Show how close each item is to acting: in a fight, its colour fills it up from the bottom
// (--charge, 0 = empty, 1 = full; style.css draws it).
function showTimers() {
  for (const item of items) {
    if (!item.effect) continue;
    item.el.style.setProperty("--charge", Math.min(1, item.timer / (item.every * 1000)));
  }
}

// An item just acted: it grows and flashes for a moment, and what it did floats up from it.
// lines = the effects, e.g. [{ text: "💥5", kind: "damage" }], one floating line each.
function showAction(item, lines) {
  item.el.classList.remove("acting");
  void item.el.offsetWidth; // makes the browser notice the class was gone, so the animation starts again
  item.el.classList.add("acting");
  const box = item.el.getBoundingClientRect();
  lines.forEach((line, index) => {
    const number = document.createElement("div");
    number.className = `float-number ${line.kind}`;
    number.textContent = line.text;
    number.style.left = `${box.left + box.width / 2}px`;
    number.style.top = `${box.top + 4 + index * 16}px`;
    number.addEventListener("animationend", () => number.remove());
    document.body.appendChild(number);
  });
}

// Stop the fight, pay out gold, fill the shop with new offers,
// and show the button back to the shop.
function endFight(won) {
  fighting = false;
  clearInterval(loopId);
  const reward = won ? winReward(enemy) : GOLD_FOR_LOSS;
  gold += reward;
  if (won) wins++;
  round++;
  const text = won
    ? `You win! The ${enemy.name} is defeated. +${reward} gold.`
    : `You lose! The ${enemy.name} wins. +${reward} gold.`;
  fightResult.textContent = text;
  addLog(text);
  backButton.hidden = false;
  newOffers();
  shopMessage.textContent = "New items in the shop.";
  showShop();
}

// Switch to the "shop", "map" or "fight" screen (style.css hides the other screens' parts).
function showScreen(name) {
  hideTooltip();
  document.body.dataset.screen = name;
}

// Back to the shop, with the items' timers emptied.
function goToShop() {
  for (const item of items) item.timer = 0;
  showTimers();
  showScreen("shop");
}

// From the shop to the scavenge screen.
function goScavenge() {
  if (drag) return;
  packHint.textContent = "";
  showMap();
  showScreen("map");
}

// Rage and exhaustion change by themselves each tick: exhaustion drops,
// rage drops (but items can add some).
function tickRageAndExhaustion() {
  const tickSeconds = TICK_MS / 1000;
  player.exhaustion = Math.max(0, player.exhaustion - recoveryPerSecond() * tickSeconds);
  if (player.worn && player.exhaustion <= RECOVERED_AT) {
    player.worn = false;
    addLog("You caught your breath: weapons are back.");
  }
  const change = (rageGainPerSecond() - RAGE_DECAY) * tickSeconds;
  player.rage = Math.min(RAGE_MAX, Math.max(0, player.rage + change));
}

// A weapon hit: deal damage (with rage), then add rage and exhaustion.
function weaponHit(item) {
  const damage = hitAmount(item, rageMultiplier());
  hit(enemy, damage);
  addLog(`${item.name} hits the ${enemy.name} for ${damage}.`);
  player.rage = Math.min(RAGE_MAX, player.rage + item.rage + item.rageBonus);
  player.exhaustion = Math.min(EXHAUSTION_MAX, player.exhaustion + exhaustPerHit(item));
  const lines = [{ text: `💥${damage}`, kind: "damage" }];
  if (exhaustPerHit(item) > 0) lines.push({ text: `😮‍💨+${exhaustPerHit(item)}`, kind: "exhaustion" });
  showAction(item, lines);
  if (player.exhaustion >= EXHAUSTION_MAX && !player.worn) {
    player.worn = true;
    addLog("You're worn out! Your weapons wait until you catch your breath.");
  }
}

// One tick of the game loop. Returns early as soon as someone is down.
function tick() {
  tickRageAndExhaustion();
  for (const item of itemsIn("body")) { // only what you wear fights
    if (!item.effect) continue; // items that work all the time don't act on a timer
    const full = item.every * 1000;
    item.timer += TICK_MS * item.speed; // a faster item's timer fills up quicker
    if (item.timer < full) continue;
    if (isWeapon(item) && player.worn) {
      item.timer = full; // ready, but waits until you're not worn out
      continue;
    }
    item.timer -= full;
    if (isWeapon(item)) {
      weaponHit(item);
    } else if (item.effect === "block") {
      player.block += hitAmount(item, 1);
      addLog(`${item.name} gives you ${hitAmount(item, 1)} block.`);
      showAction(item, [{ text: `🛡️+${hitAmount(item, 1)}`, kind: "block" }]);
    } else if (item.effect === "heal") {
      const healed = Math.min(hitAmount(item, 1), player.maxHealth - player.health);
      player.health += healed;
      addLog(`${item.name} heals you for ${healed}.`);
      showAction(item, [{ text: `❤️+${healed}`, kind: "heal" }]);
    }
    if (enemy.health === 0) {
      showFight();
      return endFight(true);
    }
  }

  enemy.timer += TICK_MS;
  if (enemy.timer >= enemy.every * 1000) {
    enemy.timer -= enemy.every * 1000;
    const blocked = hit(player, enemy.damage);
    addLog(`The ${enemy.name} hits you for ${enemy.damage}` + (blocked ? ` (${blocked} blocked).` : "."));
    if (player.health === 0) {
      showFight();
      return endFight(false);
    }
  }

  showFight();
}

// Fight the enemy of the chosen area: switch to the fight screen, reset everyone
// and start the game loop.
function startFight(chosen) {
  area = chosen;
  enemy = { ...enemyIn(area), block: 0, timer: 0 };
  enemy.health = enemy.maxHealth;
  Object.assign(player, { health: player.maxHealth, block: 0, rage: 0, exhaustion: 0, worn: false });
  for (const item of items) item.timer = 0;
  log.innerHTML = "";
  fightResult.textContent = "";
  shopMessage.textContent = "";
  backButton.hidden = true;
  fighting = true;
  showShop(); // locks the Buy buttons
  showScreen("fight");
  addLog(`Round ${round}: a ${enemy.name} in the ${area.name}!`);
  showFight();
  loopId = setInterval(tick, TICK_MS);
}

// ---------------------------------------------------------------------------
// Start the game.

// What you start with: a Sword and a Dagger in your hands,
// and a Shield and a Boomerang in your carry sack (a pillowcase).
buildBag("carry");
buildBag("body");
addItem(itemType("Sword"), "body", 4, 3);
addItem(itemType("Dagger"), "body", 5, 3);
addItem(itemType("Shield"), "carry", 0, 0);
addItem(itemType("Boomerang"), "carry", 2, 0);

const backButton = document.getElementById("back-button");
scavengeButton.addEventListener("click", goScavenge);
backButton.addEventListener("click", goToShop);
document.getElementById("map-back").addEventListener("click", goToShop);
sellSpot.textContent = SELL_IDLE_TEXT;
newOffers();
showShop();
goToShop();
