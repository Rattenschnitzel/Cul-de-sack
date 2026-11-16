# Handoff notes: Cul-de-sack

Written 2026-11-14 to continue in a fresh session. Read `CLAUDE.md` first: it has the user's
working rules. The full game description (every rule and number) is in
[rebuild-brief.md](rebuild-brief.md), so it is not repeated here.

## Where things stand

- **Last commit:** `d80147a` "Fight effects, gear colours by kind, roomier shop". It is pushed to
  https://github.com/Rattenschnitzel/Cul-de-sack (branch `main`).
- **Not committed:**
  - `docs/rebuild-brief.md`: a full spec for rebuilding the game in a fresh tool; the user wants
    to try that on another computer.
  - `art.zip`: made by the user, probably to carry the art folder over. Leave it alone unless they
    ask.
  - this file.
- **Open items:** nothing is half done. Every change asked for so far is in and tested.

## Since these notes were first written (2026-11-15)

Much has been added; the sections below this one describe the older shop only. In short:

- `index.html` is now the **start menu** (pick a critter, Play); the shop moved to **`shop.html`**.
- **Street fight:** `fight.html` + `fight.js`, an isometric bullet-heaven round in a 200 x 140 square
  suburb (streets, cul-de-sacs, a park, front yards, parked cars). The shop's "Go scavenge" opens it in
  a frame over the shop; it fights with the items on the Outfit and sends the loot back as gold.
- **Shared files:** `items.js` (every item, with its street-fight numbers, and the critters) and
  `weapons.js` (the weapon rules: throw, swing, orbit, aura, crits, chain, pierce, blasts, lifesteal).
- **Weapons designer:** `designer.html` + `designer.js`, edit items and test them in an arena.
- **Shop changes:** no gear for now (`GEAR_ON` in game.js), a 6 x 6 Outfit, no hand rule, empty carry
  sack, 20 starting gold. The old scavenge map and old shop fight are unused but still in game.js.
- **Art:** `art/catalog/` (292 sprites, see docs/art-catalog.md), `art/ground/`, `art/sprites/`, and
  pixel item pictures in `art/` (tools/make_items.py). Shadows are switched off (`SHADOWS_ON`).

## The user and how to work with them

- **New to coding.** Explain each step in plain words: what you'll do, why, what changed. Define
  jargon. Keep answers friendly and concrete.
- **Small steps.** Build one step at a time, and only the step asked for. No game code before
  they ask.
- **Commits.** Commit and push only when they say so, usually once at the end of the day. Don't
  offer to commit after each change.
- **Commit messages.**
  - Write the message to a file in the scratchpad and run `git commit -F <file>` (here-strings
    failed in PowerShell before).
  - End it with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Git user: "SmallGame Dev", with the user's email.
- **Never touch `E:\P4\EnvRebuild`.**
- **How they give feedback:** short and visual ("more subtle", "somewhat more visible"). When a
  request is ambiguous, pick the likely meaning, say which one you picked, and offer to switch.
  (Example: "subtle colour in the what-you-wear section" meant tinting the free gear squares, not
  the panel background.)
- **Their window** is about 1574 × 860 CSS px. The page must not scroll sideways. Check
  `document.documentElement.scrollWidth <= innerWidth`.

## Files

- **`index.html`:** the layout.
  - `header#top-bar` holds the name and `#scavenge-button`.
  - `aside#side` holds the raccoon and the `#totals` list.
  - `#map` is the scavenge screen.
  - `#pack-area` has two `.bag-column`s:
    - `#carry` with `#sell` under it;
    - `#body`, titled "Outfit", with `#hands` and `#gear-key`.
  - Below them: `#pack-hint`, then `#shop` (`#shop-head` with `#gold` and `#free-gold`,
    `#shopkeeper` with `#shop-message` and `#reroll`, then `#offers`, `#gear`, `#sacks`), then
    `#fight` and `#tooltip`.
  - `body[data-screen]` switches between `shop`, `map` and `fight`. Elements marked `.shop-only`,
    `.map-only`, `.fight-only` and `.not-map` show or hide by screen.
- **`game.js`** (about 1700 lines), in sections:
  1. **Constants:** `CELL=48`, `STEP=52`, rage and exhaustion values.
  2. **Items and rarities:** `ITEM_TYPES`, `RARITIES`.
  3. **Sacks and Outfit:**
     - `SACKS`, plus `BODY_COLS=10`, `BODY_ROWS=9`, `HAND_CELLS` and
       `RIGHT_POINTS` → `CONNECTION_POINTS` (mirrored);
     - `GEAR_COLORS` and `GEAR`;
     - `gearPieces` (worn gear only), `bodyCells`, and `items` (all items, plus gear stored in the
       carry sack).
  4. **Placement rules:** `fits`, `gearProblem`, `gearInUse`, `handProblem`, holster checks,
     `findFreeSpot`.
  5. **Drawing:** `drawShape` (sets `--r` and `--rows` on each block), `buildBag`, which draws
     gear, then connection points with `--tint-a`/`--tint-b`, then cells, then items.
     `showGhost`, `rotateShape`.
  6. **Pictures and info:** `makePicture` falls back to the emoji. `setShape` gives gear no
     picture. Then `describe`, the tooltip, `makeItem`, `putItem`, `putGear`, `removeGear`,
     `switchSack`.
  7. **Bonuses and totals:** `updateBonuses`, `perSecond`, `playerPower`, `showTotals`, the boost
     badges, and the reach preview.
  8. **Dragging:** `startDrag`, `moveDrag`, `rotateDrag`, `endDrag`, `endGearDrag`. Gear moves
     between `gearPieces` and `items` when it changes grid.
  9. **Shop:** offers, reroll, buying and selling, `shapePicture` (the shape drawn under each
     shop picture), `shelfItem`, `fillShelves(list, perShelf, spots)` (5 per shelf).
  10. **Scavenging:** `AREAS`, enemy growth, rewards, the verdict, `showMap`.
  11. **Fight:** `tick` every 100 ms; `showTimers` sets `--charge`; `showAction` adds the
      grow/flash class `.acting` and the floating numbers `.float-number`.
  12. **Start:** sets up the starting state.
- **`style.css`:** the garage theme.
  - Each grid has its own colour in `--bag`, which gear mixes into.
  - Gear blocks use `color-mix(... var(--color) 25%, var(--bag))`.
  - Connection points: the `.point` fill plus `.point::before` corner marks.
  - The fight charge fill (`@property --charge`, a per-block gradient slice), the `act` and
    `float-up` keyframes.
  - `.shelf-picture` stacks the shape and the picture.
- **`tools/`:** Python scripts for the art. They use ComfyUI at `127.0.0.1:8188` with
  `flux1-schnell-fp8`, 4 steps, and style F1.
  - `make_icons.py` makes the items in `art/*.png`.
  - `make_ui.py` makes `art/sacks/`, `art/gear/`, `art/characters/` and `art/ui/`.
  - The other scripts were for style tests and lineups. `art/style-test` and `art/lineups` are
    gitignored.
- **`docs/journey/`:** an illustrated PDF of the project so far, made earlier.

## Testing tips

- **Preview server:** start it with `preview_start {name: "small-game"}` (port 5500,
  `.claude/launch.json`).
- **The browser caches hard.** Before a reload, refetch the changed files with
  `await fetch('/game.js', {cache: 'reload'})` (and the same for the CSS and HTML), then
  `location.reload()`. Check something new in the code to be sure the fresh file loaded.
- **Real drags:** the built-in browser's `left_click_drag` is too fast for the game's pointer
  code, so nothing lands. Drive the drag code instead:

  ```js
  const fake = {
    button: 0, clientX: 0, clientY: 0, pointerId: 1,
    target: { closest: () => null, setPointerCapture() {} },
  };
  dragGearFromShop(gearType("Tool Belt"), fake); // or startDrag(item, fake, false, null, { dx: CELL / 2, dy: CELL / 2 })
  const o = gridOrigin("body");
  moveDrag(o.left + col * STEP + CELL / 2, o.top + row * STEP + CELL / 2);
  // read packHint.textContent and ghost.classList, then:
  endDrag(true);
  ```

  Older CDP test scripts with real mouse input also exist in a previous session's scratchpad, but
  that folder may be gone.
- **Size:** use `resize_window 1574x860` to match the user's screen, and reset it to `desktop`
  afterwards.
- **Quick setups:**
  - `gold = 100; showShop();`
  - `buyGear(makeItem(gearType("X"), "body", col, row))`
  - `addItem(itemType("X"), "body", col, row)`
  - `startFight(AREAS[2])`, and `clearInterval(loopId)` to freeze a fight.

## Ideas mentioned but not asked for

- Let items ride along when you move the gear under them (now: "Take the X off the Y first").
- On the green Outfit, vest and belt colours look alike. Push them further apart if the user
  minds.
- The "+10g" button is for testing. Remove it before a real release.
- The shop column is still taller than the screen once you reach the sacks.
