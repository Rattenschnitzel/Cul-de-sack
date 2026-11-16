// Cul-de-sack: every item in the game, in one place. The shop (index.html), the street fight
// (fight.html) and the weapons designer (designer.html) all read this list, so an item is the same
// everywhere.
//
// Each item:
//   id: a short unique name for the code; name, icon (an emoji, used when there's no picture),
//   rarity ("common" / "rare" / "epic"), color, cost (gold in the shop),
//   shape: one text line per row of squares it takes in the backpack ("X" = taken, "." = free),
//   off: true = switched off in the designer (not in the shop, not in fights).
//   The old shop fight still uses effect, amount, every, rage, exhaust, recovery, rageGain, gives, holster.
//
//   fight: what it does in the street fight. Either a weapon (it has a `type`) or a boost (no type).
//   Weapon:  type: "throw" (flies at the nearest pest), "swing" (hits everything in an arc in front),
//                  "orbit" (spins round you), "aura" (a pulse that hits everything near you)
//            damage, every (seconds between attacks), range (how far, in world pixels; for orbit: how
//            far out it spins), speed (throw: how fast it flies; orbit: degrees per second), count
//            (how many projectiles / swings / spinning things), spread (degrees between projectiles),
//            pierce (flies through this many pests), chain (after a hit, jumps on to this many more),
//            explode (blast radius on every hit, 0 = none), knock (push back), crit (chance 0..1),
//            critMult (crit damage, 2 = double), lifesteal (share of damage healed, 0..1), shot (projectile picture)
//   Boost:   reach: "all" (every weapon and you), "touch" (weapons sharing a side with it),
//                   "row" / "column" (weapons in the same rows / columns)
//            for weapons: damagePct, speedPct (attack speed), rangePct (0.1 = +10%), crit, critMult,
//                   count, chain, pierce, explode, knock, lifesteal
//            for you (always, wherever it is): health, armor (each bite hurts this much less),
//                   regen (health per second), move (0.1 = 10% faster), pickup (0.5 = 50% more pull)

const DEFAULT_ITEMS = [
  // ---- From the shop: weapons ----
  { id: "dagger", name: "Dagger", icon: "🔪", rarity: "common", color: "#a9b7c0", shape: ["X"], effect: "damage", amount: 2, every: 1, rage: 4, exhaust: 5, cost: 4,
    fight: { type: "throw", damage: 6, every: 0.5, range: 300, speed: 620, count: 1, crit: 0.1, critMult: 2, knock: 6, shot: "bottle-cap" } },
  { id: "sword", name: "Sword", icon: "🗡️", rarity: "common", color: "#b8c4cc", shape: ["X", "X"], effect: "damage", amount: 5, every: 2, rage: 10, exhaust: 10, cost: 6,
    fight: { type: "swing", damage: 14, every: 1.2, range: 70, count: 1, crit: 0.05, critMult: 2, knock: 24 } },
  { id: "brass-knuckles", name: "Brass Knuckles", icon: "👊", rarity: "common", color: "#d4b04a", shape: ["X"], effect: "damage", amount: 3, every: 1.2, rage: 6, exhaust: 5, cost: 5,
    fight: { type: "swing", damage: 8, every: 0.6, range: 45, count: 1, crit: 0.15, critMult: 2, knock: 14 } },
  { id: "wooden-board", name: "Wooden Board", icon: "🪵", rarity: "common", color: "#b98a55", shape: ["XXX"], effect: "damage", amount: 6, every: 2.2, rage: 10, exhaust: 12, cost: 5,
    fight: { type: "swing", damage: 16, every: 1.6, range: 85, count: 1, crit: 0.05, critMult: 2, knock: 30 } },
  { id: "frying-pan", name: "Frying Pan", icon: "🍳", rarity: "common", color: "#7d848a", shape: ["XX"], effect: "damage", amount: 6, every: 2.5, rage: 12, exhaust: 12, cost: 6,
    fight: { type: "swing", damage: 18, every: 1.8, range: 60, count: 1, crit: 0.1, critMult: 2.5, knock: 40 } },
  { id: "broom", name: "Broom", icon: "🧹", rarity: "common", color: "#d8b56a", shape: ["X", "X", "X", "X"], effect: "damage", amount: 4, every: 1.4, rage: 5, exhaust: 4, cost: 5,
    fight: { type: "swing", damage: 7, every: 0.9, range: 95, count: 2, crit: 0.05, critMult: 2, knock: 20 } },
  { id: "greatsword", name: "Greatsword", icon: "⚔️", rarity: "rare", color: "#9fb0bd", shape: ["X", "X", "X"], effect: "damage", amount: 9, every: 2.5, rage: 16, exhaust: 18, cost: 9,
    fight: { type: "swing", damage: 28, every: 2, range: 100, count: 1, crit: 0.08, critMult: 2, knock: 34 } },
  { id: "boomerang", name: "Boomerang", icon: "🪃", rarity: "rare", color: "#d08a4e", shape: ["X.", "XX", ".X"], effect: "damage", amount: 4, every: 1.5, rage: 8, exhaust: 6, cost: 7,
    fight: { type: "orbit", damage: 8, every: 0.5, range: 70, speed: 240, count: 1, crit: 0.05, critMult: 2, knock: 10, shot: "frisbee" } },
  { id: "axe", name: "Axe", icon: "🪓", rarity: "rare", color: "#a88a68", shape: ["XX", "XX"], effect: "damage", amount: 9, every: 3, rage: 16, exhaust: 18, cost: 8,
    fight: { type: "swing", damage: 24, every: 1.8, range: 70, count: 1, crit: 0.2, critMult: 2, knock: 26 } },
  { id: "cricket-bat", name: "Cricket Bat", icon: "🏏", rarity: "rare", color: "#c9a26b", shape: ["X", "X", "X"], effect: "damage", amount: 7, every: 2, rage: 12, exhaust: 14, cost: 7,
    fight: { type: "swing", damage: 18, every: 1.3, range: 80, count: 1, crit: 0.05, critMult: 2, knock: 50 } },
  { id: "darts", name: "Darts", icon: "🎯", rarity: "rare", color: "#d9534f", shape: ["X"], effect: "damage", amount: 3, every: 0.8, rage: 3, exhaust: 4, cost: 7,
    fight: { type: "throw", damage: 5, every: 0.35, range: 380, speed: 700, count: 1, crit: 0.25, critMult: 2.5, knock: 4, shot: "paper-plane" } },
  { id: "wrench", name: "Wrench", icon: "🔧", rarity: "epic", color: "#8d969e", shape: ["X", "X"], effect: "damage", amount: 4, every: 1.3, rage: 6, exhaust: 7, cost: 9, gives: { heal: 1 },
    fight: { type: "throw", damage: 10, every: 1, range: 320, speed: 520, count: 1, chain: 2, crit: 0.05, critMult: 2, knock: 10, shot: "tin-can" } },
  { id: "sledgehammer", name: "Sledgehammer", icon: "🔨", rarity: "epic", color: "#8a7a6a", shape: ["XXX", ".X.", ".X."], effect: "damage", amount: 14, every: 3, rage: 20, exhaust: 25, cost: 10, gives: { reach: "row", rage: 3 },
    fight: { type: "swing", damage: 40, every: 2.6, range: 90, count: 1, explode: 60, crit: 0.05, critMult: 2, knock: 60 } },
  { id: "boombox", name: "Boombox", icon: "📻", rarity: "epic", color: "#4a4f6a", shape: ["XX", "XX"], cost: 11, rageGain: 2, gives: { reach: "row", rage: 4 },
    fight: { type: "aura", damage: 6, every: 1, range: 110, count: 1, crit: 0.05, critMult: 2, knock: 16 } },

  // ---- From the shop: boosts ----
  { id: "paper-helmet", name: "Paper Helmet", icon: "🪖", rarity: "common", color: "#e8e1cf", shape: ["X"], effect: "block", amount: 2, every: 2, cost: 3, fight: { armor: 1 } },
  { id: "traffic-cone", name: "Traffic Cone", icon: "🚧", rarity: "common", color: "#e9773a", shape: [".X.", "XXX"], effect: "block", amount: 4, every: 2.5, cost: 6, fight: { armor: 2, health: 10 } },
  { id: "trash-can-lid", name: "Trash Can Lid", icon: "🗑️", rarity: "common", color: "#9aa3a8", shape: ["XX"], effect: "block", amount: 2, every: 1.5, cost: 5, fight: { armor: 2 } },
  { id: "spare-tire", name: "Spare Tire", icon: "🛞", rarity: "common", color: "#5d5d5d", shape: ["XX", "XX"], effect: "block", amount: 4, every: 3, cost: 5, fight: { armor: 3, health: 15 } },
  { id: "lemonade", name: "Lemonade", icon: "🍋", rarity: "common", color: "#f2dc6b", shape: ["X"], effect: "heal", amount: 3, every: 3, cost: 4, fight: { regen: 0.5 } },
  { id: "bandages", name: "Bandages", icon: "🩹", rarity: "common", color: "#f0d2b0", shape: ["XX"], effect: "heal", amount: 4, every: 3, cost: 5, fight: { regen: 1 } },
  { id: "water-bottle", name: "Water Bottle", icon: "💧", rarity: "common", color: "#7fc4e8", shape: ["X", "X"], recovery: 3, cost: 4, fight: { move: 0.1 } },
  { id: "bubble-wrap", name: "Bubble Wrap", icon: "🫧", rarity: "common", color: "#cfe6f2", shape: ["X"], cost: 4, gives: { block: 1 }, fight: { armor: 1 } },
  { id: "shield", name: "Shield", icon: "🛡️", rarity: "rare", color: "#c9a25a", shape: ["XX", "XX"], effect: "block", amount: 3, every: 3, cost: 6, gives: { damage: 1 },
    fight: { reach: "touch", armor: 4, damagePct: 0.15 } },
  { id: "herb", name: "Herb", icon: "🌿", rarity: "rare", color: "#8fbf75", shape: ["X"], effect: "heal", amount: 2, every: 2.5, cost: 5, gives: { speed: 0.25 },
    fight: { reach: "touch", regen: 0.5, speedPct: 0.25 } },
  { id: "watermelon", name: "Watermelon", icon: "🍉", rarity: "rare", color: "#6fae5a", shape: ["XX", "XX"], effect: "heal", amount: 6, every: 4, cost: 8, gives: { reach: "row", heal: 1 },
    fight: { health: 25, regen: 1 } },
  { id: "hot-sauce", name: "Hot Sauce", icon: "🌶️", rarity: "rare", color: "#e0503c", shape: ["X"], rageGain: 3, cost: 5, fight: { reach: "touch", damagePct: 0.3, explode: 30 } },
  { id: "lawn-chair", name: "Lawn Chair", icon: "🪑", rarity: "rare", color: "#6fb8a0", shape: ["X.", "XX"], recovery: 5, cost: 6, fight: { health: 15, regen: 1.5 } },
  { id: "garden-gloves", name: "Garden Gloves", icon: "🧤", rarity: "rare", color: "#a3c46a", shape: ["XX"], cost: 5, gives: { calm: 4 }, fight: { reach: "touch", crit: 0.15 } },
  { id: "magnet", name: "Magnet", icon: "🧲", rarity: "rare", color: "#c45a5a", shape: ["X"], cost: 7, gives: { reach: "row", speed: 0.15 }, fight: { reach: "row", pickup: 0.6, speedPct: 0.1 } },
  { id: "flashlight", name: "Flashlight", icon: "🔦", rarity: "rare", color: "#e3c25a", shape: ["XX"], cost: 7, gives: { reach: "column", damage: 1 }, fight: { reach: "column", critMult: 0.5, rangePct: 0.2 } },
  { id: "fire-extinguisher", name: "Fire Extinguisher", icon: "🧯", rarity: "rare", color: "#d6453a", shape: ["X", "X"], cost: 6, gives: { reach: "column", calm: 3 }, fight: { reach: "column", pierce: 1, knock: 15 } },
  { id: "holster", name: "Holster", icon: "👝", rarity: "rare", color: "#8a5a3a", shape: ["XX"], cost: 6, holster: true, fight: {} },

  // ---- New ideas (placeholders: emoji until they get pictures) ----
  { id: "slingshot", name: "Slingshot", icon: "🏹", rarity: "common", color: "#9a6a3a", shape: ["X", "X"], cost: 5,
    fight: { type: "throw", damage: 8, every: 0.7, range: 420, speed: 650, count: 1, pierce: 1, crit: 0.08, critMult: 2, knock: 10, shot: "pebble" } },
  { id: "egg-carton", name: "Egg Carton", icon: "🥚", rarity: "rare", color: "#f2e6c8", shape: ["XX"], cost: 7,
    fight: { type: "throw", damage: 5, every: 1.1, range: 320, speed: 480, count: 3, spread: 14, explode: 25, crit: 0.05, critMult: 2, knock: 6, shot: "egg" } },
  { id: "water-pistol", name: "Water Pistol", icon: "🔫", rarity: "common", color: "#4ab0e8", shape: ["XX"], cost: 5,
    fight: { type: "throw", damage: 3, every: 0.25, range: 260, speed: 520, count: 1, crit: 0.03, critMult: 2, knock: 22, shot: "water-balloon" } },
  { id: "roman-candle", name: "Roman Candle", icon: "🎆", rarity: "epic", color: "#e05a8a", shape: ["X", "X", "X"], cost: 11,
    fight: { type: "throw", damage: 12, every: 1.4, range: 400, speed: 420, count: 1, explode: 70, crit: 0.05, critMult: 2, knock: 20, shot: "firecracker" } },
  { id: "ricochet-puck", name: "Ricochet Puck", icon: "🏒", rarity: "rare", color: "#2a2a2a", shape: ["X"], cost: 7,
    fight: { type: "throw", damage: 7, every: 0.8, range: 350, speed: 650, count: 1, chain: 3, crit: 0.05, critMult: 2, knock: 8, shot: "puck" } },
  { id: "spinning-frisbees", name: "Spinning Frisbees", icon: "🥏", rarity: "epic", color: "#e8c84a", shape: ["XX", "XX"], cost: 10,
    fight: { type: "orbit", damage: 6, every: 0.4, range: 60, speed: 300, count: 3, crit: 0.05, critMult: 2, knock: 12, shot: "frisbee" } },
  { id: "sprinkler", name: "Sprinkler", icon: "💦", rarity: "rare", color: "#6ab0d8", shape: ["X"], cost: 6,
    fight: { type: "aura", damage: 3, every: 0.5, range: 80, count: 1, crit: 0.03, critMult: 2, knock: 10 } },
  // ---- Shooting weapons: forest, raccoon and suburb themed ----
  { id: "pinecone-launcher", name: "Pinecone Launcher", icon: "🌲", rarity: "common", color: "#6a4a2a", shape: ["X", "X"], cost: 5,
    fight: { type: "throw", damage: 6, every: 0.9, range: 340, speed: 520, count: 1, explode: 16, crit: 0.05, critMult: 2, knock: 12, shot: "pickups/pinecone" } },
  { id: "acorn-gatling", name: "Acorn Gatling", icon: "🌰", rarity: "rare", color: "#a8703a", shape: ["XX", "X."], cost: 8,
    fight: { type: "throw", damage: 4, every: 0.14, range: 300, speed: 680, count: 1, spread: 6, crit: 0.04, critMult: 2, knock: 3, shot: "acorn" } },
  { id: "fish-bone-darts", name: "Fish Bone Darts", icon: "🐟", rarity: "rare", color: "#c8d8e0", shape: ["X"], cost: 7,
    fight: { type: "throw", damage: 6, every: 0.9, range: 380, speed: 720, count: 3, spread: 10, pierce: 2, crit: 0.1, critMult: 2, knock: 4, shot: "pickups/fish-bone" } },
  { id: "trash-bag-lobber", name: "Trash Bag Lobber", icon: "🗑️", rarity: "epic", color: "#2a3a2a", shape: ["XX", "XX"], cost: 11,
    fight: { type: "throw", damage: 10, every: 2.4, range: 360, speed: 300, count: 1, explode: 55, crit: 0.05, critMult: 2, knock: 30, shot: "trash-orb" } },
  { id: "soda-can-shaker", name: "Soda Can Shaker", icon: "🥤", rarity: "rare", color: "#d84a3a", shape: ["X"], cost: 7,
    fight: { type: "throw", damage: 6, every: 1.4, range: 320, speed: 480, count: 1, explode: 26, crit: 0.05, critMult: 2, knock: 36, shot: "pickups/soda-can" } },
  { id: "tp-streamer", name: "TP Streamer", icon: "🧻", rarity: "common", color: "#f0ece0", shape: ["X", "X"], cost: 5,
    fight: { type: "throw", damage: 7, every: 0.9, range: 400, speed: 380, count: 1, pierce: 4, crit: 0.03, critMult: 2, knock: 6, shot: "tp-roll" } },
  { id: "compost-cannon", name: "Compost Cannon", icon: "🍂", rarity: "rare", color: "#7a5a2a", shape: ["XXX"], cost: 8,
    fight: { type: "throw", damage: 6, every: 1.3, range: 260, speed: 520, count: 5, spread: 16, crit: 0.05, critMult: 2, knock: 14, shot: "pickups/apple-core" } },
  { id: "bottle-cap-flicker", name: "Bottle Cap Flicker", icon: "🍾", rarity: "rare", color: "#c8a83a", shape: ["X"], cost: 7,
    fight: { type: "throw", damage: 5, every: 0.5, range: 340, speed: 760, count: 1, chain: 4, crit: 0.08, critMult: 2, knock: 5, shot: "bottle-cap" } },

  { id: "firecracker-pack", name: "Firecracker Pack", icon: "🧨", rarity: "rare", color: "#d8402a", shape: ["X"], cost: 7, fight: { reach: "touch", explode: 45 } },
  { id: "extension-cord", name: "Extension Cord", icon: "🔌", rarity: "rare", color: "#e8a830", shape: ["XXX"], cost: 7, fight: { reach: "row", chain: 2 } },
  { id: "mirror-shard", name: "Mirror Shard", icon: "🪞", rarity: "rare", color: "#c8dce8", shape: ["X"], cost: 8, fight: { reach: "touch", count: 1, damagePct: -0.1 } },
  { id: "lucky-penny", name: "Lucky Penny", icon: "🪙", rarity: "common", color: "#c8883a", shape: ["X"], cost: 4, fight: { crit: 0.08 } },
  { id: "whetstone", name: "Whetstone", icon: "🪨", rarity: "common", color: "#8a8a8a", shape: ["X"], cost: 4, fight: { reach: "touch", critMult: 0.5 } },
  { id: "coffee-mug", name: "Coffee Mug", icon: "☕", rarity: "common", color: "#8a5a3a", shape: ["X"], cost: 5, fight: { speedPct: 0.12 } },
  { id: "kitchen-timer", name: "Kitchen Timer", icon: "⏲️", rarity: "rare", color: "#d84a4a", shape: ["X"], cost: 7, fight: { reach: "row", speedPct: 0.2 } },
  { id: "megaphone", name: "Megaphone", icon: "📣", rarity: "rare", color: "#e8d84a", shape: ["XX"], cost: 7, fight: { reach: "row", damagePct: 0.2, knock: 15 } },
  { id: "binoculars", name: "Binoculars", icon: "🔭", rarity: "common", color: "#4a5a6a", shape: ["XX"], cost: 4, fight: { reach: "column", rangePct: 0.3 } },
  { id: "mosquito-jar", name: "Mosquito Jar", icon: "🦟", rarity: "rare", color: "#8ac85a", shape: ["X"], cost: 7, fight: { lifesteal: 0.04 } },
  { id: "vampire-teeth", name: "Vampire Teeth", icon: "🧛", rarity: "epic", color: "#a82a3a", shape: ["X"], cost: 10, fight: { reach: "touch", lifesteal: 0.1, damagePct: 0.1 } },
  { id: "hockey-pads", name: "Hockey Pads", icon: "🥅", rarity: "rare", color: "#d8d8e8", shape: ["XX", "XX"], cost: 7, fight: { armor: 4, health: 10, move: -0.05 } },
  { id: "toque", name: "Toque", icon: "🧢", rarity: "common", color: "#c83a3a", shape: ["X"], cost: 3, fight: { armor: 1, health: 10 } },
  { id: "energy-drink", name: "Energy Drink", icon: "⚡", rarity: "common", color: "#5ad84a", shape: ["X"], cost: 5, fight: { move: 0.15, speedPct: 0.05 } },
  { id: "maple-syrup", name: "Maple Syrup", icon: "🍁", rarity: "rare", color: "#c8701a", shape: ["X", "X"], cost: 7, fight: { health: 20, regen: 0.5 } },
];

// The critters you can play. speed: walking speed; health: health at the start of a street fight;
// rummage: how long looting a can takes (times 1 s). They have no attack of their own: only the weapons
// on your Outfit attack. (every, damage and shots are left over from their old throw; not used now.)
const CRITTERS = {
  raccoon:         { name: 'Raccoon', note: 'all-rounder, loots cans fastest', speed: 260, health: 100, every: 0.6, damage: 10, rummage: 0.7,
                     shots: ['pebble', 'bottle-cap', 'tin-can'] },
  possum:          { name: 'Possum', note: 'slow but very sturdy', speed: 225, health: 140, every: 0.75, damage: 14, rummage: 1,
                     shots: ['rotten-apple', 'sock', 'banana-spin'] },
  'red-fox':       { name: 'Red fox', note: 'quickest on its feet', speed: 310, health: 80, every: 0.55, damage: 9, rummage: 1,
                     shots: ['egg', 'water-balloon', 'paper-plane'] },
  'grey-squirrel': { name: 'Grey squirrel', note: 'fragile but nimble', speed: 290, health: 70, every: 0.38, damage: 7, rummage: 1,
                     shots: ['acorn', 'puck', 'frisbee'] },
  groundhog:       { name: 'Groundhog', note: 'the toughest, but slow', speed: 215, health: 150, every: 0.7, damage: 13, rummage: 1,
                     shots: ['pebble', 'tp-roll', 'firecracker', 'trash-orb'] },
};

// ---- Saving: the designer keeps your edits in this browser, and every page reads them from there. ----
const ITEMS_KEY = "culdesack.items";      // the edited list
const LOADOUT_KEY = "culdesack.loadout";  // the designer's test backpack: { cols, rows, placed: [{ id, col, row, shape }] }

function cloneItem(item) { return JSON.parse(JSON.stringify(item)); }

// The list to use. Only items you changed in the designer (and items you made) are kept as your own;
// every other item always comes fresh from DEFAULT_ITEMS above, so improvements to this file reach you.
// Saved as { v: 2, list: [...] }: an unchanged item is saved as just { id }, a changed one in full.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function loadItems() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(ITEMS_KEY)); } catch (e) { saved = null; }
  const defaults = Object.fromEntries(DEFAULT_ITEMS.map((i) => [i.id, i]));
  let list;
  if (saved && saved.v === 2 && Array.isArray(saved.list)) {
    list = saved.list.map((i) => (Object.keys(i).length === 1 && defaults[i.id] ? cloneItem(defaults[i.id]) : i))
                     .filter((i) => i.name);                    // (an unchanged item that has since been removed from the file)
  } else if (Array.isArray(saved)) {
    // The first saving style (the whole list): keep your own items and what you switched off.
    list = saved.map((i) => (defaults[i.id] ? { ...cloneItem(defaults[i.id]), ...(i.off ? { off: true } : {}) } : i));
  } else return DEFAULT_ITEMS.map(cloneItem);
  const have = new Set(list.map((i) => i.id));
  return list.concat(DEFAULT_ITEMS.filter((i) => !have.has(i.id)).map(cloneItem));
}
function saveItems(list) {
  const defaults = Object.fromEntries(DEFAULT_ITEMS.map((i) => [i.id, i]));
  const out = list.map((i) => (defaults[i.id] && same(i, defaults[i.id]) ? { id: i.id } : i));
  try { localStorage.setItem(ITEMS_KEY, JSON.stringify({ v: 2, list: out })); } catch (e) { /* storage off: edits only last until reload */ }
}
function loadLoadout() {
  try {
    const l = JSON.parse(localStorage.getItem(LOADOUT_KEY));
    if (l && Array.isArray(l.placed)) { l.placed.forEach((p) => delete p.el); return l; }
  } catch (e) { /* fall through */ }
  return { cols: 7, rows: 5, placed: [] };
}
function saveLoadout(l) {
  // (el is the backpack square on the designer page: not saved)
  try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(l, (k, v) => (k === "el" ? undefined : v))); } catch (e) { /* see saveItems */ }
}
