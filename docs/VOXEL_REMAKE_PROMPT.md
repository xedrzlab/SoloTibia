# SoloTibia → Voxel Remake — Systems Specification

You are rebuilding SoloTibia as a **voxel game** (Minecraft-style block world,
first-person or over-the-shoulder camera) while keeping every non-map,
non-monster system identical in behaviour to the 2D original. Map layout
and monster roster are being redesigned separately and are NOT part of this
spec. Everything below is verbatim game-rule truth from the shipping 2D
build.

The 2D build is a private single-player mobile PWA. The voxel remake is
also single-player, all state on-device, no server, no other players. Use
whichever engine fits the target platform (Unity / Godot / Bevy / custom).

---

## 1. Character stats & vocations

Four vocations, chosen at character creation. Pre-choice ("none") is a
valid state until the vocation-choice level.

| Vocation | HP/lvl | Mana/lvl | Capacity/lvl | Identity |
|---|---|---|---|---|
| none (pre-choice) | +8 | +10 | +15 | balanced placeholder |
| Knight | +15 | +5 | +25 | melee tank |
| Paladin | +10 | +15 | +20 | ranged hybrid |
| Sorcerer | +5 | +30 | +10 | offensive caster |
| Druid | +5 | +30 | +10 | healing/control caster |

**Base at level 1 (before growth):**
- HP: **150**
- Mana: **30** (starts non-zero so magic training is possible from L1)
- Capacity: **400** (units of "oz" — item weight sums against this)

Derived per level: `maxHp = 150 + hpPerLevel × (level − 1)`, same shape
for mana and capacity.

**XP curve** (cubic; fast early, slow late):
```
Exp(L) = round( 50/3 × (L³ − 6L² + 17L − 12) )
```
This is CUMULATIVE XP needed to reach level `L`. Level 1 = 0 XP, Level 2 =
100, Level 5 = 400, Level 100 = ~1.5M. `levelForExp(total)` walks up from
1 until `Exp(L+1) > total`.

**Level-up behaviour:** on gaining a level, recompute maxHp/maxMana/
maxCapacity and **fully refill HP and Mana** to their new maxes.

**Vocation choice** is unlocked at level `VOCATION_CHOICE_LEVEL = 8`. An
Elder NPC in the starter town handles it. Choosing a vocation recomputes
maxes and refills HP/Mana.

---

## 2. Skills (use-based training)

Four trainable skills:

| Skill ID | Display | Starts at | Trained by |
|---|---|---|---|
| melee | Melee | 10 | landing a melee hit (+1 try per hit) |
| distance | Distance | 10 | landing a distance hit (+1 try per hit) |
| magic | Magic Level | 0 | mana spent on any spell (+1 try per mana pt) |
| shielding | Shielding | 10 | blocking an incoming hit (+1 try per block) |

**Advancement formula** (one shared formula):
```
triesForNextLevel(skill, level, vocation) =
    A × B^(level − offset)
```
- `A` = per-skill base tries: melee 50, distance 30, shielding 100, magic 1600
- `offset` = skill's starting level (10, 10, 10, 0 respectively)
- `B` = per-vocation-per-skill growth rate:

| Vocation | melee | distance | magic | shielding |
|---|---|---|---|---|
| none | 1.5 | 1.5 | 1.5 | 1.5 |
| knight | 1.1 | 1.4 | 3.0 | 1.1 |
| paladin | 1.2 | 1.1 | 1.4 | 1.1 |
| sorcerer | 2.0 | 2.0 | 1.1 | 1.5 |
| druid | 1.8 | 1.8 | 1.1 | 1.5 |

A big mana dump can cross multiple magic levels in one training call — the
train loop subtracts `needed`, increments level, recomputes `needed`, and
loops until `tries < needed`.

Level-up messages read as "You advanced from melee fighting level 12 to
level 13." (skill names in messages: "melee fighting", "distance fighting",
"magic", "shielding").

---

## 3. Combat pipeline

### Combat stances

Three global stances the player toggles: `attack`, `balanced`, `defense`.

| Stance | Combat factor (offense) | Defense factor |
|---|---|---|
| Full Attack | 1.0 | 1.0 |
| Balanced | 0.75 | 1.0 |
| Full Defense | 0.5 | 1.5 |

The offense factor scales ONLY the skill × weapon-attack term of the
damage formula, never the level contribution. The defense factor scales
ONLY the shield-block computation.

### Player damage formulas

**Melee max damage:**
```
maxDmg = max(1, floor(0.085 × combatFactor × attack × skill + level / 5))
```
**Melee min damage:** `floor(maxDmg × 0.2)` — melee never whiffs completely.

**Distance max damage:**
```
maxDmg = max(1, floor(0.09 × combatFactor × attack × skill + level / 5))
```
**Distance min damage:** `floor(level / 5)`.

**Distance hit chance** (separate from damage, so re-tuning one doesn't
change the other):
```
optimal   = max(2, round(maxRange × 0.6))
chance    = 0.97 − 0.06 × abs(distance − optimal)
chance    = clamp(chance, 0.5, 0.97)
```
Best chance at ~60% of the weapon's max range; falls off both point-blank
and at the edge of range.

**Spell power** (damage or heal):
```
minPower = max(0, floor(level × 0.2 + magicLevel × spell.minCoefficient))
maxPower = max(1, floor(level × 0.2 + magicLevel × spell.maxCoefficient))
```
Roll uniformly between them. Only Magic Level scales spells; melee/distance
skill has ZERO effect on spell power. That's the core "tank vs. glass
cannon" gate.

### Defense pipeline (against incoming physical hits)

Applied in this order, per hit:

1. **Attacker hit roll** — every monster has an integer `hitChance` in
   0..100; roll `Math.random() × 100 < hitChance`. If it fails the hit
   is a MISS — no damage, no shielding try, floating "Missed" text.
2. **Shield block** — if the player has a shield equipped AND their
   equipped weapon is NOT two-handed:
   ```
   effectiveShieldDef = shieldDef + weaponDefBonus
   blockChance = clamp(0, 0.5,
                       (shieldingSkill × 0.004
                        + effectiveShieldDef × 0.012)
                       × defenseFactor)
   ```
   On block: 0 damage, +1 shielding try. Blocking counts as shielding
   training regardless of what the incoming damage would have been.
3. **Armor mitigation** (flat, not percentage — classic Tibia 7.6 style):
   ```
   if armor <= 0: no reduction
   if armor == 1: reduce by 1
   if armor >= 2: reduce by uniform int in [floor(A/2) .. floor(A/2)*2 − 1]
                  (A=4 → 2..3, A=6 → 3..5, A=9 → 4..7, A=14 → 7..13)
   ```
4. **Physical resistance** (percentage, `0..1`, applied after armor):
   ```
   final = floor(damage × (1 − clamp(resist, 0, 1)))
   ```
   No equipment grants resistance today (always 0); the hook exists for
   future items.

Two-handed weapons occupy the weapon AND shield slot, so wielding one
disables the block roll entirely.

### Player auto-attack

- Base attack interval: **2000 ms** (`BASE_ATTACK_INTERVAL_MS`) — one
  swing/shot per two seconds by default. Interval is stored per-player
  and can be adjusted by future gear.
- Melee reach: **1 tile** Chebyshev distance (`MELEE_RANGE`). A tile-
  adjacent target counts as in range.
- Distance reach: whatever `weapon.range` says (bow = 5 tiles).
- Attack lunges the player sprite ~4 px toward the target for 180 ms
  (`ATTACK_POSE_MS`), no dedicated swing animation.
- Tap-to-target: tap the creature to acquire it. The player auto-attacks
  the target every interval as long as it's in range and alive.

---

## 4. Equipment (paperdoll)

10 worn slots. Order matters — this is how the paperdoll is laid out
3-wide in the sidebar:

| Slot | Display | Purpose |
|---|---|---|
| head | Helmet | armor |
| neck | Amulet | armor / effects |
| back | Backpack | root of the inventory tree (container) |
| armor | Armor | armor |
| left | Weapon | attack + range + defense (as shield bonus) |
| right | Shield | defense (shield block) |
| legs | Legs | armor |
| feet | Boots | armor |
| ring | Ring | armor / effects |
| ammo | Ammo | contributes attack to distance weapons |

**Equip rules:**
- An item can only enter the slot its definition names.
- A two-handed weapon (`twoHanded: true`) occupies BOTH the weapon and
  shield slots. Trying to equip a shield while a two-hander is worn is
  rejected, and vice versa.
- Equip attempts that fail leave everything untouched.

**Derived stats:**
- `attack = weapon.attack || FIST_ATTACK(7)`. For a distance weapon, also
  add `ammo.attack` (a bow's own attack is 0 — its damage comes from
  arrows).
- `range = weapon.range || 1`.
- `defense = weapon.defense + shield.defense` (UI-facing total).
- `shieldDefense = shield.defense`; `weaponDefenseBonus = weapon.defense`
  (used only when a shield is equipped — see combat formula).
- `armor = sum(item.armor across all worn slots)`.
- `weight = sum(item.weight × count across all worn slots + full
  weight of any backpack's contents recursively)`.

---

## 5. Inventory (nested containers)

The worn backpack is the root of the inventory tree. Items that are
themselves containers (backpacks, bags) can be dropped inside other
containers and opened.

- **Container capacity:** slot count, not weight. Backpack = 12 slots,
  Bag = 8 slots, Depot = 24 slots.
- **Stack max:** 100 (`STACK_MAX`). Stackable items merge into an
  existing stack first, then spill into empty slots.
- **Weight** is tracked separately, per item type × count, and sums up
  recursively through nested containers to charge against the player's
  capacity.
- **Recursion safety:** dragging a bag into itself (or into any bag
  nested inside it) is rejected — otherwise the contents would be
  orphaned.
- **Move validation:** both source and destination sides of a move are
  validated BEFORE either is written, so a half-legal swap can't
  duplicate or delete an item.
- **Loot bags** are containers dropped as corpses; identical model, just
  UI-flagged so they render in an auto-arranged loot grid rather than the
  draggable sidebar strip.

Currency: **2 tiers**. Gold coin (base), Platinum coin (1 plat = 100
gold). Gold coin has 6 visual stack tiers with different icons at
counts 1, 5, 10, 20, 50, 100 — pick the smallest tier whose count is ≥
the stack's count.

---

## 6. Items

Every item is one of these `kind`s: `consumable`, `currency`, `equipment`,
`container`, `ammo`, `trophy`.

Item fields (only relevant ones by kind):
- **All**: `id`, `name`, `textureKey`, `kind`, `stackable`, `weight` (oz)
- **Consumable food**: `regenSeconds`, `regenPercentOfMaxHp` — eating
  queues a heal-over-time that restores `regenPercentOfMaxHp × maxHp`
  spread evenly across `regenSeconds`. Multiple foods stack additively
  (both amount and duration).
- **Consumable potion**: `healAmount` (instant HP) or `manaAmount`
  (instant Mana). Consumed on use.
- **Equipment**: `equipSlot`, `armor`, plus if it's a weapon:
  `weaponType` (`melee`/`distance`/`wand`), `attack`, `defense`, `range`,
  `twoHanded`.
- **Ammo**: `equipSlot: "ammo"`, `attack` (added to distance weapon's
  attack while equipped).
- **Container**: `equipSlot: "back"` (or nested in another container),
  `containerCapacity` (slot count).

Full catalogue in the shipping 2D build (28 items — copy verbatim):

- Currency: **gold_coin** (0.1 oz)
- Food: **cheese** (regen 9% HP over 108s), **meat** (15%/180s), **ham**
  (30%/360s)
- Trophies: **honeycomb**, **bear_paw**
- Potions: **health_potion** (heal 40, weight 2.7), **mana_potion**
  (mana 30, weight 2.7)
- Containers: **backpack** (18 oz, 12 slots, "back") + 5 cosmetic color
  variants (red/blue/green/gray/tan); **bag** (6 oz, 8 slots, "back")
- Melee weapons: **sword** (attack 12, def 11, 35 oz), **axe** (15/8/40),
  **two_handed_sword** (23/0/75, two-handed)
- Distance: **bow** (attack 0, range 5, 32 oz), **arrow** (attack 14,
  0.7 oz, stackable ammo)
- Wands: **wand_of_vortex** (attack 8, def 5, 19 oz)
- Shields: **wooden_shield** (def 9, 40 oz), **steel_shield** (def 15,
  60 oz)
- Armor: **leather_helmet** (arm 1, 12 oz), **steel_helmet** (arm 6,
  46 oz), **leather_armor** (arm 4, 40 oz), **plate_armor** (arm 10,
  110 oz), **leather_legs** (arm 1, 22 oz), **plate_legs** (arm 7,
  85 oz), **leather_boots** (arm 1, 8 oz)
- Jewellery: **amulet_of_life** (arm 1, 6 oz, "neck"),
  **ring_of_healing** (arm 1, 2 oz, "ring")
- Bare-handed: `FIST_ATTACK = 7`

Starting gear (given to a fresh character in the backpack):
- Equipped: backpack, sword, leather_armor
- In backpack: 3× health_potion, 1× mana_potion, 1× wooden_shield,
  1× leather_helmet

---

## 7. Spells

Fields: `id`, `name`, `words` (incantation string shown when cast),
`manaCost`, `kind` (`attack` | `heal`), `minCoefficient`,
`maxCoefficient`, and for attack spells only, `range` (tiles).

Casting flow:
1. Check `mana >= manaCost`. If not, "Not enough mana."
2. For attack spells, check target exists and is within `range` (Chebyshev
   tile distance). If not, "Out of range."
3. Spend the mana. **Every point spent counts as one magic-level try**
   (this is the only way to train magic).
4. Roll power in `[minPower..maxPower]` per §3.
5. Attack spell: apply the rolled damage to the target (goes through the
   same armor pipeline as physical). Heal spell: `player.heal(rolled)`.
6. Emit the spell's `words` as a floating combat-text bubble above the
   caster, plus a log entry.

Currently 2 shipping spells (extend freely):
- **light_healing**: "exura", mana 20, heal, min 3 / max 5 coefficients.
- **flame_strike**: "exori flam", mana 20, attack, min 3 / max 5, range 4.

The action bar's default spell layout is `[flame_strike, light_healing]`.

---

## 8. NPCs

Every interior room can have one NPC. Fields:
- `id`, `name`, `textureKey`
- `role`: `shop` | `vocation` | `bank`
- `greeting` (opening dialogue line)
- `about` (shown when player taps "Job" in dialogue)
- Tile position within the room
- Optional `directional` config for animated NPCs (see §12).

**Interaction:** player must be within `NPC_INTERACT_RANGE = 3` Chebyshev
tiles to talk. Tapping the NPC (or "Talk" button) inside range opens a
Dialogue panel with:
- Portrait (down-idle frame for directional NPCs, otherwise the whole
  static sprite)
- Name
- Body text (starts with greeting)
- Menu buttons:
  - "Job" → replaces body with `about` text
  - "Trade" (shop role) → opens Shop panel
  - "Deposit" / "Withdraw" (bank role) → opens Bank panel
  - "Choose Vocation" (vocation role, only if player.level ≥ 8) →
    opens Vocation choice panel
  - "Bye" → closes dialogue

**Directional NPCs (optional):**
- Spritesheet 32×32 with 4 directions × N frames (down, left, right, up
  order), rendered at 1.5× (matches player's on-screen size).
- Middle frame per direction (index 1) is the idle pose.
- Walk animation cycles `[0, 1, 2, 1]` for a 3-frame direction (or
  `[1, 2, 3, 2]` for the player's 4-frame — same "step-and-return"
  shape).
- If `wanders: true`: NPC takes 1-tile idle steps around spawn every
  1.5–3.7 seconds, within a 2-tile radius, in a random walkable
  direction, with per-step walk animation. Never leaves the room.
- When player is within `NPC_INTERACT_RANGE`: NPC freezes at its
  current tile and turns to face the player (so a shopkeeper never
  wanders mid-chat or shows their back to a customer). Wander cooldown
  resets when the player leaves range.
- NPC blocks its current tile (may differ from spawn if it has
  wandered) — pathfinder must respect that. NPC's own next step also
  can't be the player's tile.

---

## 9. Shops

Each shop is tied to an NPC and defines two lists:
```
sells: [{itemId, price}, ...]   — offers to the player
buys:  [{itemId, price}, ...]   — will take from the player
```

**Buy transaction:**
1. Player picks item + quantity via +/− picker (default 1, max whatever
   fits their capacity + backpack slots).
2. Compute total cost = `price × qty`.
3. Reject if player can't afford (gold in inventory), if no backpack
   space (`hasRoomFor` probe), or if item weight × qty would exceed free
   capacity.
4. Deduct gold, add items to backpack.

**Sell transaction:**
1. Player picks item + quantity from what they own that the shop buys.
2. Deduct items from backpack (recursively), add gold.
3. Never overflow: gold coins stack to 100 like anything else, may spill
   into additional slots.

Four shipping shops:
- **blacksmith** (Borin): sword 50/20, axe 70/28, wooden_shield 40/16,
  steel_shield 180/72, leather_helmet 25/10, steel_helmet 140/56,
  leather_armor 45/18, plate_armor 260/104, leather_legs 30/12,
  plate_legs 190/76, leather_boots 20/8, bag 12/no-buyback,
  backpack 35/no-buyback
- **fletcher** (Fenn): bow 90/36, arrow 3/1
- **apothecary** (Wren): wand_of_vortex 120/48, health_potion 15/no-buyback,
  mana_potion 15/no-buyback, amulet_of_life 90/36, ring_of_healing 110/44
- **grocer** (Della): cheese 8/3, meat 14/5, ham 22/8, backpack + 5
  cosmetic color variants at 35/no-buyback each

Buyback price is roughly 40% of sell price (except containers and
consumables, which don't buy back at all).

---

## 10. Bank & Depot

**Bank** (NPC-driven):
- Deposit: transfer any amount of gold_coin from the player's inventory
  into the bank balance (stored on the character profile, not in a
  container). Never overflows.
- Withdraw: transfer any amount from bank balance into the backpack,
  respecting backpack slot space and weight.
- Bank balance is persisted with the character (see §14) and is
  IMMUNE TO DEATH.

**Depot** (tile-driven, not NPC):
- A `X` tile in an interior — stepping on it opens the player's private
  depot Container (24 slots) in the sidebar.
- Depot contents are persisted per-character and survive death.
- Only one depot in the whole world (no per-city siloing — that only
  mattered for multiplayer trade).

---

## 11. UI (adapted for voxel)

The 2D build is a mobile touch PWA; the voxel remake gets a keyboard/
mouse or controller UI. Preserve the SEMANTICS, not the pixel layout.

**Always visible (HUD):**
- **HP bar** — current/max, colored by percentage
- **Mana bar** — current/max
- **XP bar** — progress within current level (`expIntoLevel /
  expForLevel`), with the level number
- **Combat stance indicator** — cycles Full Attack / Balanced / Full
  Defense with a hotkey
- **Action bar** — one row of large slots. Default layout: potion
  shortcuts (health_potion, mana_potion), spell shortcuts (from
  SPELL_BAR), equip shortcuts. Tapping/hotkey uses that slot's item or
  casts its spell.
- **Event log** — a small auto-scrolling strip for the last several
  messages, tagged with `kind`:
  - `damage` — hits taken and dealt, phrased "You lose N hitpoints due
    to an attack by X." / "X loses N hitpoints due to your attack."
    Miss: "Missed"
  - `loot` — item drops
  - `xp` — "You gained N experience."
  - `levelup` — "You advanced from level N to level N+1."
    (also skill-up messages)
  - `info` — everything else (dialogue prompts, out-of-range, etc.)

**On-demand panels (sidebar or fullscreen modal — voxel can use its own
choice of pause menu vs. persistent sidebar):**
- **Character** — level, vocation, HP/mana/cap, attack/defense/armor
  totals, combat stance toggle
- **Skills** — one row per skill: level + progress bar toward next level
- **Battle List** — every visible creature with its name, HP bar and a
  "selected" highlight; clicking selects target
- **Container** — one per open container. Grid of `capacity` slots,
  drag-and-drop items between containers (and to/from paperdoll and
  ground). Shows a "Loot All" button on loot bags.
- **Paperdoll (Equipment)** — the 10 slots laid out human-body-shape.
- **Shop** — split into "Buy" and "Sell" tabs, list of offers with
  price, +/- quantity picker, "Confirm" button.
- **Bank** — deposit / withdraw fields, current bank balance.
- **Dialogue** — as described in §8.
- **Vocation choice** — 4 vocation cards (name, description, growth
  rates), "Confirm" to lock in.
- **Pickup prompt** — long-press on a ground pile shows a menu of the
  items on that tile with per-item pickup buttons.
- **Climb prompt** — long-press on a ladder/hatch confirms "Climb up" /
  "Climb down".

**Modal state:** exactly one modal at a time (shop, bank, dialogue,
vocation, pickup, climb). Opening one auto-closes anything else that's
modal.

**Drag-and-drop:**
- Drag from any container slot or paperdoll slot to any other, or to
  the world (drops the stack on the ground tile the drag ended over).
- Merging: dropping stackable A onto stackable A merges up to
  STACK_MAX 100, leftover stays at source.
- Swapping: dropping non-stackable A onto non-empty slot B swaps them,
  IF both destinations legally accept the incoming item.
- Never drops in bag-in-bag recursion.

---

## 12. Rendering & animation notes

In the 2D build these matter; in a voxel remake they translate to
equivalent 3D concepts. Preserve the behavior.

- **Tile grid**: entities live at integer (x, y[, z]) tile coords. Tile
  size 32 px in 2D → 1×1×1 voxel block in 3D. Player and NPCs occupy
  ONE tile / one voxel column footprint.
- **Multi-floor world (z-axis)**: floors stack. Only the player's
  current floor renders at full opacity; the floor below is dimmed
  around holes/stairs as a "peek" preview. Voxel remake: standard
  vertical block layering, no special dimming, but interior/outdoor
  transitions still exist as room→world zone changes.
- **Player scale**: player art is authored at 32×32 and rendered at 1.5×
  scale on screen (48 tall in 2D). In a voxel remake this maps to a
  humanoid ~1.7 blocks tall.
- **NPC scale**: shop NPCs authored 32×32 rendered 1.5× — same as
  player. In voxel: same humanoid size as player, no "tiny NPC"
  mismatch.
- **Directional sprites**: 4 directions (down, left, right, up), N
  frames per direction. Walk animation cycles per-direction. Voxel
  remake: standard 3D character animator with idle + walk per direction
  (or a free-look walk that's direction-agnostic).
- **Depth sort**: 2D uses Y-tile depth (lower on screen = renders in
  front). Voxel remake: standard 3D z-buffer.
- **Attack lunge**: melee attack tweens the sprite ~4 px toward target
  for 180 ms as a swing substitute. Voxel remake: play an actual swing
  anim or keep the small lunge.
- **Floating combat text**: damage/heal/xp popups float up from the
  target/player for ~800 ms and fade. Color-coded: damage red, heal
  green, xp yellow, miss grey. Preserve this in the voxel remake as
  billboarded 3D text.
- **Silhouette shadow**: player has a black 40%-alpha copy of its own
  sprite offset (+1, +1) behind it, so the character stays readable
  against same-colored ground. In 3D this is just a proper drop shadow.

---

## 13. Movement (Tibia-style step timing)

Movement is **tile-based**, not free 3D translation. The player steps
one tile at a time. Preserve the step-timing formula:

```
totalSpeed(level) = BASE_SPEED(220) + SPEED_PER_LEVEL(2) × (level − 1)
                    + item speed bonus (0 today)

stepDurationMs(speed, groundFriction, diagonal) =
    raw     = 1000 × friction / max(1, speed)
    quant   = ceil(raw / STEP_QUANTUM_MS(50)) × STEP_QUANTUM_MS
    diag    = quant × (diagonal ? DIAGONAL_STEP_MULT(3) : 1)
    return max(MIN_STEP_MS(50), diag)
```

- Ground friction is a per-tile property. Grass = 150, cobble = 100,
  water = 250, deep sand ~200, etc. Higher = slower.
- The quantum ceiling to 50 ms creates "breakpoints" — adding a little
  speed does nothing until you cross the next threshold.
- Diagonals take 3× longer than cardinals (Tibia's DiagonalFactor = 3;
  intentional balance, not physical Pythagoras).
- MIN_STEP_MS = 50 ms is the hard floor.

**Input** (adapt to platform):
- 2D: on-screen D-pad emits `SET_MOVE_DIRECTION {dx, dy}` (±1, ±1, or
  zeros for released). Player steps continuously in that direction as
  long as it's held and the next tile is walkable.
- Voxel: WASD or gamepad stick; snap to 4 or 8 tile-directions rather
  than smooth translation. Still one voxel per step.
- Tap-to-walk: tap a distant tile → pathfind (A* or greedy, up to X
  tiles) → walk the route. Cancel on any input.

**Walkability**: a tile is walkable if it's a floor type AND no
NPC/monster/blocking prop stands on it. Some props (counters, heavy
furniture) block; consumables and coins don't.

**Aggro & respawn:**
- `MONSTER_AGGRO_RANGE = 4` tiles Chebyshev — monsters chase within
  this radius.
- `RESPAWN_SAFE_DISTANCE = 6` — player must be at least this far from
  a spawn point before a killed monster can respawn there.
- `MONSTER_RESPAWN_MS = 25_000` — 25 seconds after last kill.
- (Monster roster is redesigned separately.)

---

## 14. Persistence

All state is **on-device**, single save, no server. In the 2D build this
is IndexedDB/localStorage. Voxel remake: whatever the target platform
uses (local file, PlayerPrefs, etc.).

Persist per-character:
- Vocation, level (derived from exp on load), exp
- Current HP, mana (clamped to max on load)
- Backpack tree + every nested container's contents
- Full paperdoll
- Depot contents
- Bank balance
- Combat stance
- Skill levels + tries progress per skill
- World position (map, x/y/z tile)
- Time-of-day cycle position

Autosave on: level-up, entering/leaving interior, opening depot,
tabbing away/quitting, and periodic (every 30 s).

Never persist: transient combat state, tween positions, animation
progress, log text.

---

## 15. Death

On HP reaching 0:
1. Play death animation.
2. Drop the player's corpse — a loot Container on the tile they died
   on, containing everything they carried EXCEPT the bank balance and
   depot contents.
3. XP penalty: lose a portion of the current level's earned XP (rule
   of thumb: 10% of total XP, but the shipping build uses a simpler
   "10% of current level's XP earned" — either is fine, pick one and
   stick with it).
4. Respawn at the temple in the starter town, full HP/mana, empty
   backpack (they must go retrieve the corpse to recover gear).
5. Death is logged as "You died." to the event log.

---

## 16. Time of day / lighting

Global cycle. Real seconds per full cycle: 480 (8 minutes). Phases:

| Point in cycle | Phase | Color tint | Alpha |
|---|---|---|---|
| 0.00 | dawn | 0x1a2440 | 0.32 |
| 0.12 | morning | 0x000000 | 0.0 (bright) |
| 0.50 | afternoon | 0x000000 | 0.0 |
| 0.62 | dusk | 0x3a2440 | 0.30 |
| 0.75 | night | 0x0a1428 | 0.66 |
| 0.92 | late night | 0x0a1428 | 0.66 |
| 1.00 | back to dawn | 0x1a2440 | 0.32 |

The 2D build punches holes in a dark overlay for torches / campfires /
the forge / player's own carried light. Voxel remake: use real point
lights (torches emit warm light with a small flicker of ~10% radius
variance). Player carries a small light source at all times so they
never become the least readable thing on screen.

Underground (sewers, caves) uses a fixed damp/green-black ambient
(0x0d1811 @ 0.62 alpha in 2D — or in voxel: fixed low-ambient regardless
of surface clock) so torch light does all the visibility work.

---

## 17. Interior rooms (shops, temple, bank)

Interiors are separate small scenes, not just cordoned-off regions of
the outdoor world. Structure:
- Grid of tiles, each is one of: `W` (wall / blocking), `.` (floor —
  wood or stone), `C` (counter / blocking prop), `D` (doorway back
  outside — walkable, stepping on it exits), `U` (stairs up), `d`
  (stairs down), `X` (depot access), `S` (stone floor variant).
- One NPC placement (§8) — optional.
- Any number of decor placements (some blocking).
- Entering an interior pauses the outdoor scene; leaving resumes it.
- Player HP/mana carry across interior transitions.
- Interior→interior transitions (stairs) restart the interior scene
  with a new room.

Voxel remake: this can be enclosed buildings with doors that trigger
scene-loads, OR fully open buildings, OR anything in between — the
important part is that the shop room feels like a separate space with
its own NPC, counter, and depot/stairs semantics.

---

## 18. Ground items & corpses

Any tile can hold a **ground pile** — a small container of items
sitting on the floor. Two sources:
- Drop from inventory (drag to world)
- Monster kill drops a **corpse** loot bag (also a container)

Behaviour:
- Ground pile renders the top item's icon on the tile (like Tibia).
- Long-press (or hold-key on voxel) shows a Pickup prompt listing each
  item + count, with a per-item Pickup button.
- Tap-to-walk onto the pile automatically triggers pickup at arrival.
- "Loot All" on the pile's opened container transfers everything to
  the backpack, respecting capacity + slot space.
- Corpses (loot bags) auto-open into the loot grid UI when the player
  gets close.

---

## 19. Regeneration

Tick every second:
- **Food regen** (queued by eating): if the player has food-regen owed
  (`foodRegenAmountRemaining > 0` and `foodRegenMsRemaining > 0`),
  compute `amountThisTick = foodRegenAmountRemaining ×
  (tickMs / foodRegenMsRemaining)`, heal that, decrement both
  remaining. Multiple foods stack additively.
- **Base mana regen**: slow passive tick (a few points/second at low
  level, faster with promotion), separate from food.
- **No base HP regen** — HP only comes from food (over time) and
  potions (instant).

---

## 20. Promotion (level milestone)

At a designated level gate (e.g., 20 — pick one and document it), the
player can promote. Effects:
- Reduced death XP penalty (halve it)
- Faster HP + mana regen ticks
- 1–2 additional spells unlocked

Promotion is a one-time upgrade, no cost gate, no branching build
choice. UI: a Promote button appears on the Character panel once the
gate is reached, with a "You are now promoted!" log line.

---

## 21. Constants reference (for exact parity)

Copy verbatim:
```
TILE_SIZE                 = 32     (px, 2D) / 1 (voxel block)
BASE_SPEED                = 220
SPEED_PER_LEVEL           = 2
STEP_QUANTUM_MS           = 50
MIN_STEP_MS               = 50
DIAGONAL_STEP_MULT        = 3
BASE_STEP_MS              = 500    (fallback when no friction is available)
MELEE_RANGE               = 1      tiles
MONSTER_AGGRO_RANGE       = 4      tiles
RESPAWN_SAFE_DISTANCE     = 6      tiles
MONSTER_RESPAWN_MS        = 25_000 ms
TARGET_FPS                = 30
VOCATION_CHOICE_LEVEL     = 8
NPC_INTERACT_RANGE        = 3      tiles
BASE_ATTACK_INTERVAL_MS   = 2000
ATTACK_POSE_MS            = 180
STACK_MAX                 = 100
BASE_HP                   = 150
BASE_MANA                 = 30
BASE_CAPACITY             = 400
FIST_ATTACK               = 7
DAY_LENGTH_SECONDS        = 480
```

---

## 22. Event bus

The 2D build has a scene-to-scene message bus that decouples the world
scene from the UI scene. The full event list is:

```
PLAYER_STATS, TARGET, LOG, INVENTORY, USE_ITEM,
OPEN_SHOP, BUY_ITEM, SELL_ITEM,
OPEN_VOCATION_CHOICE, CHOOSE_VOCATION,
MODAL_STATE, OPEN_DIALOGUE, REQUEST_VOCATION_TALK,
SKILLS, INVENTORY_STATE, MOVE_ITEM,
OPEN_CONTAINER, CLOSE_CONTAINER, CAST_SPELL,
LOOT_ALL, UI_LAYOUT, BATTLE_LIST, SELECT_TARGET,
INTERIOR_STATE, OPEN_DEPOT,
OPEN_CLIMB_PROMPT, CLIMB_CONFIRM,
SET_COMBAT_STANCE, DROP_ITEM,
OPEN_PICKUP_PROMPT, CLOSE_PICKUP_PROMPT, PICKUP_ITEM,
SET_MOVE_DIRECTION
```

Voxel remake can replace this with whatever pattern fits the engine
(Unity events, Bevy resources, Godot signals) — the important part is
that the world simulation and UI never touch each other's internals.
The world is the SOLE OWNER of every state change; UI reads via bus
snapshots and asks for changes via bus requests.

---

## 23. Explicit non-goals for the voxel remake

Do NOT rebuild these (they were scoped out of the 2D build for good
reasons and the same applies):
- Multiplayer, accounts, servers, chat
- Player market or trading between players
- Per-city depots (one global depot only)
- VIP list, party/guild windows, multi-battle-list UI
- Free-text NPC dialogue parsing (menu-driven only)
- Battle list of every visible monster — a voxel remake with a
  targeting reticle can skip the list entirely
- Weight math based on oz-tiers (slot-count capacity is the model;
  weight is a single number checked against maxCapacity)
- Bestiary/charm points meta-game

---

## Handoff summary

Rebuild every system in §1–§22, exact behaviour, exact numbers, exact
formulas. Adapt only the rendering, input, and physical presentation to
suit a voxel/3D world. The MAP layout and MONSTER catalogue are being
designed separately and are not in this document — expect a follow-up
spec for those. Everything else should behave identically to the
shipping 2D build.
