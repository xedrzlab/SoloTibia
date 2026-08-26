// Vocation growth rates and the experience curve, taken from
// docs/GAME_DESIGN.md §2. A character starts as "none" (pre-vocation, matching
// the level-8 choice gate) and picks one of the four real vocations via the
// Elder in town once they reach VOCATION_CHOICE_LEVEL.

export type Vocation = "none" | "knight" | "paladin" | "sorcerer" | "druid";
export type ChosenVocation = Exclude<Vocation, "none">;

export interface VocationGrowth {
  hpPerLevel: number;
  manaPerLevel: number;
  capacityPerLevel: number;
}

export const VOCATIONS: Record<Vocation, VocationGrowth> = {
  none: { hpPerLevel: 8, manaPerLevel: 10, capacityPerLevel: 15 },
  knight: { hpPerLevel: 15, manaPerLevel: 5, capacityPerLevel: 25 },
  paladin: { hpPerLevel: 10, manaPerLevel: 15, capacityPerLevel: 20 },
  sorcerer: { hpPerLevel: 5, manaPerLevel: 30, capacityPerLevel: 10 },
  druid: { hpPerLevel: 5, manaPerLevel: 30, capacityPerLevel: 10 },
};

export const VOCATION_NAMES: Record<ChosenVocation, string> = {
  knight: "Knight",
  paladin: "Paladin",
  sorcerer: "Sorcerer",
  druid: "Druid",
};

/** Display label for any vocation, including the pre-choice "none" state. */
export function vocationDisplayName(vocation: Vocation): string {
  return vocation === "none" ? "No Vocation" : VOCATION_NAMES[vocation];
}

export const VOCATION_DESCRIPTIONS: Record<ChosenVocation, string> = {
  knight: "Melee tank. Highest HP, heavy armor, strong in a straight fight.",
  paladin: "Ranged hybrid. Balanced HP and mana, fights from a distance.",
  sorcerer: "Offensive caster. Lowest HP, highest mana, powerful spells.",
  druid: "Support caster. Lowest HP, highest mana, healing and control.",
};

const BASE_HP = 150;
// Every character starts with a small mana pool, so spellcasting (and with it
// magic-level training) is available from level 1 rather than only after the
// level-8 vocation choice.
const BASE_MANA = 30;
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
