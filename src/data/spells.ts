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
  /** Flat component of the effect, before magic level scales it. */
  base: number;
  /** How much each magic level adds. */
  factor: number;
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
    base: 12,
    factor: 3,
  },
  flame_strike: {
    id: "flame_strike",
    name: "Flame Strike",
    words: "exori flam",
    textureKey: "spell-flame",
    manaCost: 20,
    kind: "attack",
    base: 8,
    factor: 2.5,
    range: 4,
  },
};

/** Spells shown on the action bar, in order. */
export const SPELL_BAR: string[] = ["flame_strike", "light_healing"];
