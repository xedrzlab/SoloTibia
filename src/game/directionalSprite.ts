// Shared frame-indexing contract between the game code and
// scripts/generate-assets.mjs: directional sheets are laid out as
// framesPerDirection frames for each direction, in this order.
export const DIRECTION_ORDER = ["down", "left", "right", "up"] as const;
export type Direction = (typeof DIRECTION_ORDER)[number];

export function directionFromDelta(dx: number, dy: number, fallback: Direction): Direction {
  if (dx === 0 && dy < 0) return "up";
  if (dx === 0 && dy > 0) return "down";
  if (dx < 0) return "left";
  if (dx > 0) return "right";
  return fallback;
}

export function directionalFrameIndex(
  direction: Direction,
  frameInDirection: number,
  framesPerDirection: number,
): number {
  return DIRECTION_ORDER.indexOf(direction) * framesPerDirection + frameInDirection;
}

/**
 * Key for a texture's per-direction walk-loop animation (BootScene
 * registers it, Monster plays it) — a shared builder so the two sides can
 * never drift into mismatched key strings.
 */
export function walkAnimKey(textureKey: string, direction: Direction): string {
  return `${textureKey}-walk-${direction}`;
}
