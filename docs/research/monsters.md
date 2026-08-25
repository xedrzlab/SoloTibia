# Tibia Monster / Bestiary Design — Research Notes

Sources: TibiaWiki (Fandom), official Tibia.com library, TibiaXplorer, TibiaMobile, OTLand
community threads, and general published knowledge of Tibia's game design. Numbers below
are approximate/representative (Tibia has changed many creature stats over 25+ years of
updates) — use them as *design proportions*, not exact balancing targets.

---

## 1. Difficulty / Danger Categorization

Tibia's modern **Bestiary** system auto-assigns every creature one of six difficulty
tiers, computed from the creature's HP and experience yield (plus other combat stats).
The tiers primarily gate a meta-progression reward (Charm Points, unlocked via kill
counts) rather than being a designer-authored "level range" label — but in practice they
correlate strongly with the level of character that can safely fight the creature.

| Difficulty | Kills to unlock (bestiary entry tiers) | Charm Points on full unlock | Rough character-level correlation | Threat character |
|---|---|---|---|---|
| **Harmless** | 5 / 10 / 25 | 1 | Any level (level 1+) | Doesn't attack, or deals ~0 effective damage. No loot on many. |
| **Trivial** | 10 / 100 / 250 | 5 | ~1–15 | Rarely attacks; if it does, negligible damage. |
| **Easy** | 25 / 250 / 500 | 15 | ~8–30 | Fightable solo by a fresh/newbie character; manageable damage output. |
| **Medium** | 50 / 500 / 1000 | 25 | ~30–80 | Requires decent gear/level; can punish careless play. |
| **Hard** | 100 / 1000 / 2500 | 50 | ~80–200 | Dangerous solo; often hunted in duos or with good equipment. |
| **Challenging** | 200 / 2000 / 5000 | 100 | ~150+ (often bosses/elites) | High HP, strong hits, special mechanics (multi-target spells, summons, high resistances). Frequently late-game or boss-adjacent. |

Separately, creatures also carry an **Occurrence** rarity tag — **Common, Uncommon,
Rare, Very Rare** — which is independent of difficulty and just reflects how often the
creature spawns/appears across the world (roughly 650 common / 65 uncommon / 55 rare /
38 very rare in the live game). Very Rare creatures unlock bestiary rewards faster.

**Takeaway for a simplified design:** difficulty tier ≈ a function of (HP, damage output,
special abilities) and roughly maps to a safe character-level band. A minimal solo game
doesn't need six tiers — 3–4 (e.g. Trivial / Easy / Medium / Hard) covering a starter
zone is enough, each tier unlocking at a rough level gate.

---

## 2. Representative Early-Game Monster List

Classic low-level Tibia hunting grounds (Rookgaard-style starter island, and low-level
mainland spots like Venore's rat/rotworm cellars) draw from this roster. "Role" reflects
how players actually used them.

| Name | Role | Approx HP tier | Notable behavior |
|---|---|---|---|
| **Rat** | Harmless filler / atmosphere | ~5–20 (very low) | Barely fights back, near-zero threat, minimal/no loot. Pure "harmless" flavor mob. |
| **Cave Rat** | Starter fodder | ~30 | Melee only; flees at low HP (~10%); dangerous mainly in packs vs. poorly-equipped players. |
| **Bug** | Trivial filler | very low | Weak melee, easily ignored; common in fields/dungeon entries. |
| **Wasp** | Trivial-Easy, poison intro | low HP, ranged poison sting | Poison damage-over-time (annoying, not deadly); teaches players to respect DoT early. |
| **Spider** | Starter fodder | low | Melee, occasionally found in small caves; stepping stone to Poison Spider. |
| **Poison Spider** | Easy, poison specialist | ~26–52 | Melee + poison sting (DoT ~1–2 hp/turn); flees at low HP; classic Rookgaard cave monster. |
| **Rotworm** | Easy, signature "grinding" mob | low-medium, but **spawns in packs** | Slow, no ranged attack, but swarms in large numbers from egg-like nests; can't be knocked back — deadly if you get surrounded/cornered. One of the most-farmed monsters in the game for steady gold-per-hour. |
| **Snake** | Easy, poison variant | low | Melee + light poison; minor early hazard. |
| **Wolf** | Easy, pack hunter | ~20–30 | Fast, hunts in packs (2–4+), can surround an isolated player; classic "don't pull too many" lesson. |
| **Troll** | Easy, beginner "real" fight | ~50 HP | Simple melee bruiser, decent early loot (spears, axes, gold); the archetypal "first real monster" beyond vermin. |
| **Skeleton** | Easy-Medium, undead intro | medium | Melee; resistant to Earth/Death, weak to Holy — introduces elemental typing; decent loot (helmets sell well). |
| **Bear** | Easy-Medium, area flavor | medium, hits moderately hard | Normally passive/territorial, aggressive if provoked; slow, so escapable. |
| **Ghoul** | Medium, undead | ~85 HP / 85 XP | Melee, never retreats; found in themed "Ghoul Hill" hunting ground; solid newbie-mage/paladin farming spot. |
| **Orc** | Medium, camp fodder | medium | Basic melee humanoid; found in Orc camps in groups. |
| **Orc Spearman** | Medium, ranged camp unit | medium | Distance (thrown spear) attacker, flees at low HP — teaches players about ranged aggro from mobs. |
| **Minotaur** | Medium, "town" boss-lite | medium-high | Melee; described as "average alone, dangerous in organized groups" — Minotaurs live in built-up camps with several variants (guards, workers). |
| **Cyclops** | Medium-Hard, area heavy-hitter | ~260 HP / 150 XP | Pure melee, never retreats, will path around/kill weaker creatures blocking it, retargets among nearby players; good mid-tier gold loot (shields, halberds). |
| **Orc Warlord** | Hard, mini-boss of the orc camp | high | Leads groups of Orc Leaders/Berserkers; tanky, strong loot table — the "camp boss" capping the Orc hunting ground. |
| **Rotworm Queen** | Hard, area boss | high, summons | Boss variant found deeper in rotworm warrens; spawns/reinforces rotworm swarms — an escalation of the basic rotworm theme. |

**Design pattern:** each hunting ground has 1–2 basic trash mobs, 1 "specialist" mob with
a signature mechanic (poison, ranged, pack aggro), and often a rare stronger variant or
named boss that caps the zone (Orc Warlord, Rotworm Queen) without being a separate,
disconnected "raid boss" — it's just the toughest resident of that theme.

---

## 3. Stats/Attributes That Define a Monster

Every Tibia monster is defined by a consistent attribute set (visible partly via the
in-client Bestiary/Look and fully in the classic `.mon` data files OT-server devs use):

- **Hit Points (HP):** core survivability stat; the primary input to difficulty tier.
- **Experience Points (XP):** flat XP granted on kill; combined with HP, forms the
  "exp-per-HP" efficiency ratio players use to pick optimal farming targets (TibiaWiki
  even maintains a dedicated "List of Creatures by Experience to Hit Points Ratio" page).
- **Max damage / attack stats:** melee hit range, and (if applicable) distance-attack
  range and damage.
- **Elemental resistances/weaknesses:** each damage type (Physical, Fire, Ice, Earth,
  Energy, Death, Holy, Drown, Life Drain) can be Strong/Weak/Immune per creature.
  Thematic logic applies (undead weak to Holy, strong vs Death/Earth; fire elementals
  immune to fire, weak to ice; earth elementals immune to earth/energy, weak to fire).
  There's also a rock-paper-scissors flavor among elements themselves (fire beats earth,
  earth beats energy, energy beats ice, ice beats fire).
- **Abilities/spell kit:** melee hit, distance attack (thrown weapon or spell bolt), area
  spells (waves/beams), self-healing, haste/speed buffs, paralyze, drunk/confusion,
  invisibility, and **summoning** (conjuring additional creatures, common on
  necromancer-type and "boss" monsters).
- **Special traits:** immune to paralyze, cannot be pushed/knocked back (rotworms),
  never retreats vs. flees at a set HP threshold, retargets to nearest player, can be
  converted/"summoned" as a player pet, pushes/kills weaker creatures blocking its path.
- **Loot table:** ordered list of possible drops (see §4).
- **Bestiary metadata:** Difficulty tier, Occurrence rarity, and lore/flavor text unlocked
  progressively via kill-count milestones.

---

## 4. Loot Table Structure

Tibia's loot design separates drops into a few practical categories, even though the
underlying data model is just "a list of (item, chance, min–max count) entries" rolled
independently per kill:

- **Always/near-always drops:** low-value "junk" that essentially every kill produces —
  meat/food, small amounts of gold coins, a creature-specific trophy/skin item. These
  exist to fund basic upkeep (food, ammo) during grinding.
- **Common drops (moderate %):** the bread-and-butter gold-per-kill items — bulk gold
  coin stacks, common equipment pieces (leather boots, basic weapons), crafting/trade
  materials.
- **Uncommon drops:** better equipment, stackable valuables, quest-relevant items.
- **Rare/very rare drops (often <1–5%):** the "chase" items — named weapons, rare
  collectibles, high-value trade goods. Value is inversely correlated with drop rate by
  design ("the most valuable items are the most rare").
- Loot is rolled **per corpse at time of kill** in modern Tibia (an old community myth
  claimed certain equipped items boosted rare-drop odds; TibiaWiki debunks this — loot
  odds are fixed to the creature, not the killer's gear).
- Loot is displayed to the player in a fixed presentation order (alphabetical/by
  magnitude) rather than roll order, which is a UI/display detail more than a design
  principle.
- Tougher/rarer creatures generally have both a higher gold floor *and* access to a
  bigger, more valuable rare-item pool — loot value scales with difficulty tier, giving
  players an economic incentive to progress to harder hunting grounds, not just an XP one.

**Simplified model for a solo game:** per monster, define (a) an always-drop pool
(0–2 guaranteed junk/food items), (b) a common pool (2–4 items at 10–40% each), and
(c) a rare pool (1–3 items at ≤5%, ideally ≤1% for the best one). Scale gold amount and
rare-pool value with the monster's difficulty tier.

---

## 5. Hunting Ground Structure (Area/Theme Grouping)

Tibia's world design groups monsters geographically and thematically rather than by pure
level number — a "hunting ground" is a cave/dungeon/camp built around one or two related
creature types, so players can predict what they're walking into and gear accordingly.
The classic starter-zone (Rookgaard) pattern:

- **Rat/Cave Rat sewers** — very first zone, right under/near the starting town, teaches
  basic combat with near-zero risk.
- **Rotworm cellars/caves** — a step up; rewards players who learn to fight in corridors
  (since rotworms can't be pushed back) and avoid being surrounded.
- **Spider / Poison Spider cave** — introduces poison DoT as a mechanic in a contained,
  low-risk space.
- **Wolf packs (open field/NE forest)** — introduces multi-enemy pack aggro in open
  terrain rather than a corridor, a different tactical problem than the cellar mobs.
- **Troll dens/bridges** — a "graduation" fight once rats/spiders feel too easy: single
  stronger melee bruisers instead of numerous weak ones.
- **Orc camps** — a themed multi-unit camp (basic Orc, ranged Orc Spearman, and a tougher
  Orc Warlord/Orc Leader capping the group) — teaches players to handle mixed enemy
  compositions and multi-aggro pulls.
- **Ghoul Hill** — a themed undead-flavored area good for kiting/ranged classes.
- **Minotaur camps / Cyclops caves** — later "mainland" starter-adjacent zones that scale
  the same territorial-camp pattern up in HP/damage once a player has outgrown Rookgaard.

**Recurring structural pattern** worth reusing in a solo PWA design:
1. Each hunting ground has a **flavor/theme** (rats, poison bugs, undead, orc war-camp)
   that determines its resistances/weaknesses as a set (e.g., an undead zone is
   holy-weak across the board), so players who invest in one counter-strategy get value
   across the whole zone.
2. Each zone has a **soft difficulty gradient** — weaker trash near the entrance, a
   named/stronger variant deeper in — so a starter zone naturally teaches risk-vs-reward
   without needing separate levels.
3. Zones are **geographically compact and self-contained** (a cellar, a cave, a camp)
   rather than one sprawling open world with monsters scattered arbitrarily — this keeps
   scope small, which maps well onto a mobile-first single-player game with a handful of
   hand-built starter maps.

---

## Sources

- https://tibia.fandom.com/wiki/Bestiary/Difficulties
- https://tibia.fandom.com/wiki/Bestiary/Occurrences
- https://tibia.fandom.com/wiki/Bestiary/All
- https://tibia.fandom.com/wiki/Rotworm
- https://tibia.fandom.com/wiki/Cyclops
- https://tibia.fandom.com/wiki/Troll
- https://tibia.fandom.com/wiki/Ghoul
- https://tibia.fandom.com/wiki/Cave_Rat
- https://tibia.fandom.com/wiki/Poison_Spider
- https://tibia.fandom.com/wiki/Orc_Spearman
- https://tibia.fandom.com/wiki/Orc_Warlord
- https://tibia.fandom.com/wiki/Minotaur
- https://tibia.fandom.com/wiki/Skeleton
- https://tibia.fandom.com/wiki/Wasp
- https://tibia.fandom.com/wiki/Loot
- https://tibia.fandom.com/wiki/List_of_Creatures_by_Experience_to_Hit_Points_Ratio
- https://tibia.fandom.com/wiki/Rookgaard_Leveling_Guide
- https://www.tibiaqa.com/18358/what-are-all-the-elements-and-its-respective-weakness
- https://www.tibiaqa.com/7567/best-places-to-hunt-for-experience-in-rookgaard
- https://www.tibia.com/library/?subtopic=creatures
- (Note: tibia.fandom.com, tibiapal.com, and several other Tibia sites were unreachable
  by direct fetch in this environment due to network egress restrictions; all content
  above was gathered via search-engine result snippets referencing these pages, cross-
  checked against general published knowledge of Tibia's design.)
