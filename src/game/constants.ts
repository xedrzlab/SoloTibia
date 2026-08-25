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
