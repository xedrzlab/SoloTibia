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
  /**
   * Directional sheet has no dedicated step-alternation/attack art — just a
   * looping walk cycle (frame 0 idle, the rest a walk animation registered
   * in BootScene) rather than the troll's idle/stepA/stepB/attack poses.
   */
  continuousWalk?: boolean;
  /** Sprite scale multiplier, for a monster whose art is bigger/smaller than the norm without needing its own larger source frames (cf. troll/cave_rat, which bake size into the sheet itself). Omit for 1x. */
  scale?: number;
  /**
   * The creature's actual silhouette within its frame, as fractions (0-1)
   * of the full frame — every sheet has transparent padding around the
   * art (a small ground creature like the rat/slime sits in the lower half
   * of its frame, not the full height), so the red target outline needs
   * this to hug the creature instead of the frame. Measured from the union
   * of the opaque bounding box across every frame in the sheet (so it
   * doesn't need to change during the walk cycle). Omit for the full
   * frame (0,1,0,1).
   */
  targetBox?: { xMin: number; xMax: number; yMin: number; yMax: number };
  hp: number;
  xp: number;
  minDamage: number;
  maxDamage: number;
  attackIntervalMs: number;
  /** Chance (0-100) an attack against the player actually connects — rolled before damage, never folded into the damage range. */
  hitChance: number;
  /** ARM: flat physical mitigation against the player's own attacks — same calculateArmorMitigation() the player's armor uses. */
  armor: number;
  /** Ground speed, same stat and step-duration formula (constants.ts stepDurationMs) as the player's — every monster moves at its own pace, not a shared constant. */
  speed: number;
  fleeAtHpPct: number; // 0 = never flees
  loot: LootEntry[];
}

export const MONSTERS: Record<string, MonsterDef> = {
  rat: {
    id: "rat",
    name: "Rat",
    textureKey: "rat",
    frameCount: 2,
    targetBox: { xMin: 0, xMax: 0.94, yMin: 0.25, yMax: 0.88 },
    hp: 20,
    xp: 5,
    minDamage: 0,
    maxDamage: 8,
    attackIntervalMs: 2000,
    hitChance: 75,
    armor: 1,
    speed: 67,
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
    frameCount: 8,
    framesPerDirection: 2,
    continuousWalk: true,
    targetBox: { xMin: 0.05, xMax: 0.95, yMin: 0.05, yMax: 0.93 },
    hp: 30,
    xp: 10,
    minDamage: 1,
    maxDamage: 4,
    attackIntervalMs: 1800,
    hitChance: 80,
    armor: 1,
    speed: 75,
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
    targetBox: { xMin: 0.06, xMax: 0.94, yMin: 0.38, yMax: 1 },
    hp: 8,
    xp: 3,
    minDamage: 0,
    maxDamage: 1,
    attackIntervalMs: 2200,
    hitChance: 70,
    armor: 0,
    // TibiaWiki's "Slime" is a much stronger creature (150 HP/160 exp) than
    // this starter-zone one, so its speed 60 isn't a like-for-like match —
    // this is a placeholder distinct from the other three, not a verified figure.
    speed: 50,
    fleeAtHpPct: 0.3,
    loot: [{ itemId: "gold_coin", chance: 0.4, min: 1, max: 2 }],
  },
  troll: {
    id: "troll",
    name: "Troll",
    textureKey: "troll",
    frameCount: 16,
    framesPerDirection: 4,
    targetBox: { xMin: 0, xMax: 1, yMin: 0.08, yMax: 1 },
    hp: 50,
    xp: 25,
    minDamage: 3,
    maxDamage: 8,
    attackIntervalMs: 1900,
    hitChance: 90,
    armor: 4,
    speed: 68,
    fleeAtHpPct: 0,
    loot: [
      { itemId: "gold_coin", chance: 0.85, min: 10, max: 30 },
      { itemId: "health_potion", chance: 0.15, min: 1, max: 1 },
    ],
  },
  // A harmless town novelty, not a combat encounter — see its MONSTER_SPAWNS
  // entry for why it's allowed to live on the (otherwise deliberately
  // peaceful) surface. hitChance 0 means every "attack" is a guaranteed
  // miss, so it can chase the player around without ever actually landing
  // a hit; min/maxDamage are 0 too, redundantly, in case that ever changes.
  curious_rat: {
    id: "curious_rat",
    name: "Curious Rat",
    textureKey: "cave-rat",
    frameCount: 8,
    framesPerDirection: 2,
    continuousWalk: true,
    targetBox: { xMin: 0.05, xMax: 0.95, yMin: 0.05, yMax: 0.93 },
    hp: 20,
    xp: 0,
    minDamage: 0,
    maxDamage: 0,
    attackIntervalMs: 2000,
    hitChance: 0,
    armor: 0,
    speed: 90,
    fleeAtHpPct: 0,
    loot: [],
  },
  // Testing spawn only: real isolated goblin art (6-frame walk cycle x 4
  // directions) just landed, dropped into town with 0 damage/hitChance so
  // it can be looked at and walked into safely before it gets balanced
  // stats and a proper hunting-ground spawn.
  goblin: {
    id: "goblin",
    name: "Goblin",
    textureKey: "goblin",
    frameCount: 24,
    framesPerDirection: 6,
    continuousWalk: true,
    scale: 1.5,
    targetBox: { xMin: 0.16, xMax: 0.84, yMin: 0.09, yMax: 0.91 },
    hp: 25,
    xp: 0,
    minDamage: 0,
    maxDamage: 0,
    attackIntervalMs: 2000,
    hitChance: 0,
    armor: 0,
    speed: 70,
    fleeAtHpPct: 0,
    loot: [],
  },
  // Real isolated bear art (4-frame walk cycle x 4 directions) plus real
  // TibiaWiki stats (Bear page: HP 80, exp 23, speed 78, armor 6, physical
  // melee 0-25, flees at 15 hp = 18.75%). Not currently spawned anywhere —
  // this is the complete monster model, ready for a real hunting-ground
  // spot later; see docs/monster-sources/bear/ for the source art + the
  // stats writeup this was built from.
  bear: {
    id: "bear",
    name: "Bear",
    textureKey: "bear",
    frameCount: 16,
    framesPerDirection: 4,
    continuousWalk: true,
    scale: 2,
    targetBox: { xMin: 0.09, xMax: 0.88, yMin: 0.09, yMax: 0.88 },
    hp: 80,
    xp: 23,
    minDamage: 0,
    maxDamage: 25,
    attackIntervalMs: 2200,
    hitChance: 85,
    armor: 6,
    speed: 78,
    fleeAtHpPct: 0.1875,
    loot: [
      { itemId: "meat", chance: 0.4, min: 1, max: 1 },
      { itemId: "ham", chance: 0.2, min: 1, max: 1 },
      { itemId: "bear_paw", chance: 0.02, min: 1, max: 1 },
      { itemId: "honeycomb", chance: 0.005, min: 1, max: 1 },
    ],
  },
};
