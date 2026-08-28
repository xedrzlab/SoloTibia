# Bear — complete monster model

A finished monster: real per-direction walk-cycle art plus real TibiaWiki stats and
loot, wired into `src/data/monsters.ts` as `bear` but **not currently spawned anywhere**
(see `src/data/tilemap.ts` — the surface is deliberately peaceful, and this bear
actually hits). Kept here as a reusable reference/model for the next hunting-ground spot
that wants it, and as a template for building out the next real monster the same way.

## Source art

`frames/` holds the original 16 sprite frames the user supplied (4 directions x a
4-frame walk cycle, 32x32 each, transparent PNGs — matches the game's tile size
natively). `public/assets/creatures/bear_sheet.png` is these 16 frames assembled into
one horizontal strip in `DIRECTION_ORDER` (down/left/right/up) x pose order, which is
what the game actually loads (`src/data/assets.ts`).

An earlier 24-frame (6 poses/direction) version of this same bear was supplied and wired
in first, then swapped for this 16-frame set — see git history on `src/data/monsters.ts`
/ `public/assets/creatures/bear_sheet.png` if the 24-frame frames are ever wanted back.

## Stats — TibiaWiki "Bear" page

`tibiawiki_combat.jpg` and `tibiawiki_loot.jpg` are the screenshots this was read from.

| Stat | Value | Mapped to `MonsterDef` field |
|---|---|---|
| Health | 80 | `hp: 80` |
| Experience | 23 | `xp: 23` |
| Speed | 78 | `speed: 78` |
| Armor | 6 | `armor: 6` |
| Elements | Physical only | (game has no elemental typing yet) |
| Est. max damage | 25 | `maxDamage: 25` (`minDamage: 0`) |
| Attack style | melee range only | (no ranged/spell attack — `Monster.ts`'s plain melee path is correct as-is) |
| Flee threshold | retreats at 15 hp (18.75%) | `fleeAtHpPct: 0.1875` |

Two fields have no TibiaWiki equivalent in this game's simpler combat model, set to
reasonable values instead of guessed wiki numbers:
- `hitChance: 85` — this game rolls a separate hit/miss chance before damage (see
  `MonsterDef.hitChance`'s doc comment); real Tibia doesn't model attacks this way.
  Picked to sit between the starter `rat` (75) and the `troll` (90) bruiser.
- `attackIntervalMs: 2200` — matches the other melee bruiser (`troll`) family; no wiki
  attack-speed figure to match against.

## Loot

TibiaWiki's loot table (estimated from ~61k kill samples):

| Item | Chance | Qty |
|---|---|---|
| *(nothing)* | 47% | — |
| Meat | 40% | 1 |
| Ham | 20% | 1 |
| Bear Paw | 2.0% | 1 |
| Honeycomb | 0.5% | 1 |

None of Meat/Ham/Bear Paw/Honeycomb existed as items before this — they were added to
`src/data/items.ts` (icons generated in `scripts/generate-assets.mjs`:
`meatIcon`/`hamIcon`/`bearPawIcon`/`honeycombIcon`, `npm run gen:assets` to regenerate).
Meat/Ham/Honeycomb are simple consumable food (`regenSeconds`/`regenPercentOfMaxHp`,
same pattern as `cheese`) with weight/regen values estimated to fit this game's existing
scale — TibiaWiki's own combat page doesn't carry food-regen numbers, since real Tibia
food only staves off hunger rather than healing. Bear Paw is a non-consumable trophy
drop, which didn't fit any existing `ItemKind`, so a new `"trophy"` kind was added.

## To actually spawn it

Add a `{ monsterId: "bear", x: ..., y: ... }` entry to `MONSTER_SPAWNS` in
`src/data/tilemap.ts`, somewhere off the peaceful surface (`docs/research/monsters.md`
categorizes Bear as "Easy-Medium, area flavor... normally passive/territorial,
aggressive if provoked; slow, so escapable" — a good fit for an early cave/forest
hunting ground once one exists, not the town).
