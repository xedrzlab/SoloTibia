export const TILE_SIZE = 32;

// Old-school Tibia movement model. The step duration for a single tile is
//   duration_ms = ceil( 1000 * groundFriction / totalSpeed , STEP_QUANTUM_MS )
// then multiplied by DIAGONAL_STEP_MULT on a diagonal step.
//
//   totalSpeed = BASE_SPEED + SPEED_PER_LEVEL * (level - 1)  + item bonus
//
// The quantum (a Tibia mechanic) means adding a little speed does nothing
// until you cross the next "breakpoint" — the tile time only ever changes in
// STEP_QUANTUM_MS jumps. Sources: TibiaWiki Formulae + Speed Breakpoints,
// TibiaLD's BAT series, and the community "old Tibia" TFS default.
export const BASE_SPEED = 220;
export const SPEED_PER_LEVEL = 2;
export const STEP_QUANTUM_MS = 50;
/** Every step is at least this long — matches Tibia's 50 ms floor per tile. */
export const MIN_STEP_MS = STEP_QUANTUM_MS;
/**
 * Diagonal steps take longer than cardinal ones. Old Tibia used 2×; modern
 * uses 3×. We use 2 as a compromise between authenticity and playability.
 */
export const DIAGONAL_STEP_MULT = 2;

/**
 * Retained for the paperdoll walk-animation frame-timing (attack cooldown
 * uses its own constant). Real per-tile durations come from stepDurationMs
 * on Player; this is only the fallback when no tile-friction is available.
 */
export const BASE_STEP_MS = 500;

/**
 * Old-Tibia step-time formula, shared by Player and Monster so neither
 * duplicates it:
 *   duration_ms = ceil( 1000 * F / speed , STEP_QUANTUM_MS ) * (diag ? 2 : 1)
 * The ceiling to STEP_QUANTUM_MS is the "breakpoint" behaviour — adding a
 * little speed does nothing until the next quantum tier is reached.
 */
export function stepDurationMs(speed: number, friction: number, diagonal: boolean): number {
  const raw = (1000 * friction) / Math.max(1, speed);
  const quantised = Math.ceil(raw / STEP_QUANTUM_MS) * STEP_QUANTUM_MS;
  const withDiagonal = quantised * (diagonal ? DIAGONAL_STEP_MULT : 1);
  return Math.max(MIN_STEP_MS, withDiagonal);
}

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
