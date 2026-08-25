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
  hp: number;
  xp: number;
  minDamage: number;
  maxDamage: number;
  attackIntervalMs: number;
  fleeAtHpPct: number; // 0 = never flees
  loot: LootEntry[];
}

export const MONSTERS: Record<string, MonsterDef> = {
  rat: {
    id: "rat",
    name: "Rat",
    textureKey: "rat",
    frameCount: 2,
    hp: 15,
    xp: 5,
    minDamage: 0,
    maxDamage: 2,
    attackIntervalMs: 2000,
    fleeAtHpPct: 0.2,
    loot: [
      { itemId: "gold_coin", chance: 0.6, min: 1, max: 4 },
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
    fleeAtHpPct: 0.15,
    loot: [
      { itemId: "gold_coin", chance: 0.7, min: 2, max: 8 },
      { itemId: "health_potion", chance: 0.08, min: 1, max: 1 },
    ],
  },
};
