// Cul-de-sack: the weapons designer. Edit items, pack them into a test backpack, and watch your
// critter fight with them straight away in the arena. Items come from items.js (shared with the
// shop and the fight), the weapon rules from weapons.js (shared with the fight).

// ---------- 1. State ----------
let items = loadItems();                 // every item, with your edits
let loadout = loadLoadout();             // the test backpack: { cols, rows, placed: [{ id, col, row, shape }] }
let critter = localStorage.getItem("culdesack.critter") || "raccoon";
let selectedId = null;
let filter = "all";
const CELL = 44;
const $ = (id) => document.getElementById(id);
const byId = (id) => items.find((i) => i.id === id);
const defaultOf = (id) => DEFAULT_ITEMS.find((i) => i.id === id);

function toast(text) {
  const t = $("toast"); t.textContent = text; t.style.opacity = 1;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.style.opacity = 0), 1800);
}

// Something changed: save, redraw what shows it, and give the arena the new numbers.
function changed({ list = true, bag = true } = {}) {
  saveItems(items);
  saveLoadout(loadout);
  if (list) drawLibrary();
  if (bag) drawBag();
  refreshLoadout();
}

// ---------- 2. Item pictures and words ----------
function pictureOf(item, size) {
  const box = document.createElement("div");
  box.className = "pic";
  const img = new Image();
  img.src = `art/${item.id}.png`;
  img.draggable = false;
  img.onerror = () => { box.textContent = item.icon || "❓"; box.style.fontSize = `${Math.round(size * 0.65)}px`; };
  box.appendChild(img);
  return box;
}

const pct = (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
function summary(item) {
  const f = item.fight || {};
  if (f.type) {
    const extras = [];
    if ((f.count || 1) > 1) extras.push(`×${f.count}`);
    if (f.pierce) extras.push(`pierce ${f.pierce}`);
    if (f.chain) extras.push(`chain ${f.chain}`);
    if (f.explode) extras.push(`boom ${f.explode}`);
    if (f.lifesteal) extras.push(`lifesteal ${pct(f.lifesteal)}`);
    return `${f.type} · ${f.damage} dmg / ${f.every}s${extras.length ? " · " + extras.join(", ") : ""}`;
  }
  const bits = [];
  for (const [key, label] of [...BOOST_WEAPON_FIELDS, ...BOOST_SELF_FIELDS]) {
    if (!f[key]) continue;
    const short = label.split(" (")[0].replace(" +%", "").replace(" +", "");
    bits.push(key.endsWith("Pct") || ["move", "pickup", "lifesteal"].includes(key) ? `${short} ${pct(f[key])}`
             : key === "crit" ? `crit ${pct(f[key])}` : `${short} ${f[key] > 0 ? "+" : ""}${f[key]}`);
  }
  const reach = f.reach && f.reach !== "all" ? ` (${f.reach})` : "";
  return (bits.join(", ") || "does nothing yet") + reach;
}

// ---------- 3. The item list (left) ----------
function drawLibrary() {
  const q = $("search").value.trim().toLowerCase();
  const list = $("lib-list");
  list.innerHTML = "";
  for (const item of items) {
    const weapon = isWeaponItem(item);
    if (filter === "weapon" && !weapon) continue;
    if (filter === "boost" && weapon) continue;
    if (filter === "off" && !item.off) continue;
    if (q && !item.name.toLowerCase().includes(q)) continue;
    const row = document.createElement("div");
    row.className = `lib-item${item.off ? " off" : ""}${item.id === selectedId ? " selected" : ""}`;
    row.appendChild(pictureOf(item, 34));
    const mid = document.createElement("div");
    mid.innerHTML = `<div class="name rar-${item.rarity}">${item.name}</div><div class="sum">${summary(item)}</div>`;
    row.appendChild(mid);
    const tick = document.createElement("label");
    tick.title = "In the game (shop and fights)";
    const box = document.createElement("input");
    box.type = "checkbox"; box.checked = !item.off;
    box.onchange = () => { item.off = !box.checked; changed(); toast(item.off ? `${item.name} switched off` : `${item.name} is back in the game`); };
    tick.append(box, "in game");
    tick.addEventListener("pointerdown", (e) => e.stopPropagation());
    row.appendChild(tick);
    row.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      startDrag(e, { id: item.id, shape: item.shape.slice(), from: null }, () => select(item.id));
    });
    row.addEventListener("mouseenter", (e) => showTip(item, e));
    row.addEventListener("mouseleave", hideTip);
    list.appendChild(row);
  }
}

function select(id) {
  selectedId = id;
  drawLibrary();
  drawEditor();
  showTab("editor");
}

// ---------- 4. The backpack (right, Inventory tab) ----------
const fitsAt = (shape, col, row, ignore) => {
  const mine = cellsAt(shape, col, row);
  const taken = new Set(loadout.placed.filter((p) => p !== ignore).flatMap((p) => cellsAt(p.shape, p.col, p.row)));
  return mine.every((k) => {
    const [c, r] = k.split(",").map(Number);
    return c >= 0 && r >= 0 && c < loadout.cols && r < loadout.rows && !taken.has(k);
  });
};

function shapeBox(item, shape, cls) {
  const el = document.createElement("div");
  el.className = cls;
  const w = shape[0].length, h = shape.length;
  el.style.width = `${w * CELL}px`; el.style.height = `${h * CELL}px`;
  shape.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch !== "X") return;
    const b = document.createElement("div");
    b.className = "block";
    b.style.left = `${c * CELL + 2}px`; b.style.top = `${r * CELL + 2}px`;
    if (item) b.style.background = item.color || "#8a9aa8";
    el.appendChild(b);
  }));
  if (item) {
    const side = Math.min(w, h) * CELL - 8;
    const pic = pictureOf(item, side);
    pic.style.width = pic.style.height = `${side}px`;
    pic.style.left = `${(w * CELL - side) / 2}px`; pic.style.top = `${(h * CELL - side) / 2}px`;
    el.appendChild(pic);
  }
  return el;
}

let boostedNames = new Set();
function drawBag() {
  const bag = $("bag");
  bag.innerHTML = "";
  bag.style.width = `${loadout.cols * CELL + 12}px`; bag.style.height = `${loadout.rows * CELL + 12}px`;
  $("bag-cols").value = loadout.cols; $("bag-rows").value = loadout.rows;
  for (let r = 0; r < loadout.rows; r++)
    for (let c = 0; c < loadout.cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.left = `${6 + c * CELL + 2}px`; cell.style.top = `${6 + r * CELL + 2}px`;
      bag.appendChild(cell);
    }
  for (const p of loadout.placed) {
    const item = byId(p.id);
    if (!item) continue;
    const el = shapeBox(item, p.shape, "placed");
    el.style.left = `${6 + p.col * CELL}px`; el.style.top = `${6 + p.row * CELL}px`;
    if (item.off) el.style.opacity = 0.4;
    p.el = el;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      startDrag(e, { id: p.id, shape: p.shape.slice(), from: p }, () => select(p.id));
    });
    el.addEventListener("mouseenter", (e) => { showTip(item, e); highlightReach(p, true); });
    el.addEventListener("mouseleave", () => { hideTip(); highlightReach(p, false); });
    bag.appendChild(el);
  }
  markBoosted();
}

// Weapons with at least one boost get a yellow outline; hovering a boost lights up what it reaches.
function markBoosted() {
  for (const p of loadout.placed) if (p.el) p.el.classList.toggle("boosted", boostedNames.has(p));
}
function highlightReach(p, on) {
  const item = byId(p.id);
  if (!item || isWeaponItem(item)) return;
  const one = makeLoadout(critter, loadout.placed.filter((q) => q === p || isWeaponItem(byId(q.id))), items);
  const reached = new Set(one.weapons.filter((w) => w.boosts.length).map((w) => w.name));
  for (const q of loadout.placed) if (q.el && q !== p && reached.has(byId(q.id)?.name)) q.el.classList.toggle("hl", on);
}

// ---------- 5. Dragging (from the list or inside the backpack) ----------
let drag = null;
function startDrag(e, what, onClick) {
  e.preventDefault();
  drag = { ...what, startX: e.clientX, startY: e.clientY, moved: false, onClick, el: null, ghost: null };
  addEventListener("pointermove", moveDrag);
  addEventListener("pointerup", endDrag, { once: true });
}
function bagSpot(e, shape) {
  const r = $("bag").getBoundingClientRect();
  const w = shape[0].length, h = shape.length;
  const col = Math.round((e.clientX - r.left - 6 - (w * CELL) / 2) / CELL);
  const row = Math.round((e.clientY - r.top - 6 - (h * CELL) / 2) / CELL);
  const inside = e.clientX > r.left - 30 && e.clientX < r.right + 30 && e.clientY > r.top - 30 && e.clientY < r.bottom + 30;
  return { col, row, inside };
}
function redrawDragged() {
  const item = byId(drag.id);
  drag.el?.remove(); drag.ghost?.remove();
  drag.el = shapeBox(item, drag.shape, "dragging");
  document.body.appendChild(drag.el);
  drag.ghost = shapeBox(null, drag.shape, "ghost");
  $("bag").appendChild(drag.ghost);
}
function moveDrag(e) {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
  if (!drag.moved) {
    drag.moved = true;
    hideTip();
    if (drag.from) drag.from.el.style.visibility = "hidden";
    showTab("inventory");
    redrawDragged();
  }
  drag.lastEvent = e;
  const w = drag.shape[0].length, h = drag.shape.length;
  drag.el.style.left = `${e.clientX - (w * CELL) / 2}px`; drag.el.style.top = `${e.clientY - (h * CELL) / 2}px`;
  const s = bagSpot(e, drag.shape);
  drag.ghost.style.display = s.inside ? "block" : "none";
  drag.ghost.style.left = `${6 + s.col * CELL}px`; drag.ghost.style.top = `${6 + s.row * CELL}px`;
  drag.ghost.classList.toggle("bad", !fitsAt(drag.shape, s.col, s.row, drag.from));
}
function turnDragged() {
  if (!drag || !drag.moved) return;
  drag.shape = turnShape(drag.shape);
  redrawDragged();
  if (drag.lastEvent) moveDrag(drag.lastEvent);
}
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r") turnDragged(); });
addEventListener("contextmenu", (e) => { if (drag && drag.moved) { e.preventDefault(); turnDragged(); } });
function endDrag(e) {
  removeEventListener("pointermove", moveDrag);
  if (!drag) return;
  const d = drag;
  drag = null;
  d.el?.remove(); d.ghost?.remove();
  if (!d.moved) { d.onClick(); return; }
  const s = bagSpot(e, d.shape);
  if (s.inside && fitsAt(d.shape, s.col, s.row, d.from)) {
    if (d.from) Object.assign(d.from, { col: s.col, row: s.row, shape: d.shape });
    else loadout.placed.push({ id: d.id, col: s.col, row: s.row, shape: d.shape });
  } else if (d.from && !s.inside) {
    loadout.placed.splice(loadout.placed.indexOf(d.from), 1);              // dropped outside: taken out
    toast(`${byId(d.id).name} taken out`);
  } else if (!s.inside) {
    // dropped from the list somewhere else: nothing to do
  } else toast("Doesn't fit there");
  changed({ list: false });
}

// ---------- 6. Your numbers (Inventory tab, under the backpack) ----------
let currentLoadout = null;
function refreshLoadout() {
  currentLoadout = makeLoadout(critter, loadout.placed, items);
  if (runner) runner.setLoadout(currentLoadout);
  hero.max = currentLoadout.hero.maxHealth;
  hero.health = Math.min(hero.health, hero.max);
  // Which placed weapons got boosts (for the yellow outlines).
  boostedNames = new Set();
  let wi = 0;
  for (const p of loadout.placed) {
    const item = byId(p.id);
    if (!item || item.off || !isWeaponItem(item)) continue;
    if (currentLoadout.weapons[wi] && currentLoadout.weapons[wi].boosts.length) boostedNames.add(p);
    wi++;
  }
  markBoosted();
  const h = currentLoadout.hero;
  $("hero-stats").innerHTML = [
    ["Health", h.maxHealth], ["Armor", h.armor], ["Regen", `${h.regen.toFixed(1)}/s`],
    ["Move", Math.round(h.move)], ["Pickup", `${Math.round(h.pickup * 100)}%`],
    ["Total DPS", Math.round(currentLoadout.weapons.reduce((s, w) => s + w.dps, 0))],
  ].map(([k, v]) => `<div>${k}: <b>${v}</b></div>`).join("");
  const rows = currentLoadout.weapons.map((w) => {
    const tags = [];
    if (w.count > 1) tags.push(`×${w.count}`);
    if (w.pierce) tags.push(`pierce ${w.pierce}`);
    if (w.chain) tags.push(`chain ${w.chain}`);
    if (w.explode) tags.push(`boom ${Math.round(w.explode)}`);
    tags.push(`crit ${Math.round(w.crit * 100)}% ×${w.critMult.toFixed(1)}`);
    if (w.lifesteal) tags.push(`lifesteal ${Math.round(w.lifesteal * 100)}%`);
    const boosts = w.boosts.length ? `<div class="tags">boosted by ${w.boosts.join(", ")}</div>` : "";
    return `<tr><td>${w.icon} ${w.name}<div class="tags">${w.type} · ${tags.join(" · ")}</div>${boosts}</td>
            <td class="num">${w.damage.toFixed(1)}</td><td class="num">${w.every.toFixed(2)}s</td><td class="num"><b>${Math.round(w.dps)}</b></td></tr>`;
  }).join("");
  $("weapon-table").innerHTML = `<tr><th>Weapon</th><th class="num">Dmg</th><th class="num">Every</th><th class="num">DPS</th></tr>${rows}`;
}

// ---------- 7. The item editor (Edit item tab) ----------
function field(label, input) {
  const row = document.createElement("label");
  row.className = "field";
  const s = document.createElement("span"); s.textContent = label;
  row.append(s, input);
  return row;
}
function numberInput(value, step, onInput) {
  const i = document.createElement("input");
  i.type = "number"; i.step = step; i.value = value ?? 0;
  i.oninput = () => { const v = parseFloat(i.value); if (!Number.isNaN(v)) onInput(v); };
  return i;
}
function textInput(value, onInput) {
  const i = document.createElement("input");
  i.type = "text"; i.value = value ?? "";
  i.oninput = () => onInput(i.value);
  return i;
}
function selectInput(options, value, onChange) {
  const s = document.createElement("select");
  for (const [k, label] of Object.entries(options)) { const o = document.createElement("option"); o.value = k; o.textContent = label; s.appendChild(o); }
  s.value = value;
  s.onchange = () => onChange(s.value);
  return s;
}
// Trim empty rows and columns from a 4 x 4 drawing; null if nothing is ticked.
function trimShape(grid) {
  let rows = grid.map((r) => r.map((on) => (on ? "X" : ".")).join(""));
  rows = rows.filter((r) => r.includes("X"));
  if (!rows.length) return null;
  let c0 = 4, c1 = -1;
  for (const r of rows) for (let c = 0; c < 4; c++) if (r[c] === "X") { c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  return rows.map((r) => r.slice(c0, c1 + 1));
}

function drawEditor() {
  const tab = $("tab-editor");
  tab.innerHTML = "";
  const item = byId(selectedId);
  if (!item) { tab.innerHTML = `<p class="hint">Click an item in the list (or in the backpack) to edit it, or make a new one with <b>+ New item</b>.</p>`; return; }
  const save = (opts) => changed(opts);
  const head = document.createElement("h3");
  head.textContent = `${item.icon} ${item.name}${item.custom ? " (your own)" : ""}`;
  tab.appendChild(head);

  tab.appendChild(field("Name", textInput(item.name, (v) => { item.name = v || "Unnamed"; head.textContent = `${item.icon} ${item.name}`; save({ bag: false }); })));
  tab.appendChild(field("Emoji (until it has a picture)", textInput(item.icon, (v) => { item.icon = v; save(); })));
  tab.appendChild(field("Rarity", selectInput({ common: "Common", rare: "Rare", epic: "Epic" }, item.rarity, (v) => { item.rarity = v; save({ bag: false }); })));
  tab.appendChild(field("Price in the shop", numberInput(item.cost, 1, (v) => { item.cost = v; save({ bag: false }); })));
  const color = document.createElement("input"); color.type = "color"; color.value = item.color || "#8a9aa8";
  color.oninput = () => { item.color = color.value; save({ list: false }); };
  tab.appendChild(field("Colour", color));
  const inGame = document.createElement("input"); inGame.type = "checkbox"; inGame.checked = !item.off;
  inGame.onchange = () => { item.off = !inGame.checked; save(); };
  tab.appendChild(field("In the game (shop and fights)", inGame));

  // Shape: click squares on a 4 x 4 grid.
  const sh = document.createElement("h3"); sh.textContent = "Squares it takes in the backpack"; tab.appendChild(sh);
  const grid = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => (item.shape[r] || "")[c] === "X"));
  const shapeEl = document.createElement("div"); shapeEl.id = "shape-edit";
  grid.forEach((line, r) => line.forEach((on, c) => {
    const d = document.createElement("div");
    d.classList.toggle("on", on);
    d.onclick = () => {
      grid[r][c] = !grid[r][c];
      const s = trimShape(grid);
      if (!s) { grid[r][c] = true; toast("An item needs at least one square"); return; }
      d.classList.toggle("on", grid[r][c]);
      item.shape = s;
      // Placed copies take the new shape; any that no longer fit come out of the backpack.
      for (const p of loadout.placed.filter((q) => q.id === item.id)) {
        p.shape = s.slice();
        if (!fitsAt(p.shape, p.col, p.row, p)) { loadout.placed.splice(loadout.placed.indexOf(p), 1); toast(`${item.name} no longer fits: taken out`); }
      }
      save();
    };
    shapeEl.appendChild(d);
  }));
  tab.appendChild(shapeEl);
  const count = document.createElement("div"); count.className = "hint";
  count.textContent = `${item.shape.join("").split("X").length - 1} square(s)`;
  tab.appendChild(count);

  // What it does in the fight.
  const fh = document.createElement("h3"); fh.textContent = "In the street fight"; tab.appendChild(fh);
  item.fight = item.fight || {};
  const kind = selectInput({ weapon: "Weapon (attacks)", boost: "Boost (helps you or other weapons)" }, isWeaponItem(item) ? "weapon" : "boost", (v) => {
    item.fight = v === "weapon" ? { type: "throw", ...WEAPON_DEFAULTS } : { reach: "touch", damagePct: 0.1 };
    save(); drawEditor();
  });
  tab.appendChild(field("Kind", kind));
  const f = item.fight;
  if (isWeaponItem(item)) {
    tab.appendChild(field("How it attacks", selectInput(WEAPON_TYPES, f.type, (v) => { f.type = v; save(); })));
    for (const [key, label, step] of WEAPON_FIELDS)
      tab.appendChild(field(label, numberInput(f[key] ?? WEAPON_DEFAULTS[key], step, (v) => { f[key] = v; save({ bag: false }); })));
    tab.appendChild(field("Projectile picture", selectInput(Object.fromEntries(SHOTS.map((s) => [s, s])), f.shot || "pebble", (v) => { f.shot = v; save({ bag: false }); })));
  } else {
    tab.appendChild(field("Which weapons it boosts", selectInput(REACHES, f.reach || "all", (v) => { f.reach = v; save(); })));
    const wh = document.createElement("div"); wh.className = "hint"; wh.textContent = "Boosts for those weapons:"; tab.appendChild(wh);
    for (const [key, label, step] of BOOST_WEAPON_FIELDS)
      tab.appendChild(field(label, numberInput(f[key] ?? 0, step, (v) => { if (v) f[key] = v; else delete f[key]; save({ bag: false }); })));
    const sh2 = document.createElement("div"); sh2.className = "hint"; sh2.textContent = "Boosts for you (work wherever it sits):"; tab.appendChild(sh2);
    for (const [key, label, step] of BOOST_SELF_FIELDS)
      tab.appendChild(field(label, numberInput(f[key] ?? 0, step, (v) => { if (v) f[key] = v; else delete f[key]; save({ bag: false }); })));
  }

  // Buttons.
  const buttons = document.createElement("div"); buttons.className = "editor-buttons";
  const btn = (text, cls, fn) => { const b = document.createElement("button"); b.textContent = text; if (cls) b.className = cls; b.onclick = fn; buttons.appendChild(b); };
  btn("Duplicate", "", () => {
    const copy = cloneItem(item);
    copy.id = uniqueId(item.id + "-copy"); copy.name = item.name + " copy"; copy.custom = true;
    items.splice(items.indexOf(item) + 1, 0, copy);
    selectedId = copy.id; changed(); drawEditor(); toast("Copied");
  });
  if (defaultOf(item.id)) {
    btn("Undo my changes", "", () => {
      if (!confirm(`Put ${item.name} back the way it was?`)) return;
      items[items.indexOf(item)] = cloneItem(defaultOf(item.id));
      changed(); drawEditor(); toast("Back to the original");
    });
  }
  if (item.custom) {
    btn("Delete", "danger", () => {
      if (!confirm(`Delete ${item.name}? This can't be undone.`)) return;
      items.splice(items.indexOf(item), 1);
      loadout.placed = loadout.placed.filter((p) => p.id !== item.id);
      selectedId = null; changed(); drawEditor(); toast("Deleted");
    });
  } else {
    btn(item.off ? "Switch it back on" : "Switch it off", "", () => { item.off = !item.off; changed(); drawEditor(); });
  }
  btn("Put in the backpack", "primary", () => {
    for (let r = 0; r < loadout.rows; r++) for (let c = 0; c < loadout.cols; c++)
      if (fitsAt(item.shape, c, r)) { loadout.placed.push({ id: item.id, col: c, row: r, shape: item.shape.slice() }); changed(); showTab("inventory"); return; }
    toast("No room in the backpack");
  });
  tab.appendChild(buttons);
}

function uniqueId(base) {
  let id = base, n = 2;
  while (byId(id)) id = `${base}-${n++}`;
  return id;
}

// ---------- 8. Tooltip and tabs ----------
function showTip(item, e) {
  const t = $("tooltip");
  t.innerHTML = `<b>${item.icon} ${item.name}</b> <span class="rar-${item.rarity}">${item.rarity}</span><br>${summary(item)}<br>
                 <span class="tags">${item.cost} gold · ${item.shape.join("").split("X").length - 1} square(s)${item.off ? " · switched off" : ""}</span>`;
  t.style.display = "block";
  const r = e.currentTarget.getBoundingClientRect();
  t.style.left = `${Math.min(innerWidth - 300, r.right + 8)}px`; t.style.top = `${r.top}px`;
}
function hideTip() { $("tooltip").style.display = "none"; }
function showTab(name) {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.id === `tab-${name}`));
}

// ---------- 9. The test arena ----------
// Your critter in the middle of a lawn, pests walking in from every side. Seen from above.
const canvas = $("arena"), ctx = canvas.getContext("2d");
const ZOOM = 2;
const PESTS = ["dogs/corgi", "dogs/beagle", "dogs/chihuahua", "dogs/pug", "dogs/husky", "dogs/poodle", "animals/canada-goose", "animals/skunk", "humans/neighbour"];
const pics = {};
function pic(path) {
  if (!pics[path]) { const i = new Image(); i.src = `art/catalog/${path}.png`; pics[path] = i; }
  return pics[path].complete && pics[path].naturalWidth ? pics[path] : null;
}
const hero = { x: 0, y: 0, health: 100, max: 100, facing: 1, walk: 0, hurt: 0, throwPose: 0 };
let pests = [], floats = [], blasts = [], kills = 0, downs = 0, spawnWait = 0, dpsLog = [], time = 0;
let runner = null;

const world = {
  player: hero,
  enemies: () => pests,
  hurt(e, dmg, crit, dx, dy, knock) {
    e.health -= dmg; e.flash = 0.1;
    e.x += dx * knock * 0.6; e.y += dy * knock * 0.6;
    floats.push({ x: e.x, y: e.y - 20, text: crit ? `${Math.round(dmg)}!` : `${Math.round(dmg)}`, color: crit ? "#ffd34d" : "#fff", big: crit, age: 0 });
    if (e.health <= 0) { kills++; blasts.push({ x: e.x, y: e.y, r: 18, age: 0, kind: "poof" }); pests.splice(pests.indexOf(e), 1); }
  },
  heal(n) { hero.health = Math.min(hero.max, hero.health + n); },
  effect(kind, x, y, size) {
    if (kind === "explode") blasts.push({ x, y, r: size, age: 0, kind: "boom" });
    if (kind === "hit") blasts.push({ x, y, r: 6, age: 0, kind: "hit" });
  },
};

function resetArena() {
  pests = []; floats = []; blasts = []; kills = 0; downs = 0; dpsLog = []; time = 0;
  hero.health = hero.max;
  runner = new WeaponRunner(currentLoadout, world);
}

function resize() {
  const r = canvas.getBoundingClientRect(), ratio = devicePixelRatio || 1;
  canvas.width = Math.round(r.width * ratio); canvas.height = Math.round(r.height * ratio);
}
addEventListener("resize", resize);

function arenaStep(dt) {
  time += dt;
  const viewR = Math.hypot(canvas.width, canvas.height) / (devicePixelRatio || 1) / ZOOM / 2;
  // You: walk slowly round in a circle (if ticked), heal by regen.
  const prevX = hero.x, prevY = hero.y;
  if ($("walk").checked) { hero.walk += dt; hero.x = Math.cos(hero.walk * 0.5) * 90; hero.y = Math.sin(hero.walk * 0.5) * 60; }
  if (hero.x !== prevX) hero.facing = hero.x > prevX ? 1 : -1;
  hero.health = Math.min(hero.max, hero.health + currentLoadout.hero.regen * dt);
  hero.hurt = Math.max(0, hero.hurt - dt);
  // New pests at the edge of the view.
  spawnWait -= dt;
  const rate = +$("density").value;
  if (spawnWait <= 0 && pests.length < 25 + rate * 6) {
    spawnWait = 1 / rate;
    const a = Math.random() * Math.PI * 2, hp = +$("tough").value;
    pests.push({ x: hero.x + Math.cos(a) * (viewR + 30), y: hero.y + Math.sin(a) * (viewR + 30), r: 10, health: hp, max: hp,
                 speed: 60 + Math.random() * 50, sprite: PESTS[Math.floor(Math.random() * PESTS.length)], bite: 0, flash: 0 });
  }
  // Pests walk at you and bite (armor takes some off every bite).
  for (const e of pests) {
    const dx = hero.x - e.x, dy = hero.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.bite = Math.max(0, e.bite - dt); e.flash = Math.max(0, e.flash - dt);
    // Keep a little apart from other pests, like in the street fight (so blasts aren't unfairly good here).
    for (const o of pests) {
      if (o === e) continue;
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < 24) { e.x += (ox / od) * 30 * dt; e.y += (oy / od) * 30 * dt; }
    }
    if (d > 22) { e.x += (dx / d) * e.speed * dt; e.y += (dy / d) * e.speed * dt; }
    else if (e.bite === 0) {
      e.bite = 0.8;
      if (!$("god").checked) {
        const dmg = Math.max(1, 8 - currentLoadout.hero.armor);
        hero.health -= dmg; hero.hurt = 0.2;
        floats.push({ x: hero.x, y: hero.y - 40, text: `-${dmg}`, color: "#ff6a55", age: 0 });
        if (hero.health <= 0) { downs++; hero.health = hero.max; pests = pests.filter((p) => Math.hypot(p.x - hero.x, p.y - hero.y) > 120); }
      }
    }
    e.face = dx > 0 ? 1 : -1;
  }
  const firedBefore = runner.fired || 0;
  runner.update(dt);
  if ((runner.fired || 0) > firedBefore) hero.throwPose = 0.15;
  hero.throwPose = Math.max(0, hero.throwPose - dt);
  for (const f of floats) f.age += dt;
  floats = floats.filter((f) => f.age < 0.8);
  for (const b of blasts) b.age += dt;
  blasts = blasts.filter((b) => b.age < 0.35);
  dpsLog.push([time, runner.dealt]);
  while (dpsLog.length && dpsLog[0][0] < time - 5) dpsLog.shift();
}

function drawArena() {
  const ratio = devicePixelRatio || 1, W = canvas.width / ratio / ZOOM, H = canvas.height / ratio / ZOOM;
  ctx.setTransform(ratio * ZOOM, 0, 0, ratio * ZOOM, 0, 0);
  ctx.imageSmoothingEnabled = false;
  // Lawn with a faint grid, following you.
  ctx.fillStyle = "#4c7a36"; ctx.fillRect(0, 0, W, H);
  const ox = W / 2 - hero.x, oy = H / 2 - hero.y;
  ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1;
  for (let x = ((ox % 32) + 32) % 32; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = ((oy % 32) + 32) % 32; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.save(); ctx.translate(Math.round(ox), Math.round(oy));
  const sprite = (img, x, y, flip, alpha = 1) => {
    if (!img) return false;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -Math.round(img.width / 2), -img.height); ctx.restore(); return true;
  };
  const spin = (name, x, y, a) => {
    const img = pic(shotPicture(name || "pebble"));
    ctx.save(); ctx.translate(Math.round(x), Math.round(y - 12)); ctx.rotate(a);
    if (img) ctx.drawImage(img, -img.width / 2, -img.height / 2);
    else { ctx.fillStyle = "#e8e0c8"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  // Aura pulses and swings (under the characters).
  for (const p of runner.pulses) { const t = p.age / 0.3; ctx.strokeStyle = `rgba(160, 220, 255, ${1 - t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.range * (0.6 + t * 0.4), p.range * (0.6 + t * 0.4), 0, 0, Math.PI * 2); ctx.stroke(); }
  for (const s of runner.swings) {
    const t = s.age / 0.3; ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * (1 - t)})`;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, s.range, s.angle - Math.PI / 3, s.angle + Math.PI / 3); ctx.closePath(); ctx.fill();
  }
  // Characters, back to front.
  const things = pests.map((e) => ({ y: e.y, draw: () => {
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(e.x, e.y, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    const img = pic(e.sprite);
    if (!sprite(img, e.x, e.y + 3, e.face < 0)) { ctx.fillStyle = "#a8743f"; ctx.fillRect(e.x - 8, e.y - 14, 16, 14); }
    if (e.flash > 0 && img) { ctx.globalCompositeOperation = "lighter"; sprite(img, e.x, e.y + 3, e.face < 0, 0.6); ctx.globalCompositeOperation = "source-over"; }
    if (e.health < e.max) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(e.x - 11, e.y - 42, 22, 4); ctx.fillStyle = "#ff5a4a"; ctx.fillRect(e.x - 10, e.y - 41, 20 * e.health / e.max, 2); }
  } }));
  things.push({ y: hero.y, draw: () => {
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
    const k = `critters/${critter}`;
    const img = pic(hero.throwPose > 0 ? `${k}-throw` : k) || pic(k);
    const faceLeft = critter === "raccoon" && hero.throwPose <= 0;            // the raccoon's front picture looks left
    if (!sprite(img, hero.x, hero.y + 4, faceLeft ? hero.facing > 0 : hero.facing < 0, hero.hurt > 0 ? 0.6 : 1)) {
      ctx.fillStyle = "#9aa0aa"; ctx.fillRect(hero.x - 10, hero.y - 30, 20, 30);
    }
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(hero.x - 19, hero.y - 60, 38, 6);
    ctx.fillStyle = hero.health / hero.max > 0.4 ? "#5fd35a" : "#ff5a4a"; ctx.fillRect(hero.x - 18, hero.y - 59, 36 * hero.health / hero.max, 4);
  } });
  things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
  // Things in the air, spinners, chain lightning, blasts, numbers.
  for (const s of runner.shots) spin(s.name, s.x, s.y, s.name === "paper-plane" ? Math.atan2(s.vy, s.vx) : s.spin);
  for (const b of runner.spinners) spin(b.name || "frisbee", b.x, b.y, b.spin);
  for (const c of runner.chains) {
    ctx.strokeStyle = `rgba(255, 240, 120, ${1 - c.age / 0.3})`; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(c.x0, c.y0 - 12);
    for (let i = 1; i < 6; i++) { const t = i / 6; ctx.lineTo(c.x0 + (c.x1 - c.x0) * t + (Math.random() - 0.5) * 10, c.y0 - 12 + (c.y1 - c.y0) * t + (Math.random() - 0.5) * 10); }
    ctx.lineTo(c.x1, c.y1 - 12); ctx.stroke();
  }
  for (const b of blasts) {
    const t = b.age / 0.35;
    if (b.kind === "boom") {
      ctx.fillStyle = `rgba(255, ${160 - t * 100}, 40, ${0.55 * (1 - t)})`; ctx.beginPath(); ctx.arc(b.x, b.y - 6, b.r * (0.5 + t * 0.5), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255, 230, 150, ${1 - t})`; ctx.lineWidth = 2; ctx.stroke();
    } else if (b.kind === "hit") {
      ctx.fillStyle = `rgba(255, 255, 220, ${1 - t})`; ctx.beginPath(); ctx.arc(b.x, b.y - 12, 3 + t * 6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = `rgba(230, 225, 210, ${0.7 * (1 - t)})`;
      for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6]]) { ctx.beginPath(); ctx.arc(b.x + dx * (1 + t), b.y - 8 + dy, 6 + t * 6, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.textAlign = "center";
  for (const f of floats) {
    ctx.font = `bold ${f.big ? 11 : 8}px system-ui`; ctx.globalAlpha = 1 - f.age / 0.8;
    ctx.fillStyle = "#000"; ctx.fillText(f.text, f.x + 0.5, f.y - f.age * 30 + 0.5);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - f.age * 30);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  const dps = dpsLog.length > 1 ? (dpsLog[dpsLog.length - 1][1] - dpsLog[0][1]) / Math.max(1, dpsLog[dpsLog.length - 1][0] - dpsLog[0][0]) : 0;
  $("arena-hud").innerHTML = `Damage per second: <b>${Math.round(dps)}</b> &nbsp; Pests shooed: <b>${kills}</b> &nbsp; Knocked down: <b>${downs}</b><br>
    Health: <b>${Math.ceil(hero.health)} / ${hero.max}</b> &nbsp; Pests on screen: ${pests.length}`;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  arenaStep(dt);
  drawArena();
  requestAnimationFrame(frame);
}

// ---------- 10. Buttons and start ----------
for (const [key, c] of Object.entries(CRITTERS)) {
  const o = document.createElement("option"); o.value = key; o.textContent = c.name; $("critter").appendChild(o);
}
$("critter").value = critter;
$("critter").onchange = () => { critter = $("critter").value; localStorage.setItem("culdesack.critter", critter); refreshLoadout(); };
$("search").oninput = drawLibrary;
document.querySelectorAll("#filters button").forEach((b) => b.onclick = () => {
  filter = b.dataset.f;
  document.querySelectorAll("#filters button").forEach((x) => x.classList.toggle("on", x === b));
  drawLibrary();
});
document.querySelectorAll("#tabs button").forEach((b) => b.onclick = () => showTab(b.dataset.tab));
$("new-item").onclick = () => {
  const n = items.filter((i) => i.custom).length + 1;
  const item = { id: uniqueId(`new-item-${n}`), name: `New item ${n}`, icon: "❓", rarity: "common", color: "#8a9aa8", shape: ["X"], cost: 5,
                 custom: true, fight: { type: "throw", ...WEAPON_DEFAULTS } };
  items.unshift(item);
  changed();
  select(item.id);
  toast("New placeholder item made: change it on the right");
};
$("reset").onclick = () => {
  if (!confirm("Forget every change (items and backpack) and go back to the original items?")) return;
  items = DEFAULT_ITEMS.map(cloneItem);
  loadout = { cols: 7, rows: 5, placed: [] };
  selectedId = null; changed(); drawEditor(); toast("Everything is back to the original");
};
$("clear-bag").onclick = () => { loadout.placed = []; changed({ list: false }); };
for (const key of ["cols", "rows"]) $(`bag-${key}`).onchange = () => {
  loadout[key] = Math.max(2, Math.min(10, +$(`bag-${key}`).value || 5));
  loadout.placed = loadout.placed.filter((p) => cellsAt(p.shape, p.col, p.row).every((k) => { const [c, r] = k.split(",").map(Number); return c < loadout.cols && r < loadout.rows; }));
  changed({ list: false });
};
$("arena-reset").onclick = resetArena;
// Download: the items.js file with your list as the new starting list (the rest of the file unchanged).
$("download").onclick = async () => {
  const text = await (await fetch("items.js")).text();
  const start = text.indexOf("const DEFAULT_ITEMS = [");
  const end = text.indexOf("\n];\n", start);
  if (start < 0 || end < 0) { toast("Couldn't read items.js"); return; }
  const body = items.map((i) => { const c = cloneItem(i); delete c.custom; return "  " + JSON.stringify(c) + ","; }).join("\n");
  const out = text.slice(0, start) + "const DEFAULT_ITEMS = [\n" + body + text.slice(end);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "text/javascript" }));
  a.download = "items.js"; a.click();
  toast("items.js downloaded: put it in the game folder to make your changes the new originals");
};

resize();
refreshLoadout();
resetArena();
drawLibrary();
drawBag();
drawEditor();
requestAnimationFrame(frame);
