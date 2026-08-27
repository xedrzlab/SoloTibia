// Use-based skill training, modelled on Tibia's skill system: every skill
// advances by accumulating "tries" (a hit landed, a point of mana spent, a
// blow blocked), and each level costs exponentially more tries than the last.
// Vocations learn different skills at different rates.

import { Vocation } from "./stats";

export type SkillId = "melee" | "distance" | "magic" | "shielding";

export const SKILL_ORDER: SkillId[] = ["melee", "distance", "magic", "shielding"];

export const SKILL_NAMES: Record<SkillId, string> = {
  melee: "Melee",
  distance: "Distance",
  magic: "Magic",
  shielding: "Shielding",
};

/**
 * Wording for level-up messages, matching Tibia's actual phrasing ("melee
 * fighting", "distance fighting") — real Tibia splits melee into
 * sword/axe/club/fist, but this game trains them as one combined "melee"
 * skill, so this is the closest equivalent per skill.
 */
export const SKILL_LOG_NAMES: Record<SkillId, string> = {
  melee: "melee fighting",
  distance: "distance fighting",
  magic: "magic",
  shielding: "shielding",
};

interface SkillCurve {
  /** Level the skill starts at for a fresh character. */
  start: number;
  /** Tries needed for the very first step (start -> start + 1), before the vocation factor. */
  baseTries: number;
}

// Melee/distance/shielding: tries to advance from level N to N+1 follows
// TibiaWiki's documented formula, Tries = 50 * (N - 10)^1.1 — a power-law
// curve (not exponential-in-steps), with all three sharing the same base of
// 50 and skills starting at level 10. Magic level counts mana spent rather
// than hits and starts at 0; it uses a per-vocation formula instead (below).
const POWER_EXPONENT = 1.1;

const CURVES: Record<Exclude<SkillId, "magic">, SkillCurve> = {
  melee: { start: 10, baseTries: 50 },
  distance: { start: 10, baseTries: 50 },
  shielding: { start: 10, baseTries: 50 },
};

/**
 * Per-vocation try multipliers for melee/distance/shielding — lower means
 * the skill trains faster. Shielding specifically: TibiaWiki documents
 * knights and paladins advancing at the *identical* speed (fastest), with
 * druids/sorcerers advancing "significantly" slower — rarely getting
 * shielding much past 25-30 — and druids a hair faster at it than
 * sorcerers. Melee/distance don't have that knight/paladin tie or
 * druid/sorcerer split documented, so those keep their existing spread.
 */
const VOCATION_FACTORS: Record<Vocation, Record<Exclude<SkillId, "magic">, number>> = {
  none: { melee: 1.5, distance: 1.5, shielding: 1.5 },
  knight: { melee: 1.0, distance: 1.4, shielding: 1.0 },
  paladin: { melee: 1.2, distance: 1.0, shielding: 1.0 },
  sorcerer: { melee: 2.0, distance: 2.0, shielding: 4.5 },
  druid: { melee: 2.0, distance: 2.0, shielding: 4.0 },
};

// Magic level's own documented mechanic: each vocation spends mana at a
// fixed multiple of the previous level's cost — sorcerers/druids ("mages")
// only need 1.1x more per level, paladins 1.4x, knights a punishing 3x.
// That per-level GROWTH RATE differs by vocation (unlike the other three
// skills, which share one curve shape and differ only by a flat factor).
const MAGIC_BASE_MANA = 160;
const MAGIC_GROWTH: Record<Vocation, number> = {
  none: 2.0,
  knight: 3.0,
  paladin: 1.4,
  sorcerer: 1.1,
  druid: 1.1,
};

export function startingLevel(skill: SkillId): number {
  return skill === "magic" ? 0 : CURVES[skill].start;
}

/** Tries needed to advance from `level` to `level + 1`. */
export function triesForNextLevel(skill: SkillId, level: number, vocation: Vocation): number {
  if (skill === "magic") {
    return Math.max(1, Math.round(MAGIC_BASE_MANA * Math.pow(MAGIC_GROWTH[vocation], level)));
  }
  const curve = CURVES[skill];
  const step = Math.max(1, level - curve.start + 1);
  return Math.max(1, Math.round(curve.baseTries * Math.pow(step, POWER_EXPONENT) * VOCATION_FACTORS[vocation][skill]));
}

export class SkillSet {
  private levels: Record<SkillId, number>;
  private tries: Record<SkillId, number>;

  constructor() {
    this.levels = { melee: 0, distance: 0, magic: 0, shielding: 0 };
    this.tries = { melee: 0, distance: 0, magic: 0, shielding: 0 };
    for (const skill of SKILL_ORDER) this.levels[skill] = startingLevel(skill);
  }

  level(skill: SkillId): number {
    return this.levels[skill];
  }

  /** Progress toward the next level, 0..1 — drives the skill bars in the UI. */
  progress(skill: SkillId, vocation: Vocation): number {
    const needed = triesForNextLevel(skill, this.levels[skill], vocation);
    return Math.min(1, this.tries[skill] / needed);
  }

  /** Add training progress. Returns how many levels were gained (usually 0). */
  train(skill: SkillId, amount: number, vocation: Vocation): number {
    if (amount <= 0) return 0;
    this.tries[skill] += amount;
    let gained = 0;
    // A big mana dump can cross more than one magic level at once.
    let needed = triesForNextLevel(skill, this.levels[skill], vocation);
    while (this.tries[skill] >= needed) {
      this.tries[skill] -= needed;
      this.levels[skill] += 1;
      gained += 1;
      needed = triesForNextLevel(skill, this.levels[skill], vocation);
    }
    return gained;
  }
}

// ---------------------------------------------------------------------------
// Combat math
// ---------------------------------------------------------------------------

/**
 * Tibia's melee/distance damage curve:
 *   maxDamage = 0.085 * attack * (skill + 1) + level / 5
 * Damage then rolls uniformly between a floor and that maximum.
 */
export function weaponMaxDamage(skill: number, attack: number, level: number): number {
  return Math.max(1, Math.floor(0.085 * attack * (skill + 1) + level / 5));
}

/** Attacks never whiff completely — they roll between ~20% and 100% of max. */
export function weaponMinDamage(max: number): number {
  return Math.max(0, Math.floor(max * 0.2));
}

/** Spell power scales off magic level and character level, not weapons. */
export function spellDamage(magicLevel: number, level: number, base: number, factor: number): number {
  return Math.max(1, Math.floor(base + (magicLevel * factor + level / 5)));
}

/** Armor soaks a random slice of each hit, so heavy armor blunts chip damage. */
export function armorReduction(armor: number): number {
  if (armor <= 0) return 0;
  const min = armor * 0.5;
  return Math.floor(min + Math.random() * (armor - min + 1));
}

/** Shield + shielding skill give a flat chance to fully block an incoming blow. */
export function blockChance(shielding: number, defense: number): number {
  if (defense <= 0) return 0;
  return Math.min(0.5, (shielding * 0.004 + defense * 0.012));
}
