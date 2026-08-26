export const TILE_SIZE = 32;

// Base time to walk one tile, in ms. Later scaled down slightly by skill/gear.
export const BASE_STEP_MS = 220;

// How close (in tiles, Chebyshev distance) a melee target must be to land hits.
export const MELEE_RANGE = 1;

// How far (in tiles) a monster will notice and chase the player.
export const MONSTER_AGGRO_RANGE = 4;

// How far the player must be from a monster's spawn point before it can respawn.
export const RESPAWN_SAFE_DISTANCE = 6;

export const MONSTER_RESPAWN_MS = 25_000;

export const TARGET_FPS = 30;

// Level at which a character may choose a vocation (docs/GAME_DESIGN.md §2).
export const VOCATION_CHOICE_LEVEL = 8;

// How close (chebyshev, in tiles) the player must be to an NPC to interact.
export const NPC_INTERACT_RANGE = 3;

// Frame dimensions for directional sheets built by
// scripts/generate-assets.mjs — must match its printed output.
export const PLAYER_SHEET = { frameWidth: 32, frameHeight: 32 };
export const TROLL_SHEET = { frameWidth: 40, frameHeight: 52 };
