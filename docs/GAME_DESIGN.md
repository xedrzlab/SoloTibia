# SoloTibia — Game Design Reference

A single-player, mobile-first RPG inspired by classic Tibia. Built for private
personal use as a PWA (Phaser + browser), with all state local to the device
— no server, no other players.

This doc distills public game-design research on how Tibia's systems work
(mechanics/formulas/structure only — no copied code, art, or text) into
concrete, simplified rules we'll actually implement. Full research notes are
in `docs/research/` for reference; this file is the source of truth for
what we build.

---

## 1. Scope decisions for the solo version

| Tibia system | Kept | Simplified | Cut |
|---|---|---|---|
| Vocations | 4 classes, distinct stat growth + skill identity | Choose at character creation (no level-8 gate, no re-roll cost since it's a private single save) | Promotion's gold cost / premium gating — keep the milestone, drop the paywall |
| Skills | Use-based training, diminishing curve, off-vocation penalty | — | Offline training servers |
| XP curve | Cubic/power curve (fast early, slow late) | — | — |
| Monsters | Tiered difficulty, themed hunting grounds, loot tiers | 4 difficulty tiers instead of 6, ~15 starter monsters instead of hundreds | Bestiary meta-game (charm points), occurrence rarity tracking |
| Maps | Tile+floor grid, starter island, hub city, distance/depth = difficulty | Hand-built small zones instead of a continent | Nothing structural — just less content |
| NPCs | Specialist shopkeepers, quest-state dialogue | Tap-driven menus instead of keyword text parsing | Free-text chat |
| Items | 5 weapon types, full paperdoll, food/potions/runes | Slot-based capacity instead of oz weight math, 2 currency tiers instead of 3 | Player market, per-city depots |
| UI | HP/mana/XP strip, inventory sheet, action bar, minimap, event log | Tap-to-target replaces battle list | VIP list, party/guild windows, chat, multi-window UI |

---

## 2. Vocations & Progression

Four vocations chosen at character creation:

| Vocation | Identity | HP/lvl | Mana/lvl | Capacity/lvl | Weapon skill |
|---|---|---|---|---|---|
| Knight | Melee tank | +15 | +5 | +25 | Sword/Axe/Club/Fist |
| Paladin | Ranged hybrid | +10 | +15 | +20 | Distance |
| Sorcerer | Offensive caster | +5 | +30 | +10 | Wand + attack spells |
| Druid | Support/healing caster | +5 | +30 | +10 | Rod + healing/control spells |

Base at level 1: 150 HP / 0 Mana / 400 capacity, before vocation growth applies.

**Skills** (Sword/Axe/Club/Fist, Distance, Magic Level, Shielding) are
**use-based**: they rise from landing hits / spending mana / blocking, not
from leveling up. Training speed toward a skill uses a diminishing-returns
curve, and each vocation has a per-skill cost multiplier (e.g. magic level
trains ~3x slower for a Knight than a Sorcerer) — this is what keeps
vocations feeling distinct without hard-locking any skill.

Melee/distance damage scales only with the matching weapon skill; spell
damage/healing scales only with Magic Level. The two pools never cross —
this is the core "tank vs. glass cannon" mechanic.

**XP curve**: cubic growth, `Exp(L) = 50/3 × (L³ − 6L² + 17L − 12)` —
fast early levels (100 xp for level 2, 400 for level 5), grinding-heavy late
levels. Good shape to reuse as-is for the satisfying early game / long late
game feel.

**Promotion**: a one-time milestone at a level gate (e.g. level 20) —
reduced death penalty + faster HP/mana regen + a couple of extra spells.
No stat retroactive changes, no branching build choice. Cheap to implement,
good pacing beat.

Equipment reinforces identity further: heavy armor and top melee weapons
flagged Knight-only, wands/rods vocation-exclusive for casters, shields
usable by anyone with Shielding trained.

---

## 3. Monsters

4 difficulty tiers instead of Tibia's 6, each mapping to a rough level band:

| Tier | Level band | Threat |
|---|---|---|
| Trivial | 1–10 | Barely fights back |
| Easy | 8–25 | Manageable solo, teaches a mechanic (poison, packs, corridors) |
| Medium | 20–50 | Needs decent gear; can punish careless play |
| Hard | 40+ | Zone-capping mini-boss, dangerous solo |

Every monster is defined by: HP, flat XP reward, melee/ranged damage,
elemental resist/weak/immune tags, an ability list (self-heal, summon,
poison, paralyze, never-retreat, can't-be-pushed), and a 3-tier loot table
(near-guaranteed junk, common gear/gold, rare chase item ≤5%).

### Starter bestiary (~15 monsters, 3 hunting grounds)

| Zone | Monster | Tier | Notable behavior |
|---|---|---|---|
| Cellar (under town) | Rat | Trivial | Near-zero threat, flavor only |
| Cellar | Cave Rat | Trivial | Weak melee, flees at low HP |
| Rotworm den | Rotworm | Easy | Swarms in packs, can't be pushed back — corridor-fighting lesson |
| Rotworm den | Rotworm Queen | Hard | Zone boss, summons more rotworms |
| Spider cave | Spider | Trivial | Basic melee |
| Spider cave | Poison Spider | Easy | Poison DoT, flees at low HP |
| Open field | Wolf | Easy | Pack hunter, surrounds isolated player |
| Open field | Bear | Easy–Medium | Territorial, hits moderately hard |
| Bridge/den | Troll | Easy | First "real" single-target bruiser |
| Undead hill | Skeleton | Easy–Medium | Weak to Holy, resistant to Earth/Death |
| Undead hill | Ghoul | Medium | Never retreats |
| Orc camp | Orc | Medium | Basic melee camp fodder |
| Orc camp | Orc Spearman | Medium | Ranged, flees at low HP |
| Orc camp | Orc Warlord | Hard | Camp boss, tanky, strong loot |
| Cyclops cave | Cyclops | Medium–Hard | Never retreats, hits hard, good gold loot |

Each hunting ground shares one elemental theme, has a soft gradient (weaker
near entrance, named/stronger variant deeper in), and pairs 1–2 trash mobs
with one "mechanic" specialist and an optional zone-capping boss.

---

## 4. World / Maps

- **Tile grid**: entities live at integer `(x, y, z)` tile coordinates.
  32px tiles is a reasonable default for mobile screens.
- **Floors (z-axis)**: stacked layers, render only the player's current
  floor at full opacity; punch through and dim-render the floor below near
  holes/stairs as a "peek" preview. Positive z = elevation, negative z =
  underground (cleaner than Tibia's 0–15/floor-7-is-ground numbering).
- **Starter zone**: one small island/valley. Central temple = spawn +
  death-respawn point, inside a safe zone, ringed by a weapon shop, armor
  shop, and food/potion shop within a few tiles. 3 hunting grounds at
  increasing distance/depth (cellar → open field → cave), each teaching a
  distinct mechanic. Exit gated by a level threshold + single NPC ("graduate"
  to the main world), not an open map edge.
- **Main hub city**: cluster temple (heal/respawn), depot (safe storage),
  shops (sell loot, buy gear/consumables), and the fast-travel point within
  a short walk of each other — minimize friction in the fight → return →
  resupply → fight loop.
- **Depot**: a single global safe stash (no per-city siloing — that friction
  only mattered for multiplayer trade), slot-limited inventory pressure
  valve, immune to loss on death.
- **Hunting ground design**: distance + depth = difficulty dial. Static
  spawn points, respawn only once the player leaves proximity. Optional
  branching cave paths (two monster themes, same difficulty) reconverging
  deeper in for run variety.
- **Travel**: walking by default; unlock a small number of fixed, costed
  fast-travel links between discovered hubs once a hub is unlocked. No
  free "click anywhere" teleport except a single narrative moment
  (leaving the starter zone).

---

## 5. NPCs & Items

**NPCs**: tap-driven menus (not free-text keywords) with the same
functional shape — greet → role-specific menu (buy/sell/train/quest) →
confirm. Keep the "specialist shopkeeper per category" pattern (one NPC for
armor, one for weapons, one for food/potions/runes) and quest-state-aware
dialogue. Trade UI: item list (sortable by name/price/weight) → tap item →
qty +/- → confirm.

**Items**:
- Weapon skill types: Sword, Axe, Club, Fist (melee), Distance (ranged),
  Wand/Rod (magic, vocation-exclusive).
- Paperdoll slots: Head, Neck, Backpack, Armor, Weapon, Shield, Legs, Feet,
  Ring, Ammo.
- Consumables: Food (regen-over-time), Potions (instant heal, level-gated
  tiers), Runes (single-use stored spells — lets non-casters use magic
  effects).
- Currency: 2 tiers (Gold, Platinum; 100 gold = 1 platinum) — simplified
  from Tibia's 3.
- Capacity: slot-count based rather than oz weight math, still vocation-
  scaled (Knights carry more).
- Quest items: non-sellable, quest-flagged.

---

## 6. UI (mobile/touch)

- **Top strip**: HP bar, Mana bar, XP bar (combined, always visible).
- **Targeting**: tap a creature directly to target it — no battle list
  needed for a solo game with few simultaneous enemies.
- **Inventory**: single bottom-sheet/modal combining paperdoll + backpack
  grid, opened via a button.
- **Action bar**: one row of large tappable slots along the bottom
  (potions/runes/spells/equip-shortcuts).
- **Minimap**: small corner toggle, expandable to full-screen.
- **Event log**: small auto-scrolling strip for damage numbers, loot,
  quest updates — replaces chat entirely.
- **Skills screen**: secondary modal, checked infrequently.
- **NPC trade window**: kept close to the reference pattern (list + tabs +
  qty picker) since it maps naturally to touch.
- Dropped entirely: VIP list, party/guild windows, multiple battle lists,
  draggable floating windows.

---

## 7. Tech approach (recap)

PWA using Phaser (canvas/WebGL 2D engine with built-in tilemap, sprite, and
touch-input support), installable to a phone home screen. All game state
(character, inventory, world flags, position) persisted client-side via
IndexedDB/localStorage — no backend, no accounts, single local save.

---

## Sources

Research compiled from public Tibia wikis and community sites (TibiaWiki on
Fandom, official tibia.com game guides, StrategyWiki, tibiamaps.io, OTLand
community threads, and similar) for game-design study only. No Tibia code,
art assets, or copyrighted text were used — only mechanics, formulas, and
structural patterns, distilled into our own simplified rules above. Full
per-topic notes with source lists are kept in `docs/research/`.
