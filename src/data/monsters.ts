// Starter bestiary — the "cellar" hunting ground from docs/GAME_DESIGN.md §3.
// More zones/monsters get added here as new hunting grounds are built.

export interface LootEntry {
  itemId: string;
  chance: number; // 0..1
  min: number;
  max: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  textureKey: string;
  frameCount: number;
  /** Set for sheets built by scripts/generate-assets.mjs (4 directions x N frames). Omit for simple non-directional 2-frame sheets. */
  framesPerDirection?: number;
  hp: number;
  xp: number;
  minDamage: number;
  maxDamage: number;
  attackIntervalMs: number;
  /** Chance (0-100) an attack against the player actually connects — rolled before damage, never folded into the damage range. */
  hitChance: number;
  /** ARM: flat physical mitigation against the player's own attacks — same calculateArmorMitigation() the player's armor uses. */
  armor: number;
  fleeAtHpPct: number; // 0 = never flees
  loot: LootEntry[];
}

export const MONSTERS: Record<string, MonsterDef> = {
  rat: {
    id: "rat",
    name: "Rat",
    textureKey: "rat",
    frameCount: 2,
    hp: 20,
    xp: 5,
    minDamage: 0,
    maxDamage: 8,
    attackIntervalMs: 2000,
    hitChance: 75,
    armor: 1,
    fleeAtHpPct: 0.25,
    loot: [
      { itemId: "gold_coin", chance: 0.9, min: 1, max: 4 },
      { itemId: "cheese", chance: 0.36, min: 1, max: 1 },
    ],
  },
  cave_rat: {
    id: "cave_rat",
    name: "Cave Rat",
    textureKey: "cave-rat",
    frameCount: 2,
    hp: 30,
    xp: 10,
    minDamage: 1,
    maxDamage: 4,
    attackIntervalMs: 1800,
    hitChance: 80,
    armor: 1,
    fleeAtHpPct: 0.15,
    loot: [
      { itemId: "gold_coin", chance: 0.7, min: 2, max: 8 },
      { itemId: "health_potion", chance: 0.08, min: 1, max: 1 },
    ],
  },
  slime: {
    id: "slime",
    name: "Slime",
    textureKey: "slime",
    frameCount: 2,
    hp: 8,
    xp: 3,
    minDamage: 0,
    maxDamage: 1,
    attackIntervalMs: 2200,
    hitChance: 70,
    armor: 0,
    fleeAtHpPct: 0.3,
    loot: [{ itemId: "gold_coin", chance: 0.4, min: 1, max: 2 }],
  },
  troll: {
    id: "troll",
    name: "Troll",
    textureKey: "troll",
    frameCount: 16,
    framesPerDirection: 4,
    hp: 50,
    xp: 25,
    minDamage: 3,
    maxDamage: 8,
    attackIntervalMs: 1900,
    hitChance: 90,
    armor: 4,
    fleeAtHpPct: 0,
    loot: [
      { itemId: "gold_coin", chance: 0.85, min: 10, max: 30 },
      { itemId: "health_potion", chance: 0.15, min: 1, max: 1 },
    ],
  },
};
