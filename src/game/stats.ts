// Vocation growth rates and the experience curve, taken from
// docs/GAME_DESIGN.md §2. Only Knight is playable in this first slice;
// the table stays vocation-keyed so adding vocation selection later is a
// data change, not a rewrite.

export type Vocation = "knight" | "paladin" | "sorcerer" | "druid";

export interface VocationGrowth {
  hpPerLevel: number;
  manaPerLevel: number;
  capacityPerLevel: number;
}

export const VOCATIONS: Record<Vocation, VocationGrowth> = {
  knight: { hpPerLevel: 15, manaPerLevel: 5, capacityPerLevel: 25 },
  paladin: { hpPerLevel: 10, manaPerLevel: 15, capacityPerLevel: 20 },
  sorcerer: { hpPerLevel: 5, manaPerLevel: 30, capacityPerLevel: 10 },
  druid: { hpPerLevel: 5, manaPerLevel: 30, capacityPerLevel: 10 },
};

const BASE_HP = 150;
const BASE_MANA = 0;
const BASE_CAPACITY = 400;

export function maxHpFor(vocation: Vocation, level: number): number {
  return BASE_HP + VOCATIONS[vocation].hpPerLevel * (level - 1);
}

export function maxManaFor(vocation: Vocation, level: number): number {
  return BASE_MANA + VOCATIONS[vocation].manaPerLevel * (level - 1);
}

export function maxCapacityFor(vocation: Vocation, level: number): number {
  return BASE_CAPACITY + VOCATIONS[vocation].capacityPerLevel * (level - 1);
}

/** Cumulative experience required to reach `level` (docs/GAME_DESIGN.md §2). */
export function cumulativeExpForLevel(level: number): number {
  return Math.round((50 / 3) * (level ** 3 - 6 * level ** 2 + 17 * level - 12));
}

export function levelForExp(totalExp: number): number {
  let level = 1;
  while (cumulativeExpForLevel(level + 1) <= totalExp) level++;
  return level;
}

export function expIntoCurrentLevel(totalExp: number, level: number): number {
  return totalExp - cumulativeExpForLevel(level);
}

export function expNeededForNextLevel(level: number): number {
  return cumulativeExpForLevel(level + 1) - cumulativeExpForLevel(level);
}

/** Use-based skill training: diminishing-returns curve, docs/GAME_DESIGN.md §2. */
export function trainingHitsForSkillLevel(skillLevel: number): number {
  return Math.round(50 * Math.pow(Math.max(skillLevel - 10, 1), 1.1));
}
