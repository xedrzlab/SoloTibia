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
  /** The "A" reference constant — tries at step 0, before the vocation's own growth rate compounds it. */
  baseTries: number;
}

// Every skill (including magic level) shares ONE formula:
//   Required = A * B^(level - offset)
// where A and offset are per-skill constants and B is the vocation's own
// per-level growth rate for that skill (the "B" reference constants below,
// straight from Tibia's documented mechanic — magic level already worked
// this way; melee/distance/shielding turn out to use the exact same shape,
// just with a much smaller B, so this replaces the separate power-law
// curve an earlier pass used for those three).
const CURVES: Record<SkillId, SkillCurve> = {
  melee: { start: 10, baseTries: 50 },
  distance: { start: 10, baseTries: 30 },
  shielding: { start: 10, baseTries: 100 },
  // Magic level counts mana spent rather than hits, and starts at 0 (no offset).
  magic: { start: 0, baseTries: 1600 },
};

/**
 * Per-vocation, per-skill growth rate (the exponential base "B") — this
 * game trains sword/axe/club/fist as one combined "melee" skill, so it
 * uses Tibia's "Melee" (sword/axe/club) reference rate rather than the
 * separate (and for casters, slightly cheaper) "Fist" rate.
 */
const SKILL_GROWTH: Record<Vocation, Record<SkillId, number>> = {
  // Our own pre-vocation-choice state, not a real Tibia mechanic — flat
  // and identical across all four skills, so no skill is favored before
  // the player actually picks a vocation.
  none: { melee: 1.5, distance: 1.5, magic: 1.5, shielding: 1.5 },
  knight: { melee: 1.1, distance: 1.4, magic: 3.0, shielding: 1.1 },
  paladin: { melee: 1.2, distance: 1.1, magic: 1.4, shielding: 1.1 },
  sorcerer: { melee: 2.0, distance: 2.0, magic: 1.1, shielding: 1.5 },
  druid: { melee: 1.8, distance: 1.8, magic: 1.1, shielding: 1.5 },
};

export function startingLevel(skill: SkillId): number {
  return CURVES[skill].start;
}

/** Tries needed to advance from `level` to `level + 1`. */
export function triesForNextLevel(skill: SkillId, level: number, vocation: Vocation): number {
  const curve = CURVES[skill];
  const steps = Math.max(0, level - curve.start);
  return Math.max(1, Math.round(curve.baseTries * Math.pow(SKILL_GROWTH[vocation][skill], steps)));
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
 * Combat stance (Full Attack/Balanced/Full Defense) isn't implemented yet —
 * every call site passes the default 1.0 (full attack) until that's added.
 */
export const COMBAT_FACTOR_FULL_ATTACK = 1.0;

/** Melee: maxDamage = 0.085 * combatFactor * attack * skill + level/5. */
export function meleeMaxDamage(skill: number, attack: number, level: number, combatFactor = COMBAT_FACTOR_FULL_ATTACK): number {
  return Math.max(1, Math.floor(0.085 * combatFactor * attack * skill + level / 5));
}

/** Melee never whiffs completely — rolls between ~20% and 100% of max (a deliberate house-rule floor, not from the reference formula). */
export function meleeMinDamage(max: number): number {
  return Math.max(0, Math.floor(max * 0.2));
}

/** Distance: same shape as melee but its own coefficient (0.09) and floor (level/5, not 20% of max). */
export function distanceMaxDamage(skill: number, attack: number, level: number, combatFactor = COMBAT_FACTOR_FULL_ATTACK): number {
  return Math.max(1, Math.floor(0.09 * combatFactor * attack * skill + level / 5));
}

export function distanceMinDamage(level: number): number {
  return Math.max(0, Math.floor(level / 5));
}

/** Spells (damage or healing): level*0.2 + magicLevel*coefficient, rolled between the spell's min and max coefficient. */
export function spellMinPower(magicLevel: number, level: number, minCoefficient: number): number {
  return Math.max(0, Math.floor(level * 0.2 + magicLevel * minCoefficient));
}

export function spellMaxPower(magicLevel: number, level: number, maxCoefficient: number): number {
  return Math.max(1, Math.floor(level * 0.2 + magicLevel * maxCoefficient));
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
