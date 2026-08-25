# Tibia — Vocation & Character Progression Reference

Compiled from public wiki/community sources (tibia.fandom.com "TibiaWiki", tibiamobile.com,
strategywiki.org, tibiabuddy.com, tibiaqa.com, tibiaplan.com) for game-design research only.
No Tibia code or art assets are referenced or reused. Numbers below reflect "classic" /
long-standing Tibia mechanics; the live game has since layered extra systems (Wheel of
Destiny, imbuements, Monk vocation, etc.) that are noted as out-of-scope where relevant.

---

## 1. The Four Base Vocations

All characters start as "No Vocation" and pick one of four vocations at level 8 (a
newbie quest gates this choice). Each vocation is a fixed archetype — there is no
respec; picking wrong means rerolling.

| Vocation | Identity | Primary offense | Primary defense |
|---|---|---|---|
| **Knight** | Melee tank | Sword/Axe/Club Fighting (or Fist Fighting unarmed) | Highest HP, Shielding, heavy armor |
| **Paladin** | Ranged / hybrid | Distance Fighting (bows, crossbows, throwing weapons) + support spells | Medium HP, decent Shielding, light-medium armor |
| **Sorcerer** | Offensive caster | Attack spells (fire/energy/death), highest raw magic damage | Lowest HP, relies on distance/kiting, no shield use with wand |
| **Druid** | Support/healing caster | Healing + control spells, secondary attack (ice/earth) spells | Lowest HP, same fragility as Sorcerer, group-support role |

Design intent: Knight = "tank/tough guy," Paladin = "ranged jack-of-all-trades,"
Sorcerer = "glass cannon nuker," Druid = "glass cannon support/healer." Sorcerer and
Druid are mechanically near-mirrors (same HP/mana/cap growth) but split by *spell
lists* — Sorcerer's are aggressive AoE damage, Druid's are healing + weaker/utility
damage — not by different underlying stat math.

---

## 2. Core Stats: HP, Mana, Capacity Growth Per Level

Growth is a flat **per-level increment that depends only on vocation**, starting from
shared base values while "No Vocation" (levels 1–7) and then diverging once a
vocation is chosen at level 8. Sorcerer and Druid use identical stat growth.

| Vocation | HP / level | Mana / level | Capacity / level |
|---|---|---|---|
| Knight | **+15** | +5 | **+25 oz** |
| Paladin | +10 | +15 | +20 oz |
| Sorcerer | +5 | **+30** | +10 oz |
| Druid | +5 | **+30** | +10 oz |

- At level 8 (vocation choice point), all characters have the same base stats
  (commonly cited: ~185 HP / ~35 Mana at level 8 before vocation-specific gains
  begin, base 150 HP at character creation level 1). From level 8 onward each
  extra level adds the vocation's fixed increment above.
- **Design read:** HP and Mana are near-perfectly inverse between Knight and
  caster (15/5 vs 5/30) — a clean "tank vs. glass cannon" trade. Paladin sits
  exactly in the middle on both (10/15), reinforcing its hybrid identity.
  Capacity follows the same gradient (melee needs to carry more loot/armor;
  casters need less because they rely on mana, not gear weight).
- Capacity (carrying weight limit, in oz) is separate from combat stats but is
  itself vocation-gated, further reinforcing "Knight = pack mule / armor-heavy,"
  "Sorcerer/Druid = travel light."

---

## 3. Skills System

Tibia skills are **use-based ("learn by doing")**, not point-buy on level-up.
Leveling up only grants the HP/Mana/Cap stat increments above — it does **not**
directly grant skill points. Skills rise purely from repeated relevant actions,
independent of character level (a low-level character can out-skill a
higher-level one in a stat they trained more).

**Skill categories:**
- **Melee**: Sword Fighting, Axe Fighting, Club Fighting, Fist Fighting (unarmed)
  — trained by landing hits with that weapon type in combat.
- **Distance Fighting** — trained by landing ranged hits (bows/crossbows/throwables).
- **Magic Level** — trained by *spending mana* casting spells/runes (passive
  regen or shield-absorbed mana loss does not count).
- **Shielding** — trained by successfully blocking hits while a shield is equipped.
- **Fishing** — trained by fishing attempts (a minor/utility skill, not combat).

**Training mechanics:**
- Progress is driven by a hidden "skill points" counter tied to actual combat
  contribution — e.g. for melee/distance, a hit that draws blood (deals real
  damage) grants full training credit; a blocked/parried hit grants little or
  none. For magic level, mana *spent* is the training currency.
- The amount of "points" required to advance from skill level *N* to *N+1*
  grows roughly as a power curve: reported approximation
  `tries ≈ 50 × (N − 10)^1.1` for melee/distance/shielding, i.e. training gets
  progressively slower at higher skill — a soft diminishing-returns curve, not
  linear.
- **Vocation constants**: every vocation can train every skill, but each
  vocation has a different (hidden) "cost constant" per skill — training a
  weapon skill you're not built for is far slower. Concretely for Magic
  Level: it costs a fixed **1,600 mana to reach Magic Level 1**, and each
  subsequent level costs a multiple of the previous level's cost:
  - Sorcerer/Druid (mages): ×1.1 per magic level (fastest)
  - Paladin: ×1.4 per magic level (slower)
  - Knight: ×3.0 per magic level (extremely slow — knights *can* gain magic
    level but it's impractical)
  This is the core enforcement mechanism for vocation identity: nothing stops
  a Knight from casting spells or a Sorcerer from swinging a sword, but the
  training-cost multiplier makes off-vocation skills so slow to raise that in
  practice characters specialize.
- Skills can also be trained passively/offline via **training dummies** or
  (in modern Tibia) **Offline Training** while logged out, at a slower fixed rate
  than active combat — useful for AFK-style progression design.

---

## 4. Experience Curve & Promotion

### Experience formula
Cumulative total experience required to **reach** level *L* (documented on
TibiaWiki's "Experience Formula" page):

```
Exp(L) = 50/3 × (L³ − 6L² + 17L − 12)
```

This is a **cubic curve** — experience-to-next-level grows roughly with the
*square* of the current level, producing the classic MMO shape: fast early
levels, dramatically slower late levels. Verified sample values:

| Level | Cumulative Exp | Exp for *this* level (marginal) |
|---|---|---|
| 2 | 100 | 100 |
| 3 | 200 | 100 |
| 4 | 400 | 200 |
| 5 | 800 | 400 |
| 8 | 4,200 | — |
| 50 | 1,847,300 | — |
| 100 | 15,694,800 | — |
| 200 | 129,389,800 | — |
| 300 | 441,084,800 | — |

Early levels (2–5) roughly double in cost each time; by the hundreds, each
level costs tens of millions of exp — late game is defined by grinding
efficiency (hunting spot quality/hour), not quest completion.

### Promotion ("2nd vocation")
A one-time, purely mechanical upgrade — not a new vocation or new skill tree:

- **Requirements**: character level ≥ 20, Premium Account, pay 20,000 gold
  (originally purchasable directly; some variants gate it behind a quest
  instead of/in addition to gold).
- **New titles**: Knight → Elite Knight, Paladin → Royal Paladin,
  Sorcerer → Master Sorcerer, Druid → Elder Druid.
- **Mechanical benefits** (no new stat growth rates, no retroactive HP/mana):
  - **Reduced death penalty**: ~30% less experience/skill loss on death
    compared to an unpromoted character's penalty.
  - **Faster HP/Mana regeneration** rate (ticks recover more per interval).
  - **Increased soul points**: +100 max soul points, and regen rate improves
    from 1 per 2 minutes to 1 per 15 seconds (soul points are consumed by
    healing runes/spells).
  - Access to a small number of **promotion-tier spells** unavailable pre-promotion.
  - Permanent once purchased (persists even if Premium later lapses, though
    benefits are suspended while non-Premium).
- **Design read**: promotion is a *power/QoL milestone*, not a build-defining
  choice — it rewards reaching a level threshold with reduced risk and faster
  recovery, not new playstyle options. It's a good analog for a "prestige tier"
  or "ascension" gate in a solo game.

---

## 5. Equipment & Weapon Restrictions Tied to Vocation

Tibia enforces vocation identity primarily through **item-level vocation
flags** and **stat-scaling rules**, not hard skill locks:

- **Weapon types**: Sword/Axe/Club/Fist (melee) and Distance weapons
  (bows, crossbows, spears/throwing weapons) can technically be *picked up and
  equipped* by any vocation, but many individual weapon items carry an
  explicit "Vocation: Knights only" (etc.) tag — especially the strongest
  ones — so mages/paladins are locked out of top-tier melee weapons and vice
  versa regardless of skill level.
- **Distance weapons** (bows/crossbows) are functionally paladin-only in
  practice — other vocations lack the Distance Fighting skill investment and
  many strong ranged weapons carry paladin-only flags.
- **Wands (Sorcerer) / Rods (Druid)**: vocation-exclusive magical weapons —
  wands only usable by Sorcerers, rods only by Druids. They are one-handed,
  so a shield or spellbook can be equipped in the other hand. Notably, their
  damage output is a **fixed range independent of Magic Level** — i.e., the
  weapon itself doesn't scale with the caster's skill (spells are where
  Magic Level scaling actually matters).
- **Magic Level scaling**: only affects spell/rune damage and healing amount
  — it does not affect melee or distance weapon damage at all. Conversely,
  melee/distance skills do not affect spell effectiveness. This is a hard
  split: your combat stat only matters for the damage type it governs.
  Attack calculation for melee: weapon "attack" value × a factor scaling with
  melee skill level; not augmented by Magic Level even for a Knight/Paladin.
- **Two-handed weapons**: all two-handed *swords* are Knight-only; some (not
  all) two-handed axes/clubs are usable by other vocations.
- **Armor**: heavy plate/armor pieces with the highest raw Armor values are
  predominantly Knight/Paladin-flagged; robes and magic-oriented armor
  (lower base Armor, but with magic-level/mana bonuses) are Sorcerer/Druid
  flagged. So armor choice doubles as another vocation-identity lever:
  Knights stack raw defense, casters stack utility (mana regen, magic level
  bonus) at the cost of defense — reinforcing the tank vs. glass-cannon
  divide already set up by the HP/Mana growth rates.
- **Shields**: usable by any vocation with the Shielding skill, but
  Sorcerers/Druids using a wand/rod in the main hand can still equip a shield
  or a spellbook (spellbooks grant magic-level/mana bonuses instead of
  defense) — giving casters a defense-vs-utility choice in their off-hand slot.

---

## Sources

- [Vocations — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Vocation)
- [Formulae — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Formulae)
- [Experience Formula — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Experience_Formula)
- [Experience Table — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Experience_Table)
- [Magic Level — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Magic_Level)
- [Skills — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Skills)
- [Shielding — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Shielding)
- [Training — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Training)
- [Capacity — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Capacity)
- [Vocation Promotion — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Vocation_Promotion)
- [Weapon Type — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Weapon_Type)
- [Wands — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Wands)
- [Two-Handed — TibiaWiki (Fandom)](https://tibia.fandom.com/wiki/Two-Handed)
- [Tibia Vocations Guide — TibiaMobile](https://tibiamobile.com/wiki/vocations/)
- [Tibia/Vocations — StrategyWiki](https://strategywiki.org/wiki/Tibia/Vocations)
- [Tibia Level Calculator — TibiaBuddy](https://www.tibiabuddy.com/tools/level-calculator)
- [Tibia Death Penalty Guide — TibiaPlan](https://tibiaplan.com/guides/tibia-death-penalty/)
- [Where can I buy promotion? — TibiaQA](https://www.tibiaqa.com/228/where-can-i-buy-promotion)
- [Official Tibia Game Guides — Characters](https://www.tibia.com/gameguides/?subtopic=manual&section=characters)

*Note: WebFetch access to these wiki pages was blocked by this session's network
egress proxy; findings above were assembled from WebSearch result snippets
(which quote/paraphrase the source pages) plus formula cross-verification
(the experience formula was checked against known milestone values — e.g.
level 2 = 100 exp, level 3 = 200 exp, level 8 = 4,200 exp — which matched).
Some numeric constants (e.g. exact melee skill-formula per-vocation
coefficients) could not be confirmed to full precision and are flagged as
approximate above; treat exact numbers as "directionally correct, verify
before hard-coding" rather than guaranteed-exact.*
