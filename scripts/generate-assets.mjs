// Every visual asset in the game is generated here: terrain, props, buildings,
// characters, creatures, item icons and the app icons. Nothing is imported.
//
// This file is the art direction, in executable form. The rules it holds every
// asset to, so the world reads as the work of one hand:
//
//   PIXEL DENSITY  One art pixel is two screen pixels. Sprites are authored on
//                  a 16px grid and saved at SCALE, giving 32x32 world tiles.
//                  Anything authored at a finer density looks foreign next to
//                  the rest, however good it is on its own.
//   LIGHT          One source, upper left, for everything. Top and left-facing
//                  surfaces take the highlight; right and lower faces darken;
//                  contact shadows fall to the lower right.
//   PERSPECTIVE    Top-down, neither flat-on nor isometric. Tall things show a
//                  little of their front face below what you see from above.
//   PALETTE        Shared families (P_GRASS, P_STONE, ...) rather than per-asset
//                  colour. Saturation is reserved for what the player must
//                  find: loot, effects, the player themself.
//   DETAIL         Only where it says something — a crack, an edge, a material
//                  change. Noise for its own sake reads as dirt on the screen.
//
// Run with `npm run gen:assets`. Re-run any time definitions below change.

import { Sprite, saveSprite, saveSpriteSheet, savePNG } from "./pixel-canvas.mjs";

const OUT = "public/assets";
const ICONS = "public/icons";
const SCALE = 2; // 16x16 source canvas -> 32x32 tiles, matching the 1-tile-per-sqm convention

// ---------------------------------------------------------------------------
// Tiles (only the ones with no real-art replacement)
// ---------------------------------------------------------------------------

// Terrain palettes. Every tile draws from these families so the ground reads
// as one continuous world rather than a set of unrelated textures.
const P_GRASS = { deep: "#25451c", dark: "#2f5620", mid: "#3d6b2a", light: "#4f8034", hi: "#61944a" };
const P_DIRT = { deep: "#3a2717", dark: "#4f351f", mid: "#6b4a2a", light: "#82603a", hi: "#9a774d" };
const P_STONE = { deep: "#1f1d24", dark: "#2c2832", mid: "#4a4650", light: "#615c6b", hi: "#7d7887" };
const P_COBBLE = { deep: "#2a2730", dark: "#45414d", mid: "#6d6875", light: "#8a8592", hi: "#a29cac" };
const P_WATER = { deep: "#12304a", dark: "#1a3f5e", mid: "#245a7d", light: "#3a7fa3", hi: "#6fb2c9" };

/**
 * Lay down small rectangular patches rather than loose pixels. Ground texture
 * built from clusters reads as material; the same pixel count scattered one at
 * a time reads as static, which is the fastest way to make pixel art look
 * machine-made.
 */
function clusters(s, spots, hex) {
  for (const [x, y, w = 2, h = 1] of spots) s.fillRect(x, y, w, h, hex);
}

/**
 * Grass. Kept deliberately quiet: the ground is background, so it carries
 * broad tonal variation and a few blade tufts rather than detail that would
 * compete with characters and loot standing on it.
 */
function grassTile(variant = 0) {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, P_GRASS.mid);

  // Broad shading patches, so the tile has areas rather than an even field.
  clusters(
    s,
    [[0, 2, 4, 2], [6, 0, 3, 2], [11, 4, 5, 3], [2, 7, 4, 2], [8, 9, 3, 2], [0, 12, 5, 2], [12, 12, 4, 2]],
    P_GRASS.dark,
  );
  clusters(s, [[4, 1, 2, 1], [9, 3, 3, 1], [1, 5, 3, 1], [7, 6, 2, 1], [12, 8, 3, 1], [5, 11, 3, 1], [9, 14, 3, 1]], P_GRASS.light);

  // Blade tufts: a lit tip over a darker base reads as standing grass.
  for (const [x, y] of [[2, 3], [7, 1], [13, 5], [4, 9], [10, 11], [14, 9], [6, 13]]) {
    s.setPixel(x, y, P_GRASS.hi);
    s.setPixel(x, y + 1, P_GRASS.deep);
  }

  if (variant === 1) {
    // A single small flower. More than one reads as a pattern once the variant
    // repeats across a field, and the ground is meant to stay quiet.
    s.setPixel(11, 9, "#c9b86a");
    s.setPixel(11, 10, P_GRASS.deep);
  } else if (variant === 2) {
    // One small stone, warm-toned so it sits in the earth palette rather than
    // reading as a cold speck against the green.
    s.fillRect(9, 3, 2, 1, "#8a8175");
    s.fillRect(9, 4, 2, 1, "#54503f");
  }
  return s;
}

/** Bare earth: packed dirt with small embedded stones. */
function dirtTile(variant = 0) {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, P_DIRT.mid);

  clusters(
    s,
    variant === 1
      ? [[2, 1, 4, 2], [9, 3, 4, 2], [0, 7, 3, 2], [6, 9, 5, 2], [12, 12, 4, 2]]
      : [[0, 2, 3, 2], [7, 0, 4, 2], [11, 5, 5, 2], [3, 8, 4, 2], [9, 11, 4, 2], [0, 13, 4, 2]],
    P_DIRT.dark,
  );
  clusters(s, [[5, 3, 3, 1], [1, 6, 2, 1], [12, 9, 3, 1], [6, 13, 3, 1]], P_DIRT.light);
  clusters(s, [[4, 5, 2, 1], [13, 2, 2, 1], [8, 14, 2, 1]], P_DIRT.deep);

  // Small stones: a lit top edge over a shadowed base, per the global light.
  const stones = variant === 1 ? [[4, 6], [11, 12]] : [[3, 4], [12, 7], [7, 12]];
  for (const [x, y] of stones) {
    s.fillRect(x, y, 2, 1, "#8a8175");
    s.fillRect(x, y + 1, 2, 1, "#3f382c");
  }
  return s;
}

/** Cave floor: cold, dark stone, worn smooth with a few short fractures. */
function caveFloorTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, P_STONE.mid);

  clusters(s, [[1, 1, 4, 2], [8, 2, 5, 2], [3, 6, 4, 2], [11, 8, 4, 2], [0, 11, 4, 2], [7, 13, 5, 2]], P_STONE.dark);
  clusters(s, [[6, 4, 3, 1], [1, 9, 3, 1], [12, 5, 2, 1], [5, 11, 3, 1]], P_STONE.light);

  // Short fractures only. Long diagonals would tile into a visible repeating
  // slash across the whole cave floor.
  for (const [x, y, len] of [[3, 4, 3], [10, 12, 3]]) {
    s.fillRect(x, y, len, 1, P_STONE.deep);
    s.fillRect(x, y - 1, len, 1, P_STONE.light); // lit lip on the upper side
  }
  return s;
}

/** Town cobblestone: irregular blocks with mortar between them. */
function cobbleTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, P_COBBLE.deep); // mortar shows through the gaps

  // Staggered courses, so the seams don't line up into a grid.
  const rows = [
    { y: 0, h: 5, xs: [0, 6, 11] },
    { y: 5, h: 6, xs: [0, 4, 10] },
    { y: 11, h: 5, xs: [0, 7, 12] },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.xs.length; i++) {
      const x = row.xs[i];
      const w = (row.xs[i + 1] ?? 16) - x - 1;
      if (w <= 0) continue;
      s.fillRect(x, row.y, w, row.h - 1, P_COBBLE.mid);
      s.fillRect(x, row.y, w, 1, P_COBBLE.light); // lit top edge
      s.fillRect(x, row.y, 1, row.h - 1, P_COBBLE.light); // lit left edge
      s.fillRect(x + w - 1, row.y, 1, row.h - 1, P_COBBLE.dark); // shaded right
      s.fillRect(x, row.y + row.h - 2, w, 1, P_COBBLE.dark); // shaded bottom
      s.setPixel(x + 1, row.y + 1, P_COBBLE.hi); // upper-left catch light
    }
  }
  s.speckleRect(0, 0, 16, 16, 16, P_COBBLE.dark, 480);
  return s;
}

/** Still water: darker with depth, with a few surface highlights. */
/**
 * One frame of the water cycle. The body of the water never moves — only the
 * ripple crests drift and fade, which is enough to read as a living surface
 * without the ground appearing to slide underneath the player.
 */
function waterTile(frame = 0) {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, P_WATER.mid);

  // Depth pooling in broad bands rather than per-pixel noise. Static across
  // the cycle, so the water keeps its shape.
  clusters(s, [[0, 0, 6, 3], [9, 2, 7, 2], [2, 7, 5, 3], [11, 9, 5, 3], [0, 13, 7, 3]], P_WATER.dark);
  clusters(s, [[3, 1, 3, 1], [12, 3, 3, 1], [4, 8, 3, 1], [13, 10, 3, 1]], P_WATER.deep);

  // Ripple crests: a bright leading edge over a darker trough. Each drifts one
  // pixel per frame and the set wraps, so frame 4 lands back on frame 0.
  const ripples = [
    [2, 4, 5],
    [9, 6, 4],
    [4, 11, 4],
    [10, 14, 5],
  ];
  ripples.forEach(([x, y, w], i) => {
    // Alternate drift direction so the surface churns rather than scrolls.
    const drift = i % 2 === 0 ? frame : WATER_FRAMES - frame;
    const rx = (x + drift) % 16;
    for (let dx = 0; dx < w; dx++) {
      const px = (rx + dx) % 16;
      s.setPixel(px, y, P_WATER.light);
      s.setPixel(px, y + 1, P_WATER.dark);
      if (dx > 0 && dx < w - 1) s.setPixel(px, y - 1, P_WATER.hi);
    }
  });
  return s;
}

const WATER_FRAMES = 4;

// ---------------------------------------------------------------------------
// Trees. Several species rather than one repeated silhouette: a stand of
// woodland should read as a stand, not as one sprite stamped in a grid. All
// share the trunk-plus-canopy construction and the same greens.
// ---------------------------------------------------------------------------

const P_BARK = { deep: "#241609", dark: "#3a2312", mid: "#4a2e18", light: "#5f3d22" };

/** Trunk with a lit left face and roots flaring into the ground shadow. */
function drawTrunk(s, cx, top, bottom, width = 2) {
  const x = cx - Math.floor(width / 2);
  s.fillRect(x, top, width, bottom - top, P_BARK.mid);
  s.fillRect(x, top, 1, bottom - top, P_BARK.light); // lit left face
  s.fillRect(x + width - 1, top, 1, bottom - top, P_BARK.dark); // shaded right
  s.setPixel(x - 1, bottom - 1, P_BARK.dark); // roots
  s.setPixel(x + width, bottom - 1, P_BARK.dark);
  s.fillEllipse(cx, bottom, width + 2, 1, "#1a2412"); // contact shadow
}

/** Broad-canopied oak. Two variants so a wood doesn't repeat every tile. */
function treeOak(variant = 0) {
  const s = new Sprite(16, 16);
  drawTrunk(s, 8, 9, 15);

  // Canopy built from overlapping lobes, deliberately off-centre — a perfect
  // circle is the clearest tell of a procedurally drawn tree.
  const lobes =
    variant === 0
      ? [[8, 6, 6], [6, 5, 4], [11, 6.5, 3.5], [8, 8, 5]]
      : [[8, 6.5, 5.5], [10, 5, 4], [5.5, 6, 3.5], [8, 8, 4.5]];
  for (const [lx, ly, r] of lobes) s.fillCircle(lx, ly, r, P_GRASS.deep);
  for (const [lx, ly, r] of lobes) s.fillCircle(lx - 0.4, ly - 0.4, r - 0.9, "#2f7a3e");
  // Light from the upper left picks out the near-left lobes only.
  s.fillCircle(variant === 0 ? 6 : 6.5, 4.6, 2.4, "#3f9450");
  s.fillCircle(variant === 0 ? 5.6 : 6, 4, 1.2, "#6fc47f");
  // A few dark gaps so the canopy has depth instead of reading as a dome.
  s.setPixel(10, 7, P_GRASS.deep);
  s.setPixel(9, 4, P_GRASS.deep);
  return s;
}

/** Conifer: a tiered spire, unmistakable against the oaks at a glance. */
function treePine() {
  const s = new Sprite(16, 16);
  drawTrunk(s, 8, 11, 15);
  // Three tiers, each wider than the one above.
  const tiers = [
    [1, 3],
    [4, 5],
    [7, 7],
  ];
  for (const [top, span] of tiers) {
    for (let row = 0; row < 3; row++) {
      const half = Math.round(((row + 1) / 3) * span * 0.5);
      s.fillRect(8 - half, top + row, half * 2, 1, "#1f5c2e");
    }
  }
  // Lit left edge of each tier.
  for (const [top, span] of tiers) {
    const half = Math.round(span * 0.5);
    s.setPixel(8 - half, top + 2, "#3f9450");
    s.setPixel(8 - half + 1, top + 2, "#2f7a3e");
  }
  s.setPixel(8, 0, "#3f9450"); // tip
  s.setPixel(8, 1, "#2f7a3e");
  return s;
}

/** Dead tree: bare branching silhouette, for the mountain and cave approaches. */
function treeDead() {
  const s = new Sprite(16, 16);
  drawTrunk(s, 8, 5, 15, 2);
  // Branches: each is a short diagonal with a lit upper-left pixel.
  for (const [x0, y0, x1, y1] of [
    [7, 8, 3, 5],
    [9, 7, 13, 4],
    [7, 5, 5, 2],
    [9, 4, 11, 1],
  ]) {
    s.line(x0, y0, x1, y1, P_BARK.mid);
    s.setPixel(x1, y1, P_BARK.light);
  }
  s.setPixel(3, 4, P_BARK.dark); // twig ends
  s.setPixel(13, 3, P_BARK.dark);
  return s;
}

// ---------------------------------------------------------------------------
// Rocks. A size range plus a mossy variant, so stony ground can be composed
// rather than tiled.
// ---------------------------------------------------------------------------

/** Shared rock body: a lit top-left plane over a shadowed lower-right face. */
function rockBody(s, cx, cy, rx, ry, moss = false) {
  s.fillEllipse(cx, cy + ry - 0.4, rx + 0.6, 1, "#14110f"); // ground shadow
  s.fillEllipse(cx, cy, rx, ry, P_STONE.dark);
  s.fillEllipse(cx - 0.3, cy - 0.3, rx - 0.6, ry - 0.6, P_STONE.mid);
  s.fillEllipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.45, ry * 0.4, P_STONE.light);
  s.setPixel(Math.round(cx - rx * 0.5), Math.round(cy - ry * 0.55), P_STONE.hi);
  // A crack running down the shaded face gives the stone a plane to read.
  s.setPixel(Math.round(cx + rx * 0.3), Math.round(cy), P_STONE.deep);
  s.setPixel(Math.round(cx + rx * 0.2), Math.round(cy + ry * 0.4), P_STONE.deep);
  if (moss) {
    s.fillEllipse(cx - rx * 0.2, cy - ry * 0.5, rx * 0.5, ry * 0.3, "#2f6b38");
    s.setPixel(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.6), "#4a8f52");
  }
}

function rockSmall() {
  const s = new Sprite(16, 16);
  rockBody(s, 8, 12, 2.6, 1.8);
  return s;
}

function rockMedium() {
  const s = new Sprite(16, 16);
  rockBody(s, 8, 10.5, 4, 3);
  return s;
}

function rockLarge() {
  const s = new Sprite(16, 16);
  rockBody(s, 8, 9, 5.5, 4.4);
  return s;
}

function rockMossy() {
  const s = new Sprite(16, 16);
  rockBody(s, 8, 10, 4.6, 3.6, true);
  return s;
}

/** Mortared block wall — the built walls of houses and the cave. */
function stoneWallTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, P_STONE.deep); // mortar

  // Two staggered courses of blocks.
  const courses = [
    { y: 0, h: 8, offset: 0 },
    { y: 8, h: 8, offset: 4 },
  ];
  for (const course of courses) {
    for (let x = -course.offset; x < 16; x += 8) {
      const bx = Math.max(0, x);
      // Clamp to the tile edge, not to one block width — clamping to 8 left
      // the right-hand half of every tile as bare mortar.
      const bw = Math.min(16, x + 8) - bx - 1;
      if (bw <= 0) continue;
      s.fillRect(bx, course.y, bw, course.h - 1, P_STONE.mid);
      s.fillRect(bx, course.y, bw, 1, P_STONE.hi); // top plane, lit
      s.fillRect(bx, course.y, 1, course.h - 1, P_STONE.light);
      s.fillRect(bx + bw - 1, course.y, 1, course.h - 1, P_STONE.dark);
      s.fillRect(bx, course.y + course.h - 2, bw, 1, P_STONE.dark);
    }
  }
  clusters(s, [[2, 2, 3, 1], [10, 3, 3, 1], [5, 10, 3, 1], [12, 11, 3, 1]], P_STONE.dark);
  return s;
}

/** Rocky mountain ground: dry earth with stone breaking through. */
function rockyGroundTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#574c42");
  clusters(s, [[0, 0, 5, 2], [7, 3, 4, 2], [12, 0, 4, 2], [1, 7, 3, 2], [10, 13, 5, 2], [6, 8, 3, 1]], "#463d35");
  clusters(s, [[6, 1, 3, 1], [2, 6, 3, 1], [11, 9, 3, 1], [4, 14, 3, 1]], "#6b5f52");

  // Embedded stones, each with a lit top-left and a shadow to the lower right.
  for (const [x, y, w, h] of [[1, 2, 5, 4], [9, 5, 5, 4], [4, 10, 6, 4]]) {
    s.fillRect(x, y, w, h, P_STONE.mid);
    s.fillRect(x, y, w, 1, P_STONE.light);
    s.fillRect(x, y, 1, h, P_STONE.light);
    s.fillRect(x + w - 1, y, 1, h, P_STONE.dark);
    s.fillRect(x, y + h - 1, w, 1, "#2f2a26"); // contact shadow
    s.setPixel(x + 1, y + 1, P_STONE.hi);
  }
  return s;
}

function voidWallTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#1c1c20");
  s.speckle(25, "#26262c", 111);
  return s;
}

/** A rocky mountain-peak tile: fills most of the tile, meant to tile as a blocking wall. */
function mountainTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#4a4550");
  s.speckle(30, "#3a3640", 201);
  // jagged peak silhouette via overlapping triangles (approximated with lines+fills)
  for (let x = 0; x < 16; x++) {
    const peakHeight = 3 + Math.round(3 * Math.abs(Math.sin(x * 0.7 + 1)));
    s.fillRect(x, 0, 1, peakHeight, "#5c5666");
  }
  s.speckle(10, "#e8e8ee", 202); // snow flecks near the top
  s.fillRect(0, 14, 16, 2, "#2c2832");
  return s;
}

/** A worn travel path, distinct from raw dirt — lighter, more uniform, with faint wheel-rut lines. */
function roadTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#8a7860");
  s.speckle(50, "#7d6c56", 301);
  s.speckle(20, "#96856c", 302);
  s.fillRect(3, 0, 1, 16, "#7d6c56");
  s.fillRect(12, 0, 1, 16, "#7d6c56");
  return s;
}

// ---------------------------------------------------------------------------
// Environment props (standalone, transparent, collidable decoration)
// ---------------------------------------------------------------------------

function treeSprite() {
  const s = new Sprite(16, 16);
  // trunk
  s.fillRect(7, 10, 2, 5, "#4a2e18");
  s.fillRect(7, 10, 1, 5, "#3a2312");
  // foliage: layered circles for a rounded canopy with shading
  s.fillCircle(8, 7, 6, "#1f5c2e");
  s.fillCircle(8, 6, 5.4, "#2f7a3e");
  s.fillCircle(6.5, 5, 3, "#3f9450");
  s.fillCircle(6, 4.3, 1.4, "#6fc47f");
  return s;
}

function bushSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 11, 6, 3, "#193d1f");
  s.fillEllipse(8, 10, 5.6, 3.6, "#2f6b38");
  s.fillEllipse(6.5, 9, 3, 2.2, "#4a8f52");
  s.fillEllipse(6, 8.4, 1.3, 0.9, "#79c283");
  return s;
}

function boulderSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 12.5, 6, 1.6, "#14110f"); // ground shadow
  s.fillEllipse(8, 9, 5.5, 4.4, "#4a4650");
  s.fillEllipse(8, 8.3, 5, 3.9, "#5c5762");
  s.fillEllipse(6.3, 6.7, 2.4, 1.7, "#7a7480");
  s.fillEllipse(5.6, 6.2, 1, 0.6, "#a29cac");
  return s;
}

function signpostSprite() {
  const s = new Sprite(16, 16);
  s.fillRect(7, 6, 2, 8, "#4a2e18");
  s.fillRect(7, 6, 1, 8, "#3a2312");
  s.fillRect(2, 3, 12, 5, "#8a6a3d");
  s.fillRect(2, 3, 12, 1, "#a3814f");
  s.fillRect(2, 7, 12, 1, "#5a3d22");
  s.line(4, 5, 10, 5, "#5a3d22");
  return s;
}

/** A stacked wooden barrel — town-yard clutter outside shops. */
function barrelSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 13.5, 5, 1.4, "#14110f"); // ground shadow
  s.fillRect(4, 5, 8, 8, "#7a5230");
  s.fillRect(4, 5, 8, 1, "#8a6038");
  s.fillRect(3, 6, 10, 1, "#4a2f1a"); // top hoop
  s.fillRect(3, 11, 10, 1, "#4a2f1a"); // bottom hoop
  s.fillRect(4, 5, 1, 8, "#5c3c22");
  s.fillRect(11, 5, 1, 8, "#5c3c22");
  s.fillRect(6, 6, 2, 6, "#8f6338");
  return s;
}

/** A crated shipment — flat wooden slats, town-yard clutter outside shops. */
function crateSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 13.5, 5.4, 1.4, "#14110f"); // ground shadow
  s.fillRect(3, 6, 10, 7, "#8a6a3d");
  s.fillRect(3, 6, 10, 1, "#a3814f");
  s.fillRect(3, 6, 1, 7, "#5a3d22");
  s.fillRect(12, 6, 1, 7, "#5a3d22");
  s.line(3, 9, 13, 9, "#5a3d22");
  s.line(3, 6, 8, 13, "#6b4a2a");
  s.line(13, 6, 8, 13, "#6b4a2a");
  return s;
}

// ---------------------------------------------------------------------------
// Prop library. These are the pieces a location is composed from: a mine reads
// as a mine because of the carts and crates around it, not because the ground
// is a different colour.
// ---------------------------------------------------------------------------

/** Post-and-rail fence, for yards and paddocks. */
function fenceSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(3, 14, 1.6, 0.8, "#14110f");
  s.fillEllipse(12, 14, 1.6, 0.8, "#14110f");
  for (const x of [2, 11]) {
    s.fillRect(x, 5, 2, 9, P_BARK.mid);
    s.fillRect(x, 5, 1, 9, P_BARK.light);
    s.fillRect(x, 5, 2, 1, "#6b4a2a"); // cut top
  }
  for (const y of [7, 11]) {
    s.fillRect(0, y, 16, 1, "#6b4a2a");
    s.fillRect(0, y + 1, 16, 1, P_BARK.dark);
  }
  return s;
}

/** Plank bench. */
function benchSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 5, 1, "#14110f");
  s.fillRect(3, 12, 2, 2, P_BARK.dark); // legs
  s.fillRect(11, 12, 2, 2, P_BARK.dark);
  s.fillRect(2, 9, 12, 3, "#8a6a3d"); // seat
  s.fillRect(2, 9, 12, 1, "#a3814f");
  s.fillRect(2, 11, 12, 1, "#5a3d22");
  s.fillRect(2, 5, 1, 5, P_BARK.mid); // back uprights
  s.fillRect(13, 5, 1, 5, P_BARK.mid);
  s.fillRect(2, 5, 12, 2, "#8a6a3d"); // backrest
  s.fillRect(2, 5, 12, 1, "#a3814f");
  return s;
}

/** Hand cart, tipped forward on its handles — mine and market dressing. */
function cartSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 6, 1, "#14110f");
  s.fillRect(2, 6, 12, 6, "#7a5230"); // body
  s.fillRect(2, 6, 12, 1, "#96683c");
  s.fillRect(2, 6, 1, 6, "#5c3c22");
  s.fillRect(13, 6, 1, 6, "#4a2f1a");
  s.fillRect(3, 8, 10, 1, "#5a3d22"); // plank seams
  s.fillRect(3, 10, 10, 1, "#5a3d22");
  s.fillCircle(5, 13, 2.2, "#3a2312"); // wheels
  s.fillCircle(5, 13, 1.2, "#5f3d22");
  s.fillCircle(11, 13, 2.2, "#3a2312");
  s.fillCircle(11, 13, 1.2, "#5f3d22");
  s.fillRect(0, 4, 3, 1, "#6b4a2a"); // handle
  return s;
}

/** Campfire: stone ring, logs, flame. The warmest thing in a dark scene. */
function campfireSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 13, 6, 2, "#14110f");
  // Stone ring
  for (const [x, y] of [[2, 11], [5, 13], [9, 13], [12, 11], [3, 9], [12, 9]]) {
    s.fillRect(x, y, 3, 2, P_STONE.mid);
    s.fillRect(x, y, 3, 1, P_STONE.light);
  }
  // Crossed logs
  s.line(4, 12, 11, 9, P_BARK.mid);
  s.line(4, 9, 11, 12, P_BARK.dark);
  // Flame: hot core, cooler edges
  s.fillEllipse(8, 8, 2.6, 3.4, "#8a3410");
  s.fillEllipse(8, 8.6, 1.8, 2.6, "#c95a1e");
  s.fillEllipse(8, 9.2, 1, 1.6, "#e8862f");
  s.setPixel(8, 10, "#ffe08a");
  s.setPixel(8, 4, "#c95a1e"); // tip
  s.setPixel(7, 5, "#8a3410");
  return s;
}

/** Standing torch on a post — lights dungeon walls and town roads. */
function torchSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 2.4, 1, "#14110f");
  s.fillRect(7, 6, 2, 8, P_BARK.mid);
  s.fillRect(7, 6, 1, 8, P_BARK.light);
  s.fillRect(6, 5, 4, 2, "#3a3640"); // iron cage
  s.fillEllipse(8, 3.6, 2.2, 2.8, "#8a3410");
  s.fillEllipse(8, 4, 1.4, 2, "#e8862f");
  s.setPixel(8, 4, "#ffe08a");
  s.setPixel(8, 1, "#c95a1e");
  return s;
}

/** Weathered gravestone. */
function gravestoneSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 4, 1, "#14110f");
  s.fillRect(5, 4, 6, 10, P_STONE.mid);
  s.fillCircle(8, 4, 3, P_STONE.mid); // rounded top
  s.fillRect(5, 4, 2, 10, P_STONE.light);
  s.fillCircle(7, 3.6, 2.2, P_STONE.light);
  s.fillRect(10, 4, 1, 10, P_STONE.dark);
  s.fillRect(6, 6, 4, 1, P_STONE.deep); // worn inscription
  s.fillRect(6, 8, 3, 1, P_STONE.deep);
  s.fillRect(4, 13, 8, 2, P_STONE.dark); // base
  s.fillRect(4, 13, 8, 1, P_STONE.hi);
  s.setPixel(11, 12, "#2f6b38"); // moss creeping up the shaded side
  s.setPixel(11, 11, "#2f6b38");
  return s;
}

/** Banded treasure chest. */
function chestSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 5.5, 1, "#14110f");
  s.fillRect(2, 8, 12, 6, "#7a5230"); // body
  s.fillRect(2, 8, 12, 1, "#96683c");
  s.fillRect(2, 8, 1, 6, "#5c3c22");
  s.fillRect(13, 8, 1, 6, "#4a2f1a");
  s.fillRect(2, 4, 12, 4, "#8a6a3d"); // domed lid
  s.fillRect(3, 3, 10, 1, "#a3814f");
  s.fillRect(2, 7, 12, 1, "#4a2f1a"); // lid seam
  for (const x of [4, 11]) {
    s.fillRect(x, 3, 1, 11, "#8a6a1a"); // iron bands
    s.fillRect(x, 3, 1, 5, "#c9a24a");
  }
  s.fillRect(7, 7, 2, 3, "#c9a24a"); // lock plate
  s.setPixel(8, 8, "#3a2312");
  return s;
}

/** Tied sack of grain. */
function sackSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 4.5, 1, "#14110f");
  s.fillEllipse(8, 10.5, 4.4, 3.6, "#9a8670");
  s.fillEllipse(7.2, 9.8, 3.4, 2.8, "#b8a58c");
  s.fillEllipse(6.4, 9, 1.4, 1, "#cbbca6");
  s.fillRect(6, 5, 4, 3, "#8a7860"); // gathered neck
  s.fillRect(6, 6, 4, 1, "#6b5a48"); // cord
  s.setPixel(5, 6, "#4a2f1a");
  return s;
}

/** Weapon rack — dresses the forge yard. */
function weaponRackSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 5, 1, "#14110f");
  s.fillRect(2, 4, 2, 10, P_BARK.mid);
  s.fillRect(12, 4, 2, 10, P_BARK.mid);
  s.fillRect(2, 4, 1, 10, P_BARK.light);
  s.fillRect(1, 4, 14, 2, "#6b4a2a"); // crossbar
  s.fillRect(1, 4, 14, 1, "#8a6a3d");
  // Two blades and a haft leaning in the rack.
  s.fillRect(5, 6, 1, 7, "#c9ccd1");
  s.fillRect(5, 12, 1, 2, "#5a3d22");
  s.fillRect(8, 6, 1, 8, "#9aa0a8");
  s.fillRect(10, 6, 1, 8, "#5a3d22");
  s.fillRect(9, 6, 3, 2, "#c9ccd1"); // axe head
  return s;
}

/** Cut stump with visible rings — forest storytelling. */
function stumpSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 13.5, 4.5, 1.2, "#14110f");
  s.fillRect(5, 9, 6, 4, P_BARK.mid);
  s.fillRect(5, 9, 1, 4, P_BARK.light);
  s.fillRect(10, 9, 1, 4, P_BARK.dark);
  s.fillEllipse(8, 9, 3.4, 1.8, "#7a5230"); // cut face
  s.fillEllipse(8, 9, 2.2, 1.1, "#96683c");
  s.fillEllipse(8, 9, 1, 0.5, "#7a5230"); // rings
  s.setPixel(4, 12, P_BARK.dark); // roots
  s.setPixel(11, 12, P_BARK.dark);
  return s;
}

/** A small cluster of mushrooms. */
function mushroomsSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 13.5, 4, 1, "#14110f");
  for (const [x, y, r, cap] of [
    [6, 10, 2.4, "#a8402f"],
    [10, 11, 1.8, "#8a3428"],
    [8, 12, 1.4, "#a8402f"],
  ]) {
    s.fillRect(x - 1, y, 2, 3, "#cbbca6"); // stalk
    s.fillEllipse(x, y, r, r * 0.7, cap);
    s.fillEllipse(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.3, "#c26a55");
    s.setPixel(x + 1, y, "#e0dcc2"); // spots
  }
  return s;
}

/** A patch of wildflowers, for meadow variety. */
function flowersSprite() {
  const s = new Sprite(16, 16);
  for (const [x, y, colour] of [
    [4, 9, "#c9b86a"],
    [8, 7, "#c47a8a"],
    [11, 10, "#8a9ac4"],
    [6, 12, "#c9b86a"],
  ]) {
    s.fillRect(x, y + 1, 1, 3, "#2f6b38"); // stem
    s.setPixel(x, y, colour);
    s.setPixel(x - 1, y, "#4a8f52");
    s.setPixel(x + 1, y, "#4a8f52");
  }
  return s;
}

// ---------------------------------------------------------------------------
// Combat and magic effects. Small, short-lived, and drawn in the same pixel
// language as everything else — a smooth glow would read as belonging to a
// different game.
// ---------------------------------------------------------------------------

/** White impact star for a landed melee hit. */
function hitSparkSprite() {
  const s = new Sprite(16, 16);
  s.fillRect(7, 3, 2, 10, "#ffffff");
  s.fillRect(3, 7, 10, 2, "#ffffff");
  s.line(4, 4, 12, 12, "#e8e8ee");
  s.line(12, 4, 4, 12, "#e8e8ee");
  s.fillRect(6, 6, 4, 4, "#ffffff");
  return s;
}

/** Blood spatter, thrown to the lower right like every other shadow. */
function bloodSprite() {
  const s = new Sprite(16, 16);
  for (const [x, y, r] of [[7, 7, 2.4], [10, 9, 1.4], [5, 10, 1], [12, 6, 0.8]]) {
    s.fillCircle(x, y, r, "#8a1a14");
  }
  s.fillCircle(6.6, 6.4, 1.2, "#c9302f");
  return s;
}

/** Dust puff kicked up on impact or landing. */
function dustSprite() {
  const s = new Sprite(16, 16);
  for (const [x, y, r] of [[6, 9, 2.6], [10, 8, 2], [8, 11, 1.6]]) {
    s.fillCircle(x, y, r, "#8a8175");
  }
  s.fillCircle(5.6, 8.4, 1.4, "#b0a698");
  return s;
}

/** Arcane mote for spell impacts and level-ups. */
function sparkleSprite() {
  const s = new Sprite(16, 16);
  s.fillRect(7, 2, 2, 12, "#d9b8ff");
  s.fillRect(2, 7, 12, 2, "#d9b8ff");
  s.fillRect(6, 6, 4, 4, "#f0e2ff");
  s.setPixel(4, 4, "#8a5cc9");
  s.setPixel(11, 11, "#8a5cc9");
  return s;
}

/** A small stone plaza well — the town's centerpiece. */
function wellSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 13, 6, 1.6, "#14110f"); // ground shadow
  s.fillEllipse(8, 9.5, 6, 4.2, "#5c5762"); // stone ring, back
  s.fillEllipse(8, 8.6, 5.4, 3.6, "#726c78");
  s.fillEllipse(8, 8.2, 4.2, 2.6, "#1c2b30"); // dark water
  s.fillEllipse(6.6, 7.6, 1.2, 0.7, "#3d5a63"); // water glint
  s.fillRect(3, 3, 1, 6, "#4a2e18"); // support posts
  s.fillRect(12, 3, 1, 6, "#4a2e18");
  s.fillRect(2, 2, 12, 1, "#5a3d22"); // roof beam
  s.fillRect(3, 1, 10, 1, "#6b4a2a"); // roof cap
  return s;
}

// ---------------------------------------------------------------------------
// Player and troll — original directional sheets, drawn at the same pixel
// density as everything else here (16px-grid art doubled to 32px tiles).
//
// Sheet layout must match DIRECTION_ORDER in src/game/directionalSprite.ts:
// three frames per direction, in the order down, left, right, up. Frame 0 is
// idle; frames 1 and 2 are the alternating walk steps.
// ---------------------------------------------------------------------------

const PC = {
  skinHi: "#e0a877",
  skin: "#c98a5c",
  skinDark: "#a06b42",
  hair: "#7a4a22",
  hairHi: "#96612e",
  tunicHi: "#d4614a",
  tunic: "#b8442f",
  tunicDark: "#8a2f20",
  belt: "#4a2f1a",
  gold: "#e6c34a",
  legs: "#4a3d5a",
  legsDark: "#362c42",
  boot: "#3a2717",
  eye: "#1a1a1e",
};

/** Ground contact shadow shared by every character frame. */
function footShadow(s, cx, y, rx) {
  s.fillEllipse(cx, y, rx, 1, "#1a2412");
}

/**
 * One player frame. The palette is deliberately the warmest thing on screen:
 * against green grass and grey stone the player stays the easiest figure to
 * find, which matters more than costume detail at this size.
 */
function playerFrame(direction, pose) {
  const s = new Sprite(16, 16);
  const facingSide = direction === "left" || direction === "right";
  const back = direction === "up";

  footShadow(s, 8, 15, 4);

  // --- Legs: the walk cycle lives here, not in a whole-sprite bob ---
  const legY = 11;
  const legs = facingSide
    ? { near: 6, far: 8 } // profile: one leg in front of the other
    : { near: 5, far: 9 };
  // Boots stop at row 14 so the contact shadow on row 15 stays visible —
  // without it the character reads as hovering rather than standing.
  if (pose === "idle") {
    for (const x of [legs.near, legs.far]) {
      s.fillRect(x, legY, 2, 2, PC.legs);
      s.fillRect(x, legY + 2, 2, 2, PC.boot);
    }
    s.fillRect(legs.far, legY, 1, 2, PC.legsDark); // shaded inner edge
  } else {
    const lead = pose === "stepA" ? legs.near : legs.far;
    const trail = pose === "stepA" ? legs.far : legs.near;
    // Leading leg reaches down and plants, toe extended forward.
    s.fillRect(lead, legY, 2, 2, PC.legs);
    s.fillRect(lead - (facingSide && direction === "right" ? 0 : 1), legY + 2, 3, 2, PC.boot);
    // Trailing leg is lifted, so it's shorter and sits in shadow.
    s.fillRect(trail, legY, 2, 1, PC.legsDark);
    s.fillRect(trail, legY + 1, 2, 2, PC.boot);
  }

  // --- Torso: wide at the shoulders, tapering to the belt ---
  const bodyX = facingSide ? 5 : 4;
  const bodyW = facingSide ? 6 : 8;
  s.fillRect(bodyX, 6, bodyW, 1, PC.tunicHi); // lit shoulder line
  s.fillRect(bodyX, 7, bodyW, 2, PC.tunic);
  s.fillRect(bodyX + 1, 9, bodyW - 2, 1, PC.tunic); // taper toward the waist
  s.fillRect(bodyX, 7, 1, 2, PC.tunicHi); // lit left flank
  s.fillRect(bodyX + bodyW - 1, 7, 1, 2, PC.tunicDark); // shaded right flank
  s.fillRect(bodyX + 1, 10, bodyW - 2, 1, PC.belt);
  if (!facingSide && !back) s.setPixel(8, 10, PC.gold); // buckle, front view only

  // --- Arms: swing opposite the legs, and stay clear of the torso ---
  const swing = pose === "idle" ? 0 : pose === "stepA" ? 1 : -1;
  if (facingSide) {
    // In profile only the near arm reads; it swings fore and aft.
    const ax = pose === "stepA" ? 10 : pose === "stepB" ? 4 : 9;
    s.fillRect(ax, 7, 2, 3, PC.tunicDark);
    s.fillRect(ax, 10, 2, 1, PC.skin); // hand
  } else {
    const leftY = 7 + Math.max(0, swing);
    const rightY = 7 + Math.max(0, -swing);
    s.fillRect(3, leftY, 1, 3, PC.tunicHi);
    s.setPixel(3, leftY + 3, PC.skin);
    s.fillRect(12, rightY, 1, 3, PC.tunicDark);
    s.setPixel(12, rightY + 3, PC.skinDark);
  }

  // --- Neck: one pixel of separation is what stops the head reading as a box ---
  s.fillRect(7, 5, 2, 1, PC.skinDark);

  // --- Head ---
  const headX = facingSide ? (direction === "right" ? 6 : 5) : 5;
  s.fillRect(headX, 1, 6, 4, PC.skin);
  s.fillRect(headX + 1, 1, 4, 1, PC.skinHi); // lit crown
  s.fillRect(headX + 5, 2, 1, 3, PC.skinDark); // shaded right cheek

  if (back) {
    // From behind, hair covers the whole skull — no face to read.
    s.fillRect(headX, 1, 6, 4, PC.hair);
    s.fillRect(headX + 1, 1, 4, 1, PC.hairHi);
    s.fillRect(headX, 4, 6, 1, PC.hair);
  } else if (facingSide) {
    s.fillRect(headX, 1, 6, 2, PC.hair); // fringe
    s.fillRect(headX + 1, 1, 3, 1, PC.hairHi);
    s.fillRect(headX + 4, 1, 2, 4, PC.hair); // hair down the back of the head
    s.setPixel(headX + 1, 3, PC.eye);
    s.setPixel(headX, 3, PC.skinHi); // brow/nose catching the light
  } else {
    s.fillRect(headX, 1, 6, 2, PC.hair);
    s.fillRect(headX + 1, 1, 3, 1, PC.hairHi);
    s.setPixel(headX, 2, PC.hair); // sideburns
    s.setPixel(headX + 5, 2, PC.hair);
    s.setPixel(headX + 1, 3, PC.eye);
    s.setPixel(headX + 4, 3, PC.eye);
    s.fillRect(headX + 2, 4, 2, 1, PC.skinDark); // mouth
  }

  return direction === "left" ? s.flippedHorizontal() : s;
}

const TROLL = {
  skinHi: "#8a9a63",
  skin: "#6b7a4a",
  skinDark: "#4f5c36",
  skinDeep: "#3a4527",
  belly: "#9aa47a",
  tusk: "#e0dcc2",
  claw: "#c9c2a4",
  eye: "#c93a2f",
  cloth: "#6b4a2a",
  clothDark: "#4a2f1a",
};

/**
 * One troll frame. Silhouette first: a hunched brute, wider at the shoulders
 * than it is tall in the legs, so it reads as heavy even before any detail.
 */
function trollFrame(direction, pose) {
  const s = new Sprite(20, 26);
  const facingSide = direction === "left" || direction === "right";
  const back = direction === "up";

  s.fillEllipse(10, 25, 6, 1.4, "#1a2412");

  // --- Legs: short, thick, planted wide ---
  const legY = 19;
  if (pose === "idle") {
    s.fillRect(5, legY, 4, 5, TROLL.skin);
    s.fillRect(11, legY, 4, 5, TROLL.skinDark);
    s.fillRect(5, legY, 1, 5, TROLL.skinHi); // lit outer edge keeps legs off the shadow
    s.fillRect(4, legY + 4, 5, 2, TROLL.skinDark); // splayed feet
    s.fillRect(11, legY + 4, 5, 2, TROLL.skinDeep);
  } else {
    const lead = pose === "stepA" ? 5 : 11;
    const trail = pose === "stepA" ? 11 : 5;
    s.fillRect(lead, legY, 4, 5, TROLL.skinDark);
    s.fillRect(lead - 1, legY + 4, 6, 2, TROLL.skinDeep);
    s.fillRect(trail, legY, 4, 3, TROLL.skinDeep);
    s.fillRect(trail, legY + 3, 4, 2, TROLL.skinDeep);
  }

  // --- Loincloth ---
  s.fillRect(5, 17, 10, 3, TROLL.cloth);
  s.fillRect(5, 17, 10, 1, "#82603a");
  s.fillRect(5, 19, 10, 1, TROLL.clothDark);

  // --- Torso: broad, sloping shoulders ---
  s.fillRect(4, 9, 12, 8, TROLL.skin);
  s.fillRect(4, 9, 2, 8, TROLL.skinHi); // lit left flank
  s.fillRect(14, 9, 2, 8, TROLL.skinDark); // shaded right flank
  s.fillRect(5, 8, 10, 1, TROLL.skinHi); // shoulder highlight
  if (!back) {
    s.fillRect(7, 12, 6, 5, TROLL.belly);
    s.fillRect(7, 12, 6, 1, TROLL.skinHi);
  }

  // --- Arms: long, hanging below the waist ---
  const swing = pose === "idle" ? 0 : pose === "stepA" ? 1 : -1;
  const leftArmY = 10 + Math.max(0, swing);
  const rightArmY = 10 + Math.max(0, -swing);
  s.fillRect(1, leftArmY, 3, 8, TROLL.skin);
  s.fillRect(1, leftArmY, 1, 8, TROLL.skinHi);
  s.fillRect(1, leftArmY + 8, 3, 2, TROLL.skinDark); // fist
  s.fillRect(16, rightArmY, 3, 8, TROLL.skinDark);
  s.fillRect(16, rightArmY + 8, 3, 2, TROLL.skinDeep);
  if (!back) {
    // Claws sit on the lower edge of each fist. Drawn detached they read as
    // stray pixels, so they stay attached to the silhouette.
    s.setPixel(1, leftArmY + 9, TROLL.claw);
    s.setPixel(3, leftArmY + 9, TROLL.claw);
    s.setPixel(16, rightArmY + 9, TROLL.claw);
    s.setPixel(18, rightArmY + 9, TROLL.claw);
  }

  // --- Head: big, low-slung, no real neck ---
  s.fillRect(6, 2, 8, 7, TROLL.skin);
  s.fillRect(6, 2, 8, 1, TROLL.skinHi);
  s.fillRect(6, 2, 1, 7, TROLL.skinHi);
  s.fillRect(13, 2, 1, 7, TROLL.skinDark);
  s.fillRect(5, 4, 1, 3, TROLL.skinDark); // ears
  s.fillRect(14, 4, 1, 3, TROLL.skinDark);

  if (back) {
    s.fillRect(6, 2, 8, 7, TROLL.skin);
    s.fillRect(6, 2, 8, 1, TROLL.skinHi);
    s.speckleRect(7, 3, 6, 5, 6, TROLL.skinDark, 55); // matted hide
  } else if (facingSide) {
    s.fillRect(13, 4, 3, 3, TROLL.skin); // snout pushed forward
    s.fillRect(13, 4, 3, 1, TROLL.skinHi);
    s.setPixel(11, 5, TROLL.eye);
    s.setPixel(14, 7, TROLL.tusk); // single visible tusk
  } else {
    s.fillRect(8, 6, 4, 2, TROLL.skinDark); // heavy brow over the muzzle
    s.setPixel(8, 5, TROLL.eye);
    s.setPixel(11, 5, TROLL.eye);
    s.setPixel(8, 8, TROLL.tusk); // tusks jutting up from the lower jaw
    s.setPixel(11, 8, TROLL.tusk);
  }

  return direction === "left" ? s.flippedHorizontal() : s;
}

/** Assemble a 4-direction x 3-frame sheet in DIRECTION_ORDER. */
function directionalFrames(makeFrame) {
  const frames = [];
  for (const direction of ["down", "left", "right", "up"]) {
    for (const pose of ["idle", "stepA", "stepB"]) frames.push(makeFrame(direction, pose));
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Buildings — original designs replacing the imported house art, which had a
// different pixel density and palette from everything else here.
//
// Perspective: top-down, not flat-on and not isometric. The roof is seen from
// above and fills most of the sprite; a band of front wall below it carries the
// door and windows so the building reads as having height. Light comes from the
// upper left throughout, so roofs and walls are brighter on their left side and
// the contact shadow falls to the lower right.
//
// Scale: 48x56 source -> 96x112 at SCALE 2. The bottom 96px covers the 3x3-tile
// footprint; the extra 16px is roof rising above it, which the bottom-right
// sprite anchor turns into the up-and-left lean the rest of the world uses.
// ---------------------------------------------------------------------------

const BUILDING_W = 48;
const BUILDING_H = 56;

// Roof and wall palettes, related to the wood/stone families used elsewhere.
const ROOF_CLAY = { dark: "#4a2018", mid: "#7a3428", light: "#9c4535", hi: "#b85a45" };
const ROOF_SLATE = { dark: "#2c2832", mid: "#454150", light: "#5c5762", hi: "#726c78" };
const ROOF_THATCH = { dark: "#5a3d22", mid: "#8a6a3d", light: "#a3814f", hi: "#c2a068" };

const WALL_PLASTER = { dark: "#6b5a48", mid: "#9a8670", light: "#b8a58c", trim: "#4a2f1a" };
const WALL_STONE = { dark: "#3a3640", mid: "#615c6b", light: "#7d7887", trim: "#2c2832" };

const DOOR_WOOD = { dark: "#3a2312", mid: "#5a3d22", light: "#6b4a2a" };
const GLASS = { dark: "#1c2530", sheen: "#2f3d4a" };

/**
 * Shared building construction. Every house in the world is drawn by this so
 * they read as one settlement; the role details on top are what tell them apart.
 */
function buildingBase({ roof, wall, ridgeY = 3, eaveY = 28, wallY = 30, foundationY = 45 }) {
  const s = new Sprite(BUILDING_W, BUILDING_H);
  const groundY = 52;

  // --- Ground contact shadow, thrown to the lower right ---
  s.fillRect(4, groundY, BUILDING_W - 6, 2, "#14110f");
  s.fillRect(6, groundY + 2, BUILDING_W - 8, 1, "#1a1712");

  // --- Foundation: irregular stone course the walls sit on ---
  s.fillRect(3, foundationY, BUILDING_W - 6, groundY - foundationY, WALL_STONE.dark);
  for (let x = 4; x < BUILDING_W - 6; x += 7) {
    s.fillRect(x, foundationY + 1, 5, 3, WALL_STONE.mid);
    s.fillRect(x, foundationY + 1, 5, 1, WALL_STONE.light); // top plane catches the light
  }

  // --- Front wall ---
  s.fillRect(3, wallY, BUILDING_W - 6, foundationY - wallY, wall.mid);
  s.fillRect(3, wallY, 2, foundationY - wallY, wall.light); // lit left edge
  s.fillRect(BUILDING_W - 5, wallY, 2, foundationY - wallY, wall.dark); // shaded right edge
  s.speckleRect(5, wallY + 2, BUILDING_W - 12, foundationY - wallY - 3, 26, wall.dark, 71);
  s.speckleRect(5, wallY + 2, BUILDING_W - 12, foundationY - wallY - 3, 14, wall.light, 72);

  // --- Eaves: the roof overhangs, casting a hard line onto the wall below ---
  s.fillRect(1, eaveY, BUILDING_W - 2, 2, roof.dark);
  s.fillRect(3, wallY, BUILDING_W - 6, 1, "#1a1512");

  // --- Roof, seen from above: courses of tiles running left to right ---
  s.fillRect(2, ridgeY, BUILDING_W - 4, eaveY - ridgeY, roof.mid);
  for (let y = ridgeY + 3; y < eaveY; y += 4) {
    s.line(2, y, BUILDING_W - 3, y, roof.dark); // course seam
    s.line(2, y + 1, BUILDING_W - 3, y + 1, roof.light); // lit lip of the next course
  }
  // Staggered vertical seams between individual tiles.
  for (let y = ridgeY; y < eaveY; y += 4) {
    for (let x = 4 + ((y / 4) % 2) * 4; x < BUILDING_W - 4; x += 8) {
      s.setPixel(x, y + 2, roof.dark);
      s.setPixel(x, y + 3, roof.dark);
    }
  }
  // Light falls from the upper left: brighten that corner, deepen the far right.
  s.fillRect(2, ridgeY, 10, eaveY - ridgeY, roof.light);
  for (let y = ridgeY + 3; y < eaveY; y += 4) s.line(2, y, 11, y, roof.mid);
  s.fillRect(BUILDING_W - 8, ridgeY, 6, eaveY - ridgeY, roof.dark);

  // --- Ridge cap along the top edge ---
  s.fillRect(2, ridgeY - 1, BUILDING_W - 4, 2, roof.dark);
  s.fillRect(3, ridgeY - 1, BUILDING_W - 10, 1, roof.hi);

  return s;
}

/** A panelled door with a frame and handle, centred on `cx`. */
function drawDoor(s, cx, top, bottom) {
  const w = 10;
  const x = cx - w / 2;
  s.fillRect(x - 1, top - 1, w + 2, bottom - top + 2, DOOR_WOOD.dark); // frame
  s.fillRect(x, top, w, bottom - top, DOOR_WOOD.mid);
  s.fillRect(x, top, 1, bottom - top, DOOR_WOOD.light); // lit edge
  s.fillRect(x + 2, top + 2, w - 4, 1, DOOR_WOOD.dark); // panel seams
  s.fillRect(x + 2, bottom - 4, w - 4, 1, DOOR_WOOD.dark);
  s.setPixel(x + w - 3, top + Math.floor((bottom - top) / 2), "#c9a24a"); // handle
}

/** A shuttered window; `shutter` null leaves it bare. */
function drawWindow(s, x, y, w, h, shutter) {
  s.fillRect(x - 1, y - 1, w + 2, h + 2, DOOR_WOOD.dark);
  s.fillRect(x, y, w, h, GLASS.dark);
  s.fillRect(x, y, 1, h, GLASS.sheen); // faint glass highlight, light from upper left
  s.fillRect(x, y, w, 1, GLASS.sheen);
  s.line(x + Math.floor(w / 2), y, x + Math.floor(w / 2), y + h - 1, DOOR_WOOD.dark); // mullion
  if (shutter) {
    s.fillRect(x - 3, y - 1, 2, h + 2, shutter);
    s.fillRect(x + w + 1, y - 1, 2, h + 2, shutter);
  }
}

/** Borin's forge: slate roof, stone walls, a big smoke-stained chimney, lit forge window. */
function buildingForge() {
  const s = buildingBase({ roof: ROOF_SLATE, wall: WALL_STONE });

  // Chimney, offset left so it doesn't sit dead centre.
  s.fillRect(9, 0, 9, 12, WALL_STONE.dark);
  s.fillRect(10, 1, 7, 10, WALL_STONE.mid);
  s.fillRect(10, 1, 2, 10, WALL_STONE.light);
  s.fillRect(8, 0, 11, 2, WALL_STONE.light); // cap
  s.fillRect(11, 2, 5, 2, "#0f0d0c"); // sooted flue
  s.speckleRect(9, 4, 9, 7, 10, "#241f26", 91); // smoke staining

  // Wide workshop doors.
  drawDoor(s, 24, 33, 45);
  s.line(24, 33, 24, 44, DOOR_WOOD.dark); // split down the middle

  // Forge window, glowing from the fire inside.
  s.fillRect(35, 33, 8, 7, DOOR_WOOD.dark);
  s.fillRect(36, 34, 6, 5, "#8a3410");
  s.fillRect(36, 36, 6, 3, "#c95a1e");
  s.fillRect(37, 37, 4, 2, "#e8862f");
  s.setPixel(38, 38, "#ffe08a");

  // Anvil sign hung by the door.
  s.fillRect(6, 32, 9, 7, "#2c2832");
  s.fillRect(7, 34, 7, 2, WALL_STONE.light);
  s.fillRect(9, 36, 3, 2, WALL_STONE.mid);
  return s;
}

/** Wren's cottage: thatch roof, plaster walls, green shutters, herbs drying outside. */
function buildingCottage() {
  const s = buildingBase({ roof: ROOF_THATCH, wall: WALL_PLASTER });

  // Thatch reads as loose straw rather than hard tile courses.
  s.speckleRect(3, 3, BUILDING_W - 6, 24, 90, ROOF_THATCH.dark, 41);
  s.speckleRect(3, 3, BUILDING_W - 6, 24, 55, ROOF_THATCH.hi, 42);
  s.fillRect(2, 26, BUILDING_W - 4, 2, ROOF_THATCH.dark); // ragged lower edge
  for (let x = 3; x < BUILDING_W - 3; x += 3) s.setPixel(x, 28, ROOF_THATCH.dark);

  // Timber framing on the plaster.
  s.fillRect(3, 36, BUILDING_W - 6, 1, WALL_PLASTER.trim);
  s.line(12, 30, 12, 45, WALL_PLASTER.trim);
  s.line(36, 30, 36, 45, WALL_PLASTER.trim);

  drawDoor(s, 24, 33, 45);
  drawWindow(s, 5, 38, 6, 5, "#2f6b38");
  drawWindow(s, 39, 38, 6, 5, "#2f6b38");

  // Herb bundles hung to dry beside the door.
  s.fillRect(17, 30, 1, 4, "#5a3d22");
  s.fillEllipse(17, 35, 1.6, 2.2, "#3f9450");
  s.fillRect(31, 30, 1, 4, "#5a3d22");
  s.fillEllipse(31, 35, 1.6, 2.2, "#4a8f52");
  return s;
}

/** Elder Corwin's house: clay-tiled roof, plaster walls, a modest chimney. */
function buildingHouse() {
  const s = buildingBase({ roof: ROOF_CLAY, wall: WALL_PLASTER });

  s.fillRect(33, 0, 7, 10, WALL_STONE.dark);
  s.fillRect(34, 1, 5, 8, WALL_STONE.mid);
  s.fillRect(34, 1, 2, 8, WALL_STONE.light);
  s.fillRect(32, 0, 9, 2, WALL_STONE.light);
  s.fillRect(35, 2, 3, 2, "#0f0d0c");

  drawDoor(s, 20, 33, 45);
  drawWindow(s, 32, 35, 8, 6, null);
  drawWindow(s, 5, 35, 6, 6, null);

  // Doorstep, so the entrance meets the ground properly.
  s.fillRect(16, 45, 9, 2, WALL_STONE.light);
  return s;
}

/** The guard post: squat stone blockhouse, arrow slits, a banner over the door. */
function buildingGuardPost() {
  const s = buildingBase({ roof: ROOF_SLATE, wall: WALL_STONE });

  // Crenellations along the ridge instead of a chimney.
  for (let x = 4; x < BUILDING_W - 4; x += 6) {
    s.fillRect(x, 0, 4, 4, WALL_STONE.mid);
    s.fillRect(x, 0, 4, 1, WALL_STONE.light);
    s.fillRect(x, 3, 4, 1, WALL_STONE.dark);
  }

  // Coursed stone blockwork on the wall face.
  for (let y = 32; y < 45; y += 4) {
    s.line(4, y, BUILDING_W - 5, y, WALL_STONE.dark);
    for (let x = 6 + ((y / 4) % 2) * 5; x < BUILDING_W - 5; x += 10) {
      s.line(x, y, x, Math.min(y + 3, 44), WALL_STONE.dark);
    }
  }

  drawDoor(s, 24, 34, 45);

  // Arrow slits rather than glazed windows.
  s.fillRect(9, 34, 3, 8, "#1a1a1e");
  s.fillRect(10, 35, 1, 6, "#0a0a0c");
  s.fillRect(37, 34, 3, 8, "#1a1a1e");
  s.fillRect(38, 35, 1, 6, "#0a0a0c");

  // Banner hung above the doorway.
  s.fillRect(20, 29, 9, 4, "#5a1e1c");
  s.fillRect(20, 29, 9, 1, "#7a2c28");
  s.fillRect(23, 30, 3, 2, "#c9a24a");
  return s;
}

// ---------------------------------------------------------------------------
// Town NPCs — original designs (each a distinct silhouette, not palette
// swaps of one base), sized to match the player character (16x16 -> 32x32,
// same scale as the player sheet) rather than towering over it.
// ---------------------------------------------------------------------------

/** Borin the Blacksmith: stocky build, leather apron, bald, a hammer at his side. */
function borinFrame() {
  const s = new Sprite(16, 16);
  const skin = "#c98a5c";
  const apron = "#6b4a2f";
  const apronDark = "#573c26";
  const trousers = "#33363b";
  const boots = "#201814";

  s.fillRect(5, 12, 2, 2, boots);
  s.fillRect(9, 12, 2, 2, boots);
  s.fillRect(5, 9, 2, 3, trousers);
  s.fillRect(9, 9, 2, 3, trousers);
  // broad torso + apron
  s.fillRect(3, 5, 10, 6, apron);
  s.fillRect(3, 5, 10, 1, apronDark);
  s.fillRect(7, 6, 2, 5, apronDark); // center strap
  // arms (rolled sleeves, skin showing at forearm)
  s.fillRect(2, 6, 1, 3, skin);
  s.fillRect(13, 6, 1, 3, skin);
  // head: ruddy, bald with a short dark fringe
  s.fillCircle(8, 3, 3, skin);
  s.fillRect(5, 1, 6, 1, "#2a2320");
  s.setPixel(6, 3, "#241a12");
  s.setPixel(9, 3, "#241a12");
  // hammer prop at his side
  s.fillRect(13, 9, 2, 1, "#8a6a3d");
  s.fillRect(14, 8, 1, 3, "#9c9ca6");
  return s;
}

/** Wren the Herbalist: slender, hooded cloak, a basket of herbs at her hip. */
function wrenFrame() {
  const s = new Sprite(16, 16);
  const cloak = "#2f6b45";
  const cloakDark = "#204d33";
  const skin = "#e0ac69";
  const basket = "#7a5c3e";

  s.setPixel(6, 13, "#241a12");
  s.setPixel(9, 13, "#241a12");
  // long robe (trapezoid via stacked rects, widening toward the hem)
  s.fillRect(6, 10, 4, 3, cloak);
  s.fillRect(5, 8, 6, 3, cloak);
  s.fillRect(5, 8, 1, 5, cloakDark);
  s.fillRect(10, 8, 1, 5, cloakDark);
  s.fillRect(6, 6, 4, 3, cloak);
  // arms
  s.fillRect(4, 7, 1, 3, cloak);
  s.fillRect(11, 7, 1, 3, cloak);
  // hood + face (only lower face visible, rest shadowed by hood)
  s.fillCircle(8, 3.5, 2.8, cloakDark);
  s.fillEllipse(8, 4.5, 2, 1.6, skin);
  s.setPixel(7, 4, "#241a12");
  s.setPixel(9, 4, "#241a12");
  // basket prop at her hip
  s.fillRect(11, 9, 3, 2, basket);
  s.setPixel(12, 8, "#4a8f52");
  s.setPixel(13, 8, "#6fc47f");
  return s;
}

/** Elder Corwin: robed, long white beard, a gem-topped staff. */
function elderFrame() {
  const s = new Sprite(16, 16);
  const robe = "#3a3a7a";
  const robeDark = "#28285a";
  const skin = "#e0b58a";
  const beard = "#e8e8e0";
  const staff = "#6b4a2f";

  // long robe reaching the ground
  s.fillRect(5, 9, 6, 4, robe);
  s.fillRect(5, 9, 1, 4, robeDark);
  s.fillRect(10, 9, 1, 4, robeDark);
  s.fillRect(7, 11, 2, 2, "#c9a24a"); // rope belt
  s.fillRect(5, 6, 6, 4, robe);
  s.fillRect(4, 7, 1, 3, robe);
  s.fillRect(11, 7, 1, 3, robe);
  // head + long beard
  s.fillCircle(8, 3, 2.6, skin);
  s.fillRect(6, 1, 4, 1, beard); // hair
  s.fillRect(6, 4, 4, 4, beard); // beard body
  s.fillRect(7, 8, 2, 2, beard); // beard tip
  s.setPixel(6, 3, "#241a12");
  s.setPixel(10, 3, "#241a12");
  // staff prop with a small gem
  s.fillRect(13, 2, 1, 11, staff);
  s.fillCircle(13.5, 2, 1.1, "#6fb2ff");
  return s;
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

function ratFrame({ furBase = "#7a5c3e", furDark = "#6b4f34", eye = "#1a1a1a", scale = 1, step = 0 } = {}) {
  const s = new Sprite(16, 16);
  const bob = step === 0 ? 0 : 1;
  const rx = 5 * scale;
  const ry = 3 * scale;
  const cx = 7;
  const cy = 10 - bob;
  s.fillEllipse(cx, cy, rx, ry, furBase);
  // head
  s.fillEllipse(cx + rx - 1, cy - 1, 2.6 * scale, 2.2 * scale, furDark);
  // ears
  s.fillCircle(cx + rx, cy - 3, 1.2 * scale, "#c98a8a");
  s.fillCircle(cx + rx + 2, cy - 3, 1.2 * scale, "#c98a8a");
  // eye + nose
  s.setPixel(Math.round(cx + rx + 1), Math.round(cy - 1), eye);
  s.setPixel(Math.round(cx + rx + 2), Math.round(cy), "#2a2a2a");
  // tail
  s.line(Math.round(cx - rx), Math.round(cy), Math.round(cx - rx - 3), Math.round(cy + 2), furDark);
  // feet
  s.fillRect(Math.round(cx - 2), Math.round(cy + ry - 1), 1, 2, furDark);
  s.fillRect(Math.round(cx + 1), Math.round(cy + ry - 1), 1, 2, furDark);
  return s;
}

const SLIME_SHADOW = "#0f5c38";
const SLIME_DARK = "#1f8f56";
const SLIME_BASE = "#33c374";
const SLIME_LIGHT = "#7fe6ab";
const SLIME_HILIGHT = "#d6fbe8";
const SLIME_EYE = "#12271c";

/** A classic gooey blob monster: layered shading + a squish bounce cycle. */
function slimeFrame({ squish = false } = {}) {
  const s = new Sprite(16, 16);
  const rx = squish ? 6.4 : 5.4;
  const ry = squish ? 3.6 : 4.6;
  const cx = 8;
  const cy = squish ? 11.6 : 10.6;

  // ground shadow
  s.fillEllipse(cx, 14, rx * 0.8, 1.3, "#0a1a12");

  // body: dark outline pass, then base, then a lighter upper band, then a
  // small specular highlight, to fake a rounded gooey-blob light model.
  s.fillEllipse(cx, cy, rx + 0.5, ry + 0.5, SLIME_SHADOW);
  s.fillEllipse(cx, cy, rx, ry, SLIME_DARK);
  s.fillEllipse(cx, cy - ry * 0.15, rx * 0.85, ry * 0.75, SLIME_BASE);
  s.fillEllipse(cx - rx * 0.2, cy - ry * 0.55, rx * 0.45, ry * 0.35, SLIME_LIGHT);
  s.fillEllipse(cx - rx * 0.35, cy - ry * 0.65, rx * 0.18, ry * 0.14, SLIME_HILIGHT);

  // two small drip bumps break up the silhouette so it doesn't read as a
  // perfect oval
  s.fillEllipse(cx - rx * 0.55, cy + ry * 0.7, rx * 0.22, ry * 0.3, SLIME_DARK);
  s.fillEllipse(cx + rx * 0.6, cy + ry * 0.75, rx * 0.2, ry * 0.28, SLIME_DARK);

  // eyes
  const eyeY = cy - ry * 0.1;
  s.fillEllipse(cx - rx * 0.32, eyeY, 0.7, 0.9, SLIME_EYE);
  s.fillEllipse(cx + rx * 0.32, eyeY, 0.7, 0.9, SLIME_EYE);
  s.setPixel(Math.round(cx - rx * 0.32 - 0.3), Math.round(eyeY - 0.6), SLIME_HILIGHT);
  s.setPixel(Math.round(cx + rx * 0.32 - 0.3), Math.round(eyeY - 0.6), SLIME_HILIGHT);

  return s;
}

// ---------------------------------------------------------------------------
// Items (small icons, drawn centered in a 16x16 canvas)
// ---------------------------------------------------------------------------

function swordIcon() {
  const s = new Sprite(16, 16);
  s.fillRect(7, 2, 2, 8, "#c9ccd1"); // blade
  s.fillRect(7, 2, 2, 1, "#eef0f3"); // tip highlight
  s.fillRect(5, 10, 6, 1, "#8a6a3d"); // crossguard
  s.fillRect(7, 11, 2, 3, "#5a3d22"); // hilt
  s.fillRect(6, 14, 4, 1, "#3a2717"); // pommel
  return s;
}

function healthPotionIcon() {
  const s = new Sprite(16, 16);
  s.fillRect(6, 2, 4, 2, "#8a6a3d");
  s.fillRect(7, 1, 2, 1, "#3a2717");
  s.fillEllipse(8, 9, 4, 5, "#c9302f");
  s.fillRect(5, 6, 6, 3, "#e8f4fb"); // glass highlight band
  s.fillEllipse(8, 9, 3.2, 4.2, "#c9302f");
  s.setPixel(7, 7, "#ff6f6b");
  return s;
}

function manaPotionIcon() {
  const s = new Sprite(16, 16);
  s.fillRect(6, 2, 4, 2, "#8a6a3d");
  s.fillRect(7, 1, 2, 1, "#3a2717");
  s.fillEllipse(8, 9, 4, 5, "#2f6fa8");
  s.fillRect(5, 6, 6, 3, "#e8f4fb");
  s.fillEllipse(8, 9, 3.2, 4.2, "#2f6fa8");
  s.setPixel(7, 7, "#6fb2ff");
  return s;
}

function goldCoinIcon() {
  const s = new Sprite(16, 16);
  s.fillCircle(8, 8, 5, "#8a6a1a");
  s.fillCircle(8, 8, 4, "#e6c34a");
  s.setPixel(6, 6, "#fff2b8");
  return s;
}

// --- Containers ---

/** Shared body for the bag/backpack icons, parameterised by size and leather tone. */
function packIcon({ dark, mid, light, strap, width, height, top }) {
  const s = new Sprite(16, 16);
  const x = 8 - width / 2;
  s.fillRect(x, top, width, height, mid);
  s.fillRect(x, top, width, 1, light); // lid highlight
  s.fillRect(x, top + height - 1, width, 1, dark); // base shadow
  s.fillRect(x, top, 1, height, dark);
  s.fillRect(x + width - 1, top, 1, height, dark);
  s.fillRect(x + 1, top + 2, width - 2, 1, dark); // flap seam
  s.fillRect(7, top + 3, 2, 2, strap); // buckle
  return s;
}

function backpackIcon() {
  const s = packIcon({
    dark: "#4a2f1a",
    mid: "#7a5230",
    light: "#96683c",
    strap: "#e6c34a",
    width: 10,
    height: 11,
    top: 3,
  });
  s.fillRect(4, 1, 2, 3, "#5c3c22"); // shoulder straps
  s.fillRect(10, 1, 2, 3, "#5c3c22");
  return s;
}

function bagIcon() {
  const s = packIcon({
    dark: "#5a3d22",
    mid: "#8a6a3d",
    light: "#a3814f",
    strap: "#c9a24a",
    width: 8,
    height: 8,
    top: 6,
  });
  s.fillRect(6, 4, 4, 2, "#5a3d22"); // cinched neck
  return s;
}

// --- Weapons ---

function axeIcon() {
  const s = new Sprite(16, 16);
  s.fillRect(7, 3, 2, 11, "#5a3d22"); // haft
  s.fillRect(7, 3, 1, 11, "#3a2717");
  s.fillEllipse(5, 5, 4, 3.4, "#c9ccd1"); // blade
  s.fillEllipse(5.6, 5, 3, 2.6, "#9aa0a8");
  s.fillRect(6, 2, 4, 1, "#eef0f3");
  return s;
}

function bowIcon() {
  const s = new Sprite(16, 16);
  // Limbs: a C-shape opening right, drawn as two arcs of stacked pixels.
  for (let y = 2; y <= 13; y++) {
    const bulge = Math.round(3 * Math.sin(((y - 2) / 11) * Math.PI));
    s.setPixel(4 + bulge, y, "#6b4a2a");
    s.setPixel(5 + bulge, y, "#8a6a3d");
  }
  s.line(4, 2, 4, 13, "#d8d2c0"); // string
  return s;
}

function arrowIcon() {
  const s = new Sprite(16, 16);
  s.fillRect(7, 4, 2, 9, "#8a6a3d"); // shaft
  s.fillRect(7, 4, 1, 9, "#5a3d22");
  s.fillRect(6, 2, 4, 2, "#c9ccd1"); // head
  s.setPixel(8, 1, "#eef0f3");
  s.fillRect(5, 12, 2, 3, "#c9302f"); // fletching
  s.fillRect(9, 12, 2, 3, "#c9302f");
  return s;
}

function wandIcon() {
  const s = new Sprite(16, 16);
  s.fillRect(7, 6, 2, 9, "#3a2717"); // shaft
  s.fillRect(7, 6, 1, 9, "#241609");
  s.fillCircle(8, 4, 3, "#4a2f6b"); // vortex gem
  s.fillCircle(8, 4, 2, "#8a5cc9");
  s.setPixel(7, 3, "#d9b8ff");
  return s;
}

// --- Shields ---

/** Shared heater-shield silhouette: square shoulders tapering to a point. */
function shieldIcon({ dark, mid, light, boss }) {
  const s = new Sprite(16, 16);
  for (let y = 2; y <= 13; y++) {
    const t = (y - 2) / 11;
    const halfWidth = Math.max(1, Math.round(5 * (1 - t * t)));
    s.fillRect(8 - halfWidth, y, halfWidth * 2, 1, mid);
    s.setPixel(8 - halfWidth, y, dark);
    s.setPixel(8 + halfWidth - 1, y, dark);
  }
  s.fillRect(3, 2, 10, 1, light); // top edge
  s.fillCircle(8, 7, 2, boss); // central boss
  return s;
}

function woodenShieldIcon() {
  return shieldIcon({ dark: "#4a2f1a", mid: "#7a5230", light: "#96683c", boss: "#c9a24a" });
}

function steelShieldIcon() {
  return shieldIcon({ dark: "#5c6068", mid: "#9aa0a8", light: "#d5dae0", boss: "#e6c34a" });
}

// --- Armor ---

/** Shared helmet silhouette: domed skull with a face opening. */
function helmetIcon({ dark, mid, light, full }) {
  const s = new Sprite(16, 16);
  s.fillCircle(8, 8, 5, mid);
  s.fillRect(3, 8, 10, 5, mid);
  s.fillCircle(8, 7, 4.2, light); // domed highlight
  s.fillRect(3, 12, 10, 1, dark);
  s.fillRect(5, 9, 6, full ? 2 : 3, "#1a1a1e"); // visor slit / face gap
  if (full) s.fillRect(7, 9, 2, 4, dark); // nose guard
  return s;
}

function leatherHelmetIcon() {
  return helmetIcon({ dark: "#4a2f1a", mid: "#7a5230", light: "#96683c", full: false });
}

function steelHelmetIcon() {
  return helmetIcon({ dark: "#5c6068", mid: "#9aa0a8", light: "#c9ccd1", full: true });
}

/** Shared cuirass silhouette: shoulders, chest, waist. */
function armorIcon({ dark, mid, light, trim }) {
  const s = new Sprite(16, 16);
  s.fillRect(3, 3, 10, 3, mid); // shoulders
  s.fillRect(4, 6, 8, 7, mid); // chest
  s.fillRect(4, 6, 8, 1, light);
  s.fillRect(3, 3, 1, 3, dark);
  s.fillRect(12, 3, 1, 3, dark);
  s.fillRect(4, 12, 8, 1, dark); // waist hem
  s.fillRect(6, 3, 4, 2, "#1a1a1e"); // neck opening
  s.fillRect(7, 7, 2, 4, trim); // centre seam
  return s;
}

function leatherArmorIcon() {
  return armorIcon({ dark: "#4a2f1a", mid: "#7a5230", light: "#96683c", trim: "#5c3c22" });
}

function plateArmorIcon() {
  return armorIcon({ dark: "#5c6068", mid: "#9aa0a8", light: "#d5dae0", trim: "#6d727a" });
}

/** Shared legs silhouette: waistband over two tapering legs. */
function legsIcon({ dark, mid, light }) {
  const s = new Sprite(16, 16);
  s.fillRect(4, 3, 8, 3, mid); // waistband
  s.fillRect(4, 3, 8, 1, light);
  s.fillRect(4, 6, 3, 8, mid); // left leg
  s.fillRect(9, 6, 3, 8, mid); // right leg
  s.fillRect(4, 13, 3, 1, dark);
  s.fillRect(9, 13, 3, 1, dark);
  s.fillRect(7, 6, 2, 8, "#1a1a1e"); // gap between legs
  return s;
}

function leatherLegsIcon() {
  return legsIcon({ dark: "#4a2f1a", mid: "#7a5230", light: "#96683c" });
}

function plateLegsIcon() {
  return legsIcon({ dark: "#5c6068", mid: "#9aa0a8", light: "#d5dae0" });
}

function leatherBootsIcon() {
  const s = new Sprite(16, 16);
  s.fillRect(3, 4, 4, 7, "#7a5230"); // left shaft
  s.fillRect(9, 4, 4, 7, "#7a5230");
  s.fillRect(3, 4, 4, 1, "#96683c");
  s.fillRect(9, 4, 4, 1, "#96683c");
  s.fillRect(2, 11, 6, 2, "#4a2f1a"); // left foot
  s.fillRect(8, 11, 6, 2, "#4a2f1a");
  s.fillRect(2, 13, 6, 1, "#241609"); // soles
  s.fillRect(8, 13, 6, 1, "#241609");
  return s;
}

// --- Jewellery ---

function amuletIcon() {
  const s = new Sprite(16, 16);
  for (let x = 4; x <= 11; x++) {
    const y = 3 + Math.round(2 * Math.sin(((x - 4) / 7) * Math.PI));
    s.setPixel(x, y, "#c9a24a"); // chain arc
  }
  s.fillCircle(8, 9, 3, "#8a6a1a"); // pendant
  s.fillCircle(8, 9, 2, "#c9302f");
  s.setPixel(7, 8, "#ff8f8b");
  return s;
}

function ringIcon() {
  const s = new Sprite(16, 16);
  s.fillCircle(8, 10, 4, "#8a6a1a");
  s.fillCircle(8, 10, 2.6, "#1a1a1e"); // band hole
  s.fillCircle(8, 5, 2.4, "#c9a24a"); // setting
  s.fillCircle(8, 5, 1.4, "#7cff7c"); // stone
  s.setPixel(7, 4, "#d8ffd8");
  return s;
}

// --- Spell icons (action bar) ---

function healSpellIcon() {
  const s = new Sprite(16, 16);
  s.fillCircle(8, 8, 6, "#1d3a24");
  s.fillCircle(8, 8, 5, "#2f7a3e");
  s.fillRect(6, 3, 4, 10, "#d8ffd8"); // cross
  s.fillRect(3, 6, 10, 4, "#d8ffd8");
  return s;
}

function flameSpellIcon() {
  const s = new Sprite(16, 16);
  s.fillCircle(8, 8, 6, "#3a1408");
  s.fillEllipse(8, 9, 4.4, 5, "#c9302f"); // outer flame
  s.fillEllipse(8, 10, 3, 3.6, "#e8862f");
  s.fillEllipse(8, 11, 1.6, 2.2, "#ffe08a"); // core
  s.setPixel(8, 3, "#ff9f4a"); // tip
  s.setPixel(8, 4, "#ff9f4a");
  return s;
}

// ---------------------------------------------------------------------------
// App icons (PWA home screen)
// ---------------------------------------------------------------------------

function appIcon(size) {
  const s = new Sprite(size, size);
  s.fillRect(0, 0, size, size, "#151515");
  const cx = size / 2;
  const cy = size / 2;
  s.fillCircle(cx, cy, size * 0.34, "#2f6fa8");
  s.fillRect(cx - size * 0.05, cy - size * 0.28, size * 0.1, size * 0.32, "#c9ccd1");
  s.fillRect(cx - size * 0.16, cy + size * 0.02, size * 0.32, size * 0.05, "#8a6a3d");
  return s;
}

// ---------------------------------------------------------------------------
// Write everything out
// ---------------------------------------------------------------------------

// --- terrain -------------------------------------------------------------
saveSprite(grassTile(0), SCALE, `${OUT}/terrain/grass_01.png`);
saveSprite(grassTile(1), SCALE, `${OUT}/terrain/grass_02.png`);
saveSprite(grassTile(2), SCALE, `${OUT}/terrain/grass_03.png`);
saveSprite(dirtTile(0), SCALE, `${OUT}/terrain/dirt_01.png`);
saveSprite(dirtTile(1), SCALE, `${OUT}/terrain/dirt_02.png`);
saveSprite(caveFloorTile(), SCALE, `${OUT}/terrain/cave_floor_01.png`);
saveSprite(cobbleTile(), SCALE, `${OUT}/terrain/cobble_01.png`);
saveSprite(stoneWallTile(), SCALE, `${OUT}/terrain/wall_stone_01.png`);
saveSprite(rockyGroundTile(), SCALE, `${OUT}/terrain/ground_rocky_01.png`);
saveSprite(voidWallTile(), SCALE, `${OUT}/terrain/void_01.png`);
saveSprite(mountainTile(), SCALE, `${OUT}/terrain/mountain_01.png`);
saveSprite(roadTile(), SCALE, `${OUT}/terrain/road_01.png`);

// Water is animated, so its frames ship as one sheet rather than a tile.
const waterMeta = saveSpriteSheet(
  Array.from({ length: WATER_FRAMES }, (_, i) => waterTile(i)),
  SCALE,
  `${OUT}/terrain/water_sheet.png`,
);

// --- environment ---------------------------------------------------------
saveSprite(treeOak(0), SCALE, `${OUT}/environment/tree_oak_01.png`);
saveSprite(treeOak(1), SCALE, `${OUT}/environment/tree_oak_02.png`);
saveSprite(treePine(), SCALE, `${OUT}/environment/tree_pine_01.png`);
saveSprite(treeDead(), SCALE, `${OUT}/environment/tree_dead_01.png`);
saveSprite(bushSprite(), SCALE, `${OUT}/environment/bush_01.png`);
saveSprite(rockSmall(), SCALE, `${OUT}/environment/rock_small_01.png`);
saveSprite(rockMedium(), SCALE, `${OUT}/environment/rock_medium_01.png`);
saveSprite(rockLarge(), SCALE, `${OUT}/environment/rock_large_01.png`);
saveSprite(rockMossy(), SCALE, `${OUT}/environment/rock_mossy_01.png`);
saveSprite(stumpSprite(), SCALE, `${OUT}/environment/stump_01.png`);
saveSprite(mushroomsSprite(), SCALE, `${OUT}/environment/mushrooms_01.png`);
saveSprite(flowersSprite(), SCALE, `${OUT}/environment/flowers_01.png`);

// --- props ---------------------------------------------------------------
saveSprite(barrelSprite(), SCALE, `${OUT}/props/barrel_01.png`);
saveSprite(crateSprite(), SCALE, `${OUT}/props/crate_01.png`);
saveSprite(wellSprite(), SCALE, `${OUT}/props/well_01.png`);
saveSprite(signpostSprite(), SCALE, `${OUT}/props/sign_01.png`);
saveSprite(fenceSprite(), SCALE, `${OUT}/props/fence_01.png`);
saveSprite(benchSprite(), SCALE, `${OUT}/props/bench_01.png`);
saveSprite(cartSprite(), SCALE, `${OUT}/props/cart_01.png`);
saveSprite(campfireSprite(), SCALE, `${OUT}/props/campfire_01.png`);
saveSprite(torchSprite(), SCALE, `${OUT}/props/torch_01.png`);
saveSprite(gravestoneSprite(), SCALE, `${OUT}/props/gravestone_01.png`);
saveSprite(chestSprite(), SCALE, `${OUT}/props/chest_01.png`);
saveSprite(sackSprite(), SCALE, `${OUT}/props/sack_01.png`);
saveSprite(weaponRackSprite(), SCALE, `${OUT}/props/weapon_rack_01.png`);

// --- buildings -----------------------------------------------------------
saveSprite(buildingForge(), SCALE, `${OUT}/buildings/forge_01.png`);
saveSprite(buildingCottage(), SCALE, `${OUT}/buildings/cottage_01.png`);
saveSprite(buildingHouse(), SCALE, `${OUT}/buildings/house_01.png`);
saveSprite(buildingGuardPost(), SCALE, `${OUT}/buildings/guardpost_01.png`);

// --- characters ----------------------------------------------------------
const playerMeta = saveSpriteSheet(directionalFrames(playerFrame), SCALE, `${OUT}/characters/player_sheet.png`);
saveSprite(borinFrame(), SCALE, `${OUT}/characters/npc_borin.png`);
saveSprite(wrenFrame(), SCALE, `${OUT}/characters/npc_wren.png`);
saveSprite(elderFrame(), SCALE, `${OUT}/characters/npc_corwin.png`);

// --- creatures -----------------------------------------------------------
const trollMeta = saveSpriteSheet(directionalFrames(trollFrame), SCALE, `${OUT}/creatures/troll_sheet.png`);
const ratFrames = [ratFrame({ step: 0 }), ratFrame({ step: 1 })];
const ratMeta = saveSpriteSheet(ratFrames, SCALE, `${OUT}/creatures/rat_sheet.png`);
// Darker fur and red eyes mark the cave variant apart from the field rat.
const CAVE_RAT = { furBase: "#4a3626", furDark: "#3a2a1c", eye: "#a83232", scale: 1.15 };
const caveRatFrames = [ratFrame({ ...CAVE_RAT, step: 0 }), ratFrame({ ...CAVE_RAT, step: 1 })];
const caveRatMeta = saveSpriteSheet(caveRatFrames, SCALE, `${OUT}/creatures/cave_rat_sheet.png`);
const slimeFrames = [slimeFrame({ squish: false }), slimeFrame({ squish: true })];
const slimeMeta = saveSpriteSheet(slimeFrames, SCALE, `${OUT}/creatures/slime_sheet.png`);

// --- effects -------------------------------------------------------------
saveSprite(hitSparkSprite(), SCALE, `${OUT}/effects/hit_spark_01.png`);
saveSprite(bloodSprite(), SCALE, `${OUT}/effects/blood_01.png`);
saveSprite(dustSprite(), SCALE, `${OUT}/effects/dust_01.png`);
saveSprite(sparkleSprite(), SCALE, `${OUT}/effects/sparkle_01.png`);

// --- items ---------------------------------------------------------------
saveSprite(swordIcon(), SCALE, `${OUT}/items/weapon_sword.png`);
saveSprite(axeIcon(), SCALE, `${OUT}/items/weapon_axe.png`);
saveSprite(bowIcon(), SCALE, `${OUT}/items/weapon_bow.png`);
saveSprite(wandIcon(), SCALE, `${OUT}/items/weapon_wand.png`);
saveSprite(arrowIcon(), SCALE, `${OUT}/items/ammo_arrow.png`);
saveSprite(woodenShieldIcon(), SCALE, `${OUT}/items/shield_wooden.png`);
saveSprite(steelShieldIcon(), SCALE, `${OUT}/items/shield_steel.png`);
saveSprite(leatherHelmetIcon(), SCALE, `${OUT}/items/armor_helmet_leather.png`);
saveSprite(steelHelmetIcon(), SCALE, `${OUT}/items/armor_helmet_steel.png`);
saveSprite(leatherArmorIcon(), SCALE, `${OUT}/items/armor_body_leather.png`);
saveSprite(plateArmorIcon(), SCALE, `${OUT}/items/armor_body_plate.png`);
saveSprite(leatherLegsIcon(), SCALE, `${OUT}/items/armor_legs_leather.png`);
saveSprite(plateLegsIcon(), SCALE, `${OUT}/items/armor_legs_plate.png`);
saveSprite(leatherBootsIcon(), SCALE, `${OUT}/items/armor_boots_leather.png`);
saveSprite(amuletIcon(), SCALE, `${OUT}/items/jewel_amulet.png`);
saveSprite(ringIcon(), SCALE, `${OUT}/items/jewel_ring.png`);
saveSprite(backpackIcon(), SCALE, `${OUT}/items/container_backpack.png`);
saveSprite(bagIcon(), SCALE, `${OUT}/items/container_bag.png`);
saveSprite(healthPotionIcon(), SCALE, `${OUT}/items/potion_health.png`);
saveSprite(manaPotionIcon(), SCALE, `${OUT}/items/potion_mana.png`);
saveSprite(goldCoinIcon(), SCALE, `${OUT}/items/coin_gold.png`);
saveSprite(healSpellIcon(), SCALE, `${OUT}/items/spell_heal.png`);
saveSprite(flameSpellIcon(), SCALE, `${OUT}/items/spell_flame.png`);

savePNG(appIcon(192).toPNG(1), `${ICONS}/icon-192.png`);
savePNG(appIcon(512).toPNG(1), `${ICONS}/icon-512.png`);

console.log("Generated every game asset: terrain, environment, props, buildings, characters, creatures, effects, items, app icons.");
console.log("water sheet meta:", waterMeta);
console.log("PLAYER_SHEET must match:", playerMeta);
console.log("TROLL_SHEET must match:", trollMeta);
console.log("rat sheet meta:", ratMeta);
console.log("cave rat sheet meta:", caveRatMeta);
console.log("slime sheet meta:", slimeMeta);
