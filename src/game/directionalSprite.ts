// Shared frame-indexing contract between the game code and
// scripts/process-uploaded-assets.mjs: directional sheets are laid out as
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
