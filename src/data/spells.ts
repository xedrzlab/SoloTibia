// Spells are the third way to fight (alongside melee and distance) and the
// only way to train magic level — every point of mana spent counts as a try.

export interface SpellDef {
  id: string;
  name: string;
  /** Tibia-style incantation, shown when the spell is cast. */
  words: string;
  textureKey: string;
  manaCost: number;
  kind: "attack" | "heal";
  /** Coefficients applied to magic level for the roll's low/high end — power = level*0.2 + magicLevel*coefficient. */
  minCoefficient: number;
  maxCoefficient: number;
  /** Tiles the spell reaches (attack spells only). */
  range?: number;
}

export const SPELLS: Record<string, SpellDef> = {
  light_healing: {
    id: "light_healing",
    name: "Light Healing",
    words: "exura",
    textureKey: "spell-heal",
    manaCost: 20,
    kind: "heal",
    minCoefficient: 3,
    maxCoefficient: 5,
  },
  flame_strike: {
    id: "flame_strike",
    name: "Flame Strike",
    words: "exori flam",
    textureKey: "spell-flame",
    manaCost: 20,
    kind: "attack",
    minCoefficient: 3,
    maxCoefficient: 5,
    range: 4,
  },
};

/** Spells shown on the action bar, in order. */
export const SPELL_BAR: string[] = ["flame_strike", "light_healing"];
