// Cul-de-sack: the street fight (isometric suburb, houses, trash cans, minimap, pests, auto attacks, the clock,
// the forest escape, and the art catalogue: critters to pick, dog breeds, animals, neighbours, two bosses,
// pickups, effects, ground marks, parked cars, trees and yard things).
// You walk your critter around a suburb with WASD or the arrow keys.
//
// How positions work: the game thinks of the map as a flat sheet seen from straight above
// ("world" positions x and y, plus z for height). Only when drawing is that turned into the
// slanted isometric picture, in one function: project(). So rules like walking and bumping
// into houses stay simple, and the look can change without touching them.

// ---------- 1. Constants ----------
const TILE = 32;              // the ground is made of squares this many world pixels wide
const MAP_COLS = 200;         // map size in tiles
const MAP_ROWS = 140;
const MAP_W = MAP_COLS * TILE;
const MAP_H = MAP_ROWS * TILE;
const FOREST = 3;             // tiles of forest along each edge of the map
const PLAYER_RADIUS = 10;     // how much room the raccoon takes when bumping into things
const PLAYER_HEIGHT = 30;
const CAN_HALF = 8;           // a trash can is 16 x 16 world pixels...
const CAN_HEIGHT = 26;        // ...and this tall
const RUMMAGE_REACH = 36;     // how close you must stand to rummage a can
const RUMMAGE_TIME = 1.0;     // seconds of standing next to it to loot it
const EXTRA_CANS = 40;        // cans on the sidewalks, on top of one per house
const DOG_BITE_GAP = 0.8;     // seconds before the same pest can bite again
const ROUND_TIME = 180;       // seconds on the clock (3 minutes)

// How tough the pests are: [at the start, when the clock hits zero]. In between it changes
// smoothly. After zero it keeps growing just as fast (an "overtime" that pushes you to leave).
// Each kind of pest multiplies these by its own numbers (see ENEMY_TYPES).
const DOG_SPEED = [130, 165];        // world pixels per second (you walk about 180 to 370)
const DOG_SPAWN_GAP = [1.5, 0.35];   // seconds between new pests
const MAX_DOGS = [25, 70];
const DOG_HEALTH = [20, 50];
const DOG_LIMIT = 120;               // never more pests than this at once, however late
const SHOT_RADIUS = 5;        // how close a thrown thing must pass to hit
const SHOT_HEIGHT = 14;       // thrown things fly at this height above the ground
const PICKUP_REACH = 24;      // how close you must get to pick something up
const PICKUP_PULL = 80;       // closer than this, pickups fly to you by themselves

// The critters you can play are in items.js (CRITTERS), shared with the weapons designer.
let critter = null;           // the picked one (its key, like 'raccoon'), set by chooseCritter()
let stats = CRITTERS.raccoon; // its numbers
// Your attacks and your own numbers (health, armor, regen, speed, pickup pull), worked out by
// weapons.js from your critter and the items in the designer's test backpack (see chooseCritter).
let hero = null;
let runner = null;

// Opened from the shop's "Go scavenge" (fight.html?from=shop): fight with what you wear on your Outfit
// there, and take the loot back to the shop as gold. Each round the pests get tougher.
const FROM_SHOP = new URLSearchParams(location.search).get('from') === 'shop';
let shopRun = null;           // { placed (what you wear), round }
if (FROM_SHOP) { try { shopRun = JSON.parse(localStorage.getItem('culdesack.fightLoadout')); } catch (e) { shopRun = null; } }
const ROUND = (shopRun && shopRun.round) || 1;
const TOUGHER = 1 + 0.3 * (ROUND - 1);     // pests have 30% more health every round...
const QUICKER = 1 + 0.04 * (ROUND - 1);    // ...and run 4% faster
let goldEarned = 0;

// ---------- 2. A repeatable random number maker ----------
// Gives the same "random" town every time the page loads, so testing is predictable.
function makeRandom(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = makeRandom(7);
const pick = list => list[Math.floor(random() * list.length)];

// ---------- 2b. The pictures (sprites) ----------
// Every picture the game uses, by name. The first ones are in art/sprites/ (tools/make_sprites.py,
// make_houses.py); the rest come from the art catalogue in art/catalog/<folder>/ (tools/make_catalog.py)
// and are named like 'dogs/corgi'. facing: which way the painting looks, 1 = right, -1 = left; the game
// mirrors it to face the other way. Catalogue front views look right, back and rear views look left.
const SPRITES = {};
const FACES_LEFT = new Set(['critters/raccoon', 'critters/raccoon-hurt']);   // the two exceptions

function addSprite(name, path, facing) { SPRITES[name] = { path, facing }; }
for (const n of ['bin-recycling', 'bin-compost', 'bin-garbage', 'pine', 'pine-tall', 'house',
                 'house-1', 'house-2', 'house-3', 'house-4', 'house-5', 'house-6', 'house-7', 'house-8'])
  addSprite(n, 'sprites/' + n, 1);
// A catalogue picture: registers it the first time, and gives back its name.
function cat(name) {
  if (!SPRITES[name]) addSprite(name, 'catalog/' + name, FACES_LEFT.has(name) || /-(back|rear)$/.test(name) ? -1 : 1);
  return name;
}

// ---------- 3. The map ----------
const ground = [];            // ground[row][col] = 'grass' | 'road' | 'sidewalk' | 'forest'
const houses = [];            // { x0, y0, x1, y1 (world box), wall, roof, height }

// The street plan, laid out like a real Canadian suburb. Two wide roads cross the whole town (east to
// west and north to south) and run out into the woods at all four ends; they cut the town into four
// neighbourhoods. Each neighbourhood has its own quieter streets: loops, streets that don't line up
// (real towns rarely have a perfect grid) and cul-de-sacs ending in a round turning circle. The park
// is in the north-east. Numbers are in ground squares (tiles), from the top left.
// Each street: its first and last column (c0, c1) and row (r0, r1). Wide (5) streets get a yellow centre line.
const STREETS = [
  { c0: 0,   c1: 199, r0: 68,  r1: 72 },    // the avenue, east to west
  { c0: 98,  c1: 102, r0: 0,   r1: 139 },   // the road, north to south
  // North-west
  { c0: 12,  c1: 98,  r0: 22,  r1: 24 },
  { c0: 12,  c1: 14,  r0: 22,  r1: 68 },
  { c0: 52,  c1: 54,  r0: 22,  r1: 68 },
  { c0: 14,  c1: 52,  r0: 45,  r1: 47 },
  { c0: 54,  c1: 80,  r0: 44,  r1: 46 },    // dead end to the east
  { c0: 32,  c1: 34,  r0: 9,   r1: 22 },    // dead ends to the north
  { c0: 74,  c1: 76,  r0: 9,   r1: 22 },
  // North-east (round the park)
  { c0: 102, c1: 186, r0: 18,  r1: 20 },
  { c0: 184, c1: 186, r0: 18,  r1: 68 },
  { c0: 120, c1: 122, r0: 20,  r1: 68 },
  { c0: 122, c1: 184, r0: 60,  r1: 62 },
  { c0: 160, c1: 162, r0: 7,   r1: 18 },    // dead end to the north
  { c0: 162, c1: 172, r0: 40,  r1: 42 },    // dead end into the block east of the park
  // South-west
  { c0: 12,  c1: 98,  r0: 92,  r1: 94 },
  { c0: 20,  c1: 98,  r0: 116, r1: 118 },
  { c0: 20,  c1: 22,  r0: 72,  r1: 118 },
  { c0: 60,  c1: 62,  r0: 94,  r1: 116 },
  { c0: 12,  c1: 14,  r0: 72,  r1: 92 },
  { c0: 22,  c1: 44,  r0: 104, r1: 106 },   // dead end to the east
  { c0: 40,  c1: 42,  r0: 118, r1: 130 },   // dead ends to the south
  { c0: 80,  c1: 82,  r0: 118, r1: 130 },
  // South-east
  { c0: 102, c1: 188, r0: 88,  r1: 90 },
  { c0: 102, c1: 188, r0: 112, r1: 114 },
  { c0: 186, c1: 188, r0: 72,  r1: 114 },
  { c0: 140, c1: 142, r0: 90,  r1: 112 },
  { c0: 120, c1: 122, r0: 72,  r1: 88 },
  { c0: 142, c1: 170, r0: 100, r1: 102 },   // dead end to the east
  { c0: 128, c1: 130, r0: 114, r1: 128 },   // dead ends to the south
  { c0: 166, c1: 168, r0: 114, r1: 128 },
];
// The turning circles at the dead ends: centre column and row, radius, and which way the street
// leaves it ([1, 0] = to the right, [-1, 0] = left, [0, 1] = down, [0, -1] = up).
const BULBS = [
  { c: 83, r: 45, rad: 5, dir: [-1, 0] }, { c: 33, r: 9, rad: 5, dir: [0, 1] }, { c: 75, r: 9, rad: 5, dir: [0, 1] },
  { c: 161, r: 7, rad: 4, dir: [0, 1] }, { c: 175, r: 41, rad: 4, dir: [-1, 0] },
  { c: 47, r: 105, rad: 4, dir: [-1, 0] }, { c: 41, r: 130, rad: 5, dir: [0, -1] }, { c: 81, r: 130, rad: 5, dir: [0, -1] },
  { c: 173, r: 101, rad: 4, dir: [-1, 0] }, { c: 129, r: 128, rad: 5, dir: [0, -1] }, { c: 167, r: 128, rad: 5, dir: [0, -1] },
];
// The park (in tiles), with a pond in it (world pixels; ellipse centre and half-widths).
const PARK = { c0: 126, c1: 154, r0: 28, r1: 56 };
const POND = { x: 141 * TILE, y: 43 * TILE, rx: 6 * TILE, ry: 4 * TILE };
// How much bigger the town is than the first big one (140 x 100), for how much scenery to scatter.
const AREA = (MAP_COLS * MAP_ROWS) / (140 * 100);
function inPark(x, y, pad = 0) {
  return x > PARK.c0 * TILE - pad && x < (PARK.c1 + 1) * TILE + pad && y > PARK.r0 * TILE - pad && y < (PARK.r1 + 1) * TILE + pad;
}
function inPond(x, y, r = 0) { return ((x - POND.x) / (POND.rx + r)) ** 2 + ((y - POND.y) / (POND.ry + r)) ** 2 < 1; }

function buildMap() {
  const isRoad = (c, r) => STREETS.some(s => c >= s.c0 && c <= s.c1 && r >= s.r0 && r <= s.r1) ||
                           BULBS.some(b => Math.hypot(c - b.c, r - b.r) <= b.rad);
  for (let r = 0; r < MAP_ROWS; r++) {
    ground.push([]);
    for (let c = 0; c < MAP_COLS; c++) {
      let kind = 'grass';
      if (isRoad(c, r)) kind = 'road';
      else {
        // A sidewalk runs along every road: any square next to one (corners too).
        for (let dr = -1; dr <= 1 && kind === 'grass'; dr++)
          for (let dc = -1; dc <= 1; dc++) if (isRoad(c + dc, r + dr)) { kind = 'sidewalk'; break; }
        if (BULBS.some(b => Math.hypot(c - b.c, r - b.r) <= b.rad + 1)) kind = 'sidewalk';
      }
      if (r < FOREST || c < FOREST || r >= MAP_ROWS - FOREST || c >= MAP_COLS - FOREST) kind = 'forest';
      ground[r].push(kind);
    }
  }
  placeHouses();
  placeYards();
  placeCars();
  placeCans();
  placeDecor();
  placeTrees();
  placeDecals();
}

// What kind of ground is at a world spot (outside the map counts as forest).
function groundAt(x, y) { return (ground[Math.floor(y / TILE)] || [])[Math.floor(x / TILE)] || 'forest'; }

// Pine trees in the forest band and a little beyond the map's edge. Just scenery: you and the
// pests walk straight through them. A few are dead trees, small spruces, stumps or tall grass instead.
const trees = [];             // { x, y, height, color, mirror, sprite (or none for a pine) }
const TREE_GREENS = ['#2c5a2e', '#336633', '#285228', '#3b6e3a'];
const FOREST_EXTRAS = ['trees/dead-tree', 'trees/small-spruce', 'trees/small-spruce', 'trees/stump', 'trees/tall-grass', 'trees/tall-grass'];

function placeTrees() {
  const band = FOREST * TILE, beyond = 3 * TILE;
  for (let i = 0; i < 3800; i++) {
    const x = -beyond + random() * (MAP_W + 2 * beyond);
    const y = -beyond + random() * (MAP_H + 2 * beyond);
    const inBand = x < band || y < band || x > MAP_W - band || y > MAP_H - band;
    if (!inBand || blocked(x, y, 6)) continue;
    const tree = { x, y, height: 50 + random() * 40, color: pick(TREE_GREENS), mirror: random() < 0.5 };
    if (random() < 0.1) tree.sprite = cat(pick(FOREST_EXTRAS));
    trees.push(tree);
  }
}

// Houses go on grass near a street, with a yard around them and room between neighbours.
const WALL_COLORS = ['#b9c7d3', '#e3d6a4', '#a9bfa0', '#e8e2d6', '#d9a99a', '#9fb4c9', '#c9b79c'];
const ROOF_COLORS = ['#3d5a46', '#5b4636', '#4a4f57', '#7a3f35', '#39475e'];

// Which painted house each plot gets: a shuffled deck of all nine, dealt out and reshuffled when
// it runs out, so every kind appears about equally and the same one rarely stands twice in a row.
const HOUSE_SPRITES = ['house', 'house-1', 'house-2', 'house-3', 'house-4', 'house-5', 'house-6', 'house-7', 'house-8'];
let houseDeck = [];
function pickHouse() {
  if (!houseDeck.length) {
    houseDeck = HOUSE_SPRITES.slice();
    for (let i = houseDeck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [houseDeck[i], houseDeck[j]] = [houseDeck[j], houseDeck[i]];
    }
  }
  return houseDeck.pop();
}

function placeHouses() {
  const kindAt = (c, r) => (ground[r] && ground[r][c]) || 'forest';
  const nearRoad = (c0, r0, c1, r1, reach) => {
    for (let r = r0 - reach; r <= r1 + reach; r++)
      for (let c = c0 - reach; c <= c1 + reach; c++)
        if (kindAt(c, r) === 'road') return true;
    return false;
  };
  const taken = [];           // tile boxes already used, with their gap included

  for (let r = FOREST; r < MAP_ROWS - FOREST; r++) {
    for (let c = FOREST; c < MAP_COLS - FOREST; c++) {
      const w = 5, d = 5;   // size in tiles: square, to match the painted house (320 pixels wide = 5 + 5 tiles)
      const c1 = c + w - 1, r1 = r + d - 1;
      // The house plus a 2-tile yard all round must be grass.
      let ok = true;
      for (let rr = r - 2; rr <= r1 + 2 && ok; rr++)
        for (let cc = c - 2; cc <= c1 + 2 && ok; cc++)
          if (kindAt(cc, rr) !== 'grass') ok = false;
      if (!ok || !nearRoad(c, r, c1, r1, 4)) continue;
      // Not in the park (or right at its edge).
      if ([[c, r], [c1 + 1, r], [c, r1 + 1], [c1 + 1, r1 + 1]].some(([cc, rr]) => inPark(cc * TILE, rr * TILE, 2 * TILE))) continue;
      if (taken.some(t => c <= t.c1 && c1 >= t.c0 && r <= t.r1 && r1 >= t.r0)) continue;
      taken.push({ c0: c - 2, r0: r - 2, c1: c1 + 2, r1: r1 + 2 });
      houses.push({
        x0: c * TILE, y0: r * TILE, x1: (c1 + 1) * TILE, y1: (r1 + 1) * TILE,
        wall: pick(WALL_COLORS), roof: pick(ROOF_COLORS), height: 54 + Math.floor(random() * 3) * 10,
        sprite: pickHouse(),
      });
    }
  }
}

// ---------- 3a. Front yards ----------
// Each house gets a yard: a low fence all round with a gate, a paved path from the front door
// (the painted houses face down-left on screen, towards larger y) to the sidewalk, often a
// driveway with the family car, flower beds along the house front and inside the fence, and a
// greener, tidier lawn. You and the pests hop over the low fences.
const yards = [];             // { x0, y0, x1, y1 (world box), path, drive (boxes, or null), fence: 'picket' | 'plank', beds: [boxes] }
const fences = [];            // fence pieces, one per ground square: { x, y, along: 'x' | 'y', kind }
const paved = [];             // boxes of path and driveway, kept free of scenery

function placeYards() {
  const inHouse = (x, y, except) => houses.some(o => o !== except && x > o.x0 - 8 && x < o.x1 + 8 && y > o.y0 - 8 && y < o.y1 + 8);
  const smallCars = CARS.filter(([n]) => !['school-bus', 'rv', 'garbage-truck', 'ice-cream-truck', 'mail-van'].includes(n));
  for (const h of houses) {
    const yard = { x0: h.x0 - 2 * TILE, y0: h.y0 - 2 * TILE, x1: h.x1 + 2 * TILE, y1: h.y1 + 2 * TILE,
                   fence: random() < 0.55 ? 'picket' : 'plank', beds: [], path: null, drive: null };
    const midX = (h.x0 + h.x1) / 2, midY = (h.y0 + h.y1) / 2;
    // How many squares from the wall to a sidewalk or road, looking one way (dx, dy), or 0 if none close.
    const streetAt = (dx, dy) => {
      for (let d = 2; d <= 5; d++) {
        const x = dx > 0 ? h.x1 + d * TILE + 16 : dx < 0 ? h.x0 - d * TILE - 16 : midX;
        const y = dy > 0 ? h.y1 + d * TILE + 16 : dy < 0 ? h.y0 - d * TILE - 16 : midY;
        if (inHouse(x, y, h) || groundAt(x, y) === 'forest') return 0;
        if (groundAt(x, y) !== 'grass') return d;
      }
      return 0;
    };
    // The painted houses have their door on the down-left wall (towards larger y). Mirrored, it's on
    // the down-right wall (larger x). Face the street if it's on one of those sides.
    const down = streetAt(0, 1), right = streetAt(1, 0), up = streetAt(0, -1), left = streetAt(-1, 0);
    const side = down ? 'down' : right ? 'right' : up ? 'up' : left ? 'left' : 'down';
    if (side === 'right') h.look = -1;
    if (side === 'down' && down) yard.y1 = h.y1 + down * TILE;
    if (side === 'right') yard.x1 = h.x1 + right * TILE;
    if (side === 'up') yard.y0 = h.y0 - up * TILE;
    if (side === 'left') yard.x0 = h.x0 - left * TILE;
    const street = !!(down || right || up || left);

    // The path from the front door to the yard's edge on that side.
    yard.path = h.look === -1 ? { x0: h.x1, x1: yard.x1, y0: midY - 10, y1: midY + 10 }
                              : { x0: midX - 10, x1: midX + 10, y0: h.y1, y1: yard.y1 };
    paved.push(yard.path);
    // A driveway beside the house, from the street, with the family car parked nose to the street.
    if (street && random() < 0.75) {
      const [name, w] = pick(smallCars);
      const L = Math.round(w * 0.66), W = Math.round(w * 0.34);
      let car;
      if (side === 'down') {        // car along y, nose down-left: front view, mirrored
        const x0 = h.x1 + 13, y0 = h.y1 + 40 - L;
        car = { x0, y0, x1: x0 + W, y1: y0 + L, sprite: `cars/${name}`, look: -1 };
        yard.drive = { x0: x0 - 3, x1: x0 + W + 3, y0: y0 - 6, y1: yard.y1 };
      } else if (side === 'right') { // car along x, nose down-right: front view
        const y0 = h.y1 + 13, x0 = h.x1 + 40 - L;
        car = { x0, y0, x1: x0 + L, y1: y0 + W, sprite: `cars/${name}`, look: 1 };
        yard.drive = { x0: x0 - 6, x1: yard.x1, y0: y0 - 3, y1: y0 + W + 3 };
      } else if (side === 'up') {    // car along y, nose up-right: rear view, mirrored
        const x0 = h.x1 + 13, y0 = h.y0 - 40;
        car = { x0, y0, x1: x0 + W, y1: y0 + L, sprite: `cars/${name}-rear`, look: 1 };
        yard.drive = { x0: x0 - 3, x1: x0 + W + 3, y0: yard.y0, y1: y0 + L + 6 };
      } else {                       // car along x, nose up-left: rear view
        const y0 = h.y1 + 13, x0 = h.x0 - 40;
        car = { x0, y0, x1: x0 + L, y1: y0 + W, sprite: `cars/${name}-rear`, look: -1 };
        yard.drive = { x0: yard.x0, x1: x0 + L + 6, y0: y0 - 3, y1: y0 + W + 3 };
      }
      car.sprite = cat(car.sprite);
      solids.push(car);
      paved.push(yard.drive);
    }
    // Flower beds: along the front wall (either side of the path), and along the inside of the fences.
    if (h.look === -1) {
      yard.beds.push({ x0: h.x1 + 2, x1: h.x1 + 14, y0: h.y0 + 4, y1: midY - 14 });
      yard.beds.push({ x0: h.x1 + 2, x1: h.x1 + 14, y0: midY + 14, y1: h.y1 - 4 });
    } else {
      yard.beds.push({ x0: h.x0 + 4, x1: midX - 14, y0: h.y1 + 2, y1: h.y1 + 14 });
      yard.beds.push({ x0: midX + 14, x1: h.x1 - 4, y0: h.y1 + 2, y1: h.y1 + 14 });
    }
    yard.beds.push({ x0: yard.x0 + 3, x1: yard.x0 + 13, y0: yard.y0 + 3, y1: yard.y1 - 3 });
    yard.beds.push({ x0: yard.x0 + 3, x1: yard.x1 - 3, y0: yard.y0 + 3, y1: yard.y0 + 13 });
    // (No bed where it would run under the driveway.)
    yard.beds = yard.beds.filter(b => !yard.drive || !(b.x1 > yard.drive.x0 && b.x0 < yard.drive.x1 && b.y1 > yard.drive.y0 && b.y0 < yard.drive.y1));
    yards.push(yard);

    // The fence: one piece per ground square along each edge. Gaps where the path or driveway go
    // through, a gate at the back, and nothing where the edge would be on a street or in another house.
    const cx = (yard.x0 + yard.x1) / 2, cy = (yard.y0 + yard.y1) / 2;
    const crosses = (x, y, along) => paved.some(b => along === 'x'
      ? x + TILE > b.x0 + 2 && x < b.x1 - 2 && y >= b.y0 - 2 && y <= b.y1 + 2
      : y + TILE > b.y0 + 2 && y < b.y1 - 2 && x >= b.x0 - 2 && x <= b.x1 + 2);
    const add = (x, y, along) => {
      const mx = along === 'x' ? x + TILE / 2 : x, my = along === 'y' ? y + TILE / 2 : y;
      const ix = mx + Math.sign(cx - mx) * 8, iy = my + Math.sign(cy - my) * 8;   // just inside the yard
      if (groundAt(ix, iy) !== 'grass' || inHouse(mx, my, h) || crosses(x, y, along)) return;
      fences.push({ x, y, along, kind: yard.fence });
    };
    const gate = Math.floor(random() * Math.max(1, (yard.x1 - yard.x0) / TILE - 2)) + 1;
    for (let i = 0, x = yard.x0; x < yard.x1 - 1; i++, x += TILE) {
      if (i !== gate) add(x, yard.y0, 'x');
      add(x, yard.y1, 'x');
    }
    for (let y = yard.y0; y < yard.y1 - 1; y += TILE) { add(yard.x0, y, 'y'); add(yard.x1, y, 'y'); }

    // A mailbox by the front path, and bushes in the front corners.
    if (h.look === -1) decor.push(withBox({ x: yard.x1 - 8, y: midY + 22, sprite: cat('props/mailbox'), look: -1 }));
    else decor.push(withBox({ x: midX + 22, y: yard.y1 - 8, sprite: cat('props/mailbox'), look: 1 }));
    for (const [x, y] of [[yard.x0 + 18, yard.y1 - 14], [yard.x1 - 18, yard.y1 - 14], [yard.x1 - 14, yard.y0 + 18]])
      if (!paved.some(b => x > b.x0 - 16 && x < b.x1 + 16 && y > b.y0 - 16 && y < b.y1 + 16) && random() < 0.8)
        decor.push(withBox({ x, y, sprite: cat(pick(['trees/round-bush', 'trees/flowering-bush', 'trees/round-bush'])), look: random() < 0.5 ? 1 : -1 }));
  }
}

// Fence pieces are drawn in code (pixel by pixel, once), so they line up exactly along the
// slanted ground. One picture per kind, for a piece running along x (down-right on screen);
// mirrored, it runs along y (down-left).
const FENCE_LOOK = {
  picket: { height: 13, light: '#f1ebdc', dark: '#c4b8a2', edge: '#6e6455', gap: true },
  plank:  { height: 15, light: '#b4733f', dark: '#8a5229', edge: '#4c2d16', gap: false },
};
function makeFence(kind) {
  const f = FENCE_LOOK[kind], H = f.height;
  const c = document.createElement('canvas');
  c.width = TILE + 2; c.height = H + TILE / 2 + 3;
  const g = c.getContext('2d');
  const baseY = x => H + 1 + x / 2;              // the fence's foot, x pixels along the piece
  // Boards every 4 pixels (pickets with a gap and a pointed top; planks side by side).
  for (let x = 0; x <= TILE - 3; x += 4) {
    const b = Math.round(baseY(x + 1.5)), w = f.gap ? 3 : 4;
    g.fillStyle = f.edge; g.fillRect(x, b - H - 1, w + (f.gap ? 1 : 0), H + 2);
    g.fillStyle = f.light; g.fillRect(x + 1, b - H, w - 1, H);
    g.fillStyle = f.dark; g.fillRect(x + w - 1, b - H, 1, H);
    if (f.gap) { g.clearRect(x, b - H - 1, 1, 1); g.clearRect(x + 3, b - H - 1, 1, 1); }   // pointed top
  }
  // Two rails across the boards (only seen through the gaps of a picket fence; planks get a top rail).
  g.fillStyle = f.dark;
  for (let x = 0; x <= TILE; x++) {
    const b = Math.round(baseY(x));
    if (f.gap) { g.fillRect(x, b - Math.round(H * 0.3), 1, 1); g.fillRect(x, b - Math.round(H * 0.75), 1, 1); }
    else { g.fillStyle = f.edge; g.fillRect(x, b - H - 1, 1, 1); }
  }
  return c;
}
for (const kind of Object.keys(FENCE_LOOK)) SPRITES[`fence-${kind}`] = { facing: 1, ready: Promise.resolve() };
function buildFences() { for (const kind of Object.keys(FENCE_LOOK)) SPRITES[`fence-${kind}`].img = makeFence(kind); }

function drawFence(p) {
  const end = p.along === 'x' ? project(p.x + TILE, p.y) : project(p.x, p.y + TILE);
  const mid = p.along === 'x' ? project(p.x + TILE / 2, p.y) : project(p.x, p.y + TILE / 2);
  if (hidesPlayer(`fence-${p.kind}`, p.along === 'x' ? p.x + TILE : p.x, p.along === 'y' ? p.y + TILE : p.y)) ctx.globalAlpha = 0.5;
  drawSprite(`fence-${p.kind}`, mid.x, end.y + 2, p.along === 'x' ? 1 : -1);
  ctx.globalAlpha = 1;
}

// Paint the yards onto the flat ground picture (see buildGround): greener lawn, path, driveway, flower beds.
const FLOWER_COLORS = ['#e8506a', '#f07a3a', '#f4d04a', '#b468d8', '#e86ac0', '#ffffff', '#ff8aa8', '#7a5ce0'];
function paintYards(f, fill) {
  const rnd = makeRandom(99);
  for (const y of yards) {
    f.fillStyle = 'rgba(110, 190, 60, 0.13)';                    // a tidier, greener lawn
    f.fillRect(y.x0, y.y0, y.x1 - y.x0, y.y1 - y.y0);
    for (const b of y.beds) {
      if (b.x1 - b.x0 < 6 || b.y1 - b.y0 < 6) continue;
      f.fillStyle = '#5b3d24'; f.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);   // soil
      f.fillStyle = '#3f2a18'; f.fillRect(b.x0, b.y1 - 1, b.x1 - b.x0, 1);
      for (let x = b.x0 + 1; x < b.x1 - 2; x += 3)
        for (let yy = b.y0 + 1; yy < b.y1 - 2; yy += 3) {
          const r = rnd();
          f.fillStyle = r < 0.45 ? FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)] : r < 0.85 ? '#3f7a2c' : '#5c9a36';
          f.fillRect(x + Math.floor(rnd() * 2), yy + Math.floor(rnd() * 2), 2, 2);
        }
    }
    fill('sidewalk');
    for (const b of [y.path, y.drive]) {
      if (!b) continue;
      f.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      f.strokeStyle = 'rgba(60, 56, 48, 0.45)'; f.lineWidth = 1.5;
      f.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      fill('sidewalk');
    }
  }
}

// ---------- 3b. Street dressing: parked cars, yard things, trees and ground marks ----------
// Solid things you (and the pests) bump into, besides houses and cans: cars, wrecks, a shed or two.
const solids = [];            // { x0, y0, x1, y1 (world box), sprite, look }
// Walk-through scenery: { x, y, sprite, look }. Tall ones turn see-through when you walk behind them.
const decor = [];
// Marks painted onto the ground once (puddles, cracks, paw prints): { x, y, sprite }.
const decals = [];

// Parked cars, with their picture width. A car's footprint is about 2/3 of that long and 1/3 wide.
const CARS = [['station-wagon', 140], ['pickup', 140], ['minivan', 140], ['hatchback', 120], ['vintage-sedan', 146],
              ['suv', 142], ['ice-cream-truck', 150], ['garbage-truck', 160], ['mail-van', 134], ['patrol-car', 140],
              ['school-bus', 170], ['rv', 166]];

function placeCars() {
  // Is this square road, or a sidewalk? (Used to keep parked cars out of crossings and driveways.)
  const kindAt = (c, r) => (ground[r] && ground[r][c]) || 'forest';
  const clearRun = (c0, c1, r0, r1) => {     // all road, and no side street opening off it
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (kindAt(c, r) !== 'road') return false;
    return true;
  };
  for (const s of STREETS) {
    const across = s.r1 - s.r0 + 1, horizontal = s.c1 - s.c0 > s.r1 - s.r0;
    if (!horizontal && s.r1 - s.r0 < 14) continue;            // no parking in the short cul-de-sac stems
    // Wide streets get parking on both sides, narrow ones on one side only (so a lane stays free).
    // Right-hand traffic: on the near side cars point our way (front view), on the far side away (rear view).
    const lanes = across >= 5 ? ['far', 'near'] : ['near'];
    for (const lane of lanes) {
      let at = (horizontal ? s.c0 : s.r0) * TILE + 40 + random() * 200;
      const end = (horizontal ? s.c1 + 1 : s.r1 + 1) * TILE - 40;
      while (at < end) {
        const [name, w] = pick(CARS);
        const L = Math.round(w * 0.66), W = Math.round(w * 0.34);
        let box;
        if (horizontal) {
          const y0 = lane === 'far' ? s.r0 * TILE + 3 : (s.r1 + 1) * TILE - 3 - W;
          box = { x0: at, y0, x1: at + L, y1: y0 + W, sprite: lane === 'far' ? `cars/${name}-rear` : `cars/${name}`, look: lane === 'far' ? -1 : 1 };
        } else {
          const x0 = (s.c1 + 1) * TILE - 3 - W;
          box = { x0, y0: at, x1: x0 + W, y1: at + L, sprite: `cars/${name}`, look: -1 };
        }
        // Only where the road runs straight on both sides (no crossing next to it) and inside the town.
        const c0 = Math.floor(box.x0 / TILE) - (horizontal ? 1 : 3), c1 = Math.floor(box.x1 / TILE) + (horizontal ? 1 : 3);
        const r0 = Math.floor(box.y0 / TILE) - (horizontal ? 0 : 1), r1 = Math.floor(box.y1 / TILE) + (horizontal ? 0 : 1);
        const ok = horizontal ? clearRun(c0, c1, s.r0, s.r1) && kindAt(c0, s.r0 - 2) !== 'road' && kindAt(c1, s.r0 - 2) !== 'road' &&
                                kindAt(c0, s.r1 + 2) !== 'road' && kindAt(c1, s.r1 + 2) !== 'road'
                              : clearRun(s.c0, s.c1, r0, r1) && kindAt(s.c0 - 2, r0) !== 'road' && kindAt(s.c1 + 2, r1) !== 'road' &&
                                kindAt(s.c0 - 2, r1) !== 'road' && kindAt(s.c1 + 2, r0) !== 'road';
        if (ok && !inForest(box.x0, box.y0) && !inForest(box.x1, box.y1) && random() < 0.6) {
          box.sprite = cat(box.sprite);
          solids.push(box);
        }
        at += L + 40 + random() * 260;
      }
    }
  }
  // Two or three old wrecks dumped at the edge of the woods.
  for (let placed = 0, tries = 0; placed < 3 && tries < 200; tries++) {
    const x = FOREST * TILE + random() * (MAP_W - 2 * FOREST * TILE), y = random() < 0.5 ? 20 : MAP_H - FOREST * TILE + 10;
    if (solids.some(s => Math.abs(s.x0 - x) < 300)) continue;
    solids.push({ x0: x, y0: y, x1: x + 90, y1: y + 46, sprite: cat(pick(['cars/wreck-rusty', 'cars/wreck-burnt', 'cars/wreck-crushed'])), look: 1 });
    placed++;
  }
}

// Scenery you bump into: picture -> half the width of its solid box (world px). Big furniture gets a
// big box; lamps, poles and tree trunks a small one. Anything not listed (flowers, gnomes, leaf piles,
// tall grass...) you walk through.
const SOLID_SIZE = {
  'props/old-couch': 22, 'props/bench': 16, 'props/picnic-table': 22, 'props/trampoline': 32, 'props/swing-set': 28,
  'props/sandbox': 20, 'props/kiddie-pool': 22, 'props/hockey-net': 15, 'props/basketball-hoop': 6, 'props/doghouse': 16,
  'props/barbecue': 9, 'props/canoe-rack': 26, 'props/compost-heap': 16, 'props/firewood': 16, 'props/hay-bale': 12,
  'props/street-lamp': 4, 'props/power-pole': 5, 'props/fire-hydrant': 5, 'props/mailbox': 4, 'props/newspaper-box': 8,
  'props/rain-barrel': 8, 'props/birdbath': 8, 'props/scarecrow': 5, 'props/stop-sign': 3, 'props/street-sign': 3,
  'props/muskoka-chair': 9, 'props/boxes': 8, 'props/garbage-bags': 11, 'props/bicycle': 10, 'props/lawn-mower': 10,
  'props/wheelbarrow': 12, 'props/shopping-cart': 10,
  'trees/cedar-hedge': 26, 'trees/oak': 10, 'trees/red-maple': 8, 'trees/orange-maple': 8, 'trees/yellow-birch': 6,
  'trees/small-spruce': 7, 'trees/dead-tree': 7, 'trees/stump': 8, 'trees/round-bush': 12, 'trees/flowering-bush': 12,
};
function withBox(t) {
  const s = SOLID_SIZE[t.sprite];
  if (s) t.box = { x0: t.x - s, y0: t.y - s * 0.7, x1: t.x + s, y1: t.y + s * 0.7 };
  return t;
}

// Yard things: [picture, how much room it needs around it, solid (a box you bump into)].
const YARD_THINGS = [
  ['props/barbecue', 20], ['props/basketball-hoop', 30], ['props/bicycle', 24], ['props/birdbath', 20], ['props/boxes', 16],
  ['props/canoe-rack', 44], ['props/compost-heap', 26], ['props/doghouse', 26], ['props/firewood', 26], ['props/flamingo', 14],
  ['props/garbage-bags', 22], ['props/gnome', 12], ['props/hockey-net', 26], ['props/hose-reel', 14], ['props/jack-o-lantern', 12],
  ['props/kiddie-pool', 34], ['props/lawn-mower', 20], ['props/muskoka-chair', 16], ['props/old-couch', 34], ['props/picnic-table', 32],
  ['props/rain-barrel', 14], ['props/sandbox', 30], ['props/scarecrow', 20], ['props/swing-set', 44], ['props/trampoline', 44],
  ['props/wheelbarrow', 22], ['props/hay-bale', 18],
  ['trees/flowering-bush', 26], ['trees/round-bush', 26], ['trees/pumpkin-patch', 36], ['trees/leaf-pile', 26],
  ['trees/cedar-hedge', 46], ['props/shed', 40, true],
];
const YARD_TREES = [['trees/red-maple', 50], ['trees/orange-maple', 56], ['trees/yellow-birch', 40], ['trees/oak', 70], ['trees/small-spruce', 30]];
const WILD_THINGS = [['trees/tall-grass', 18], ['trees/wildflowers', 22], ['trees/stump', 18], ['trees/round-bush', 26], ['trees/leaf-pile', 26],
                     ['trees/flowering-bush', 26], ['trees/dead-tree', 50]];

function placeDecor() {
  const room = [];            // { x, y, r } spots already used
  const fits = (x, y, r, kinds = ['grass']) =>
    kinds.includes(groundAt(x, y)) && !inForest(x, y) && !inPond(x, y, r + 20) && !onParkPath(x, y, r * 0.6) &&
    !houses.some(h => x > h.x0 - r * 0.5 - 6 && x < h.x1 + r * 0.5 + 6 && y > h.y0 - r * 0.5 - 6 && y < h.y1 + r * 0.5 + 6) &&
    !solids.some(b => x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r) &&
    !cans.some(c => Math.hypot(c.x - x, c.y - y) < r + 16) &&
    !paved.some(b => x > b.x0 - r * 0.6 && x < b.x1 + r * 0.6 && y > b.y0 - r * 0.6 && y < b.y1 + r * 0.6) &&
    !room.some(o => Math.hypot(o.x - x, o.y - y) < (o.r + r) * 0.8) &&
    Math.hypot(x - player.x, y - player.y) > 60;
  const put = (sprite, x, y, r, solid) => {
    room.push({ x, y, r });
    if (solid) solids.push({ x0: x - r * 0.6, y0: y - r * 0.6, x1: x + r * 0.6, y1: y + r * 0.6, sprite: cat(sprite), look: 1 });
    else decor.push(withBox({ x, y, sprite: cat(sprite), look: random() < 0.5 ? 1 : -1 }));
  };
  const tryPut = (sprite, r, solid, x0, y0, x1, y1, kinds) => {
    for (let t = 0; t < 30; t++) {
      const x = x0 + random() * (x1 - x0), y = y0 + random() * (y1 - y0);
      if (fits(x, y, r, kinds)) { put(sprite, x, y, r, solid); return true; }
    }
    return false;
  };
  // Along every sidewalk: street lamps, power poles (the main avenue), hydrants and newspaper boxes.
  const main = STREETS[0];
  const lamps = [], small = [];      // to keep them spaced out
  for (let r = FOREST; r < MAP_ROWS - FOREST; r++)
    for (let c = FOREST; c < MAP_COLS - FOREST; c++) {
      if (ground[r][c] !== 'sidewalk') continue;
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      const onMain = r === main.r0 - 1 || r === main.r1 + 1;
      const roll = random();
      if (roll < 0.3 && !lamps.some(o => Math.hypot(o.x - x, o.y - y) < (onMain ? 300 : 420)) && fits(x, y, 12, ['sidewalk'])) {
        put(onMain && r < main.r0 ? 'props/power-pole' : 'props/street-lamp', x, y, 12);
        lamps.push({ x, y });
      } else if (roll > 0.97 && !small.some(o => Math.hypot(o.x - x, o.y - y) < 260) && fits(x, y, 10, ['sidewalk'])) {
        put(pick(['props/fire-hydrant', 'props/fire-hydrant', 'props/newspaper-box', 'props/traffic-cone']), x, y, 10);
        small.push({ x, y });
      }
    }
  for (let i = 0; i < 3; i++)
    tryPut('props/bus-shelter', 40, true, FOREST * TILE, (main.r1 + 1) * TILE + 4, MAP_W - FOREST * TILE, (main.r1 + 2) * TILE - 4, ['sidewalk']);
  for (let i = 0; i < 5; i++) tryPut('props/bench', 26, false, FOREST * TILE, (main.r0 - 1) * TILE, MAP_W - FOREST * TILE, main.r0 * TILE, ['sidewalk']);
  for (let i = 0; i < 3; i++) tryPut('props/shopping-cart', 18, false, FOREST * TILE, FOREST * TILE, MAP_W, MAP_H, ['sidewalk']);
  // Stop signs where a street meets another one: on the corner, at the right of the street coming in.
  for (const s of STREETS) {
    if (s.c1 - s.c0 > s.r1 - s.r0) continue;                      // only the up-and-down streets
    for (const o of STREETS) {
      if (o === s || o.c1 - o.c0 <= o.r1 - o.r0 || s.c0 < o.c0 || s.c1 > o.c1) continue;
      if (s.r0 >= o.r0 && s.r0 <= o.r1 + 1) put('props/stop-sign', (s.c1 + 1.5) * TILE, (o.r1 + 2.5) * TILE, 12);
      if (s.r1 >= o.r0 - 1 && s.r1 <= o.r1) put('props/stop-sign', (s.c0 - 0.5) * TILE, (o.r0 - 1.5) * TILE, 12);
    }
  }
  put('props/street-sign', (STREETS[1].c0 - 0.5) * TILE, (main.r0 - 1.5) * TILE, 12);
  // A few traffic cones around a pothole-ish spot on the avenue.
  const coneX = (FOREST + 12 + Math.floor(random() * 20)) * TILE, coneY = (main.r0 + 2) * TILE + 8;
  for (const [dx, dy] of [[-30, -10], [30, -6], [0, 22]]) put('props/traffic-cone', coneX + dx, coneY + dy, 8);
  placePark(put, tryPut);
  // Each house: a tree or two and a few yard things around it.
  for (const h of houses) {
    const pad = 3 * TILE;
    for (let i = 0, n = 1 + Math.floor(random() * 2); i < n; i++) {
      const [sprite, r] = pick(YARD_TREES);
      tryPut(sprite, r, false, h.x0 - pad, h.y0 - pad, h.x1 + pad, h.y1 + pad);
    }
    for (let i = 0, n = 2 + Math.floor(random() * 3); i < n; i++) {
      const [sprite, r, solid] = pick(YARD_THINGS);
      tryPut(sprite, r, solid, h.x0 - pad, h.y0 - pad, h.x1 + pad, h.y1 + pad);
    }
  }
  // Odd bits of nature on the open grass.
  for (let i = 0; i < 150 * AREA; i++) {
    const [sprite, r] = pick(WILD_THINGS);
    tryPut(sprite, r, false, FOREST * TILE, FOREST * TILE, MAP_W - FOREST * TILE, MAP_H - FOREST * TILE);
  }
}

// Ground marks: which pictures go on which ground.
const DECALS_ON = {
  road:     ['decals/oil-stain', 'decals/oil-stain', 'decals/crack', 'decals/pothole', 'decals/skid-marks', 'decals/broken-glass', 'decals/paint-splash'],
  sidewalk: ['decals/hopscotch', 'decals/crack', 'decals/ketchup', 'decals/soda-spill', 'decals/footprints', 'decals/banana-smear'],
  grass:    ['decals/leaf-scatter', 'decals/leaf-scatter', 'decals/mud-puddle', 'decals/paw-trail', 'decals/water-puddle', 'decals/footprints', 'decals/crater'],
};

function placeDecals() {
  for (let placed = 0, tries = 0; placed < 180 * AREA && tries < 12000; tries++) {
    const x = FOREST * TILE + random() * (MAP_W - 2 * FOREST * TILE), y = FOREST * TILE + random() * (MAP_H - 2 * FOREST * TILE);
    const list = DECALS_ON[groundAt(x, y)];
    if (!list || houses.some(h => x > h.x0 - 30 && x < h.x1 + 30 && y > h.y0 - 30 && y < h.y1 + 30)) continue;
    if (inPond(x, y, 60) || onParkPath(x, y, 30) || paved.some(b => x > b.x0 - 30 && x < b.x1 + 30 && y > b.y0 - 30 && y < b.y1 + 30)) continue;
    if (decals.some(d => Math.hypot(d.x - x, d.y - y) < 120)) continue;
    decals.push({ x, y, sprite: cat(pick(list)) });
    placed++;
  }
}

// ---------- 3c. The park ----------
// A loop path round the pond, with straight paths out to the four sides; a playground, a little
// basketball court, benches, picnic tables, lamps, lots of trees and a wild meadow corner.
const PARK_LOOP = { rx: POND.rx + 2.6 * TILE, ry: POND.ry + 2.4 * TILE };
const PARK_COURT = { x0: (PARK.c0 + 1.5) * TILE, y0: (PARK.r0 + 1.5) * TILE, x1: (PARK.c0 + 6.5) * TILE, y1: (PARK.r0 + 4.5) * TILE };
const PARK_SAND = { x: (PARK.c1 - 3) * TILE, y: (PARK.r1 - 3) * TILE, r: 2.3 * TILE };
// Is a spot on (or within pad of) one of the park's paths?
function onParkPath(x, y, pad = 0) {
  if (!inPark(x, y, pad)) return false;
  const dx = x - POND.x, dy = y - POND.y, w = 12 + pad;
  const k = Math.hypot(dx / PARK_LOOP.rx, dy / PARK_LOOP.ry);
  if (Math.abs(k - 1) * Math.min(PARK_LOOP.rx, PARK_LOOP.ry) < w) return true;              // the loop
  if (Math.abs(dx) < w && Math.abs(dy) > PARK_LOOP.ry * 0.9) return true;                    // north and south paths
  if (Math.abs(dy) < w && Math.abs(dx) > PARK_LOOP.rx * 0.9) return true;                    // west and east paths
  return false;
}

function placePark(put, tryPut) {
  const x0 = PARK.c0 * TILE, y0 = PARK.r0 * TILE, x1 = (PARK.c1 + 1) * TILE, y1 = (PARK.r1 + 1) * TILE;
  // Benches and lamps round the loop path, just outside it.
  for (let i = 0; i < 10; i++) {
    const a = (i + 0.5) / 10 * Math.PI * 2, out = i % 2 ? 26 : -26;
    const x = POND.x + Math.cos(a) * (PARK_LOOP.rx + out), y = POND.y + Math.sin(a) * (PARK_LOOP.ry + out);
    put(i % 2 ? 'props/bench' : 'props/street-lamp', x, y, 16);
  }
  // The playground (on painted sand) and the basketball court.
  put('props/swing-set', PARK_SAND.x - 20, PARK_SAND.y - 14, 30);
  put('props/sandbox', PARK_SAND.x + 30, PARK_SAND.y + 24, 20);
  put('props/basketball-hoop', PARK_COURT.x1 - 10, (PARK_COURT.y0 + PARK_COURT.y1) / 2, 20);
  put('props/hockey-net', PARK_COURT.x0 + 14, (PARK_COURT.y0 + PARK_COURT.y1) / 2, 20);
  for (let i = 0; i < 3; i++) tryPut('props/picnic-table', 32, false, x0 + TILE, y0 + TILE, x1 - TILE, y1 - TILE);
  for (let i = 0; i < 3; i++) tryPut('props/garbage-bags', 20, false, x0 + TILE, y0 + TILE, x1 - TILE, y1 - TILE);
  tryPut('props/birdbath', 20, false, x0 + TILE, y0 + TILE, x1 - TILE, y1 - TILE);
  // Lots of trees, mostly round the edges; a wild meadow corner with tall grass and flowers.
  const PARK_TREES = [['trees/oak', 60], ['trees/red-maple', 46], ['trees/orange-maple', 50], ['trees/yellow-birch', 36],
                      ['trees/small-spruce', 28], ['trees/flowering-bush', 22], ['trees/round-bush', 22]];
  for (let i = 0; i < 45; i++) { const [sprite, r] = pick(PARK_TREES); tryPut(sprite, r, false, x0 + 8, y0 + 8, x1 - 8, y1 - 8); }
  for (let i = 0; i < 14; i++)
    tryPut(pick(['trees/tall-grass', 'trees/wildflowers', 'trees/tall-grass', 'trees/stump']), 14, false, x0 + 8, (PARK.r1 - 5) * TILE, x0 + 7 * TILE, y1 - 8);
}

// ---------- 3d. Richer grass and the park's ground ----------
// The lawn texture alone repeats and looks flat. On top of it, painted once onto the flat ground:
// big soft patches of lusher, darker and drier green, a few bare muddy spots, and little flowers
// and clover. Then (after the ground is turned) tufts of wild grass stand along every edge: curbs,
// fences, house walls, the forest's edge, round the pond, and scattered over the open grass.
const GRASS_PATCHES = ['#86c04a', '#9ccf55', '#2f6a2c', '#24552a', '#b7ac58', '#3f8f5e', '#6aa63c'];
const SPECKS = ['#ffffff', '#fff4b0', '#f4d04a', '#c890f0', '#ff9ac0', '#ffffff', '#e8f0a0'];

function paintGrass(f) {
  const rnd = makeRandom(41);
  // Only on grass squares.
  const grassArea = new Path2D();
  for (let r = 0; r < MAP_ROWS; r++)
    for (let c = 0; c < MAP_COLS; c++) if (ground[r][c] === 'grass') grassArea.rect(c * TILE, r * TILE, TILE, TILE);
  f.save();
  f.clip(grassArea);
  // Soft patches of colour.
  for (let i = 0; i < 1400 * AREA; i++) {
    const x = rnd() * MAP_W, y = rnd() * MAP_H, r = 30 + rnd() * 140;
    const g = f.createRadialGradient(x, y, 0, x, y, r);
    const col = GRASS_PATCHES[Math.floor(rnd() * GRASS_PATCHES.length)];
    g.addColorStop(0, col + '2e'); g.addColorStop(1, col + '00');      // the last two digits: see-through
    f.fillStyle = g;
    f.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // Bare, trodden muddy spots: clusters of brown blobs with darker crumbs (not in the tidy yards).
  for (let i = 0; i < 45 * AREA; i++) {
    const x = rnd() * MAP_W, y = rnd() * MAP_H;
    if (yards.some(yd => x > yd.x0 && x < yd.x1 && y > yd.y0 && y < yd.y1) || groundAt(x, y) !== 'grass') continue;
    for (let j = 0; j < 22; j++) {
      const bx = x + (rnd() - 0.5) * 70, by = y + (rnd() - 0.5) * 50, br = 5 + rnd() * 12;
      f.fillStyle = rnd() < 0.5 ? 'rgba(112, 82, 48, 0.55)' : 'rgba(96, 70, 40, 0.45)';
      f.beginPath(); f.ellipse(bx, by, br, br * 0.8, 0, 0, Math.PI * 2); f.fill();
    }
    f.fillStyle = 'rgba(60, 42, 24, 0.8)';
    for (let j = 0; j < 30; j++) f.fillRect(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 50, 2, 2);
  }
  // Clover clumps and tiny flowers.
  for (let i = 0; i < 2600 * AREA; i++) {
    const x = rnd() * MAP_W, y = rnd() * MAP_H;
    if (rnd() < 0.5) {
      f.fillStyle = rnd() < 0.5 ? '#5aa03a' : '#3e7f2e';                // clover: a small cluster of dots
      for (let j = 0; j < 6; j++) f.fillRect(x + rnd() * 8, y + rnd() * 6, 2, 2);
    } else {
      f.fillStyle = SPECKS[Math.floor(rnd() * SPECKS.length)];         // a few flowers together
      for (let j = 0, n = 1 + Math.floor(rnd() * 4); j < n; j++) f.fillRect(x + rnd() * 10, y + rnd() * 8, 2, 2);
    }
  }
  f.restore();
}

function paintPark(f, fill) {
  const rnd = makeRandom(77);
  const x0 = PARK.c0 * TILE, y0 = PARK.r0 * TILE, x1 = (PARK.c1 + 1) * TILE, y1 = (PARK.r1 + 1) * TILE;
  // The playground's sand and the basketball court.
  f.fillStyle = '#d9c38a';
  f.beginPath(); f.ellipse(PARK_SAND.x, PARK_SAND.y, PARK_SAND.r * 1.3, PARK_SAND.r, 0, 0, Math.PI * 2); f.fill();
  f.fillStyle = 'rgba(150, 120, 70, 0.6)';
  for (let i = 0; i < 160; i++) f.fillRect(PARK_SAND.x + (rnd() - 0.5) * PARK_SAND.r * 2.2, PARK_SAND.y + (rnd() - 0.5) * PARK_SAND.r * 1.6, 2, 1);
  const c = PARK_COURT;
  fill('road'); f.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
  f.fillStyle = 'rgba(70, 110, 150, 0.35)'; f.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);   // a blue-ish painted court
  f.strokeStyle = 'rgba(240, 236, 220, 0.9)'; f.lineWidth = 2;
  f.strokeRect(c.x0 + 4, c.y0 + 4, c.x1 - c.x0 - 8, c.y1 - c.y0 - 8);
  f.beginPath(); f.moveTo((c.x0 + c.x1) / 2, c.y0 + 4); f.lineTo((c.x0 + c.x1) / 2, c.y1 - 4); f.stroke();
  f.beginPath(); f.arc((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, 14, 0, Math.PI * 2); f.stroke();
  // Paths: the loop round the pond and the four straight ones, with a soft dark edge.
  const paths = () => {
    f.beginPath(); f.ellipse(POND.x, POND.y, PARK_LOOP.rx, PARK_LOOP.ry, 0, 0, Math.PI * 2);
    f.moveTo(POND.x, y0); f.lineTo(POND.x, POND.y - PARK_LOOP.ry);
    f.moveTo(POND.x, y1); f.lineTo(POND.x, POND.y + PARK_LOOP.ry);
    f.moveTo(x0, POND.y); f.lineTo(POND.x - PARK_LOOP.rx, POND.y);
    f.moveTo(x1, POND.y); f.lineTo(POND.x + PARK_LOOP.rx, POND.y);
  };
  paths(); f.strokeStyle = 'rgba(50, 60, 34, 0.45)'; f.lineWidth = 26; f.stroke();
  paths(); fill('sidewalk'); f.strokeStyle = f.fillStyle; f.lineWidth = 22; f.stroke();
  // Flower beds where the straight paths meet the loop.
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const bx = POND.x + dx * (PARK_LOOP.rx + 30) + dy * 30, by = POND.y + dy * (PARK_LOOP.ry + 30) + dx * 30;
    f.fillStyle = '#5b3d24'; f.beginPath(); f.ellipse(bx, by, 16, 12, 0, 0, Math.PI * 2); f.fill();
    for (let i = 0; i < 40; i++) {
      f.fillStyle = rnd() < 0.6 ? FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)] : '#3f7a2c';
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      f.fillRect(bx + Math.cos(a) * d * 14, by + Math.sin(a) * d * 10, 2, 2);
    }
  }
  // The pond: a muddy shore, then water darker towards the middle, light ripples and lily pads.
  const ell = (grow, color) => { f.fillStyle = color; f.beginPath(); f.ellipse(POND.x, POND.y, POND.rx + grow, POND.ry + grow, 0, 0, Math.PI * 2); f.fill(); };
  ell(9, '#7a5c38'); ell(4, '#5e8a4a'); ell(0, '#3d86a8'); ell(-14, '#33769a'); ell(-34, '#2b6688');
  f.save();
  f.beginPath(); f.ellipse(POND.x, POND.y, POND.rx - 4, POND.ry - 4, 0, 0, Math.PI * 2); f.clip();
  f.fillStyle = 'rgba(190, 230, 240, 0.7)';
  for (let i = 0; i < 70; i++) f.fillRect(POND.x + (rnd() - 0.5) * POND.rx * 2, POND.y + (rnd() - 0.5) * POND.ry * 2, 4 + rnd() * 8, 1.5);
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, d = 0.55 + rnd() * 0.4;
    const lx = POND.x + Math.cos(a) * POND.rx * d, ly = POND.y + Math.sin(a) * POND.ry * d;
    f.fillStyle = '#4f9a3c'; f.beginPath(); f.arc(lx, ly, 4 + rnd() * 3, 0.3, Math.PI * 2); f.fill();
    if (rnd() < 0.4) { f.fillStyle = '#ffb0d0'; f.fillRect(lx - 1, ly - 1, 3, 3); }
  }
  f.restore();
}

// Tuft pictures, drawn pixel by pixel: blades of grass from a common root, leaning a little.
// kinds: 'grass' (green), 'dry' (straw-coloured), 'weed' (with little flower heads), 'reed' (tall, with cattails).
function makeTufts() {
  const rnd = makeRandom(5);
  const GREENS = ['#2f5a24', '#3d6b2a', '#4f8a34', '#6aa83e', '#86bf4a', '#9fd05a'];
  const DRY = ['#8a8a3a', '#a8a050', '#c2b060', '#d4c27a', '#7a8a3a'];
  const HEADS = ['#e070c0', '#f4e060', '#ffffff', '#d04848', '#9a78e8', '#ff9a3c'];
  const make = (kind) => {
    const tall = kind === 'reed' ? 22 : kind === 'weed' ? 13 : 10;
    const c = document.createElement('canvas');
    c.width = 16; c.height = tall + 3;
    const g = c.getContext('2d');
    const blades = kind === 'reed' ? 6 : 5 + Math.floor(rnd() * 6);
    for (let i = 0; i < blades; i++) {
      const bx = 8 + Math.round((rnd() - 0.5) * 8), h = Math.round(tall * (0.4 + rnd() * 0.6)), lean = (rnd() - 0.5) * 6;
      const cols = kind === 'dry' ? DRY : kind === 'reed' ? ['#4f7a34', '#6a9a40', '#86a850'] : GREENS;
      const col = cols[Math.floor(rnd() * cols.length)];
      for (let t = 0; t <= h; t++) {
        g.fillStyle = t < 2 ? '#24401c' : col;                          // dark at the root
        g.fillRect(Math.round(bx + lean * (t / h) ** 1.5), c.height - 1 - t, 1, 1);
      }
      const tipX = Math.round(bx + lean), tipY = c.height - 1 - h;
      if (kind === 'weed' && rnd() < 0.5) { g.fillStyle = HEADS[Math.floor(rnd() * HEADS.length)]; g.fillRect(tipX - 1, tipY - 1, 2, 2); }
      if (kind === 'reed' && rnd() < 0.6) { g.fillStyle = '#6a4224'; g.fillRect(tipX, tipY, 2, 4); }
    }
    return c;
  };
  const out = {};
  for (const kind of ['grass', 'dry', 'weed', 'reed']) out[kind] = Array.from({ length: 8 }, () => make(kind));
  return out;
}

// Where the tufts go (world spots), back to front so nearer ones overlap farther ones.
function placeTufts() {
  const rnd = makeRandom(13);
  const out = [];
  const kindAt = (c, r) => (ground[r] && ground[r][c]) || 'forest';
  const inYard = (x, y) => yards.some(yd => x > yd.x0 + 4 && x < yd.x1 - 4 && y > yd.y0 + 4 && y < yd.y1 - 4);
  const wild = () => { const r = rnd(); return r < 0.5 ? 'grass' : r < 0.78 ? 'dry' : 'weed'; };
  const ok = (x, y) => groundAt(x, y) === 'grass' && !inPond(x, y, 6) && !onParkPath(x, y, 2) &&
                       !paved.some(b => x > b.x0 - 2 && x < b.x1 + 2 && y > b.y0 - 2 && y < b.y1 + 2) &&
                       !houses.some(h => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1);
  // Along the edges of grass: curbs (sidewalk and road) and the forest.
  for (let r = 0; r < MAP_ROWS; r++)
    for (let c = 0; c < MAP_COLS; c++) {
      if (ground[r][c] !== 'grass') continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const other = kindAt(c + dc, r + dr);
        if (other === 'grass') continue;
        const n = other === 'forest' ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const along = rnd() * TILE, into = 1 + rnd() * (other === 'forest' ? 14 : 7);
          const x = c * TILE + (dc ? (dc > 0 ? TILE - into : into) : along);
          const y = r * TILE + (dr ? (dr > 0 ? TILE - into : into) : along);
          if (ok(x, y)) out.push({ x, y, kind: wild() });
          if (other === 'forest' && rnd() < 0.6) out.push({ x: x + dc * 20, y: y + dr * 20, kind: wild() });
        }
      }
    }
  // Along both sides of every fence.
  for (const p of fences)
    for (let i = 0; i < 6; i++) {
      const t = rnd() * TILE, side = (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 5);
      const x = p.along === 'x' ? p.x + t : p.x + side, y = p.along === 'y' ? p.y + t : p.y + side;
      if (ok(x, y)) out.push({ x, y, kind: rnd() < 0.7 ? 'grass' : 'weed' });
    }
  // At the foot of the walls we see (the down-left and down-right ones).
  for (const h of houses) {
    for (let x = h.x0; x < h.x1; x += 7) if (rnd() < 0.6) { const y = h.y1 + 2 + rnd() * 4; if (ok(x, y)) out.push({ x, y, kind: 'grass' }); }
    for (let y = h.y0; y < h.y1; y += 7) if (rnd() < 0.6) { const x = h.x1 + 2 + rnd() * 4; if (ok(x, y)) out.push({ x, y, kind: 'grass' }); }
  }
  // Reeds round the pond.
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2, d = 1 + rnd() * 0.12;
    const x = POND.x + Math.cos(a) * (POND.rx + 4) * d, y = POND.y + Math.sin(a) * (POND.ry + 4) * d;
    out.push({ x, y, kind: rnd() < 0.7 ? 'reed' : 'grass' });
  }
  // Scattered over open grass: thicker in the wild spots, sparse in the mown yards.
  for (let i = 0; i < 9000 * AREA; i++) {
    const x = rnd() * MAP_W, y = rnd() * MAP_H;
    if (!ok(x, y)) continue;
    if (inYard(x, y) && rnd() < 0.85) continue;
    out.push({ x, y, kind: inYard(x, y) ? 'grass' : wild() });
    // Wild clumps: a few more close together.
    if (!inYard(x, y) && rnd() < 0.3)
      for (let j = 0; j < 4; j++) { const cx = x + (rnd() - 0.5) * 18, cy = y + (rnd() - 0.5) * 14; if (ok(cx, cy)) out.push({ x: cx, y: cy, kind: wild() }); }
  }
  return out.sort((a, b) => (a.x + a.y) - (b.x + b.y));
}

// ---------- 4. Trash cans ----------
// Three kinds, like Canadian curbside bins: black garbage, blue recycling, green compost.
const CAN_KINDS = [
  { name: 'garbage',   body: '#3a3d42', lid: '#2a2c30' },
  { name: 'recycling', body: '#2f6fb3', lid: '#24568c' },
  { name: 'compost',   body: '#4f8a3c', lid: '#3c6c2d' },
];
const cans = [];              // { x, y, kind, progress (0..RUMMAGE_TIME), looted }

function canBox(c) { return { x0: c.x - CAN_HALF, y0: c.y - CAN_HALF, x1: c.x + CAN_HALF, y1: c.y + CAN_HALF }; }

function placeCans() {
  const kindAt = groundAt;
  const free = (x, y) =>
    (kindAt(x, y) === 'grass' || kindAt(x, y) === 'sidewalk') &&
    !houses.some(h => x > h.x0 - 24 && x < h.x1 + 24 && y > h.y0 - 24 && y < h.y1 + 24) &&
    !solids.some(h => x > h.x0 - 24 && x < h.x1 + 24 && y > h.y0 - 24 && y < h.y1 + 24) &&
    !paved.some(b => x > b.x0 - 14 && x < b.x1 + 14 && y > b.y0 - 14 && y < b.y1 + 14) && !inPond(x, y, 40) &&
    !cans.some(c => Math.hypot(c.x - x, c.y - y) < 60);
  const add = (x, y) => cans.push({ x, y, kind: pick(CAN_KINDS), progress: 0, looted: false });

  // One beside each house: try spots just outside its walls until one is free.
  for (const h of houses) {
    for (let tries = 0; tries < 20; tries++) {
      const side = Math.floor(random() * 4);
      const along = random();
      const x = side === 0 ? h.x0 - 30 : side === 1 ? h.x1 + 30 : h.x0 + along * (h.x1 - h.x0);
      const y = side === 2 ? h.y0 - 30 : side === 3 ? h.y1 + 30 : h.y0 + along * (h.y1 - h.y0);
      if (free(x, y)) { add(x, y); break; }
    }
  }
  // A few more out on the sidewalks.
  for (let placed = 0, tries = 0; placed < EXTRA_CANS && tries < 2000; tries++) {
    const x = (FOREST + random() * (MAP_COLS - 2 * FOREST)) * TILE;
    const y = (FOREST + random() * (MAP_ROWS - 2 * FOREST)) * TILE;
    if (kindAt(x, y) === 'sidewalk' && free(x, y)) { add(x, y); placed++; }
  }
}

// Stand next to a can and you rummage through it; stay long enough and it's yours.
let looted = 0;
const popups = [];            // floating "+1" texts: { x, y, text, age }
function rummageTime() { return RUMMAGE_TIME * stats.rummage; }

function rummage(seconds) {
  let nearest = null, best = RUMMAGE_REACH;
  for (const c of cans) {
    if (c.looted) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < best) { best = d; nearest = c; }
  }
  player.rummaging = !!nearest;
  for (const c of cans) {
    if (c.looted) continue;
    if (c === nearest) c.progress += seconds;
    else c.progress = Math.max(0, c.progress - seconds * 2);   // walk away and it drains
    if (c.progress >= rummageTime()) {
      c.looted = true;
      looted++;
      popups.push({ x: c.x, y: c.y, text: '+1 trash', color: '#ffd34d', age: 0 });
      addEffect(cat('effects/coin-burst'), c.x, c.y, CAN_HEIGHT, 0.5, 16);
      addMark(cat('decals/spilled-trash'), c.x - 26, c.y + 22, Infinity);
      // A few things tumble out of the bin.
      for (let i = 0, n = 2 + Math.floor(random() * 2); i < n; i++) dropPickup(canLoot(), c.x, c.y, 1);
    }
  }
}

function agePopups(seconds) {
  for (const p of popups) p.age += seconds;
  while (popups.length && popups[0].age > 1.2) popups.shift();
}

// ---------- 5. Pests: dogs, animals, neighbours and two bosses ----------
// They appear just outside the screen and run at you. Touch one and it bites.
// file: the catalogue picture (front view; '-back' and the attack pose are added to the name).
// r: body size in world px. speed, hp: times the round's current base numbers. bite: health it takes.
// from: how far into the round it starts showing up (0 = at the start, 1 = when the clock hits zero).
const ENEMY_TYPES = [
  { file: 'dogs/chihuahua',        attack: 'bite',   r: 6,  speed: 1.35, hp: 0.5, bite: 4,  from: 0 },
  { file: 'dogs/pug',              attack: 'bite',   r: 8,  speed: 0.9,  hp: 0.8, bite: 6,  from: 0 },
  { file: 'dogs/dachshund',        attack: 'bite',   r: 8,  speed: 1.15, hp: 0.7, bite: 6,  from: 0 },
  { file: 'dogs/corgi',            attack: 'bite',   r: 9,  speed: 1.0,  hp: 1.0, bite: 8,  from: 0 },
  { file: 'dogs/beagle',           attack: 'bite',   r: 9,  speed: 1.05, hp: 1.0, bite: 8,  from: 0 },
  { file: 'animals/acorn-squirrel', attack: 'attack', r: 6, speed: 1.4,  hp: 0.4, bite: 3,  from: 0.05 },
  { file: 'dogs/poodle',           attack: 'bite',   r: 9,  speed: 1.1,  hp: 0.9, bite: 7,  from: 0.1 },
  { file: 'animals/black-cat',     attack: 'attack', r: 7,  speed: 1.3,  hp: 0.6, bite: 6,  from: 0.15 },
  { file: 'animals/orange-cat',    attack: 'attack', r: 8,  speed: 1.2,  hp: 0.7, bite: 6,  from: 0.15 },
  { file: 'dogs/bulldog',          attack: 'bite',   r: 9,  speed: 0.85, hp: 1.6, bite: 10, from: 0.2 },
  { file: 'animals/canada-goose',  attack: 'attack', r: 9,  speed: 1.15, hp: 1.0, bite: 9,  from: 0.25 },
  { file: 'dogs/husky',            attack: 'bite',   r: 10, speed: 1.15, hp: 1.2, bite: 9,  from: 0.3 },
  { file: 'dogs/sheepdog',         attack: 'bite',   r: 10, speed: 0.95, hp: 1.5, bite: 9,  from: 0.3 },
  { file: 'animals/seagull',       attack: 'attack', r: 7,  speed: 1.25, hp: 0.7, bite: 7,  from: 0.3 },
  { file: 'animals/skunk',         attack: 'attack', r: 9,  speed: 0.9,  hp: 1.3, bite: 12, from: 0.35 },
  { file: 'dogs/golden-retriever', attack: 'bite',   r: 11, speed: 1.05, hp: 1.4, bite: 10, from: 0.35 },
  { file: 'animals/crow',          attack: 'attack', r: 8,  speed: 1.3,  hp: 0.8, bite: 7,  from: 0.4 },
  { file: 'animals/beaver',        attack: 'attack', r: 9,  speed: 0.85, hp: 1.8, bite: 10, from: 0.4 },
  { file: 'animals/porcupine',     attack: 'attack', r: 9,  speed: 0.7,  hp: 2.2, bite: 14, from: 0.45 },
  { file: 'humans/neighbour',      attack: 'attack', r: 10, speed: 0.8,  hp: 2.2, bite: 10, from: 0.45 },
  { file: 'dogs/german-shepherd',  attack: 'bite',   r: 11, speed: 1.2,  hp: 1.6, bite: 11, from: 0.5 },
  { file: 'humans/jogger',         attack: 'attack', r: 9,  speed: 1.3,  hp: 1.3, bite: 8,  from: 0.5 },
  { file: 'humans/gardener',       attack: 'attack', r: 11, speed: 0.8,  hp: 2.4, bite: 12, from: 0.5 },
  { file: 'humans/mail-carrier',   attack: 'attack', r: 10, speed: 1.0,  hp: 2.0, bite: 10, from: 0.55 },
  { file: 'humans/paper-kid',      attack: 'attack', r: 9,  speed: 1.15, hp: 1.4, bite: 8,  from: 0.55 },
  { file: 'animals/coyote',        attack: 'attack', r: 11, speed: 1.3,  hp: 1.6, bite: 12, from: 0.6 },
  { file: 'humans/kid-on-bike',    attack: 'attack', r: 10, speed: 1.5,  hp: 1.2, bite: 9,  from: 0.6 },
  { file: 'humans/grandma',        attack: 'attack', r: 11, speed: 0.6,  hp: 3.0, bite: 14, from: 0.65 },
  { file: 'dogs/great-dane',       attack: 'bite',   r: 12, speed: 1.0,  hp: 2.4, bite: 14, from: 0.7 },
  { file: 'humans/bbq-dad',        attack: 'attack', r: 10, speed: 0.8,  hp: 2.6, bite: 12, from: 0.7 },
  { file: 'humans/hockey-teen',    attack: 'attack', r: 12, speed: 1.1,  hp: 2.2, bite: 12, from: 0.75 },
  { file: 'humans/crossing-guard', attack: 'attack', r: 10, speed: 0.9,  hp: 2.6, bite: 12, from: 0.8 },
  { file: 'humans/animal-control', attack: 'attack', r: 11, speed: 1.0,  hp: 3.2, bite: 15, from: 0.9 },
];
// Bosses: each comes once, when the round gets this far ('at'). heavy: not pushed back by hits.
const BOSSES = [
  { file: 'animals/moose',      attack: 'attack', r: 30, speed: 0.7,  hp: 12, bite: 22, at: 0.4, heavy: true, name: 'A moose wanders into town!' },
  { file: 'animals/black-bear', attack: 'attack', r: 24, speed: 0.85, hp: 14, bite: 28, at: 1.0, heavy: true, name: 'A black bear smells the trash!' },
];
for (const t of [...ENEMY_TYPES, ...BOSSES]) { cat(t.file); cat(`${t.file}-back`); cat(`${t.file}-${t.attack}`); }

const dogs = [];              // the pests: { type, x, y, r, faceX, faceY (which way it looks), biteWait, biteAnim, health, maxHealth, speed, boss }
let spawnWait = DOG_SPAWN_GAP[0];
const bossesCome = new Set(); // bosses that have already come

// How far along the round is: 0 at the start, 1 when the clock hits zero, up to 2 in overtime.
function stage() { return Math.min(2, elapsed / ROUND_TIME); }
// A value from a [start, clock-zero] pair for the current stage (it keeps going past the end).
function byStage([start, end]) { return start + (end - start) * stage(); }

// A free world spot on a frame a little outside the screen, for something r wide (or null).
function spawnSpot(r) {
  const m = 80, w = view.width + 2 * m, h = view.height + 2 * m;
  for (let tries = 0; tries < 20; tries++) {
    let t = random() * 2 * (w + h), sx, sy;
    if (t < w) { sx = t; sy = 0; }
    else if ((t -= w) < h) { sx = w; sy = t; }
    else if ((t -= h) < w) { sx = t; sy = h; }
    else { sx = 0; sy = t - w; }
    const p = unproject(sx - m, sy - m);
    const inside = p.x > r && p.y > r && p.x < MAP_W - r && p.y < MAP_H - r;
    if (inside && !blocked(p.x, p.y, r)) return p;
  }
  return null;
}

function addEnemy(type, p, boss = false) {
  const hp = Math.round(byStage(DOG_HEALTH) * type.hp * TOUGHER);
  dogs.push({ type, x: p.x, y: p.y, r: type.r, faceX: 1, faceY: 0, biteWait: 0, biteAnim: 0, health: hp, maxHealth: hp,
              walk: random() * 6, moving: false,
              speed: byStage(DOG_SPEED) * type.speed * QUICKER, hitFlash: 0, boss });
}

function spawnDogs(seconds) {
  // A boss whose time has come.
  for (const b of BOSSES) {
    if (bossesCome.has(b) || stage() < b.at) continue;
    const p = spawnSpot(b.r);
    if (p) { bossesCome.add(b); addEnemy(b, p, true); showBanner(b.name); }
  }
  spawnWait -= seconds;
  const max = Math.min(DOG_LIMIT, Math.round(byStage(MAX_DOGS)));
  if (spawnWait > 0 || dogs.length >= max) return;
  spawnWait = Math.max(0.15, byStage(DOG_SPAWN_GAP));
  // Any kind whose time has come; the newest kinds a bit more often, so each stage feels different.
  const ready = ENEMY_TYPES.filter(t => t.from <= stage());
  const newest = ready.filter(t => t.from > stage() - 0.25);
  const type = newest.length && random() < 0.4 ? pick(newest) : pick(ready);
  const p = spawnSpot(type.r);
  if (p) addEnemy(type, p);
}

function moveDogs(seconds) {
  for (const d of dogs) {
    const reach = PLAYER_RADIUS + d.r + 4;
    d.biteWait = Math.max(0, d.biteWait - seconds);
    d.biteAnim = Math.max(0, d.biteAnim - seconds);
    const dx = player.x - d.x, dy = player.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    let vx = dx / dist, vy = dy / dist;
    d.faceX = vx; d.faceY = vy;
    // Keep a little apart from other pests, so they don't pile into one spot.
    for (const o of dogs) {
      if (o === d) continue;
      const ox = d.x - o.x, oy = d.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < (d.r + o.r) * 1.2) { vx += ox / od * 0.8; vy += oy / od * 0.8; }
    }
    const len = Math.hypot(vx, vy) || 1;
    const step = dist > reach ? d.speed * seconds : 0;
    d.moving = step > 0;
    d.walk += seconds * d.speed * 0.09;          // steps come quicker the faster it runs
    const mx = vx / len * step, my = vy / len * step;
    // Same sliding as the player. If both ways are blocked, try going round sideways.
    let moved = false;
    if (!blocked(d.x + mx, d.y, d.r)) { d.x += mx; moved = true; }
    if (!blocked(d.x, d.y + my, d.r)) { d.y += my; moved = true; }
    // Stuck (a fence, a car...): walk sideways along it for a while, turning the other way if that's blocked too.
    d.detourTime = Math.max(0, (d.detourTime || 0) - seconds);
    if (!moved && step > 0) {
      if (!d.detourTime) { d.detour = random() < 0.5 ? 1 : -1; d.detourTime = 0.8; }
      for (const turn of [d.detour, -d.detour]) {
        const sx = -my * turn, sy = mx * turn;                   // a quarter turn
        if (!blocked(d.x + sx, d.y + sy, d.r)) { d.x += sx; d.y += sy; d.detour = turn; break; }
      }
    } else if (d.detourTime && step > 0) {
      const sx = -my * d.detour * 0.7, sy = mx * d.detour * 0.7;   // keep edging round while the detour lasts
      if (!blocked(d.x + sx, d.y + sy, d.r)) { d.x += sx; d.y += sy; }
    }
    // Bite!
    if (dist <= reach && d.biteWait === 0 && health > 0) {
      d.biteWait = DOG_BITE_GAP;
      d.biteAnim = 0.3;
      const bite = Math.max(1, d.type.bite - hero.armor);        // armor takes some off every bite
      health = Math.max(0, health - bite);
      hurtFlash = 0.25;
      popups.push({ x: player.x, y: player.y, text: `-${bite}`, color: '#ff5a4a', age: 0 });
      if (d.type.bite >= 14) addEffect(cat('effects/dizzy'), player.x, player.y, 44, 0.6, 4);
      if (health === 0) endRound(false);
    }
  }
}

// ---------- 6. Attacks ----------
// The weapon rules live in weapons.js (shared with the weapons designer): the runner fires every
// weapon by itself, moves what's in the air and works out each hit. This "world" is how it reaches
// the street: the pests, what happens when one is hit, lifesteal, and the effects to show.
let shooed = 0;               // pests chased off so far

// Where a thrown thing lands without hitting anything, some leave a mark.
const SPLATS = { egg: 'decals/egg-splat', 'rotten-apple': 'decals/juice-splat', 'water-balloon': 'decals/water-puddle' };
for (const n of Object.values(SPLATS)) cat(n);
for (const n of SHOTS) cat(shotPicture(n));
cat('effects/impact'); cat('effects/flame'); cat('effects/smoke'); cat('effects/zap'); cat('decals/scorch');

const streetWorld = {
  get player() { return player; },   // (player is set up further down)
  enemies: () => dogs,
  hurt(d, dmg, crit, dx, dy, knock) {
    d.health -= dmg;
    d.hitFlash = 0.1;
    if (crit) popups.push({ x: d.x, y: d.y, text: `${Math.round(dmg)}!`, color: '#ffd34d', age: 0 });
    // Pushed back a little, unless a wall is in the way (bosses are too heavy).
    const nx = d.x + dx * knock, ny = d.y + dy * knock;
    if (!d.type.heavy && !blocked(nx, ny, d.r)) { d.x = nx; d.y = ny; }
    if (d.health <= 0) shoo(d);
  },
  heal(n) { health = Math.min(hero.maxHealth, health + n); },
  effect(kind, x, y, size) {
    if (kind === 'hit') addEffect('effects/impact', x, y, SHOT_HEIGHT - 10, 0.16, 0);
    if (kind === 'explode') { addEffect('effects/flame', x, y, 0, 0.35, 8); addEffect('effects/smoke', x, y, 4, 0.5, 14); addMark('decals/scorch', x, y); }
    if (kind === 'chain') addEffect('effects/zap', size.x, size.y, 6, 0.2, 0);
  },
  blocked: (x, y) => blocked(x, y, 0),
  random,
  landed(s) { if (!s.done.size && SPLATS[s.name]) addMark(SPLATS[s.name], s.x, s.y); },
};

function attack(seconds) {
  const before = runner.fired || 0;
  runner.update(seconds);
  if ((runner.fired || 0) > before) player.throwTime = 0.18;
  for (const d of dogs) d.hitFlash = Math.max(0, d.hitFlash - seconds);
  health = Math.min(hero.maxHealth, health + hero.regen * seconds);   // health per second from your items
}

// A pest is chased off: a puff of dust (feathers for birds, a stink cloud for the skunk), and it may drop something.
const BIRDS = new Set(['animals/canada-goose', 'animals/seagull', 'animals/crow']);
function shoo(d) {
  dogs.splice(dogs.indexOf(d), 1);
  shooed++;
  const f = d.type.file;
  const fx = BIRDS.has(f) ? 'effects/feathers' : f === 'animals/skunk' ? 'effects/stink-cloud' : pick(['effects/dust-a', 'effects/dust-b', 'effects/dust-c']);
  addEffect(cat(fx), d.x, d.y, 0, 0.5, 12);
  if (d.boss) {
    addEffect(cat('effects/smoke'), d.x, d.y, 0, 0.9, 30);
    addMark(cat('decals/crater'), d.x, d.y, Infinity);
    dropPickup('treasure-chest', d.x, d.y, 0.6);
    dropPickup('golden-can', d.x, d.y, 0.6);
    for (let i = 0; i < 8; i++) dropPickup(pick(['orb-gold', 'orb-blue', 'gold-coin']), d.x, d.y, 1.4);
    showBanner('Boss shooed!');
    return;
  }
  const roll = random();
  if (roll < 0.30) dropPickup('orb-green', d.x, d.y);
  else if (roll < 0.38) dropPickup('orb-blue', d.x, d.y);
  else if (roll < 0.40) dropPickup('orb-gold', d.x, d.y);
  else if (roll < 0.45) dropPickup(pick(FOODS), d.x, d.y);
  else if (roll < 0.455) dropPickup('magnet', d.x, d.y);
  else if (roll < 0.49 && f.startsWith('dogs/')) dropPickup('dog-bone', d.x, d.y);
}

// ---------- 6b. Pickups ----------
// Things lying on the ground. Walk over them (or near: they fly to you) to pick them up.
// shinies: money for the shop later. heal: health back. speed: seconds of running faster.
// magnet: every pickup on the map flies to you. trash: counts as looted cans.
const PICKUPS = {
  'orb-green': { shinies: 1 }, 'orb-blue': { shinies: 3 }, 'orb-gold': { shinies: 10, fx: 'sparkle' },
  'gold-coin': { shinies: 5 }, 'coin-stack': { shinies: 10, fx: 'sparkle' }, 'bottle-cap': { shinies: 1 }, marble: { shinies: 2 },
  key: { shinies: 5 }, 'treasure-chest': { shinies: 40, fx: 'sparkle' }, 'golden-can': { trash: 3, fx: 'sparkle' },
  'pizza-slice': { heal: 15 }, donut: { heal: 10 }, sandwich: { heal: 15 }, poutine: { heal: 25 }, cheese: { heal: 8 },
  'apple-core': { heal: 5 }, 'maple-syrup': { heal: 20 }, 'first-aid': { heal: 40 }, bandage: { heal: 15 },
  'energy-drink': { speed: 6 }, magnet: { magnet: true },
  sock: { shinies: 2 }, 'old-boot': { shinies: 2 }, 'rubber-duck': { shinies: 3 }, 'toy-car': { shinies: 3 }, 'fish-bone': { shinies: 1 },
  'dog-bone': { shinies: 2 }, 'banana-peel': { shinies: 1 }, pinecone: { shinies: 1 }, acorn: { shinies: 1 }, 'soda-can': { shinies: 2 },
};
for (const n of Object.keys(PICKUPS)) cat(`pickups/${n}`);
const FOODS = ['pizza-slice', 'donut', 'sandwich', 'poutine', 'cheese', 'apple-core', 'maple-syrup', 'bandage'];
const JUNK = ['sock', 'old-boot', 'rubber-duck', 'toy-car', 'fish-bone', 'banana-peel', 'pinecone', 'acorn', 'soda-can', 'bottle-cap', 'marble', 'key'];

const pickups = [];           // { x, y, kind, vx, vy (a little pop when dropped), age, pulled }
let shinies = 0;
let speedBoost = 0;           // seconds of faster running left

// What a looted can gives.
function canLoot() {
  const r = random();
  return r < 0.5 ? pick(JUNK) : r < 0.75 ? pick(['gold-coin', 'coin-stack', 'orb-blue']) : r < 0.93 ? pick(FOODS)
       : r < 0.96 ? 'first-aid' : r < 0.98 ? 'energy-drink' : 'magnet';
}

function dropPickup(kind, x, y, pop = 0.5) {
  const a = random() * Math.PI * 2, v = (60 + random() * 120) * pop;
  pickups.push({ x, y, kind, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, pulled: false });
  if (pickups.length > 400) pickups.shift();
}

function movePickups(seconds) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.age += seconds;
    const dx = player.x - p.x, dy = player.y - p.y, dist = Math.hypot(dx, dy) || 1;
    if (dist < PICKUP_PULL * hero.pickup && p.age > 0.4) p.pulled = true;
    if (p.pulled) {
      const v = 260 + p.age * 60;                  // flies to you, faster and faster
      p.x += dx / dist * Math.min(dist, v * seconds); p.y += dy / dist * Math.min(dist, v * seconds);
    } else {
      // The pop when dropped, slowing down; it stops at walls.
      const nx = p.x + p.vx * seconds, ny = p.y + p.vy * seconds;
      if (!blocked(nx, ny, 4)) { p.x = nx; p.y = ny; }
      p.vx *= Math.pow(0.02, seconds); p.vy *= Math.pow(0.02, seconds);
    }
    if (dist < PICKUP_REACH && p.age > 0.25) { collect(p); pickups.splice(i, 1); }
  }
  speedBoost = Math.max(0, speedBoost - seconds);
}

function collect(p) {
  const what = PICKUPS[p.kind];
  let text, color = '#ffd34d';
  if (what.shinies) { shinies += what.shinies; text = `+${what.shinies}`; color = '#bfe8ff'; }
  if (what.heal) {
    const got = Math.round(Math.min(what.heal, hero.maxHealth - health));
    health += got; text = `+${got} health`; color = '#7ee07a';
    addEffect(cat('effects/heart'), player.x, player.y, 40, 0.6, 18);
  }
  if (what.trash) { looted += what.trash; text = `+${what.trash} trash`; }
  if (what.speed) { speedBoost = what.speed; text = 'Zoom!'; color = '#ff9a3c'; addEffect(cat('effects/zap'), player.x, player.y, 6, 0.3, 0); }
  if (what.magnet) {
    for (const o of pickups) o.pulled = true;
    text = 'Magnet!'; color = '#ff6ad5';
    addEffect(cat('effects/zap'), player.x, player.y, 6, 0.4, 0);
  }
  if (what.fx) addEffect(cat(`effects/${what.fx}`), player.x, player.y, 20, 0.5, 14);
  popups.push({ x: player.x, y: player.y, text, color, age: 0 });
}

// ---------- 6c. Effects and marks ----------
// Effects: short pictures that rise a little and fade (dust, impact stars, hearts...).
const effects = [];           // { sprite, x, y, z, age, life, rise }
function addEffect(sprite, x, y, z = 0, life = 0.4, rise = 20) {
  effects.push({ sprite, x, y, z, age: 0, life, rise });
}
function ageEffects(seconds) {
  for (let i = effects.length - 1; i >= 0; i--) if ((effects[i].age += seconds) > effects[i].life) effects.splice(i, 1);
}
// Marks: pictures on the ground that appear during the round (splats, scorch, spilled trash).
// They fade out after 'life' seconds (Infinity: they stay).
const marks = [];             // { sprite, x, y, age, life }
function addMark(sprite, x, y, life = 12) {
  marks.push({ sprite, x, y, age: 0, life });
  if (marks.length > 80) marks.splice(marks.findIndex(m => m.life !== Infinity), 1);
}
function ageMarks(seconds) {
  for (let i = marks.length - 1; i >= 0; i--) if ((marks[i].age += seconds) > marks[i].life) marks.splice(i, 1);
}

// A short message in the middle of the screen.
let bannerTime = 0;
function showBanner(text) {
  const el = document.getElementById('banner');
  el.textContent = text; el.style.opacity = 1; bannerTime = 2.5;
}
function ageBanner(seconds) {
  if (bannerTime > 0 && (bannerTime -= seconds) <= 0) document.getElementById('banner').style.opacity = 0;
}

// ---------- 7. The player ----------
// facing: 1 or -1, the way you last walked on screen; up: walking away from the camera (shows the back view);
// walkTime: for the walking animation; throwTime: seconds left of the throwing pose.
// You start on the avenue's north sidewalk, near the middle of town.
const player = { x: 90.5 * TILE, y: 67.5 * TILE, facing: 1, up: false, moving: false, walkTime: 0, throwTime: 0, rummaging: false };
let health = 100;
let hurtFlash = 0;            // seconds your critter still flashes red after a bite
let started = false;          // false until you've picked a critter
let over = false;             // true once the round has ended, either way
let escaped = false;          // ...and true if you got away
let elapsed = 0;              // seconds since the round began

// The critter picker shown before the round. Click one or press its number key.
function chooseCritter(key) {
  if (started || !CRITTERS[key]) return;
  critter = key; stats = CRITTERS[key];
  try { localStorage.setItem('culdesack.critter', key); } catch (e) { /* storage off */ }
  // Your weapons and numbers: the critter plus the items in the weapons designer's test backpack.
  const loadout = makeLoadout(key, shopRun ? shopRun.placed : loadLoadout().placed, loadItems());
  setTimeout(() => showBanner(!loadout.weapons.length ? 'No weapons! Put some on your Outfit in the shop.'
                              : FROM_SHOP ? `Round ${ROUND}: grab the trash and get out!` : 'Grab the trash and get out!'), 300);
  hero = loadout.hero;
  health = hero.maxHealth;
  runner = new WeaponRunner(loadout, streetWorld);
  for (const n of ['', '-back', '-throw', '-walk-a', '-walk-b', '-hurt', '-cheer', '-dig']) if (key === 'raccoon' || ['', '-back', '-throw'].includes(n)) cat(`critters/${key}${n}`);
  loadSprites();
  document.getElementById('choose').hidden = true;
  started = true;
  lastTime = performance.now();
}
function buildPicker() {
  const box = document.getElementById('critters');
  Object.entries(CRITTERS).forEach(([key, c], i) => {
    const b = document.createElement('button');
    b.innerHTML = `<img src="art/catalog/critters/${key}.png" alt=""><b>${c.name}</b><span>${c.note}</span><span class="key">press ${i + 1}</span>`;
    b.onclick = () => chooseCritter(key);
    box.appendChild(b);
  });
  addEventListener('keydown', e => { const k = Object.keys(CRITTERS)[Number(e.key) - 1]; if (k) chooseCritter(k); });
  // The critter picked on the start menu (fight.html?critter=red-fox, or the one remembered) skips this picker.
  let remembered = null;
  try { remembered = localStorage.getItem('culdesack.critter'); } catch (e) { /* storage off */ }
  const asked = new URLSearchParams(location.search).get('critter') || remembered;
  if (asked) chooseCritter(asked);
}

// ---------- 8. The clock and the way out ----------
// Walk into the forest round the edge and keep going to slip away with what you've looted.
function inForest(x, y) {
  const edge = FOREST * TILE;
  return x < edge || y < edge || x > MAP_W - edge || y > MAP_H - edge;
}
function atMapEdge(x, y) {
  const r = PLAYER_RADIUS + 1;
  return x <= r || y <= r || x >= MAP_W - r || y >= MAP_H - r;
}

function clockText(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateClock(seconds) {
  elapsed += seconds;
  const left = ROUND_TIME - elapsed;
  const el = document.getElementById('timer');
  el.textContent = left > 0 ? clockText(left) : "Time's up! Run for the forest!";
  el.className = left > 30 ? '' : 'late';
  document.getElementById('escape-hint').hidden = !inForest(player.x, player.y);
  if (atMapEdge(player.x, player.y)) endRound(true);
}

// The round is over: escaped (true) or chased off (false). Shows the results.
function endRound(got) {
  if (over) return;
  over = true;
  escaped = got;
  document.getElementById('over-title').textContent = escaped
    ? 'You slipped into the forest!' : 'The neighbourhood chased you off!';
  document.getElementById('over-stats').textContent = escaped
    ? `Trash looted: ${looted}  ·  Shinies: ${shinies}  ·  Pests shooed: ${shooed}  ·  Time: ${clockText(elapsed)}`
    : `You dropped your loot. Pests shooed: ${shooed}`;
  // Your loot as gold for the shop: every can of trash is worth 1 gold, and every 10 shinies 1 more.
  // Chased off, you drop the trash and half the shinies.
  goldEarned = escaped ? looted + Math.floor(shinies / 10) : Math.floor(shinies / 20);
  document.getElementById('over-gold').textContent = `+${goldEarned} gold`;
  if (FROM_SHOP) {
    document.getElementById('back-to-shop').hidden = false;
    document.getElementById('over-keys').textContent = 'Press Enter to go back to the shop';
  }
  document.getElementById('over').className = escaped ? 'won' : '';
  document.getElementById('escape-hint').hidden = true;
  document.getElementById('over').hidden = false;
}
// Back to the shop (which opened this fight in a frame) with what you gathered.
function backToShop() {
  if (window.parent !== window) window.parent.postMessage({ type: 'street-done', gold: goldEarned, escaped, looted, shinies, shooed }, '*');
  else location.href = 'shop.html';
}
document.getElementById('back-to-shop').addEventListener('click', backToShop);
addEventListener('keydown', e => {
  if (!over) return;
  if (FROM_SHOP) { if (e.key === 'Enter') backToShop(); return; }
  if (e.key.toLowerCase() === 'r') location.reload();
  if (e.key.toLowerCase() === 'm') location.href = 'index.html';   // back to the start menu
});

// ---------- 9. The keyboard and walking ----------
const keysDown = new Set();

addEventListener('keydown', e => { keysDown.add(e.key.toLowerCase()); });
addEventListener('keyup', e => { keysDown.delete(e.key.toLowerCase()); });
addEventListener('blur', () => keysDown.clear());   // stop walking when the window loses focus

// Is a world spot inside something solid, for something r wide (your critter unless told)?
// Solid: houses, cars, cans, fences, the pond, and big things like couches, benches, lamps and tree trunks.
// Checking thousands of boxes for every step would be slow, so once the town is built every box is
// sorted into a grid of squares (BLOCK_CELL wide), and a spot only checks the boxes in its own squares.
const BLOCK_CELL = 64;
let blockGrid = null;         // blockGrid[row * gridCols + col] = boxes touching that square
let gridCols = 0;
function buildBlockGrid() {
  gridCols = Math.ceil(MAP_W / BLOCK_CELL);
  blockGrid = Array.from({ length: gridCols * Math.ceil(MAP_H / BLOCK_CELL) }, () => []);
  const boxes = [...houses, ...solids, ...cans.map(canBox),
                 ...fences.map(p => p.along === 'x' ? { x0: p.x, y0: p.y - 3, x1: p.x + TILE, y1: p.y + 3 }
                                                    : { x0: p.x - 3, y0: p.y, x1: p.x + 3, y1: p.y + TILE }),
                 ...decor.filter(t => t.box).map(t => t.box)];
  for (const b of boxes)
    for (let r = Math.max(0, Math.floor(b.y0 / BLOCK_CELL)); r <= Math.min(MAP_H / BLOCK_CELL - 1, Math.floor(b.y1 / BLOCK_CELL)); r++)
      for (let c = Math.max(0, Math.floor(b.x0 / BLOCK_CELL)); c <= Math.min(gridCols - 1, Math.floor(b.x1 / BLOCK_CELL)); c++)
        blockGrid[r * gridCols + c].push(b);
}
function blocked(x, y, r = PLAYER_RADIUS) {
  const hits = b => x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r;
  if (inPond(x, y, r)) return true;
  if (!blockGrid) return houses.some(hits) || solids.some(hits) || cans.some(c => hits(canBox(c)));   // while building the town
  const c0 = Math.floor((x - r) / BLOCK_CELL), c1 = Math.floor((x + r) / BLOCK_CELL);
  const r0 = Math.floor((y - r) / BLOCK_CELL), r1 = Math.floor((y + r) / BLOCK_CELL);
  for (let row = r0; row <= r1; row++) {
    if (row < 0 || row * BLOCK_CELL >= MAP_H) continue;
    for (let col = c0; col <= c1; col++) {
      if (col < 0 || col >= gridCols) continue;
      if (blockGrid[row * gridCols + col].some(hits)) return true;
    }
  }
  return false;
}

function movePlayer(seconds) {
  // Keys give a direction on the screen: right, left, up, down.
  let sx = 0, sy = 0;
  if (keysDown.has('a') || keysDown.has('arrowleft')) sx -= 1;
  if (keysDown.has('d') || keysDown.has('arrowright')) sx += 1;
  if (keysDown.has('w') || keysDown.has('arrowup')) sy -= 1;
  if (keysDown.has('s') || keysDown.has('arrowdown')) sy += 1;
  player.throwTime = Math.max(0, player.throwTime - seconds);
  player.moving = sx !== 0 || sy !== 0;
  if (!player.moving) return;
  player.walkTime += seconds;
  if (sx !== 0) player.facing = sx;     // remember which way you last walked, for the sprite
  player.up = sy < 0;                   // walking up the screen: show the back
  const speed = hero.move * (speedBoost > 0 ? 1.4 : 1);
  const len = Math.hypot(sx, sy);       // so walking diagonally isn't faster
  sx = sx / len * speed * seconds;
  sy = sy / len * speed * seconds;
  // Turn that screen step into a world step (the reverse of project()).
  const dx = sy / ISO_Y / 2 + sx / ISO_X / 2;
  const dy = sy / ISO_Y / 2 - sx / ISO_X / 2;
  // Try each direction on its own, so you slide along a wall instead of sticking to it.
  const r = PLAYER_RADIUS;
  const nx = Math.max(r, Math.min(MAP_W - r, player.x + dx));
  if (!blocked(nx, player.y)) player.x = nx;
  const ny = Math.max(r, Math.min(MAP_H - r, player.y + dy));
  if (!blocked(player.x, ny)) player.y = ny;
}

// ---------- 10. The camera ----------
// The world spot shown in the middle of the screen. It simply follows the raccoon.
const camera = { x: 0, y: 0 };
function followPlayer() { camera.x = player.x; camera.y = player.y; }

// ---------- 11. Drawing ----------
// All drawing lives here, so it can later be swapped for WebGL without touching the rest.
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const view = { width: 0, height: 0 };   // screen size in CSS pixels

// Isometric: one world step to the right goes right and down on screen, one step down goes
// left and down. Tiles become diamonds twice as wide as tall.
const ISO_X = 1, ISO_Y = 0.5;

// How close the camera is: every art pixel is drawn this many screen pixels big. A whole number
// keeps the pixel art crisp (2 = twice as close as the art's own size).
const ZOOM = 2;
let pixel = 1;                // real screen pixels per art pixel (ZOOM times the screen's own scaling)
// Snap a position to the nearest real screen pixel. Everything drawn goes through this with the
// same camera offset, so the ground and the things on it move together and never wobble apart.
function snap(v) { return Math.round(v * pixel) / pixel; }

// Where the camera puts the middle of the screen, snapped (see snap()).
function cameraOffset() {
  return { cx: snap((camera.x - camera.y) * ISO_X) - snap(view.width / 2),
           cy: snap((camera.x + camera.y) * ISO_Y) - snap(view.height / 2) };
}
// The one place that turns a world position (and height z) into a screen position.
function project(x, y, z = 0) {
  const { cx, cy } = cameraOffset();
  return { x: (x - y) * ISO_X - cx, y: (x + y) * ISO_Y - z - cy };
}
// The reverse, for the ground (z = 0): which world spot is under this screen spot?
function unproject(sx, sy) {
  const { cx, cy } = cameraOffset();
  const a = (sx + cx) / ISO_X;    // = x - y
  const b = (sy + cy) / ISO_Y;    // = x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

const GROUND_COLORS = {
  grass:    ['#4f7a3a', '#557f3e', '#4a7436'],
  road:     ['#45474a', '#484a4d', '#434548'],
  sidewalk: ['#9a968c', '#a19d93', '#96928a'],
  forest:   ['#24401f', '#284622', '#213b1c'],
};
const OUTSIDE = '#1a3018';   // deep forest beyond the map

// The game draws in art pixels: the screen is ZOOM times fewer of them wide and tall.
let screenRatio = 1;          // the screen's own scaling (2 on many high-res screens)
function resize() {
  screenRatio = window.devicePixelRatio || 1;
  pixel = screenRatio * ZOOM;
  view.width = innerWidth / ZOOM;
  view.height = innerHeight / ZOOM;
  canvas.width = Math.round(innerWidth * screenRatio);
  canvas.height = Math.round(innerHeight * screenRatio);
  ctx.setTransform(pixel, 0, 0, pixel, 0, 0);   // one unit = one art pixel
  ctx.imageSmoothingEnabled = false;            // keep pixel art crisp
}
addEventListener('resize', resize);

// Darken (amount < 0) or lighten (amount > 0) a colour like '#a1b2c3'.
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v + amount * (amount < 0 ? v : 255 - v))));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// ----- The painted ground (textures made by tools/make_ground.py into art/ground/) -----
// Once all four textures have loaded, the whole ground is painted once: first flat, as seen from
// straight above (lawn, road, sidewalk and forest squares, curbs, the yellow road line), then turned
// into the slanted isometric view on a big hidden canvas. Each frame just copies the part on screen.
// A band of forest beyond the map's edge is included, so the outside isn't empty.
const GROUND_FILES = { grass: 'lawn', road: 'road', sidewalk: 'sidewalk', forest: 'forest' };
const BEYOND = 8 * TILE;      // forest painted beyond each edge of the map
let ground3d = null;          // the slanted ground (made in pieces as needed), or null until it's ready

// Waits for the four textures and the ground marks' pictures, then paints.
function loadGround() {
  const imgs = {};
  const textures = Object.entries(GROUND_FILES).map(([kind, file]) => new Promise(done => {
    const img = new Image();
    img.onload = () => { imgs[kind] = img; done(); };
    img.src = `art/ground/${file}.png`;
  }));
  const marks = decals.map(d => loadSprite(SPRITES[d.sprite]));
  Promise.all([...textures, ...marks]).then(() => buildGround(imgs));
}

function buildGround(imgs) {
  // 1. Flat, seen from above, in world pixels (shifted by BEYOND so the outside forest fits).
  const W = MAP_W + 2 * BEYOND, H = MAP_H + 2 * BEYOND;
  const flat = document.createElement('canvas');
  flat.width = W; flat.height = H;
  const f = flat.getContext('2d');
  f.translate(BEYOND, BEYOND);
  const fill = kind => { f.fillStyle = f.createPattern(imgs[kind], 'repeat'); };
  fill('forest');
  f.fillRect(-BEYOND, -BEYOND, W, H);
  for (const kind of ['grass', 'road', 'sidewalk']) {
    fill(kind);
    f.beginPath();
    for (let r = 0; r < MAP_ROWS; r++)
      for (let c = 0; c < MAP_COLS; c++)
        if (ground[r][c] === kind) f.rect(c * TILE, r * TILE, TILE, TILE);
    f.fill();
  }
  paintGrass(f);
  // The round ends of the cul-de-sacs as true circles (the squares above give them stair steps):
  // a ring of sidewalk with a light curb, and road inside. Same places and sizes as in buildMap().
  for (const b of BULBS) {
    const bx = (b.c + 0.5) * TILE, by = (b.r + 0.5) * TILE, br = b.rad * TILE, [dx, dy] = b.dir;
    const circle = r => { f.beginPath(); f.arc(bx, by, r, 0, Math.PI * 2); };
    // A strip 'w' wide, 'side' off the stem's middle line, from 'from' to 'to' along the stem.
    const stem = (side, w, from, to) => {
      const a = Math.min(from, to), len = Math.abs(to - from);
      if (dy) f.fillRect(bx + side, Math.min(by + dy * from, by + dy * to), w, len);
      else f.fillRect(Math.min(bx + dx * from, bx + dx * to), by + side, len, w);
    };
    fill('grass'); circle(br + TILE * 1.6); f.fill();
    fill('sidewalk'); circle(br + TILE * 1.1); f.fill();
    f.strokeStyle = 'rgba(40, 52, 30, 0.35)'; circle(br + TILE * 1.1); f.lineWidth = 2; f.stroke();
    fill('sidewalk');                                                    // where the stem street joins
    stem(-2.5 * TILE, TILE, br * 0.8, br + 2.5 * TILE);
    stem(1.5 * TILE, TILE, br * 0.8, br + 2.5 * TILE);
    fill('road'); circle(br + TILE * 0.5); f.fill();
    stem(-1.5 * TILE, 3 * TILE, 0, br + 2.5 * TILE);
    f.strokeStyle = 'rgba(230, 226, 214, 0.9)'; f.lineWidth = 3;
    const a = Math.atan2(dy, dx);                                        // the gap in the curb faces the stem
    f.beginPath(); f.arc(bx, by, br + TILE * 0.5, a + 0.26, a + Math.PI * 2 - 0.26); f.stroke();
  }
  // Curbs: a light edge where sidewalk meets road, a soft dark one where sidewalk meets lawn.
  const kindAt = (c, r) => (ground[r] && ground[r][c]) || 'forest';
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (ground[r][c] !== 'sidewalk') continue;
      if (BULBS.some(b => Math.hypot(c - b.c, r - b.r) < b.rad + 2.2)) continue;   // drawn round above
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const other = kindAt(c + dc, r + dr);
        if (other === 'sidewalk') continue;
        f.fillStyle = other === 'road' ? 'rgba(230, 226, 214, 0.9)' : 'rgba(40, 52, 30, 0.35)';
        const t = other === 'road' ? 3 : 2;
        const x = c * TILE + (dc === 1 ? TILE - t : 0), y = r * TILE + (dr === 1 ? TILE - t : 0);
        f.fillRect(x, y, dc ? t : TILE, dr ? t : TILE);
      }
    }
  }
  paintYards(f, fill);
  paintPark(f, fill);
  // A dashed yellow line down the middle of the wide streets (not across crossings).
  f.fillStyle = 'rgba(226, 184, 72, 0.85)';
  for (const s of STREETS) {
    if (s.r1 - s.r0 === 4) {
      const row = s.r0 + 2;
      for (let c = s.c0; c <= s.c1; c++)
        if (c % 2 === 0 && kindAt(c, s.r0 - 1) !== 'road' && kindAt(c, s.r1 + 1) !== 'road')
          f.fillRect(c * TILE + 4, row * TILE + TILE / 2 - 2, TILE - 8, 4);
    } else if (s.c1 - s.c0 === 4) {
      const col = s.c0 + 2;
      for (let r = s.r0; r <= s.r1; r++)
        if (r % 2 === 0 && kindAt(s.c0 - 1, r) !== 'road' && kindAt(s.c1 + 1, r) !== 'road')
          f.fillRect(col * TILE + TILE / 2 - 2, r * TILE + 4, 4, TILE - 8);
    }
  }
  // The forest outside the map, a little darker, so the edge of town reads.
  f.fillStyle = 'rgba(10, 20, 8, 0.35)';
  f.fillRect(-BEYOND, -BEYOND, W, BEYOND);
  f.fillRect(-BEYOND, MAP_H, W, BEYOND);
  f.fillRect(-BEYOND, 0, BEYOND, MAP_H);
  f.fillRect(MAP_W, 0, BEYOND, MAP_H);

  // 2. The slanted (isometric) view is made in square pieces ("chunks") the first time the camera
  // comes near them; the town is too big to turn into one picture. Here we only list which ground
  // marks and grass tufts fall on which piece. Positions are on the slanted picture: world (x, y)
  // lands at ((x - y) + H, (x + y) / 2), shifted by BEYOND (see project()).
  const iso = (x, y) => { const fx = x + BEYOND, fy = y + BEYOND; return { X: (fx - fy) * ISO_X + H * ISO_X, Y: (fx + fy) * ISO_Y }; };
  const items = [];
  for (const d of decals) {
    const img = SPRITES[d.sprite].img;
    if (!img) continue;
    const p = iso(d.x, d.y);
    items.push({ img, X: Math.round(p.X - img.width / 2), Y: Math.round(p.Y - img.height / 2) });
  }
  const tufts = makeTufts();
  for (const t of placeTufts()) {
    const img = pick(tufts[t.kind]), p = iso(t.x, t.y);
    items.push({ img, X: Math.round(p.X - img.width / 2), Y: Math.round(p.Y - img.height) });
  }
  const bins = new Map();
  for (const it of items)
    for (let i = Math.floor(it.X / CHUNK); i <= Math.floor((it.X + it.img.width) / CHUNK); i++)
      for (let j = Math.floor(it.Y / CHUNK); j <= Math.floor((it.Y + it.img.height) / CHUNK); j++) {
        const key = i + ',' + j;
        if (!bins.has(key)) bins.set(key, []);
        bins.get(key).push(it);
      }
  ground3d = { flat, W, H, bins, chunks: new Map() };
}

// Make one slanted piece: turn the part of the flat picture that lands on it, then add its marks and tufts.
const CHUNK = 1024;           // size of a piece of the slanted ground, in pixels
const KEEP_CHUNKS = 28;       // how many pieces to keep ready; the farthest are dropped and remade if needed
function makeChunk(i, j) {
  const { flat, W, H, bins } = ground3d;
  // The flat picture's spots under the piece's four corners (the reverse of the turn), boxed.
  const corners = [[0, 0], [CHUNK, 0], [0, CHUNK], [CHUNK, CHUNK]].map(([a, b]) => {
    const X = i * CHUNK + a - H * ISO_X, Y = (j * CHUNK + b) / ISO_Y;   // X = fx - fy, Y = fx + fy
    return [(Y + X) / 2, (Y - X) / 2];
  });
  const sx = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 2), sy = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 2);
  const ex = Math.min(W, Math.ceil(Math.max(...corners.map(c => c[0]))) + 2), ey = Math.min(H, Math.ceil(Math.max(...corners.map(c => c[1]))) + 2);
  if (ex <= sx || ey <= sy) return null;                       // nothing of the town here
  const c = document.createElement('canvas');
  c.width = CHUNK; c.height = CHUNK;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;     // smooth while turning, or the slanted texture breaks up
  g.setTransform(ISO_X, ISO_Y, -ISO_X, ISO_Y, H * ISO_X - i * CHUNK, -j * CHUNK);
  g.drawImage(flat, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
  g.setTransform(1, 0, 0, 1, -i * CHUNK, -j * CHUNK);
  g.imageSmoothingEnabled = false;
  for (const it of bins.get(i + ',' + j) || []) g.drawImage(it.img, it.X, it.Y);
  return c;
}

function drawGround() {
  if (ground3d) {
    // Where the screen's top left corner falls on the slanted ground (see buildGround), using the
    // same snapped camera offset as project(), so the ground and the sprites stay together.
    const { cx, cy } = cameraOffset();
    const fx = cx + ground3d.H * ISO_X, fy = cy + BEYOND * 2 * ISO_Y;
    const i0 = Math.floor(fx / CHUNK), i1 = Math.floor((fx + view.width) / CHUNK);
    const j0 = Math.floor(fy / CHUNK), j1 = Math.floor((fy + view.height) / CHUNK);
    const { chunks } = ground3d;
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const key = i + ',' + j;
        if (!chunks.has(key)) chunks.set(key, makeChunk(i, j));
        const c = chunks.get(key);
        chunks.delete(key); chunks.set(key, c);                // most recently used goes to the end
        if (c) ctx.drawImage(c, i * CHUNK - fx, j * CHUNK - fy);
      }
    while (chunks.size > KEEP_CHUNKS) chunks.delete(chunks.keys().next().value);   // drop the longest unused
    return;
  }
  // Until the textures have loaded: plain coloured diamonds.
  // Find the range of tiles the screen's four corners cover.
  const corners = [unproject(0, 0), unproject(view.width, 0), unproject(0, view.height), unproject(view.width, view.height)];
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  const c0 = Math.max(0, Math.floor(Math.min(...xs) / TILE)), c1 = Math.min(MAP_COLS - 1, Math.floor(Math.max(...xs) / TILE));
  const r0 = Math.max(0, Math.floor(Math.min(...ys) / TILE)), r1 = Math.min(MAP_ROWS - 1, Math.floor(Math.max(...ys) / TILE));
  // Collect the diamonds by colour, then fill each colour in one go (much faster).
  const paths = new Map();
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const shades = GROUND_COLORS[ground[r][c]];
      const color = shades[(c * 7 + r * 13) % shades.length];
      if (!paths.has(color)) paths.set(color, new Path2D());
      const p = paths.get(color);
      const a = project(c * TILE, r * TILE), b = project((c + 1) * TILE, r * TILE);
      const d = project((c + 1) * TILE, (r + 1) * TILE), e = project(c * TILE, (r + 1) * TILE);
      p.moveTo(a.x, a.y); p.lineTo(b.x, b.y); p.lineTo(d.x, d.y); p.lineTo(e.x, e.y); p.closePath();
    }
  }
  ctx.lineWidth = 1;
  for (const [color, p] of paths) {
    ctx.fillStyle = color; ctx.fill(p);
    ctx.strokeStyle = color; ctx.stroke(p);   // closes the hairline gaps between diamonds
  }
}

// Fill a flat shape given by world corners [x, y, z].
function face(points, color) {
  ctx.beginPath();
  points.forEach(([x, y, z], i) => {
    const s = project(x, y, z);
    if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 16, 12, 0.35)';
  ctx.stroke();
}

// ----- Sprites: the painted pixel art (listed in section 2b) -----
// Each is drawn at its own size, one art pixel per screen pixel, standing on the spot given.
// Until a picture has loaded (or if it's missing), the old block shapes are drawn instead.

// A copy of a picture filled with one colour where the picture is solid (for hit flashes),
// or darkened (for looted bins). Made the first time it's needed.
function tinted(img, color, mode = 'source-in') {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = mode;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// Start loading one picture (once). Gives back a promise that is done when it has loaded (or failed).
function loadSprite(s) {
  if (!s.ready) s.ready = new Promise(done => {
    const img = new Image();
    img.onload = () => { s.img = img; done(s); };
    img.onerror = () => { console.warn('missing picture', s.path); done(s); };
    img.src = `art/${s.path}.png`;
  });
  return s.ready;
}
function loadSprites() { for (const s of Object.values(SPRITES)) loadSprite(s); }

function overlayOf(s, kind) {
  if (!s[kind]) s[kind] = kind === 'white' ? tinted(s.img, '#fff6e0') : kind === 'red' ? tinted(s.img, '#ff4a3a')
                                           : tinted(s.img, 'rgba(10, 8, 6, 0.55)', 'source-atop');
  return s[kind];
}

// Draw a sprite standing with its bottom middle on screen spot (sx, sy). Returns false if it isn't
// loaded yet, so the caller can draw a stand-in. look: 1 or -1, the way it should face.
// overlay: 'white' or 'red' (a flash on top), or 'dark' (drawn darkened).
// walk: a number that keeps growing while it walks (or null when it stands still), for a hop and sway.
function drawSprite(name, sx, sy, look = 1, overlay = null, overlayAlpha = 0.8, walk = null) {
  const s = SPRITES[name];
  if (!s) return false;
  if (!s.img) { loadSprite(s); return false; }
  const w = s.img.width, h = s.img.height;
  const pic = overlay === 'dark' ? overlayOf(s, 'dark') : s.img;
  ctx.save();
  if (walk !== null) {
    // Walking: hop up on every step, and rock a little from foot to foot.
    ctx.translate(snap(sx), snap(sy - Math.abs(Math.sin(walk)) * 3));
    ctx.rotate(Math.sin(walk) * 0.07);
  } else ctx.translate(snap(sx), snap(sy));
  if (look !== s.facing) ctx.scale(-1, 1);
  const left = -Math.round(w / 2);
  ctx.drawImage(pic, left, -h);
  if (overlay === 'white' || overlay === 'red') {
    ctx.globalAlpha *= overlayAlpha;
    ctx.drawImage(overlayOf(s, overlay), left, -h);
  }
  ctx.restore();
  return true;
}

// Draw a sprite centred on screen spot (sx, sy), turned by 'angle' (for spinning thrown things).
function drawSpriteSpin(name, sx, sy, angle) {
  const s = SPRITES[name];
  if (!s || !s.img) return false;
  ctx.save();
  ctx.translate(snap(sx), snap(sy));
  ctx.rotate(angle);
  ctx.drawImage(s.img, -Math.round(s.img.width / 2), -Math.round(s.img.height / 2));
  ctx.restore();
  return true;
}

// Tall scenery you're standing behind turns see-through, so you can see yourself.
// (x, y): the thing's world spot; its picture stands up from there.
function hidesPlayer(name, x, y) {
  const s = SPRITES[name];
  if (!s || !s.img || s.img.height < 50 || player.x + player.y > x + y) return false;
  const p = project(player.x, player.y), t = project(x, y);
  return Math.abs(p.x - t.x) < s.img.width / 2 && p.y < t.y && p.y > t.y - s.img.height - 10;
}

function spriteHeight(name, fallback) {
  const s = SPRITES[name];
  return s && s.img ? s.img.height : fallback;
}

function drawHouse(h) {
  const { x0, y0, x1, y1, height: H } = h;
  // The painted house: its bottom corner sits on the footprint's front corner.
  if (drawSprite(h.sprite, project((x0 + x1) / 2, (y0 + y1) / 2).x, project(x1, y1).y + 2, h.look || 1)) return;   // mirrored to face a street on the right
  // Shadow on the grass, cast towards the lower left.
  face([[x0, y1, 0], [x1, y1, 0], [x1 + 18, y1 + 30, 0], [x0 + 18, y1 + 30, 0]], 'rgba(0, 0, 0, 0.18)');
  // The two walls that face us: the lit one (facing down-left) and the darker one (down-right).
  face([[x0, y1, 0], [x1, y1, 0], [x1, y1, H], [x0, y1, H]], shade(h.wall, 0.08));
  face([[x1, y0, 0], [x1, y1, 0], [x1, y1, H], [x1, y0, H]], shade(h.wall, -0.18));
  // A door and windows on the lit wall, windows on the dark one.
  const midX = (x0 + x1) / 2;
  face([[midX - 10, y1, 0], [midX + 10, y1, 0], [midX + 10, y1, 34], [midX - 10, y1, 34]], shade(h.roof, -0.1));
  for (const wx of [x0 + 18, x1 - 38]) face([[wx, y1, 24], [wx + 20, y1, 24], [wx + 20, y1, 42], [wx, y1, 42]], '#f2e6a8');
  const midY = (y0 + y1) / 2;
  face([[x1, midY - 10, 24], [x1, midY + 10, 24], [x1, midY + 10, 42], [x1, midY - 10, 42]], '#c9bd85');
  // A gable roof, its ridge along the house's longer side, overhanging the walls a little.
  const o = 6, R = 34;
  const ax0 = x0 - o, ax1 = x1 + o, ay0 = y0 - o, ay1 = y1 + o;
  if (x1 - x0 >= y1 - y0) {
    const ym = (y0 + y1) / 2;
    face([[ax0, ay0, H], [ax1, ay0, H], [ax1, ym, H + R], [ax0, ym, H + R]], shade(h.roof, 0.15));   // back slope
    face([[x1, y0, H], [x1, y1, H], [x1, ym, H + R]], shade(h.wall, -0.25));                          // gable end
    face([[ax0, ay1, H], [ax1, ay1, H], [ax1, ym, H + R], [ax0, ym, H + R]], h.roof);                  // front slope
  } else {
    const xm = (x0 + x1) / 2;
    face([[ax0, ay0, H], [ax0, ay1, H], [xm, ay1, H + R], [xm, ay0, H + R]], shade(h.roof, 0.15));
    face([[x0, y1, H], [x1, y1, H], [xm, y1, H + R]], shade(h.wall, 0.0));
    face([[ax1, ay0, H], [ax1, ay1, H], [xm, ay1, H + R], [xm, ay0, H + R]], shade(h.roof, -0.2));
  }
}

// Which picture of your critter to show right now. Only the raccoon has walking, hurt, digging
// and cheering pictures; the others have front, back and throw.
function playerPose() {
  const k = `critters/${critter || 'raccoon'}`, raccoon = critter === 'raccoon' || !critter;
  if (over && escaped && raccoon) return k + '-cheer';
  if (hurtFlash > 0 && raccoon) return k + '-hurt';
  if (player.throwTime > 0 && !player.up) return k + '-throw';
  if (player.up) return k + '-back';
  if (player.moving && raccoon) return Math.floor(player.walkTime / 0.14) % 2 ? k + '-walk-a' : k + '-walk-b';
  if (player.rummaging && raccoon) return k + '-dig';
  return k;
}

function drawPlayer() {
  const { x, y } = player, r = PLAYER_RADIUS, H = PLAYER_HEIGHT;
  const s = project(x, y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';                        // shadow
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, r * 1.6, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  const hurt = hurtFlash > 0;
  // The painted critter, facing the way you last walked, flashing red just after a bite,
  // hopping and swaying while it walks.
  const pose = playerPose();
  if (drawSprite(pose, s.x, s.y + 4, player.facing, hurt ? 'red' : null, 0.6, player.moving && !over ? player.walkTime * 14 : null)) {
    drawHealthBar(s.x, s.y - spriteHeight(pose, 46) - 6);
    return;
  }
  // Stand-in until the picture loads: a little grey block with a dark mask band.
  face([[x - r, y + r, 0], [x + r, y + r, 0], [x + r, y + r, H], [x - r, y + r, H]], hurt ? '#e0625a' : '#9aa0aa');
  face([[x + r, y - r, 0], [x + r, y + r, 0], [x + r, y + r, H], [x + r, y - r, H]], hurt ? '#b04a44' : '#767c86');
  face([[x - r, y - r, H], [x + r, y - r, H], [x + r, y + r, H], [x - r, y + r, H]], hurt ? '#f08a82' : '#b4bac4');
  face([[x - r, y + r, H - 14], [x + r, y + r, H - 14], [x + r, y + r, H - 7], [x - r, y + r, H - 7]], '#2b2d33');
  const top = project(x, y, H + 16);
  drawHealthBar(top.x, top.y);
}

// Your health bar, centred on screen spot (x, y).
function drawHealthBar(x, y) {
  const bw = 36;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(snap(x - bw / 2 - 1), snap(y - 1), bw + 2, 6);
  const share = health / (hero ? hero.maxHealth : stats.health);
  ctx.fillStyle = share > 0.4 ? '#5fd35a' : share > 0.2 ? '#f0c040' : '#ff5a4a';
  ctx.fillRect(snap(x - bw / 2), snap(y), bw * share, 4);
}

function drawDog(d) {
  const { x, y, r } = d;
  const s = project(x, y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath(); ctx.ellipse(s.x, s.y, r * 1.7, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  // The painted pest, facing the way it runs on screen, flashing white just after a hit:
  // its attack picture while biting, its back when running up the screen.
  const look = dogLook(d), pose = dogPose(d);
  if (drawSprite(pose, s.x, s.y + 3, look, d.hitFlash > 0 ? 'white' : null, 0.8, d.moving && d.biteAnim === 0 ? d.walk : null)) {
    if (d.health < d.maxHealth || d.boss) drawDogHealth(d, s.x, s.y - spriteHeight(pose, 36) - 4);
    return;
  }
  // Stand-in until the picture loads: a low brown block with a head and dark ears.
  const c = color => (d.hitFlash > 0 ? '#fff6e0' : color);
  const B = 14;
  face([[x - r, y + r, 0], [x + r, y + r, 0], [x + r, y + r, B], [x - r, y + r, B]], c('#9a6a3c'));
  face([[x + r, y - r, 0], [x + r, y + r, 0], [x + r, y + r, B], [x + r, y - r, B]], c('#7a522c'));
  face([[x - r, y - r, B], [x + r, y - r, B], [x + r, y + r, B], [x - r, y + r, B]], c('#b07c48'));
  const hx = x + d.faceX * 9, hy = y + d.faceY * 9, h = 5, z0 = 8, z1 = 20;
  face([[hx - h, hy + h, z0], [hx + h, hy + h, z0], [hx + h, hy + h, z1], [hx - h, hy + h, z1]], c('#a8743f'));
  face([[hx + h, hy - h, z0], [hx + h, hy + h, z0], [hx + h, hy + h, z1], [hx + h, hy - h, z1]], c('#865a30'));
  face([[hx - h, hy - h, z1], [hx + h, hy - h, z1], [hx + h, hy + h, z1], [hx - h, hy + h, z1]], c('#c08a52'));
  face([[hx - h, hy - h, z1], [hx - h + 3, hy - h, z1], [hx - h + 3, hy - h + 3, z1 + 5], [hx - h, hy - h + 3, z1 + 5]], c('#4a3018'));
  face([[hx + h - 3, hy + h - 3, z1], [hx + h, hy + h - 3, z1], [hx + h, hy + h, z1 + 5], [hx + h - 3, hy + h, z1 + 5]], c('#4a3018'));
  if (d.health < d.maxHealth) { const top = project(x, y, 30); drawDogHealth(d, top.x, top.y); }
}

// Which way a pest looks on screen (its direction turned into left or right), and which picture shows:
// its attack picture while biting, its back when running up the screen.
function dogLook(d) { return d.faceX - d.faceY >= 0 ? 1 : -1; }
function dogPose(d) {
  const f = d.type.file;
  return d.biteAnim > 0 ? `${f}-${d.type.attack}` : d.faceX + d.faceY < 0 ? `${f}-back` : f;
}

// A small health bar over a hurt pest (a wide one over a boss).
function drawDogHealth(d, x, y) {
  const bw = d.boss ? 70 : 22;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(snap(x - bw / 2 - 1), snap(y - 1), bw + 2, 5);
  ctx.fillStyle = '#ff5a4a'; ctx.fillRect(snap(x - bw / 2), snap(y), bw * d.health / d.maxHealth, 3);
}

function drawShot(s) {
  const g = project(s.x, s.y), p = project(s.x, s.y, SHOT_HEIGHT);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
  const name = cat(shotPicture(s.name || 'pebble'));
  if (drawSpriteSpin(name, p.x, p.y, s.name === 'paper-plane' ? 0 : s.spin)) return;
  ctx.fillStyle = '#3a3226';
  ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8c8a0';
  ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
}

// Effects: each rises a little and fades out in the second half of its life.
function drawEffects() {
  for (const e of effects) {
    const t = e.age / e.life;
    const s = project(e.x, e.y, e.z + e.rise * t);
    ctx.globalAlpha = Math.min(1, 2 - 2 * t);
    drawSprite(e.sprite, s.x, s.y + spriteHeight(e.sprite, 0) / 2);
  }
  ctx.globalAlpha = 1;
}

// Marks that appeared during the round, flat on the ground, fading out at the end of their life.
function drawMarks() {
  for (const m of marks) {
    const s = SPRITES[m.sprite];
    if (!s.img) { loadSprite(s); continue; }
    const p = project(m.x, m.y);
    if (p.x < -120 || p.y < -80 || p.x > view.width + 120 || p.y > view.height + 80) continue;
    ctx.globalAlpha = Math.min(1, (m.life - m.age) / 2);
    ctx.drawImage(s.img, snap(p.x) - Math.round(s.img.width / 2), snap(p.y) - Math.round(s.img.height / 2));
  }
  ctx.globalAlpha = 1;
}

// Swings (a pale arc), aura pulses (a widening ring) and chain lightning, drawn flat on the ground
// before everything standing (so pests stand in front of them).
function drawWeaponMarks() {
  if (!runner) return;
  const ring = (x, y, r, steps = 28) => {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) { const a = (i / steps) * Math.PI * 2, p = project(x + Math.cos(a) * r, y + Math.sin(a) * r); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
  };
  for (const s of runner.swings) {
    const t = s.age / 0.3, c = project(s.x, s.y);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * (1 - t)})`;
    ctx.beginPath(); ctx.moveTo(c.x, c.y);
    for (let i = 0; i <= 12; i++) { const a = s.angle - Math.PI / 3 + (i / 12) * (Math.PI * 2 / 3), p = project(s.x + Math.cos(a) * s.range, s.y + Math.sin(a) * s.range); ctx.lineTo(p.x, p.y); }
    ctx.closePath(); ctx.fill();
  }
  for (const p of runner.pulses) {
    const t = p.age / 0.3;
    ctx.strokeStyle = `rgba(160, 220, 255, ${1 - t})`; ctx.lineWidth = 2;
    ring(p.x, p.y, p.range * (0.6 + t * 0.4)); ctx.stroke();
  }
  for (const c of runner.chains) {
    ctx.strokeStyle = `rgba(255, 240, 120, ${1 - c.age / 0.3})`; ctx.lineWidth = 1.5;
    const a = project(c.x0, c.y0, 12), b = project(c.x1, c.y1, 12);
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    for (let i = 1; i < 6; i++) { const t = i / 6; ctx.lineTo(a.x + (b.x - a.x) * t + (random() - 0.5) * 8, a.y + (b.y - a.y) * t + (random() - 0.5) * 8); }
    ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

// A pickup on the ground: a small shadow, the picture bobbing gently above it.
function drawPickup(p) {
  const g = project(p.x, p.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const name = `pickups/${p.kind}`;
  if (!drawSprite(name, g.x, g.y - 2 - Math.abs(Math.sin(p.age * 3)) * 3)) {
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(g.x, g.y - 8, 5, 0, Math.PI * 2); ctx.fill();
  }
}

// Parked cars, wrecks, sheds: the picture's bottom corner sits on the footprint's front corner.
function drawSolid(b) {
  const g = project((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y + 4, (b.x1 - b.x0 + b.y1 - b.y0) * 0.5, (b.x1 - b.x0 + b.y1 - b.y0) * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  if (drawSprite(b.sprite, g.x, project(b.x1, b.y1).y + 4, b.look)) return;
  face([[b.x0, b.y1, 0], [b.x1, b.y1, 0], [b.x1, b.y1, 30], [b.x0, b.y1, 30]], '#8a8f96');
  face([[b.x1, b.y0, 0], [b.x1, b.y1, 0], [b.x1, b.y1, 30], [b.x1, b.y0, 30]], '#6a6f76');
}

// Yard things, street furniture, garden trees.
function drawDecor(t) {
  const g = project(t.x, t.y);
  const see = hidesPlayer(t.sprite, t.x, t.y);
  if (see) ctx.globalAlpha = 0.45;
  drawSprite(t.sprite, g.x, g.y + 4, t.look);
  ctx.globalAlpha = 1;
}

function drawCan(c) {
  const { x, y } = c, h = CAN_HALF, H = CAN_HEIGHT, k = c.kind;
  const s = project(x, y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, h * 1.8, h * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  if (c.looted) {
    // Knocked open: lid on the grass beside it (the spilled trash is a ground mark, see rummage()).
    face([[x + h + 2, y - h, 0], [x + h + 18, y - h, 0], [x + h + 18, y + h, 0], [x + h + 2, y + h, 0]], shade(k.lid, -0.3));
  }
  // The painted bin (darkened once looted). Stand-in blocks until the picture loads.
  const binName = 'bin-' + k.name;
  if (drawSprite(binName, s.x, s.y + 3, 1, c.looted ? 'dark' : null)) {
    drawRummageRing(c, s.x, s.y - spriteHeight(binName, 34) - 14);
    return;
  }
  const body = c.looted ? shade(k.body, -0.35) : k.body;
  face([[x - h, y + h, 0], [x + h, y + h, 0], [x + h, y + h, H], [x - h, y + h, H]], shade(body, 0.1));
  face([[x + h, y - h, 0], [x + h, y + h, 0], [x + h, y + h, H], [x + h, y - h, H]], shade(body, -0.2));
  if (c.looted) face([[x - h, y - h, H], [x + h, y - h, H], [x + h, y + h, H], [x - h, y + h, H]], '#1b1b1b');   // open top
  else face([[x - h - 2, y - h - 2, H], [x + h + 2, y - h - 2, H], [x + h + 2, y + h + 2, H], [x - h - 2, y + h + 2, H]], k.lid);
  const top = project(x, y, H + 22);
  drawRummageRing(c, top.x, top.y);
}

// While you rummage: a ring above the can fills up.
function drawRummageRing(c, x, y) {
  if (c.looted || c.progress <= 0) return;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffd34d';
  ctx.beginPath(); ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, c.progress / rummageTime())); ctx.stroke();
  ctx.lineWidth = 1;
}

function drawPopups() {
  ctx.font = `bold ${Math.round(18 / ZOOM)}px system-ui, sans-serif`;   // about 18 screen pixels tall
  ctx.textAlign = 'center';
  for (const p of popups) {
    const s = project(p.x, p.y, CAN_HEIGHT + 30 + p.age * 40);   // rises...
    ctx.globalAlpha = Math.max(0, 1 - p.age / 1.2);              // ...and fades
    ctx.fillStyle = '#000'; ctx.fillText(p.text, s.x + 1, s.y + 1);
    ctx.fillStyle = p.color; ctx.fillText(p.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

// ----- The minimap (top right corner) -----
// A small copy of the whole map in the same isometric slant. The streets and houses never
// change, so they're drawn once onto a hidden canvas; each frame only adds the dots.
const MINI_SCALE = 0.026;
const MINI_PAD = 12;
let miniBack = null;          // the hidden canvas with the streets and houses

function miniPoint(x, y) {
  return { x: (x - y + MAP_H) * ISO_X * MINI_SCALE, y: (x + y) * ISO_Y * MINI_SCALE };
}

function buildMinimap() {
  miniBack = document.createElement('canvas');
  miniBack.width = Math.ceil((MAP_W + MAP_H) * ISO_X * MINI_SCALE);
  miniBack.height = Math.ceil((MAP_W + MAP_H) * ISO_Y * MINI_SCALE);
  const m = miniBack.getContext('2d');
  const colors = { grass: '#4d7739', road: '#5b5d61', sidewalk: '#5b5d61', forest: '#26421f' };
  const diamond = (x0, y0, x1, y1, color) => {
    const pts = [miniPoint(x0, y0), miniPoint(x1, y0), miniPoint(x1, y1), miniPoint(x0, y1)];
    m.beginPath(); pts.forEach((p, i) => (i ? m.lineTo(p.x, p.y) : m.moveTo(p.x, p.y)));
    m.closePath(); m.fillStyle = color; m.fill(); m.strokeStyle = color; m.stroke();
  };
  for (let r = 0; r < MAP_ROWS; r++)
    for (let c = 0; c < MAP_COLS; c++)
      diamond(c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE, colors[ground[r][c]]);
  for (const h of houses) diamond(h.x0, h.y0, h.x1, h.y1, '#c9b9a0');
}

function drawMinimap() {
  const w = miniBack.width, h = miniBack.height;
  const left = innerWidth - w - MINI_PAD, top = MINI_PAD;
  ctx.save();
  ctx.setTransform(screenRatio, 0, 0, screenRatio, 0, 0);   // the minimap isn't zoomed
  ctx.translate(left, top);
  // The map is a diamond; give it a dark backing so the corners don't look empty.
  ctx.fillStyle = 'rgba(10, 14, 10, 0.55)';
  ctx.fillRect(-6, -6, w + 12, h + 12);
  ctx.drawImage(miniBack, 0, 0);
  // The part of the town the screen shows right now.
  const corners = [unproject(0, 0), unproject(view.width, 0), unproject(view.width, view.height), unproject(0, view.height)];
  ctx.beginPath();
  corners.forEach((c, i) => { const p = miniPoint(c.x, c.y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.closePath();
  ctx.save(); ctx.clip();                          // keep the frame inside the minimap
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  // Cans still to loot: bright yellow dots.
  ctx.fillStyle = '#ffd34d';
  for (const c of cans) {
    if (c.looted) continue;
    const p = miniPoint(c.x, c.y);
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  // Pests: small red dots; bosses: big orange ones.
  for (const d of dogs) {
    const p = miniPoint(d.x, d.y), size = d.boss ? 7 : 3;
    ctx.fillStyle = d.boss ? '#ff9a2a' : '#ff5a4a';
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  // You: a white dot with a dark rim.
  const p = miniPoint(player.x, player.y);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ----- Shadows -----
// The sun is low in the upper left, so everything standing throws a shadow down to the right.
// A shadow is the thing's outline, slanted and squashed flat onto the ground: every pixel of height
// lands SHADOW.x pixels to the right and SHADOW.y pixels down. Houses and cars (whose pictures include
// a patch of ground) cast a block instead: their footprint, stretched away from the sun by their height.
// All shadows are drawn black onto one hidden layer, which then goes onto the ground see-through in one
// go (so overlapping shadows don't get darker). Then, as each thing is drawn, shadows of the things
// beside it that fall across it are laid over it too.
const SHADOWS_ON = false;      // switched off for now: they made the game lag a little (true brings them back)
const SHADOW = { x: 0.7, y: 0.25, alpha: 0.3 };
const shadowLayer = document.createElement('canvas'), sctx = shadowLayer.getContext('2d');
const shadowTemp = document.createElement('canvas'), tctx = shadowTemp.getContext('2d');

function silhouette(s) { if (!s.black) s.black = tinted(s.img, '#000'); return s.black; }
// How solid a picture is at one of its pixels (0 = see-through), from a copy of its pixels made once.
function alphaAt(s, x, y) {
  if (x < 0 || y < 0 || x >= s.img.width || y >= s.img.height) return 0;
  if (!s.alpha) {
    const c = document.createElement('canvas');
    c.width = s.img.width; c.height = s.img.height;
    const g = c.getContext('2d'); g.drawImage(s.img, 0, 0);
    s.alpha = g.getImageData(0, 0, c.width, c.height).data;
  }
  return s.alpha[(y * s.img.width + x) * 4 + 3];
}

// The shadow of a picture standing with its bottom middle at screen spot (x, y).
// box: the screen area it covers; draw(g): draw it in black; covers(px, py): is that screen spot in it?
function spriteCaster(name, x, y, look) {
  const s = SPRITES[name];
  if (!s || !s.img) return null;
  const w = s.img.width, h = s.img.height, mirror = look !== s.facing, left = Math.round(w / 2);
  x = snap(x); y = snap(y);
  return {
    box: { x0: x - left - 2, y0: y - 2, x1: x + left + SHADOW.x * h + 2, y1: y + SHADOW.y * h + 2 },
    draw(g) {
      g.save(); g.translate(x, y); g.transform(1, 0, -SHADOW.x, -SHADOW.y, 0, 0);
      if (mirror) g.scale(-1, 1);
      g.drawImage(silhouette(s), -left, -h); g.restore();
    },
    covers(px, py) {
      const v = (py - y) / SHADOW.y;                             // the height that lands here
      if (v < 0 || v > h) return false;
      let u = px - x - SHADOW.x * v;
      if (mirror) u = -u;
      return alphaAt(s, Math.floor(u + left), Math.floor(h - v)) > 100;
    },
  };
}

// The shadow of a block standing on a world footprint (x0, y0, x1, y1), H pixels tall.
function boxCaster(b, H) {
  const wx = (SHADOW.x + 2 * SHADOW.y) * H / 2, wy = (2 * SHADOW.y - SHADOW.x) * H / 2;   // the sun's push, in world steps
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  const pts = [...corners, ...corners.map(([x, y]) => [x + wx, y + wy])].map(([x, y]) => project(x, y));
  // The outline round all eight points (a "convex hull": like a rubber band stretched round them).
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list) => { const out = []; for (const p of list) { while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop(); out.push(p); } out.pop(); return out; };
  const hull = [...half(pts), ...half(pts.slice().reverse())];
  const xs = hull.map((p) => p.x), ys = hull.map((p) => p.y);
  return {
    box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    draw(g) { g.beginPath(); hull.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = '#000'; g.fill(); },
    covers(px, py) {
      for (let i = 0; i < hull.length; i++) {                    // inside if it's on the inner side of every edge
        const a = hull[i], c = hull[(i + 1) % hull.length];
        if ((c.x - a.x) * (py - a.y) - (c.y - a.y) * (px - a.x) < 0) return false;
      }
      return true;
    },
  };
}

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// All the near things' shadows onto the ground, in one see-through layer.
function drawGroundShadows(near) {
  const W = canvas.width, H = canvas.height;
  if (shadowLayer.width !== W || shadowLayer.height !== H) { shadowLayer.width = W; shadowLayer.height = H; }
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, W, H);
  sctx.setTransform(pixel, 0, 0, pixel, 0, 0);
  const screen = { x0: 0, y0: 0, x1: view.width, y1: view.height };
  for (const t of near) if (t.info && t.info.cast && overlaps(t.info.cast.box, screen)) t.info.cast.draw(sctx);   // only shadows on screen
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = SHADOW.alpha;
  ctx.drawImage(shadowLayer, 0, 0);
  ctx.restore();
}

// After drawing thing t: lay the shadows of things beside it (not in front of it) over it.
// Small things (people, pests, props) are either in a shadow or not, judged at their feet. Big things
// (houses, big trees) get exactly the part of the shadow that falls across their picture.
function drawShadowOn(t, tallOnes) {
  const spr = t.info && t.info.spr;
  if (!spr) return;
  const s = SPRITES[spr.name];
  if (!s || !s.img) return;
  const w = s.img.width, h = s.img.height, left = Math.round(w / 2), x = snap(spr.x), y = snap(spr.y);
  const mirror = spr.look !== s.facing;
  const area = { x0: x - left, y0: y - h, x1: x + left, y1: y };
  if (area.x1 < 0 || area.y1 < 0 || area.x0 > view.width || area.y0 > view.height) return;   // off screen
  const casters = tallOnes.filter((c) => c !== t && overlaps(c.info.cast.box, area) && !inFront(c, t));
  if (!casters.length) return;
  const drawPic = (g, pic) => { g.save(); g.translate(x, y); if (mirror) g.scale(-1, 1); g.drawImage(pic, -left, -h); g.restore(); };
  if (h < 80) {
    if (!casters.some((c) => c.info.cast.covers(x, y - 1))) return;
    ctx.save(); ctx.globalAlpha = SHADOW.alpha; drawPic(ctx, silhouette(s)); ctx.restore();
    return;
  }
  const pw = Math.ceil(w * pixel), ph = Math.ceil(h * pixel);
  if (shadowTemp.width < pw || shadowTemp.height < ph) { shadowTemp.width = Math.max(pw, shadowTemp.width); shadowTemp.height = Math.max(ph, shadowTemp.height); }
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, pw, ph);
  tctx.setTransform(pixel, 0, 0, pixel, -area.x0 * pixel, -area.y0 * pixel);
  for (const c of casters) c.info.cast.draw(tctx);
  tctx.globalCompositeOperation = 'destination-in';              // keep only what lands on the picture
  drawPic(tctx, s.img);
  tctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha = SHADOW.alpha;
  ctx.drawImage(shadowTemp, 0, 0, pw, ph, area.x0, area.y0, pw / pixel, ph / pixel);
  ctx.restore();
}

// Things that stand up (houses, cans, the raccoon) must be drawn back to front.
// "a is in front of b" when it lies wholly past b towards the viewer (larger x or larger y),
// and b isn't past a the other way (then they sit side by side on screen and never overlap).
function inFront(a, b) {
  const aPastX = a.x0 >= b.x1, aPastY = a.y0 >= b.y1;
  const bPastX = b.x0 >= a.x1, bPastY = b.y0 >= a.y1;
  return (aPastX && !bPastY) || (aPastY && !bPastX);
}

function drawTree(t) {
  const { x, y, height: H } = t;
  const g = project(x, y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
  // The painted pine: two sizes, the taller for the taller trees. Some are mirrored for variety.
  // A few are other catalogue trees instead.
  const name = t.sprite || (H > 70 ? 'pine-tall' : 'pine');
  if (hidesPlayer(name, x, y)) ctx.globalAlpha = 0.45;
  const drawn = drawSprite(name, g.x, g.y + 4, t.mirror ? -1 : 1);
  ctx.globalAlpha = 1;
  if (drawn) return;
  face([[x - 3, y + 3, 0], [x + 3, y + 3, 0], [x + 3, y + 3, 14], [x - 3, y + 3, 14]], '#5a3f28');
  // Two stacked cones: a wide one low down and a narrow one on top.
  for (const [z0, z1, w] of [[10, H * 0.75, 20], [H * 0.45, H, 13]]) {
    const base = project(x, y, z0), tip = project(x, y, z1);
    ctx.fillStyle = shade(t.color, -0.25);
    ctx.beginPath(); ctx.ellipse(base.x, base.y, w, w / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(base.x - w, base.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(base.x + w, base.y);
    ctx.closePath(); ctx.fillStyle = t.color; ctx.fill();
    ctx.beginPath(); ctx.moveTo(base.x, base.y + w / 2); ctx.lineTo(tip.x, tip.y); ctx.lineTo(base.x + w, base.y);
    ctx.closePath(); ctx.fillStyle = shade(t.color, -0.18); ctx.fill();   // shaded right side
  }
}

// What a thing's shadow and picture are, for the shadow code: cast (its shadow), spr (its main
// picture, to lay other shadows on), tall (big enough to shade things beside it).
function standingInfo(name, x, y, look, cast = null) {
  const s = SPRITES[name];
  return { spr: { name, x, y, look }, cast: cast || spriteCaster(name, x, y, look), tall: !!(s && s.img && s.img.height > 30) };
}

function drawStanding() {
  const r = PLAYER_RADIUS;
  const things = houses.map(h => ({ ...h, draw: () => drawHouse(h), sh: () => {
    const p = project((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2);
    return { ...standingInfo(h.sprite, p.x, project(h.x1, h.y1).y + 2, h.look || 1, boxCaster(h, 115)), tall: true };
  } }));
  for (const t of trees) things.push({ x0: t.x - 4, y0: t.y - 4, x1: t.x + 4, y1: t.y + 4, draw: () => drawTree(t), sh: () => {
    const g = project(t.x, t.y);
    return standingInfo(t.sprite || (t.height > 70 ? 'pine-tall' : 'pine'), g.x, g.y + 4, t.mirror ? -1 : 1);
  } });
  for (const b of solids) things.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, draw: () => drawSolid(b), sh: () => {
    const s = SPRITES[b.sprite], tall = s && s.img ? Math.min(70, s.img.height * 0.42) : 45;
    return { ...standingInfo(b.sprite, project((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2).x, project(b.x1, b.y1).y + 4, b.look, boxCaster(b, tall)), tall: true };
  } });
  for (const p of fences) {
    const sh = () => {
      const end = p.along === 'x' ? project(p.x + TILE, p.y) : project(p.x, p.y + TILE), mid = p.along === 'x' ? project(p.x + TILE / 2, p.y) : project(p.x, p.y + TILE / 2);
      return { cast: spriteCaster(`fence-${p.kind}`, mid.x, end.y + 2, p.along === 'x' ? 1 : -1), tall: false };
    };
    things.push(p.along === 'x' ? { x0: p.x, y0: p.y - 1, x1: p.x + TILE, y1: p.y + 1, draw: () => drawFence(p), sh }
                                : { x0: p.x - 1, y0: p.y, x1: p.x + 1, y1: p.y + TILE, draw: () => drawFence(p), sh });
  }
  for (const t of decor) {
    const b = t.box && t.box.x1 - t.box.x0 > 16 ? t.box : { x0: t.x - 4, y0: t.y - 4, x1: t.x + 4, y1: t.y + 4 };   // big things sort by their box
    things.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, draw: () => drawDecor(t), sh: () => { const g = project(t.x, t.y); return standingInfo(t.sprite, g.x, g.y + 4, t.look); } });
  }
  for (const p of pickups) things.push({ x0: p.x - 3, y0: p.y - 3, x1: p.x + 3, y1: p.y + 3, draw: () => drawPickup(p) });
  for (const c of cans) things.push({ ...canBox(c), draw: () => drawCan(c), sh: () => {
    const g = project(c.x, c.y);
    return { ...standingInfo('bin-' + c.kind.name, g.x, g.y + 3, 1), tall: false };
  } });
  for (const d of dogs) things.push({ x0: d.x - d.r, y0: d.y - d.r, x1: d.x + d.r, y1: d.y + d.r, draw: () => drawDog(d), sh: () => {
    const g = project(d.x, d.y);
    return { ...standingInfo(dogPose(d), g.x, g.y + 3, dogLook(d)), tall: !!d.boss };
  } });
  if (runner) {
    for (const s of runner.shots) things.push({ x0: s.x - 2, y0: s.y - 2, x1: s.x + 2, y1: s.y + 2, draw: () => drawShot(s) });
    for (const s of runner.spinners) things.push({ x0: s.x - 2, y0: s.y - 2, x1: s.x + 2, y1: s.y + 2, draw: () => drawShot(s) });
  }
  things.push({ x0: player.x - r, y0: player.y - r, x1: player.x + r, y1: player.y + r, draw: drawPlayer, sh: () => {
    const g = project(player.x, player.y);
    return { ...standingInfo(playerPose(), g.x, g.y + 4, player.facing), tall: false };
  } });
  // Only sort and draw what is near the screen.
  const margin = 400;
  const near = things.filter(t => {
    const s = project((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2);
    return s.x > -margin && s.x < view.width + margin && s.y > -margin && s.y < view.height + margin;
  });
  // Shadows: first all of them on the ground (see drawGroundShadows).
  let tallOnes = [];
  if (SHADOWS_ON) {
    for (const t of near) t.info = t.sh ? t.sh() : null;
    drawGroundShadows(near);
    const onScreen = { x0: -60, y0: -60, x1: view.width + 60, y1: view.height + 60 };
    tallOnes = near.filter((c) => c.info && c.info.cast && c.info.tall && overlaps(c.info.cast.box, onScreen));   // only these shade other things
  }
  // Before drawing a thing, first draw everything that stands behind it.
  // (A plain sort can't do this reliably: "behind" doesn't line up neatly for many objects.)
  near.sort((a, b) => (a.x0 + a.y0) - (b.x0 + b.y0));   // a rough order to start from
  const done = new Set();
  const visit = t => {
    if (done.has(t)) return;
    done.add(t);
    for (const other of near) if (other !== t && inFront(t, other)) visit(other);
    t.draw();
    if (SHADOWS_ON && t.info && t.info.spr) drawShadowOn(t, tallOnes);  // shadows of things beside it falling across it
  };
  near.forEach(visit);
}

function draw() {
  ctx.fillStyle = OUTSIDE;
  ctx.fillRect(0, 0, view.width, view.height);
  drawGround();
  drawMarks();
  drawWeaponMarks();
  drawStanding();
  drawEffects();
  drawPopups();
  drawMinimap();
}

// ---------- 12. The game loop ----------
// Runs once per screen refresh (usually 60 times a second).
let lastTime = performance.now();

function frame(now) {
  const seconds = Math.min(0.05, (now - lastTime) / 1000);   // cap, so a stalled tab doesn't jump
  lastTime = now;
  if (started && !over) {         // nothing moves until you've picked a critter, and everything stops at the end
    movePlayer(seconds);
    updateClock(seconds);
    rummage(seconds);
    spawnDogs(seconds);
    moveDogs(seconds);
    attack(seconds);
    movePickups(seconds);
    ageMarks(seconds);
    hurtFlash = Math.max(0, hurtFlash - seconds);
    document.getElementById('loot').textContent = `Trash looted: ${looted}  (cans left: ${cans.filter(c => !c.looted).length})`;
    document.getElementById('shooed').textContent = `Pests shooed: ${shooed}`;
    document.getElementById('shinies').textContent = `Shinies: ${shinies}` + (speedBoost > 0 ? '   ZOOM!' : '');
    document.getElementById('health').textContent = `Health: ${Math.ceil(health)} / ${hero.maxHealth}`;
  }
  agePopups(seconds);
  ageEffects(seconds);
  ageBanner(seconds);
  followPlayer();
  draw();
  requestAnimationFrame(frame);
}

// ---------- 13. Start ----------
buildMap();                   // first: placing things also lists which pictures are needed
buildBlockGrid();             // then sort everything solid into squares, for fast bumping
loadSprites();
buildFences();
loadGround();                 // after buildMap: the ground picture is painted from the map
buildMinimap();
resize();
buildPicker();
requestAnimationFrame(frame);
