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

interface SkillCurve {
  /** Level the skill starts at for a fresh character. */
  start: number;
  /** Tries needed to advance from `start` to `start + 1`. */
  baseTries: number;
  /** How much more expensive each subsequent level is. */
  growth: number;
}

const CURVES: Record<SkillId, SkillCurve> = {
  melee: { start: 10, baseTries: 50, growth: 1.1 },
  distance: { start: 10, baseTries: 30, growth: 1.1 },
  // Magic counts mana spent rather than hits, so its base is much larger.
  magic: { start: 0, baseTries: 160, growth: 1.15 },
  shielding: { start: 10, baseTries: 90, growth: 1.1 },
};

/** Per-vocation try multipliers — lower means the skill trains faster. */
const VOCATION_FACTORS: Record<Vocation, Record<SkillId, number>> = {
  none: { melee: 1.5, distance: 1.5, magic: 2.0, shielding: 1.5 },
  knight: { melee: 1.0, distance: 1.4, magic: 3.0, shielding: 1.0 },
  paladin: { melee: 1.2, distance: 1.0, magic: 1.8, shielding: 1.1 },
  sorcerer: { melee: 2.0, distance: 2.0, magic: 1.0, shielding: 1.5 },
  druid: { melee: 2.0, distance: 2.0, magic: 1.0, shielding: 1.5 },
};

export function startingLevel(skill: SkillId): number {
  return CURVES[skill].start;
}

/** Tries needed to advance from `level` to `level + 1`. */
export function triesForNextLevel(skill: SkillId, level: number, vocation: Vocation): number {
  const curve = CURVES[skill];
  const steps = Math.max(0, level - curve.start);
  return Math.max(1, Math.round(curve.baseTries * Math.pow(curve.growth, steps) * VOCATION_FACTORS[vocation][skill]));
}

export class SkillSet {
  private levels: Record<SkillId, number>;
  private tries: Record<SkillId, number>;

  constructor() {
    this.levels = { melee: 0, distance: 0, magic: 0, shielding: 0 };
    this.tries = { melee: 0, distance: 0, magic: 0, shielding: 0 };
    for (const skill of SKILL_ORDER) this.levels[skill] = CURVES[skill].start;
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
