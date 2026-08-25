# Tibia World/Map Design Research
*Design-pattern reference for an original, solo-player "Tibia-inspired" PWA. No copied maps, coordinates, or art — patterns only.*

---

## 1. Tile / Grid System

- **Tile size convention**: base sprite/tile is **32x32 px**, representing **1 "sqm" (square meter)** of world space. Larger creatures/objects scale up in multiples (64x64 = 2x2 sqm, 96x96, etc.) rather than using a different grid.
- **Client viewport vs. server area**: the classic client requests a generous buffer of tiles from the server (historically an 18x14 tile area) but only *renders* a smaller centered window (historically 15x11 tiles) — i.e., the server keeps more state loaded than is drawn, giving smooth scrolling/prediction without re-querying every step.
  - **Takeaway for Phaser**: decouple "loaded/simulated chunk" from "camera-visible viewport." Keep a small buffer of off-screen tiles active so monsters/spawns just outside view still behave correctly, and so scrolling feels seamless.
- **Everything is orthogonal grid-based**: no free movement — all entities occupy discrete tile coordinates (x, y, z). Pathing, collision, line-of-sight, and spawn logic all resolve at the tile level, which is what makes the world feel readable and "gridable" for design (easy to reason about distances in tiles, e.g. "monsters respawn only when player is 7+ tiles away").

## 2. The Z-Axis / Floor System

- Floors are numbered on a single vertical axis, historically **0–15**, with **floor 7 conventionally treated as "ground level."**
  - Floors **0–6** (numerically *lower* than 7) render **above ground** — rooftops, towers, upper floors of buildings, mountains/cliffs you climb.
  - Floors **8–15** render **below ground** — cellars, caves, mines, dungeons; deeper number = deeper underground.
  - This is a purely internal numbering quirk (ground isn't 0) — for an original game you're free to use an intuitive signed convention instead: e.g. `0 = ground`, positive = elevation, negative = depth. The *design principle* worth keeping is a single vertical integer axis per tile, not the specific numbering.
- **Rendering rule**: floor visibility is a **client-side decision** — the server sends full stacked floor data, and the client chooses what to draw based on the player's current floor and each object's flags (e.g. "blocks view," "is roof," "top-order"). Practical rules used:
  - You normally see **only your current floor** plus context.
  - Standing at the edge of a drop-off (e.g., top of a cliff/hole) reveals the floor(s) below through that opening, so players can preview danger before descending — an *"illusion" effect* where distant lower-floor content is visible until you get close enough that your own floor's roof/ceiling occludes it.
  - Taller character models (or being in an open/outdoor area) can reveal upper floors (rooftops) that shorter/indoor states hide.
- **Design takeaway for Phaser**: implement floors as **stacked tile layers keyed by an integer z**, with visibility resolved by camera/player z:
  - Render only `z == playerZ` fully opaque.
  - For tiles adjacent to a "hole"/staircase/opening, punch through and render `z == playerZ - 1` (or the next occupied floor down) at reduced opacity/darkened tint as a preview — cheap and very on-brand for the "peer down the hole" feel.
  - Use floor transitions (stairs, ladders, holes, ramps) as deliberate chokepoints/gates between danger tiers rather than seamless multi-level open sight-lines everywhere.

## 3. Starter Island Concept (Rookgaard → later Tutorial Island / Newhaven)

Classic layout pattern for a contained beginner zone:

- **Central temple** = spawn/respawn anchor. New characters start here (or very near it); dying anywhere sends you back here. It sits inside a **protection zone (PZ)** — no PvP, no monsters, a safe social/logistics hub.
- **Immediate radius around the temple**: basic shops within a short walk — a weapon/armor shop, a food shop, a magic/rune shop — so a brand-new character can gear up without any risk before the first fight.
- **No/limited depot on the starter island historically** (Rookgaard had no depot) — reinforces that the starter zone is a low-stakes, temporary staging area, not a long-term base. (Some later iterations added a small one.)
- **Concentric/tiered hunting grounds radiating outward from town**, roughly ordered by both *distance* and *enclosure*:
  1. Trivial, very close, often literally under/behind a building near town (e.g., a rat cellar) — first monster kill, minutes after spawning.
  2. Slightly farther, open-air or shallow cave (wolves, spiders, low apprentices) — first "real" hunting ground, teaches combat + retreat.
  3. Farther out / requires descending into a cave system (trolls, orcs) — a soft mid-tier gate that filters players who've gained a few levels and some equipment.
  - Progression is communicated spatially: **farther from temple + deeper underground = harder**, without needing explicit level-gates on the ground itself.
- **Gated exit**: leaving the starter zone is tied to a **level threshold** (historically level 8–9) and funneled through a single NPC/ritual (an "Oracle") rather than an open map edge — this is a deliberate narrative + mechanical gate: you can't wander off unprepared, and the transition to the "real world" is a discrete, memorable event (choose vocation, choose home city) rather than a gradual walk.
- **Design takeaway**: for a solo game's tutorial zone, keep it small, walled off (island / geography-limited), anchor everything to one safe hub, ring it with 2–3 hand-tuned difficulty tiers, and use a clear narrative/mechanical gate (quest, NPC, level check) to "graduate" the player into the main world — this also gives you a natural checkpoint to introduce fast-travel/waypoints for the first time.

## 4. Main City Structure (Thais as the classic example)

Common anatomy of a full-size Tibia city, and *why* each piece is placed where it is:

| Building | Typical placement | Purpose |
|---|---|---|
| **Temple** | Central or near a main gate; always inside a PZ | Respawn anchor after death; free low-cost healing/status-cure NPC; sets "home city" |
| **Depot** | Central, often the reference point other buildings are described relative to | Long-term item storage hub (see §4 below) |
| **Bank / banker NPC** | Near the depot | Converts heavy gold piles into an account balance — removes carry-weight friction from trading |
| **Marketplace** | Central open square | Player-to-player and NPC trade hub; social gathering point |
| **Guildhalls** | Near city center, often a short walk from depot | Endgame/social sink — a purchasable base of operations, reinforces "this city is home" |
| **Armor / weapon / food shops** | Scattered around center, within easy walking distance of temple+depot | Let a player fully re-gear in one short loop after respawning |
| **City walls + gates** | Perimeter, with named gates (e.g. north/south/southwest) | Frame hunting-ground access points; make "leaving town" a legible, discrete action; also historically PvP/faction boundary markers |

- **Underlying design logic**: everything a player needs *between* fights (heal, restock, sell loot, bank gold, socialize) is clustered within a short walk of the temple, so the loop of *fight → die/return → resupply → fight again* has minimal friction. The city itself is the "safe hub" node in a hub-and-spoke world; hunting grounds are the spokes.
- **Design takeaway**: for a solo PWA, replicate the *cluster*, not the specific building list — put your equivalent of "heal/respawn," "storage," "sell loot," "buy consumables/gear," and "fast-travel departure point" all within a few tiles of each other at each hub, even if it's a single small hub city rather than Thais-scale.

## 5. The Depot / Storage System

- **What it is**: a **safe, off-inventory storage container** tied to a location (a city), separate from carried inventory/weight limits.
- **Why it exists (design purpose)**:
  1. **Weight/inventory pressure valve** — Tibia inventory is weight-limited, so players constantly return to town to store loot they don't need on hand; depot is the release valve that makes hunting trips loop naturally back to town.
  2. **Safety** — items in the depot cannot be lost on death (unlike carried inventory, which historically could drop), so it's the "bank vault" for anything valuable you're not actively using or trading.
  3. **Trade/market backing** — the depot (and its evolution, a "locker" with a Market tab) is where items sold on the player market are deposited/withdrawn, tying storage directly into the economy.
  4. **History → global depot**: originally each city had its *own separate* depot (items stored in Thais weren't accessible in Carlin); a later update unified all depots into one global storage pool accessible from any city. This is a useful case study in "friction as a *deliberate* early design choice, later removed as quality-of-life won out."
- **Design takeaway for a solo game**: even without other players, keep the *pressure valve* function — a weight/slot-limited inventory plus a safe unlimited(ish) stash forces meaningful trips back to a hub and meaningful inventory decisions during a run, which is good tension for a Souls-like or dungeon-crawl-style loop. You don't need per-city siloed storage (that friction existed mainly to matter in a multiplayer trade economy) — a single global stash fits a solo game fine and mirrors where Tibia itself ended up.

## 6. Hunting Grounds / Dungeon Design Near a City

- **Danger scales with distance and depth, not with arbitrary walls**: the map itself teaches difficulty — a cellar under a house near the temple is trivial; a cave reached by walking outside the gates is moderate; a multi-level dungeon reached by descending further underground is hard. This is a spatial difficulty curve instead of (or in addition to) numeric level-gating.
- **Branching, converging cave layouts**: a documented pattern (e.g., a troll cave near a city) is a single entrance splitting into two paths of *different* monster types at the same difficulty tier (e.g., trolls one way, orcs the other), which later reconverge on a deeper level. This gives players a *choice* of flavor at equal risk, then funnels them together as stakes rise — good for run variety without needing more raw content.
- **Depth-tiered caves**: a simple, reusable dungeon template seen repeatedly: **level 1 of a cave = small, single easy monster type; level 2 = larger, adds a second tougher monster type.** Depth is a cheap, legible difficulty dial.
- **Spawns**:
  - **Static spawn points**: fixed tile locations where a specific monster (or, later, a *set* of possible monsters — a "varying spawn") reappears after a respawn timer once killed and the area is unoccupied.
  - **Respawn gating by player proximity**: monsters only respawn once players are far enough away (roughly "7+ tiles or off-screen" historically) — prevents spawn-camping trivializing an area and keeps kills meaningful.
  - **Dynamic/population-scaled respawn rate**: in the original multiplayer design, respawn speed scaled with how many players were online (more players online → faster respawns) to keep hunting grounds from feeling empty or overcrowded. For a solo game this scaling axis is irrelevant, but the *underlying goal* — respawn rate tuned so grounds never feel dead but also never feel infinitely farmable — is still worth targeting, just via a flat/tuned timer instead.
- **Design takeaway**: build 2–4 small hunting areas ringing your hub at increasing distance/depth, each with a dominant "theme" monster (readable identity), a simple depth-based sub-tier inside (basement level 1 easy / level 2 harder), and a respawn timer + proximity gate so areas regenerate without feeling exploitable.

## 7. Waypoints / Travel

Historical progression of Tibia's own travel system — useful as a menu of options for a solo fast-travel design:

1. **Walking only** (earliest game) — the baseline; distance itself is the cost, and it reinforces the mental map of "how far is this place."
2. **Boats/ships between named coastal cities** — a *scheduled, discrete* fast-travel method: talk to an NPC captain, pay a fare (or ask for a specific destination), get a loading transition, arrive elsewhere. Not instant/free — has a cost (gold, sometimes a level/quest gate) and a *place* (a dock) rather than "travel from anywhere."
3. **Magic carpets** (region-specific alternative to boats, e.g., for landlocked areas without sea access) — same purpose (discrete paid fast-travel between hubs), different flavor/reason to exist, showing you can reskin the same mechanic per-region for flavor.
4. **Special one-off transports for gating, not general travel** — e.g., an NPC ("the Oracle") that performs a single narrative teleport from the tutorial island to the mainland once a level requirement is met. This is a *quest/milestone gate*, not a general travel network.
5. Later expansions added premium-only teleport scrolls/portals for even faster travel, layered on top of — not replacing — the boat network.

- **Common thread across all methods**: fast-travel is always **NPC/location-mediated and has a cost or gate** (fare, level, quest) — never a free "open map, click anywhere" teleport. It also always **starts and ends at a named hub** (a dock, a temple, a portal), never mid-wilderness — this keeps hubs meaningful and preserves the "world has geography" feeling even when skipping the walk.
- **Design takeaway for a solo PWA**: 
  - Early game: force walking to teach the map.
  - Mid game: unlock a small number of fixed fast-travel nodes (think "boat lines," but could be simple map-view point-to-point links) between hubs you've already discovered/unlocked, each with a small cost (gold or an item) to preserve economic tension.
  - Reserve any *free, no-cost* teleport for a rare narrative beat (equivalent to the Oracle) rather than baseline UX — makes it feel earned.
  - Keep fast-travel endpoints tied to real locations (temples/docks) already built as hubs, rather than inventing a separate "map screen only" waypoint system, so the world still feels spatially coherent.

---

## Summary Table: Core Transferable Patterns

| Tibia concept | Transferable pattern | Not worth copying literally |
|---|---|---|
| 32px tile / 1 sqm grid | Uniform tile-grid world, entities always at integer tile coords | Exact pixel size (use whatever fits your art) |
| Z-axis floors, client-side visibility | Stacked z-layers, only render current floor + "peek" through holes | Exact 0–15 / floor-7-is-ground numbering |
| Rookgaard | Small walled starter zone, one safe hub, tiered nearby hunting grounds, level-gated single exit | Specific monsters/rooms |
| Thais | Cluster heal/store/sell/buy/fast-travel near one central safe hub | Exact building list/positions |
| Depot | Safe stash decoupled from carry-limited inventory, drives return-to-hub loop | Per-city siloed storage (multiplayer-motivated) |
| Hunting grounds | Distance/depth = difficulty dial; static spawns + proximity-gated respawn; branching-then-converging cave layouts | Population-based respawn scaling (no population in solo game) |
| Travel | Discrete, costed, hub-to-hub fast travel unlocked by progression; walking as default | Multiplayer-specific mechanics (premium accounts, city citizenship) |

---

### Sources consulted (public wikis/community sites, general design reference only — no assets or map data taken)
- tibia.fandom.com (TibiaWiki): Floor, Flooring, Roof, Depot, Depot Chest, Rookgaard, Rookgaard Leveling Guide, Temple, Protection Zone, Towns, Thais, Thais Buildings, Thais Troll Cave, Darashia Rotworm Caves, Rotworm, Spawn, Respawn, Varying Monster Spawn, Boat, Travelling, Island of Destiny, Bank, The Market, Guildhall
- tibia.com official game guides (world/interface manual sections)
- tibiamaps.io (minimap file format, floor rendering explainer)
- OTLand.net community threads (floor rendering differences, respawn mechanics, Rookgaard guide)
- tibiavault.com hunting spots guide
