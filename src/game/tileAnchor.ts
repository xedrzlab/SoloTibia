import { TILE_SIZE } from "./constants";

// Tibia's real rendering isn't isometric — it's an oblique top-down
// projection where the ground stays a plain square grid, and sprites taller
// or wider than one tile are anchored at the BOTTOM-RIGHT corner of their
// tile rather than centered. Any extra height/width in the sprite then
// naturally extends up and to the left, which is exactly the "leaning"
// look of Tibia trees, buildings, and creatures — no shear/transform math
// needed, just a different anchor point plus normal Y-sorting.

export function tileAnchorX(tileX: number): number {
  return (tileX + 1) * TILE_SIZE;
}

export function tileAnchorY(tileY: number): number {
  return (tileY + 1) * TILE_SIZE;
}

const DEPTH_BASE = 10;

/** Y-sort depth: things lower on the (isometric-feeling) screen render in front. */
export function depthForTileY(tileY: number): number {
  return DEPTH_BASE + tileY;
}
