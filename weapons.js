// Cul-de-sack: the weapon rules for the street fight. The real fight (fight.js) and the weapons
// designer's test arena (designer.js) both use this file, so what you test is exactly what you get.
//
// Two parts:
//   1. makeLoadout(): from your critter and the items in your backpack, work out your own numbers
//      (health, armor...) and every weapon's final numbers, with all boosts added.
//   2. WeaponRunner: each frame, fires the weapons, moves what's in the air and deals the hits.
//      It doesn't know about maps or drawing: the page gives it a "world" (see WeaponRunner below).
//
// Positions are world pixels seen from above (x right, y down), like everywhere in the fight.

// What the designer shows for each number, in order. kind: which items have it.
const WEAPON_FIELDS = [
  ["damage", "Damage", 1], ["every", "Seconds between attacks", 0.05], ["range", "Range", 5], ["speed", "Speed (throw: px/s, orbit: °/s)", 10],
  ["count", "Projectiles / swings / spinners", 1], ["spread", "Spread between projectiles (°)", 1], ["pierce", "Pierce (flies through)", 1],
  ["chain", "Chain (jumps on to more)", 1], ["explode", "Explosion radius (0 = none)", 5], ["knock", "Knockback", 2],
  ["crit", "Crit chance (0-1)", 0.01], ["critMult", "Crit damage (x)", 0.1], ["lifesteal", "Lifesteal (0-1)", 0.01],
];
const BOOST_WEAPON_FIELDS = [
  ["damagePct", "Damage +% (0.1 = 10%)", 0.05], ["speedPct", "Attack speed +%", 0.05], ["rangePct", "Range +%", 0.05],
  ["crit", "Crit chance +", 0.01], ["critMult", "Crit damage +", 0.1], ["count", "Projectiles +", 1], ["chain", "Chain +", 1],
  ["pierce", "Pierce +", 1], ["explode", "Explosion radius +", 5], ["knock", "Knockback +", 2], ["lifesteal", "Lifesteal +", 0.01],
];
const BOOST_SELF_FIELDS = [
  ["health", "Max health +", 5], ["armor", "Armor (bites hurt less)", 1], ["regen", "Health per second", 0.1],
  ["move", "Move speed +%", 0.05], ["pickup", "Pickup pull +%", 0.1],
];
const WEAPON_TYPES = { throw: "Throw (flies at the nearest pest)", swing: "Swing (arc in front)", orbit: "Orbit (spins round you)", aura: "Aura (pulse round you)" };
const REACHES = { all: "Everything (all weapons)", touch: "Weapons it touches", row: "Weapons in its rows", column: "Weapons in its columns" };
// Projectile pictures: art/catalog/projectiles/<name>.png, or any catalogue picture named with its folder.
const SHOTS = ["pebble", "bottle-cap", "tin-can", "rotten-apple", "sock", "banana-spin", "egg", "water-balloon", "paper-plane",
               "acorn", "puck", "frisbee", "tp-roll", "firecracker", "trash-orb",
               "pickups/pinecone", "pickups/fish-bone", "pickups/soda-can", "pickups/apple-core", "pickups/acorn", "pickups/dog-bone", "pickups/sock"];
function shotPicture(name) { return name.includes("/") ? name : `projectiles/${name}`; }

const WEAPON_DEFAULTS = { damage: 5, every: 1, range: 300, speed: 500, count: 1, spread: 12, pierce: 0, chain: 0, explode: 0,
                          knock: 10, crit: 0.05, critMult: 2, lifesteal: 0, shot: "pebble" };

function isWeaponItem(item) { return !!(item && item.fight && item.fight.type); }

// The squares an item covers when placed with its top-left at (col, row), as "col,row" strings.
function cellsAt(shape, col, row) {
  const out = [];
  shape.forEach((line, r) => [...line].forEach((ch, c) => { if (ch === "X") out.push(`${col + c},${row + r}`); }));
  return out;
}

// Turn a shape a quarter turn clockwise.
function turnShape(shape) {
  const h = shape.length, w = shape[0].length, out = [];
  for (let c = 0; c < w; c++) { let line = ""; for (let r = h - 1; r >= 0; r--) line += shape[r][c]; out.push(line); }
  return out;
}

// placed: [{ id, col, row, shape }]; items: the item list. Gives { hero, weapons }.
//   hero: maxHealth, armor, regen, move (walking speed), pickup (pull multiplier), critter
//   weapons: final numbers per weapon, plus `name`, `icon`, `boosts` (names of items boosting it) and `dps`.
function makeLoadout(critterKey, placed, items) {
  const crit = CRITTERS[critterKey] || CRITTERS.raccoon;
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const parts = placed.map((p) => ({ ...p, item: byId[p.id], cells: new Set(cellsAt(p.shape, p.col, p.row)) }))
                      .filter((p) => p.item && !p.item.off);
  const rowsOf = (p) => new Set([...p.cells].map((k) => k.split(",")[1]));
  const colsOf = (p) => new Set([...p.cells].map((k) => k.split(",")[0]));
  const touching = (a, b) => [...a.cells].some((k) => {
    const [c, r] = k.split(",").map(Number);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => b.cells.has(`${c + dc},${r + dr}`));
  });
  const shares = (a, b, f) => { const s = f(b); return [...f(a)].some((v) => s.has(v)); };
  const reaches = (boost, weapon) => {
    const reach = boost.item.fight.reach || "all";
    if (!weapon) return reach === "all";                         // the critter's own throw: only "everything" boosts
    if (reach === "all") return true;
    if (reach === "touch") return touching(boost, weapon);
    if (reach === "row") return shares(boost, weapon, rowsOf);
    if (reach === "column") return shares(boost, weapon, colsOf);
    return false;
  };

  const boosts = parts.filter((p) => !isWeaponItem(p.item));
  const sum = (key, list = boosts) => list.reduce((s, p) => s + (p.item.fight[key] || 0), 0);
  const hero = {
    critter: critterKey,
    maxHealth: Math.round(crit.health + sum("health")),
    armor: sum("armor"),
    regen: sum("regen"),
    move: crit.speed * Math.max(0.3, 1 + sum("move")),
    pickup: Math.max(0.2, 1 + sum("pickup")),
  };

  const finish = (base, name, icon, part) => {
    const weaponKeys = BOOST_WEAPON_FIELDS.map(([k]) => k);
    const mine = boosts.filter((b) => reaches(b, part) && weaponKeys.some((k) => b.item.fight[k]));   // only items that boost weapons
    const add = (key) => sum(key, mine);
    const w = { ...WEAPON_DEFAULTS, ...base };
    const out = {
      name, icon, type: w.type, shot: w.shot, shots: base.shots,
      damage: Math.max(0, w.damage * (1 + add("damagePct"))),
      every: Math.max(0.05, w.every / Math.max(0.1, 1 + add("speedPct"))),
      range: w.range * (1 + add("rangePct")),
      speed: w.speed,
      count: Math.max(1, Math.round(w.count + add("count"))),
      spread: w.spread,
      pierce: Math.max(0, Math.round(w.pierce + add("pierce"))),
      chain: Math.max(0, Math.round(w.chain + add("chain"))),
      explode: Math.max(0, w.explode + add("explode")),
      knock: Math.max(0, w.knock + add("knock")),
      crit: Math.min(1, Math.max(0, w.crit + add("crit"))),
      critMult: Math.max(1, w.critMult + add("critMult")),
      lifesteal: Math.max(0, w.lifesteal + add("lifesteal")),
      boosts: mine.map((b) => b.item.name),
    };
    // A rough damage-per-second: hits per second x projectiles x average crit bonus (chains and blasts not counted).
    out.dps = out.damage * out.count * (1 + out.crit * (out.critMult - 1)) / out.every;
    return out;
  };

  // Only the weapons in the backpack attack (the critters have no attack of their own).
  const weapons = [];
  for (const p of parts) if (isWeaponItem(p.item)) weapons.push(finish(p.item.fight, p.item.name, p.item.icon, p));
  return { hero, weapons };
}

// What an item does in the street fight, in a few short lines (for the shop's and designer's info cards).
function itemSummary(item) {
  const f = item.fight || {};
  const pct = (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
  if (f.type) {
    const w = { ...WEAPON_DEFAULTS, ...f };
    const lines = [`${WEAPON_TYPES[w.type].split(" (")[0]}: ${w.damage} damage every ${w.every}s`];
    const extras = [];
    if (w.count > 1) extras.push(`${w.count} at once`);
    if (w.pierce) extras.push(`flies through ${w.pierce}`);
    if (w.chain) extras.push(`jumps on to ${w.chain} more`);
    if (w.explode) extras.push(`bursts (${w.explode} wide)`);
    if (w.lifesteal) extras.push(`heals you ${pct(w.lifesteal)} of its damage`);
    extras.push(`${Math.round(w.crit * 100)}% crit for ×${w.critMult}`);
    lines.push(extras.join(", "));
    return lines;
  }
  const where = { all: "all your weapons", touch: "weapons it touches", row: "weapons in its rows", column: "weapons in its columns" }[f.reach || "all"];
  const forWeapons = [], forYou = [];
  const named = { damagePct: "damage", speedPct: "attack speed", rangePct: "range", critMult: "crit damage", lifesteal: "lifesteal", move: "move speed", pickup: "pickup pull" };
  for (const [k] of BOOST_WEAPON_FIELDS) if (f[k]) forWeapons.push(k.endsWith("Pct") || k === "lifesteal" ? `${pct(f[k])} ${named[k]}` : k === "crit" ? `${pct(f[k])} crit chance` : k === "critMult" ? `+${f[k]} ${named[k]}` : `+${f[k]} ${k}`);
  for (const [k] of BOOST_SELF_FIELDS) if (f[k]) forYou.push(k === "move" || k === "pickup" ? `${pct(f[k])} ${named[k]}` : k === "regen" ? `+${f[k]} health per second` : `+${f[k]} ${k === "health" ? "max health" : k}`);
  const lines = [];
  if (forWeapons.length) lines.push(`${forWeapons.join(", ")} for ${where}`);
  if (forYou.length) lines.push(`you: ${forYou.join(", ")}`);
  return lines.length ? lines : ["does nothing in the street fight"];
}

// ---------------------------------------------------------------------------------------------
// The runner. world: what the page gives it:
//   player: { x, y } (read every frame)
//   enemies(): the list of pests, each with x, y, r (size) and health
//   hurt(enemy, damage, crit, dirX, dirY, knock): take health off (and remove it at 0, show a number...)
//   heal(amount): lifesteal
//   effect(kind, x, y, size): show something: "hit", "explode", "chain" (from x,y to size = {x, y}), "aura"
//   blocked(x, y): optional, true where thrown things stop (walls, cars)
//   random(): optional, a random number 0..1
// What it keeps for drawing: shots (things in the air), swings (arcs just swung), spinners (orbit
// blades), pulses (aura rings), chains (lines from chain jumps). Each has an `age`.
class WeaponRunner {
  constructor(loadout, world) {
    this.world = world;
    this.shots = []; this.swings = []; this.spinners = []; this.pulses = []; this.chains = [];
    this.dealt = 0;          // damage dealt so far (for a damage-per-second meter)
    this.setLoadout(loadout);
  }
  // Swap in new numbers (the designer does this whenever you change something) without a restart.
  setLoadout(loadout) {
    const old = this.weapons || [];
    this.loadout = loadout;
    this.weapons = loadout.weapons.map((w, i) => ({ ...w, wait: old[i] ? Math.min(old[i].wait, w.every) : w.every * 0.5,
                                                     phase: old[i] ? old[i].phase : 0, cooldowns: new Map() }));
  }
  rand() { return this.world.random ? this.world.random() : Math.random(); }

  nearest(x, y, range, skip) {
    let best = null, bestD = range;
    for (const e of this.world.enemies()) {
      if (e.health <= 0 || (skip && skip.has(e))) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // One hit on one pest: crits, lifesteal, and the blast if the weapon explodes.
  hit(w, e, dx, dy, scale = 1, blast = true) {
    if (e.health <= 0) return;
    const crit = this.rand() < w.crit;
    const dmg = w.damage * scale * (crit ? w.critMult : 1);
    this.dealt += Math.min(dmg, e.health);
    this.world.hurt(e, dmg, crit, dx, dy, w.knock * scale);
    if (w.lifesteal > 0) this.world.heal(dmg * w.lifesteal);
    if (blast && w.explode > 0) {
      this.world.effect("explode", e.x, e.y, w.explode);
      for (const o of this.world.enemies().slice()) {
        if (o === e || o.health <= 0) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < w.explode + o.r) {
          const len = d || 1;
          this.hit(w, o, (o.x - e.x) / len, (o.y - e.y) / len, scale * 0.5, false);   // blasts do half damage
        }
      }
    }
  }

  update(dt) {
    const p = this.world.player;
    for (const w of this.weapons) {
      w.wait -= dt;
      if (w.type === "orbit") { this.orbit(w, dt, p); continue; }
      if (w.wait > 0) continue;
      if (w.type === "aura") {
        w.wait = w.every;
        const near = this.world.enemies().filter((e) => e.health > 0 && Math.hypot(e.x - p.x, e.y - p.y) < w.range + e.r);
        this.pulses.push({ x: p.x, y: p.y, range: w.range, age: 0 });
        for (const e of near) { const d = Math.hypot(e.x - p.x, e.y - p.y) || 1; this.hit(w, e, (e.x - p.x) / d, (e.y - p.y) / d); }
        continue;
      }
      const target = this.nearest(p.x, p.y, w.range);
      if (!target) { w.wait = 0; continue; }                     // nothing close: stay ready
      w.wait = w.every;
      const aim = Math.atan2(target.y - p.y, target.x - p.x);
      if (w.type === "swing") this.swing(w, p, aim);
      else this.fire(w, p, aim);
      this.fired = (this.fired || 0) + 1;
    }
    this.moveShots(dt);
    for (const list of [this.swings, this.pulses, this.chains]) {
      for (const s of list) s.age += dt;
      while (list.length && list[0].age > 0.3) list.shift();
    }
  }

  fire(w, p, aim) {
    const spread = (w.spread * Math.PI) / 180;
    for (let k = 0; k < w.count; k++) {
      const a = aim + (k - (w.count - 1) / 2) * spread;
      const name = w.shots ? w.shots[Math.floor(this.rand() * w.shots.length)] : w.shot;
      this.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, flown: 0, w, name,
                        spin: 0, pierce: w.pierce, chain: w.chain, done: new Set() });
    }
  }

  swing(w, p, aim) {
    const half = Math.PI / 3;                                    // a 120° arc
    for (let k = 0; k < w.count; k++) {
      const a = aim + (k * Math.PI * 2) / w.count;
      this.swings.push({ x: p.x, y: p.y, angle: a, range: w.range, age: 0 });
      for (const e of this.world.enemies().slice()) {
        if (e.health <= 0) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        let diff = Math.abs(Math.atan2(dy, dx) - a) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (d < w.range + e.r && (diff < half || d < e.r + 10)) this.hit(w, e, dx / (d || 1), dy / (d || 1));
      }
    }
  }

  orbit(w, dt, p) {
    w.phase += (w.speed * Math.PI / 180) * dt;
    for (const [e, t] of w.cooldowns) { if (t - dt <= 0) w.cooldowns.delete(e); else w.cooldowns.set(e, t - dt); }
    const blades = [];
    for (let k = 0; k < w.count; k++) {
      const a = w.phase + (k * Math.PI * 2) / w.count;
      const bx = p.x + Math.cos(a) * w.range, by = p.y + Math.sin(a) * w.range;
      blades.push({ x: bx, y: by, name: w.shot, spin: w.phase * 3 });
      for (const e of this.world.enemies().slice()) {
        if (e.health <= 0 || w.cooldowns.has(e)) continue;
        if (Math.hypot(e.x - bx, e.y - by) < e.r + 10) {
          w.cooldowns.set(e, w.every);                           // the same pest only every `every` seconds
          this.hit(w, e, Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2));
        }
      }
    }
    w.blades = blades;
    this.spinners = this.weapons.filter((x) => x.type === "orbit").flatMap((x) => x.blades || []);
  }

  moveShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], w = s.w;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.flown += w.speed * dt; s.spin += dt * 14;
      let gone = s.flown > w.range * 1.3 || (this.world.blocked && this.world.blocked(s.x, s.y));
      const e = this.world.enemies().find((o) => o.health > 0 && !s.done.has(o) && Math.hypot(o.x - s.x, o.y - s.y) < o.r + 5);
      if (e) {
        s.done.add(e);
        const len = Math.hypot(s.vx, s.vy) || 1;
        this.world.effect("hit", s.x, s.y, 1);
        this.hit(w, e, s.vx / len, s.vy / len);
        if (s.pierce > 0) s.pierce--;
        else if (s.chain > 0) {
          // Jump on to the nearest pest it hasn't hit yet.
          const next = this.nearest(e.x, e.y, 220, s.done);
          if (next) {
            s.chain--;
            const a = Math.atan2(next.y - e.y, next.x - e.x), sp = Math.hypot(s.vx, s.vy);
            this.chains.push({ x0: e.x, y0: e.y, x1: next.x, y1: next.y, age: 0 });
            this.world.effect("chain", e.x, e.y, { x: next.x, y: next.y });
            s.x = e.x; s.y = e.y; s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.flown = 0;
          } else gone = true;
        } else gone = true;
      }
      if (gone) { this.shots.splice(i, 1); if (this.world.landed) this.world.landed(s); }
    }
  }
}
