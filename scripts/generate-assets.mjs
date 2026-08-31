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
const P_STONE = { deep: "#1f1d24", dark: "#2c2832", mid: "#4a4650", light: "#615c6b", hi: "#7d7887" };
const P_COBBLE = { deep: "#2a2730", dark: "#45414d", mid: "#6d6875", light: "#8a8592", hi: "#a29cac" };

/**
 * Lay down small rectangular patches rather than loose pixels. Ground texture
 * built from clusters reads as material; the same pixel count scattered one at
 * a time reads as static, which is the fastest way to make pixel art look
 * machine-made.
 */
function clusters(s, spots, hex) {
  for (const [x, y, w = 2, h = 1] of spots) s.fillRect(x, y, w, h, hex);
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

const P_BARK = { deep: "#241609", dark: "#3a2312", mid: "#4a2e18", light: "#5f3d22" };

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

/**
 * Wooden ladder rising out of a dark pit — the "up" exit from a sewer room.
 * Drawn two tiles tall (16x32 source, i.e. one tile wide, two tall) so it
 * reads as a real ladder climbing out of sight rather than a floor
 * decal: the pit and the first few rungs sit in the bottom tile (the tile
 * the player actually stands on to climb), and the rails keep going for a
 * full tile above that.
 *
 * Anchored bottom-right like everything else (WorldScene.buildEnvironmentDecoration),
 * so the extra height extends straight up over the tile behind it — which is
 * exactly the tile WorldScene fades this sprite for for when the player
 * walks onto it, so they're never hidden behind their own ladder.
 */
/**
 * Sewer entrance: a square hatch cut into the street/ground, stone-rimmed,
 * with a wooden grate cover pulled half aside over a dark drop. Standing on
 * this tile climbs the player down into the sewers.
 */
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

// ---------------------------------------------------------------------------
// Prop library. These are the pieces a location is composed from: a mine reads
// as a mine because of the carts and crates around it, not because the ground
// is a different colour.
// ---------------------------------------------------------------------------

/** Post-and-rail fence running east-west, for top/bottom edges. */
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

/** Post-and-rail fence running north-south, for left/right edges. */
function fenceVerticalSprite() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 14, 1.6, 0.8, "#14110f");
  s.fillRect(7, 0, 2, 14, P_BARK.mid);
  s.fillRect(7, 0, 1, 14, P_BARK.light);
  s.fillRect(7, 0, 2, 1, "#6b4a2a");
  for (const x of [5, 10]) {
    s.fillRect(x, 0, 1, 16, "#6b4a2a");
    s.fillRect(x - 1, 0, 1, 16, P_BARK.dark);
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

/** A single soft puff, animated in code (WorldScene's spawnSmoke) rather than as drawn frames — same idea as dustSprite but paler/softer for chimney smoke. */
function smokePuffSprite() {
  const s = new Sprite(16, 16);
  for (const [x, y, r] of [[7, 9, 3], [10, 7, 2.2], [5, 8, 2]]) {
    s.fillCircle(x, y, r, "#8f8f96");
  }
  s.fillCircle(6.5, 7.5, 1.6, "#c4c4cc");
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
// Troll — original directional sheet, drawn at the same pixel density as
// everything else here (16px-grid art doubled to 32px tiles).
//
// Sheet layout must match DIRECTION_ORDER in src/game/directionalSprite.ts:
// four frames per direction, in the order down, left, right, up.
//
// The player's own body used to be generated here too (plus paper-doll
// equipment layers stacked on top — armor/helmet/weapon/shield/backpack).
// Both are gone: the body is real art now (player_base_sheet.png, see
// BootScene/assets.ts), and worn equipment didn't read well stacked onto
// it, so the project moved to icon-only equipment (item icons in the
// inventory/equip slots, nothing rendered on the character).
// ---------------------------------------------------------------------------

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
  const attacking = pose === "attack";

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
  // On the swing one arm is hauled up over the shoulder, ready to come down.
  const leftArmY = attacking ? 4 : 10 + Math.max(0, swing);
  const rightArmY = attacking ? 12 : 10 + Math.max(0, -swing);
  s.fillRect(1, leftArmY, 3, 8, TROLL.skin);
  s.fillRect(1, leftArmY, 1, 8, TROLL.skinHi);
  s.fillRect(1, leftArmY + 8, 3, 2, TROLL.skinDark); // fist
  if (attacking) {
    s.fillRect(0, 2, 4, 3, TROLL.skinHi); // raised fist clears the shoulder
    s.fillRect(0, 2, 4, 1, TROLL.belly);
  }
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

/**
 * Poses per direction, in sheet order. Frame 0 is idle, 1 and 2 are the walk
 * steps, and 3 is the attack — held briefly on a swing so a blow reads as an
 * action rather than as a number appearing over the target.
 */
const POSES = ["idle", "stepA", "stepB", "attack"];

/** Assemble a 4-direction x 4-frame sheet in DIRECTION_ORDER. */
function directionalFrames(makeFrame) {
  const frames = [];
  for (const direction of ["down", "left", "right", "up"]) {
    for (const pose of POSES) frames.push(makeFrame(direction, pose));
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
function buildingBase({ roof, wall, ridgeY = 3, eaveY = 28, wallY = 30 }) {
  const s = new Sprite(BUILDING_W, BUILDING_H);
  const groundY = 52;

  // --- Ground contact shadow, thrown to the lower right ---
  s.fillRect(4, groundY, BUILDING_W - 6, 2, "#14110f");
  s.fillRect(6, groundY + 2, BUILDING_W - 8, 1, "#1a1712");

  // --- Front wall — extends from wallY all the way down to the ground ---
  s.fillRect(3, wallY, BUILDING_W - 6, groundY - wallY, wall.mid);
  s.fillRect(3, wallY, 2, groundY - wallY, wall.light); // lit left edge
  s.fillRect(BUILDING_W - 5, wallY, 2, groundY - wallY, wall.dark); // shaded right edge
  s.speckleRect(5, wallY + 2, BUILDING_W - 12, groundY - wallY - 3, 26, wall.dark, 71);
  s.speckleRect(5, wallY + 2, BUILDING_W - 12, groundY - wallY - 3, 14, wall.light, 72);

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
  drawDoor(s, 24, 33, 52);
  s.line(24, 33, 24, 51, DOOR_WOOD.dark); // split down the middle

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
  s.line(12, 30, 12, 52, WALL_PLASTER.trim);
  s.line(36, 30, 36, 52, WALL_PLASTER.trim);

  drawDoor(s, 24, 33, 52);
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

  drawDoor(s, 20, 33, 52);
  drawWindow(s, 32, 35, 8, 6, null);
  drawWindow(s, 5, 35, 6, 6, null);

  // Doorstep at the ground line.
  s.fillRect(16, 50, 9, 2, WALL_STONE.light);
  return s;
}

/**
 * The town church: bigger than every other building, stone-walled, red-tiled
 * roof pitched steeply, a bell tower with a small cross topping the ridge. A
 * tall arched door and one big rose window face the street.
 *
 * Sized larger than the standard 48x56 house — 64x80 source — because a
 * church needs to dominate the plaza it stands on. The bottom 2 rows are
 * shadow / ground contact, above that is the wall face; the top ~40 rows are
 * the roof plus steeple.
 */
function buildingChurch() {
  const W = 64;
  const H = 80;
  const s = new Sprite(W, H);
  const wall = WALL_STONE;
  const roof = ROOF_CLAY;
  const ridgeY = 20; // where the roof meets the steeple base
  const eaveY = 48; // roof drops to here at the eave
  const wallY = 50;
  const groundY = 76;

  // Ground shadow
  s.fillRect(4, groundY, W - 6, 2, "#14110f");
  s.fillRect(8, groundY + 2, W - 12, 1, "#1a1712");

  // Wall face — extends all the way to the ground
  s.fillRect(3, wallY, W - 6, groundY - wallY, wall.mid);
  s.fillRect(3, wallY, 2, groundY - wallY, wall.light);
  s.fillRect(W - 5, wallY, 2, groundY - wallY, wall.dark);
  s.speckleRect(5, wallY + 2, W - 12, groundY - wallY - 3, 34, wall.dark, 71);
  s.speckleRect(5, wallY + 2, W - 12, groundY - wallY - 3, 18, wall.light, 72);

  // Roof: main pitched body from ridgeY to eaveY
  s.fillRect(2, eaveY, W - 4, 2, roof.dark); // eave line
  s.fillRect(3, wallY, W - 6, 1, "#1a1512"); // shadow just below eave
  s.fillRect(4, ridgeY, W - 8, eaveY - ridgeY, roof.mid);
  for (let y = ridgeY + 4; y < eaveY; y += 4) {
    s.line(4, y, W - 5, y, roof.dark);
    s.line(4, y + 1, W - 5, y + 1, roof.light);
  }
  // Staggered vertical seams
  for (let y = ridgeY; y < eaveY; y += 4) {
    for (let x = 6 + ((y / 4) % 2) * 4; x < W - 6; x += 8) {
      s.setPixel(x, y + 2, roof.dark);
      s.setPixel(x, y + 3, roof.dark);
    }
  }
  s.fillRect(4, ridgeY, 12, eaveY - ridgeY, roof.light); // lit left face
  s.fillRect(W - 10, ridgeY, 6, eaveY - ridgeY, roof.dark); // shaded right
  // Ridge cap
  s.fillRect(4, ridgeY - 1, W - 8, 2, roof.dark);
  s.fillRect(5, ridgeY - 1, W - 14, 1, roof.hi);

  // Bell tower / steeple: narrow rectangular block rising from the ridge
  const towerW = 14;
  const towerX = Math.floor(W / 2) - Math.floor(towerW / 2);
  const towerTop = 4;
  const towerBase = ridgeY;
  s.fillRect(towerX, towerTop, towerW, towerBase - towerTop, wall.mid);
  s.fillRect(towerX, towerTop, 2, towerBase - towerTop, wall.light);
  s.fillRect(towerX + towerW - 2, towerTop, 2, towerBase - towerTop, wall.dark);
  // Belfry arches (two dark openings)
  s.fillRect(towerX + 3, towerTop + 6, 2, 5, "#0a0a0c");
  s.fillRect(towerX + towerW - 5, towerTop + 6, 2, 5, "#0a0a0c");
  // Tower roof — small pointed pyramid
  s.fillRect(towerX - 1, towerTop - 3, towerW + 2, 3, roof.dark);
  s.fillRect(towerX + 1, towerTop - 5, towerW - 2, 2, roof.mid);
  // Small cross on the very top
  s.setPixel(Math.floor(W / 2), towerTop - 8, "#e6c34a");
  s.setPixel(Math.floor(W / 2), towerTop - 7, "#e6c34a");
  s.setPixel(Math.floor(W / 2), towerTop - 6, "#e6c34a");
  s.setPixel(Math.floor(W / 2) - 1, towerTop - 7, "#e6c34a");
  s.setPixel(Math.floor(W / 2) + 1, towerTop - 7, "#e6c34a");

  // Rose window above the door
  const rwCx = Math.floor(W / 2);
  s.fillCircle(rwCx, wallY + 6, 4, DOOR_WOOD.dark);
  s.fillCircle(rwCx, wallY + 6, 3.2, "#2f3d7a");
  s.fillCircle(rwCx, wallY + 6, 2, "#6fa2ff");
  s.setPixel(rwCx - 1, wallY + 5, "#dfe8ff");
  s.setPixel(rwCx, wallY + 5, "#dfe8ff");

  // Tall double doors — arched at top
  const doorTop = wallY + 12;
  const doorBottom = groundY - 1;
  const doorLeft = rwCx - 6;
  const doorRight = rwCx + 5;
  s.fillRect(doorLeft - 1, doorTop, doorRight - doorLeft + 2, doorBottom - doorTop, DOOR_WOOD.dark);
  s.fillRect(doorLeft, doorTop + 1, doorRight - doorLeft, doorBottom - doorTop - 1, DOOR_WOOD.mid);
  // Split in the middle for double doors
  s.line(rwCx, doorTop + 1, rwCx, doorBottom - 1, DOOR_WOOD.dark);
  // Iron banding
  s.line(doorLeft, doorTop + 4, doorRight, doorTop + 4, "#3a3a3a");
  s.line(doorLeft, doorBottom - 3, doorRight, doorBottom - 3, "#3a3a3a");
  // Handles
  s.setPixel(rwCx - 2, doorTop + Math.floor((doorBottom - doorTop) / 2), "#c9a24a");
  s.setPixel(rwCx + 2, doorTop + Math.floor((doorBottom - doorTop) / 2), "#c9a24a");
  // Arched doorway highlight
  s.setPixel(doorLeft, doorTop + 1, DOOR_WOOD.light);
  s.setPixel(doorLeft + 1, doorTop, DOOR_WOOD.light);

  // Two narrow side windows flanking the door
  drawWindow(s, 8, wallY + 8, 5, 8, null);
  drawWindow(s, W - 13, wallY + 8, 5, 8, null);

  // Doorstep
  s.fillRect(doorLeft - 2, groundY - 2, doorRight - doorLeft + 4, 2, wall.light);
  return s;
}

/** Hanging shop-sign: a wooden plank with a coloured symbol, hung from a small bracket. */
function shopSignSprite(kind) {
  const s = new Sprite(16, 16);
  const bracket = "#3a2717";
  const plank = "#8a6a3d";
  const plankHi = "#a3814f";
  const plankLo = "#5a3d22";
  const chain = "#5c5762";
  const steel = "#c9ccd1";
  const steelHi = "#eef0f3";
  const gold = "#c9a24a";
  const goldHi = "#f0d67a";
  const wood = "#8a6a3d";
  s.fillRect(4, 15, 8, 1, "#0a0a0a");
  s.fillRect(0, 2, 3, 1, bracket);
  s.setPixel(2, 3, bracket);
  s.setPixel(3, 4, chain);
  s.setPixel(11, 4, chain);
  s.fillRect(2, 5, 12, 8, plank);
  s.fillRect(2, 5, 12, 1, plankHi);
  s.fillRect(2, 12, 12, 1, plankLo);
  s.fillRect(2, 5, 1, 8, plankHi);
  s.fillRect(13, 5, 1, 8, plankLo);

  if (kind === "sword-shield") {
    // Sword on the left, shield on the right — the melee shop mark.
    s.fillRect(5, 6, 1, 4, steel);
    s.setPixel(5, 6, steelHi);
    s.fillRect(4, 10, 3, 1, gold);
    s.setPixel(5, 11, wood);
    // Small kite shield
    s.fillRect(9, 7, 4, 4, "#7a2c28");
    s.fillRect(9, 7, 4, 1, "#c9302f");
    s.setPixel(9, 7, "#e05a58");
    s.fillRect(10, 8, 2, 1, gold);
    s.setPixel(11, 10, gold);
    s.line(9, 10, 12, 10, "#5a1e1c");
  } else if (kind === "bow-arrow") {
    // Bow arc on the left, arrow crossing right.
    s.setPixel(5, 6, wood);
    s.setPixel(4, 7, wood);
    s.setPixel(4, 8, wood);
    s.setPixel(4, 9, wood);
    s.setPixel(4, 10, wood);
    s.setPixel(5, 11, wood);
    s.setPixel(5, 7, plankLo);
    s.setPixel(5, 10, plankLo);
    // Bow string
    s.line(5, 7, 5, 10, "#e8e0c8");
    // Arrow shaft
    s.line(6, 8, 12, 8, steel);
    // Arrow head
    s.setPixel(13, 8, steelHi);
    s.setPixel(12, 7, steelHi);
    s.setPixel(12, 9, steelHi);
    // Feather fletching
    s.setPixel(6, 7, "#c9302f");
    s.setPixel(6, 9, "#c9302f");
  } else if (kind === "potion-wand") {
    // Potion left, wand right — the magic shop mark.
    s.fillRect(4, 6, 2, 1, "#c9ccd1"); // cork
    s.setPixel(4, 5, "#3a2717");
    s.setPixel(5, 5, "#3a2717");
    s.fillEllipse(5, 9, 1.6, 2, "#c9302f");
    s.setPixel(4, 8, "#ff8f8b");
    // Wand — brown haft with a lit crystal tip
    s.line(9, 11, 12, 8, wood);
    s.setPixel(13, 7, "#6fb2ff");
    s.setPixel(12, 7, "#c9e6ff");
    s.setPixel(13, 6, "#c9e6ff");
    // Small sparkle
    s.setPixel(11, 5, "#ffe08a");
  } else if (kind === "coin") {
    // Gold coin with a green $ — the bank mark.
    s.fillCircle(8, 9, 3, gold);
    s.fillCircle(8, 9, 2.6, goldHi);
    // $ glyph in green
    const green = "#2f9c3a";
    const greenHi = "#7cff7c";
    s.setPixel(8, 7, green);
    s.setPixel(7, 8, green);
    s.setPixel(8, 8, green);
    s.setPixel(9, 8, green);
    s.setPixel(7, 9, green);
    s.setPixel(8, 9, greenHi);
    s.setPixel(9, 10, green);
    s.setPixel(7, 10, green);
    s.setPixel(8, 10, green);
    s.setPixel(8, 11, green);
    // Vertical bar of the $
    s.setPixel(8, 6, green);
    s.setPixel(8, 12, green);
  } else if (kind === "depot") {
    // Metal strongbox with brass corners — the depot mark.
    const box = "#4a4650";
    const boxHi = "#8a8792";
    const boxLo = "#2c2832";
    s.fillRect(4, 7, 8, 6, box);
    s.fillRect(4, 7, 8, 1, boxHi);
    s.fillRect(4, 12, 8, 1, boxLo);
    // Lid line
    s.fillRect(4, 9, 8, 1, boxLo);
    s.fillRect(4, 10, 8, 1, boxHi);
    // Brass corners
    s.setPixel(4, 7, gold);
    s.setPixel(11, 7, gold);
    s.setPixel(4, 12, gold);
    s.setPixel(11, 12, gold);
    // Lock plate + keyhole in front
    s.fillRect(7, 10, 2, 2, gold);
    s.setPixel(7, 11, "#0a0a0a");
  }
  return s;
}

/**
 * Stone altar — a flat-topped stone block with a lit candle at each end.
 * Used in temple / church interiors as the room's focal point.
 */
function altarSprite() {
  const s = new Sprite(16, 16);
  const stone = "#7d7887";
  const stoneHi = "#a29cac";
  const stoneLo = "#4a4650";
  const cloth = "#c9302f";
  const clothHi = "#e05a58";
  const wax = "#e8e4c0";
  const flame = "#ffe08a";
  s.fillEllipse(8, 15, 6, 1, "#0a0a0a");
  // Altar body (broader base, narrower top gives a plinth silhouette)
  s.fillRect(2, 10, 12, 4, stone);
  s.fillRect(2, 10, 12, 1, stoneHi);
  s.fillRect(2, 13, 12, 1, stoneLo);
  s.fillRect(3, 8, 10, 2, stoneHi); // top slab
  s.fillRect(3, 8, 10, 1, "#c9c4d0"); // lit top edge
  // Red altar cloth draped down the middle
  s.fillRect(6, 7, 4, 8, cloth);
  s.fillRect(6, 7, 4, 1, clothHi);
  s.setPixel(7, 14, clothHi);
  // Candles at each end
  s.fillRect(3, 5, 1, 4, wax);
  s.fillRect(12, 5, 1, 4, wax);
  s.setPixel(3, 4, flame);
  s.setPixel(12, 4, flame);
  return s;
}

/**
 * Stone stairs going up — steps ascending from the bottom of the tile to the
 * top, drawn as receding parallel rectangles for the top-down perspective.
 */
function stairsUpSprite() {
  const s = new Sprite(16, 16);
  const stone = "#7d7887";
  const stoneHi = "#a29cac";
  const stoneLo = "#4a4650";
  const stoneDeep = "#2c2832";
  // Ground shadow
  s.fillRect(0, 15, 16, 1, "#0a0a0a");
  // Landing at the bottom (widest, closest to the viewer)
  s.fillRect(1, 12, 14, 3, stone);
  s.fillRect(1, 12, 14, 1, stoneHi);
  s.fillRect(1, 14, 14, 1, stoneLo);
  // Successive narrower steps going up (receding into the tile)
  s.fillRect(2, 9, 12, 3, stone);
  s.fillRect(2, 9, 12, 1, stoneHi);
  s.fillRect(3, 6, 10, 3, stone);
  s.fillRect(3, 6, 10, 1, stoneHi);
  s.fillRect(4, 3, 8, 3, stone);
  s.fillRect(4, 3, 8, 1, stoneHi);
  // Doorway hole at the very top: the step recedes into shadow.
  s.fillRect(5, 1, 6, 2, stoneDeep);
  s.fillRect(5, 0, 6, 1, "#0a0a0a");
  return s;
}

/** Stone stairs going down — inverse of stairsUp, with a dark pit at the base. */
function stairsDownSprite() {
  const s = new Sprite(16, 16);
  const stone = "#7d7887";
  const stoneHi = "#a29cac";
  const stoneLo = "#4a4650";
  const pit = "#0a0a0c";
  s.fillRect(0, 15, 16, 1, "#0a0a0a");
  // Top rim (widest, above the pit)
  s.fillRect(1, 3, 14, 2, stone);
  s.fillRect(1, 3, 14, 1, stoneHi);
  // Dark pit descending — steps going into darkness
  s.fillRect(3, 5, 10, 9, pit);
  s.fillRect(4, 6, 8, 1, stoneLo);
  s.fillRect(5, 8, 6, 1, stoneLo);
  s.fillRect(6, 10, 4, 1, stoneLo);
  s.fillRect(7, 12, 2, 1, stoneLo);
  // Front lip of the pit
  s.fillRect(1, 14, 14, 1, stone);
  s.fillRect(1, 14, 14, 1, stoneLo);
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
  for (let y = 32; y < 52; y += 4) {
    s.line(4, y, BUILDING_W - 5, y, WALL_STONE.dark);
    for (let x = 6 + ((y / 4) % 2) * 5; x < BUILDING_W - 5; x += 10) {
      s.line(x, y, x, Math.min(y + 3, 51), WALL_STONE.dark);
    }
  }

  drawDoor(s, 24, 34, 52);

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
// Unique house variants — each is a different SIZE and SHAPE, not just a
// repaint. Varying footprints (2-wide, 3-wide, 4-wide, 5-wide), roof
// pitches (steep A-frame, shallow, flat, asymmetric), wall construction
// (horizontal logs, stacked stone, brick coursing, timber-frame, plaster),
// and window types.
// ---------------------------------------------------------------------------

const WALL_BRICK = { dark: "#5a2820", mid: "#8a3c2a", light: "#a84e38", trim: "#3a1a10" };
const WALL_TIMBER = { dark: "#2a1a0c", mid: "#3a2812", light: "#4a3520", trim: "#1a0e06" };
const WALL_LOG = { dark: "#3a2810", mid: "#5a4020", light: "#6a5030", trim: "#2a1a08" };
const WALL_FIELDSTONE = { dark: "#484440", mid: "#686460", light: "#888078", trim: "#383430" };
const WALL_WARM = { dark: "#7a6040", mid: "#b89868", light: "#d4b480", trim: "#5a3a1a" };
const ROOF_MOSS = { dark: "#2a4020", mid: "#3a5a2a", light: "#4a6a35", hi: "#6a8a50" };

/**
 * Timber hall — 4 tiles wide (64x56). Long building with timber-frame walls,
 * a shallow-pitched slate roof, a row of three windows and a door at one end.
 */
function buildingTimberHall() {
  const W = 64, H = 56;
  const s = new Sprite(W, H);
  const wall = WALL_PLASTER;
  const trim = WALL_TIMBER;
  const roof = ROOF_SLATE;
  const wallY = 30, groundY = 52;

  // Ground shadow
  s.fillRect(4, groundY, W - 6, 2, "#14110f");
  s.fillRect(6, groundY + 2, W - 8, 1, "#1a1712");
  // Front wall — white plaster, extends to ground
  s.fillRect(3, wallY, W - 6, groundY - wallY, wall.mid);
  s.fillRect(3, wallY, 2, groundY - wallY, wall.light);
  s.fillRect(W - 5, wallY, 2, groundY - wallY, wall.dark);
  s.speckleRect(5, wallY + 2, W - 12, groundY - wallY - 3, 30, wall.dark, 71);

  // Timber framing — vertical posts + horizontal rails
  for (const x of [3, 18, 33, 48, W - 4]) {
    s.fillRect(x, wallY, 2, groundY - wallY, trim.mid);
    s.fillRect(x + 1, wallY, 1, groundY - wallY, trim.dark);
  }
  s.fillRect(3, 37, W - 6, 2, trim.mid);
  s.fillRect(3, 38, W - 6, 1, trim.dark);

  // Shallow roof — ridge sits higher (less slope), only 8px from top
  const ridgeY = 8, eaveY = 28;
  s.fillRect(2, eaveY, W - 4, 2, roof.dark);
  s.fillRect(3, wallY, W - 6, 1, "#1a1512");
  s.fillRect(2, ridgeY, W - 4, eaveY - ridgeY, roof.mid);
  for (let y = ridgeY + 5; y < eaveY; y += 5) {
    s.line(2, y, W - 3, y, roof.dark);
    s.line(2, y + 1, W - 3, y + 1, roof.light);
  }
  s.fillRect(2, ridgeY, 14, eaveY - ridgeY, roof.light);
  s.fillRect(W - 10, ridgeY, 8, eaveY - ridgeY, roof.dark);
  s.fillRect(2, ridgeY - 1, W - 4, 2, roof.dark);
  s.fillRect(3, ridgeY - 1, W - 10, 1, roof.hi);

  // Three windows across — evenly spaced
  drawWindow(s, 7, 33, 6, 6, null);
  drawWindow(s, 23, 33, 6, 6, null);
  drawWindow(s, 39, 33, 6, 6, null);

  // Door at the right end
  drawDoor(s, 54, 33, groundY);

  // Chimney left
  s.fillRect(6, 2, 6, 8, WALL_STONE.dark);
  s.fillRect(7, 3, 4, 6, WALL_STONE.mid);
  s.fillRect(5, 2, 8, 2, WALL_STONE.light);
  return s;
}

/**
 * Tower house — 2 tiles wide, 3 tall (32x64). Narrow stone tower with a
 * steep pointed roof, arrow-slit window, heavy studded door.
 */
function buildingTowerHouse() {
  const W = 32, H = 64;
  const s = new Sprite(W, H);
  const wall = WALL_STONE;
  const roof = ROOF_SLATE;
  const wallY = 30, groundY = 60;

  // Ground shadow
  s.fillRect(3, groundY, W - 4, 2, "#14110f");
  s.fillRect(4, groundY + 2, W - 6, 1, "#1a1712");
  // Wall — coursed stone blocks, extends to ground
  s.fillRect(2, wallY, W - 4, groundY - wallY, wall.mid);
  s.fillRect(2, wallY, 2, groundY - wallY, wall.light);
  s.fillRect(W - 4, wallY, 2, groundY - wallY, wall.dark);
  for (let y = wallY + 3; y < groundY; y += 4) {
    s.line(3, y, W - 4, y, wall.dark);
    for (let x = 4 + ((y / 4) % 2) * 4; x < W - 4; x += 8) {
      s.line(x, y, x, Math.min(y + 3, groundY - 1), wall.dark);
    }
  }

  // Steep pointed roof — tall triangle
  const ridgeY = 2, eaveY = 28;
  s.fillRect(1, eaveY, W - 2, 2, roof.dark);
  s.fillRect(2, wallY, W - 4, 1, "#1a1512");
  // Fill the triangular area
  for (let y = ridgeY; y < eaveY; y++) {
    const progress = (y - ridgeY) / (eaveY - ridgeY);
    const halfW = Math.floor(progress * (W / 2 - 2));
    const cx = Math.floor(W / 2);
    s.fillRect(cx - halfW, y, halfW * 2 + 1, 1, roof.mid);
    if (y % 4 === 0) s.fillRect(cx - halfW, y, halfW * 2 + 1, 1, roof.dark);
    if (y % 4 === 1) s.fillRect(cx - halfW, y, halfW * 2 + 1, 1, roof.light);
    if (halfW > 3) s.fillRect(cx - halfW, y, 3, 1, roof.light);
  }
  // Pointed cap
  s.setPixel(Math.floor(W / 2), ridgeY - 1, roof.dark);
  s.setPixel(Math.floor(W / 2), ridgeY, roof.dark);

  // Arrow slit — narrow vertical window
  s.fillRect(13, 35, 4, 10, wall.dark);
  s.fillRect(14, 36, 2, 8, GLASS.dark);
  s.fillRect(14, 36, 1, 2, GLASS.sheen);

  // Heavy studded door — narrower
  const dx = 9, dw = 12;
  s.fillRect(dx - 1, 40, dw + 2, groundY - 40, DOOR_WOOD.dark);
  s.fillRect(dx, 41, dw, groundY - 41, DOOR_WOOD.mid);
  s.fillRect(dx, 41, 1, groundY - 41, DOOR_WOOD.light);
  // Iron studs
  for (let sy = 43; sy < groundY - 2; sy += 4) {
    s.setPixel(dx + 2, sy, "#5a5a5a");
    s.setPixel(dx + dw - 3, sy, "#5a5a5a");
  }
  s.setPixel(dx + dw - 4, 46, "#c9a24a"); // handle
  return s;
}

/**
 * Log cabin — 3x3 but with a steep A-frame thatch roof that rises well above
 * the standard roofline, and horizontal log walls instead of plaster.
 */
function buildingLogCabin() {
  const W = 48, H = 62;
  const s = new Sprite(W, H);
  const log = WALL_LOG;
  const roof = ROOF_THATCH;
  const wallY = 34, groundY = 58;

  // Ground shadow
  s.fillRect(4, groundY, W - 6, 2, "#14110f");
  s.fillRect(6, groundY + 2, W - 8, 1, "#1a1712");
  // Log walls — horizontal round logs with notched corners, extends to ground
  s.fillRect(3, wallY, W - 6, groundY - wallY, log.mid);
  for (let y = wallY; y < groundY; y += 3) {
    s.fillRect(3, y, W - 6, 1, log.light);
    s.fillRect(3, y + 2, W - 6, 1, log.dark);
  }
  // Notched log ends at corners
  for (let y = wallY; y < groundY; y += 3) {
    s.fillRect(1, y, 3, 2, log.mid);
    s.fillRect(1, y, 3, 1, log.light);
    s.fillRect(W - 4, y, 3, 2, log.mid);
    s.fillRect(W - 4, y, 3, 1, log.dark);
  }

  // Steep A-frame roof — triangle reaches almost to the top
  const ridgeY = 2, eaveY = 32;
  s.fillRect(0, eaveY, W, 2, roof.dark);
  for (let y = ridgeY; y < eaveY; y++) {
    const progress = (y - ridgeY) / (eaveY - ridgeY);
    const halfW = Math.floor(progress * (W / 2));
    const cx = Math.floor(W / 2);
    s.fillRect(cx - halfW, y, halfW * 2 + 1, 1, roof.mid);
  }
  s.speckleRect(4, ridgeY + 2, W - 8, eaveY - ridgeY - 4, 80, roof.dark, 91);
  s.speckleRect(4, ridgeY + 2, W - 8, eaveY - ridgeY - 4, 50, roof.hi, 92);
  // Brighten the left face
  for (let y = ridgeY; y < eaveY; y++) {
    const progress = (y - ridgeY) / (eaveY - ridgeY);
    const halfW = Math.floor(progress * (W / 2));
    const cx = Math.floor(W / 2);
    s.fillRect(cx - halfW, y, Math.min(6, halfW), 1, roof.light);
  }
  // Ridge cap
  s.setPixel(W / 2, ridgeY, roof.dark);
  s.fillRect(W / 2 - 1, ridgeY + 1, 3, 1, roof.dark);

  drawDoor(s, 24, 37, groundY);

  // Single square window with wooden shutters
  s.fillRect(6, 38, 8, 7, DOOR_WOOD.dark);
  s.fillRect(7, 39, 6, 5, GLASS.dark);
  s.fillRect(7, 39, 2, 1, GLASS.sheen);
  s.line(10, 39, 10, 43, DOOR_WOOD.dark);
  // Wooden shutters
  s.fillRect(4, 38, 2, 7, log.mid);
  s.fillRect(14, 38, 2, 7, log.mid);

  // Smoke hole in the A-frame (no chimney — rustic)
  s.fillRect(22, ridgeY + 6, 4, 3, "#0f0d0c");
  return s;
}

/**
 * Workshop — 3x3 with a FLAT roof (low parapet instead of pitched), stone
 * block walls, wide double doors, a pulley beam jutting out from the wall.
 */
function buildingWorkshop() {
  const W = 48, H = 50;
  const s = new Sprite(W, H);
  const wall = WALL_STONE;
  const wallY = 12, groundY = 46;

  // Ground shadow
  s.fillRect(4, groundY, W - 6, 2, "#14110f");
  s.fillRect(6, groundY + 2, W - 8, 1, "#1a1712");
  // Wall — coursed stone, extends to ground
  s.fillRect(3, wallY, W - 6, groundY - wallY, wall.mid);
  s.fillRect(3, wallY, 2, groundY - wallY, wall.light);
  s.fillRect(W - 5, wallY, 2, groundY - wallY, wall.dark);
  for (let y = wallY + 3; y < groundY; y += 4) {
    s.line(4, y, W - 5, y, wall.dark);
    for (let x = 5 + ((y / 4) % 2) * 5; x < W - 5; x += 10) {
      s.line(x, y, x, Math.min(y + 3, groundY - 1), wall.dark);
    }
  }

  // Flat roof — just a dark parapet along the top
  s.fillRect(2, wallY - 3, W - 4, 4, wall.dark);
  s.fillRect(3, wallY - 3, W - 6, 1, wall.light); // lit top edge
  // Crenellation-style notches for interest
  for (let x = 6; x < W - 6; x += 8) {
    s.fillRect(x, wallY - 3, 4, 2, wall.mid);
    s.fillRect(x, wallY - 3, 4, 1, wall.light);
  }

  // Wide double doors
  const dLeft = 15, dW = 18;
  s.fillRect(dLeft - 1, 22, dW + 2, groundY - 22, DOOR_WOOD.dark);
  s.fillRect(dLeft, 23, dW, groundY - 23, DOOR_WOOD.mid);
  s.fillRect(dLeft, 23, 1, groundY - 23, DOOR_WOOD.light);
  s.line(dLeft + dW / 2, 23, dLeft + dW / 2, groundY - 1, DOOR_WOOD.dark);
  // Iron banding
  s.line(dLeft, 28, dLeft + dW - 1, 28, "#3a3a3a");
  s.line(dLeft, 33, dLeft + dW - 1, 33, "#3a3a3a");
  // Handles
  s.setPixel(dLeft + dW / 2 - 2, 30, "#c9a24a");
  s.setPixel(dLeft + dW / 2 + 2, 30, "#c9a24a");

  // Small window beside the door
  drawWindow(s, 37, 25, 6, 6, null);

  // Pulley beam jutting out above the door
  s.fillRect(22, wallY - 6, 3, 4, WALL_TIMBER.mid);
  s.fillRect(22, wallY - 6, 1, 4, WALL_TIMBER.light);
  s.setPixel(23, wallY - 7, "#5a5a5a"); // pulley wheel
  s.line(23, wallY - 7, 23, wallY - 4, "#3a3a3a"); // rope
  return s;
}

/**
 * Farmhouse — 5 tiles wide (80x56). A long, low building with a stone base
 * and timber-frame upper section, thatched roof, multiple windows and a
 * door offset to one side. Reads as two houses joined together.
 */
function buildingFarmhouse() {
  const W = 80, H = 56;
  const s = new Sprite(W, H);
  const roof = ROOF_THATCH;
  const wallY = 30, groundY = 52;

  // Ground shadow
  s.fillRect(4, groundY, W - 6, 2, "#14110f");
  s.fillRect(6, groundY + 2, W - 8, 1, "#1a1712");
  // Wall — warm plaster with timber framing, extends to ground
  s.fillRect(3, wallY, W - 6, groundY - wallY, WALL_WARM.mid);
  s.fillRect(3, wallY, 2, groundY - wallY, WALL_WARM.light);
  s.fillRect(W - 5, wallY, 2, groundY - wallY, WALL_WARM.dark);
  s.speckleRect(5, wallY + 1, W - 12, groundY - wallY - 2, 15, WALL_WARM.dark, 55);
  // Timber frame dividers
  s.fillRect(3, 37, W - 6, 1, WALL_TIMBER.mid); // horizontal rail
  for (const x of [3, 20, 40, 60, W - 4]) {
    s.fillRect(x, wallY, 2, groundY - wallY, WALL_TIMBER.mid);
    s.fillRect(x + 1, wallY, 1, groundY - wallY, WALL_TIMBER.dark);
  }

  // Roof — broad thatch, lower slope
  const ridgeY = 6, eaveY = 28;
  s.fillRect(1, eaveY, W - 2, 2, roof.dark);
  s.fillRect(3, wallY, W - 6, 1, "#1a1512");
  s.fillRect(2, ridgeY, W - 4, eaveY - ridgeY, roof.mid);
  s.speckleRect(3, ridgeY + 1, W - 6, eaveY - ridgeY - 2, 90, roof.dark, 41);
  s.speckleRect(3, ridgeY + 1, W - 6, eaveY - ridgeY - 2, 55, roof.hi, 42);
  s.fillRect(2, ridgeY, 16, eaveY - ridgeY, roof.light);
  s.fillRect(W - 10, ridgeY, 8, eaveY - ridgeY, roof.dark);
  // Ragged bottom edge
  for (let x = 2; x < W - 2; x += 3) s.setPixel(x, eaveY + 1, roof.dark);
  // Ridge cap
  s.fillRect(2, ridgeY - 1, W - 4, 2, roof.dark);
  s.fillRect(3, ridgeY - 1, W - 10, 1, roof.hi);

  // Four windows across
  drawWindow(s, 6, 32, 6, 5, "#5a3d22");
  drawWindow(s, 24, 32, 6, 5, null);
  drawWindow(s, 46, 32, 6, 5, null);
  drawWindow(s, 64, 32, 6, 5, "#5a3d22");

  // Door offset to the left third
  drawDoor(s, 36, 33, groundY);

  // Chimney offset right
  s.fillRect(58, 0, 7, 10, WALL_STONE.dark);
  s.fillRect(59, 1, 5, 8, WALL_STONE.mid);
  s.fillRect(59, 1, 2, 8, WALL_STONE.light);
  s.fillRect(57, 0, 9, 2, WALL_STONE.light);
  s.fillRect(60, 2, 3, 2, "#0f0d0c");

  // Second chimney left (reads as two homes joined)
  s.fillRect(10, 0, 6, 8, WALL_STONE.dark);
  s.fillRect(11, 1, 4, 6, WALL_STONE.mid);
  s.fillRect(9, 0, 8, 2, WALL_STONE.light);
  s.fillRect(12, 2, 2, 1, "#0f0d0c");
  return s;
}

/**
 * L-house — an L-shaped building built as a 4x4 footprint. The sprite shows
 * the rooflines of the two wings meeting at a right angle, with a courtyard
 * gap in one corner (that corner is still blocked because the footprint is
 * rectangular, but the visual reads as an L).
 *
 * Wing A runs the full width (4 tiles), wing B extends south on the right
 * side (2 tiles wide). The empty corner at bottom-left has a small porch
 * / covered area with barrels, making it look like a private yard.
 */
function buildingLHouse() {
  const W = 64, H = 72;
  const s = new Sprite(W, H);
  const wall = WALL_BRICK;
  const roof = ROOF_CLAY;

  // --- Wing A: the main front wing, spanning the full 4-tile width ---
  const wAWallY = 30, wAGroundY = 48;
  // Wall — brick, extends to ground
  s.fillRect(3, wAWallY, W - 6, wAGroundY - wAWallY, wall.mid);
  s.fillRect(3, wAWallY, 2, wAGroundY - wAWallY, wall.light);
  s.fillRect(W - 5, wAWallY, 2, wAGroundY - wAWallY, wall.dark);
  for (let y = wAWallY + 2; y < wAGroundY; y += 3) {
    s.line(4, y, W - 5, y, wall.dark);
    const off = ((y / 3) % 2) * 4;
    for (let x = 5 + off; x < W - 5; x += 8) {
      s.line(x, y, x, Math.min(y + 2, wAGroundY - 1), wall.dark);
    }
  }
  // Eave
  s.fillRect(1, wAWallY - 2, W - 2, 2, roof.dark);
  s.fillRect(3, wAWallY, W - 6, 1, "#1a1512");
  // Roof
  const ridgeAY = 6, eaveAY = wAWallY - 2;
  s.fillRect(2, ridgeAY, W - 4, eaveAY - ridgeAY, roof.mid);
  for (let y = ridgeAY + 3; y < eaveAY; y += 4) {
    s.line(2, y, W - 3, y, roof.dark);
    s.line(2, y + 1, W - 3, y + 1, roof.light);
  }
  s.fillRect(2, ridgeAY, 12, eaveAY - ridgeAY, roof.light);
  s.fillRect(W - 10, ridgeAY, 8, eaveAY - ridgeAY, roof.dark);
  s.fillRect(2, ridgeAY - 1, W - 4, 2, roof.dark);
  s.fillRect(3, ridgeAY - 1, W - 10, 1, roof.hi);

  // Windows on wing A
  drawWindow(s, 6, 32, 6, 6, null);
  drawWindow(s, 22, 32, 6, 6, null);
  // Door on wing A left side
  drawDoor(s, 42, 32, wAGroundY);

  // --- Wing B: extends south from the right half ---
  const wBLeft = 32, wBRight = W - 3;
  const wBWallY = wAGroundY, wBGroundY = 68;

  // Ground shadow for wing B
  s.fillRect(wBLeft + 1, wBGroundY, wBRight - wBLeft - 1, 2, "#14110f");
  // Wall — brick, extends to ground
  s.fillRect(wBLeft, wBWallY, wBRight - wBLeft, wBGroundY - wBWallY, wall.mid);
  s.fillRect(wBLeft, wBWallY, 2, wBGroundY - wBWallY, wall.light);
  s.fillRect(wBRight - 2, wBWallY, 2, wBGroundY - wBWallY, wall.dark);
  for (let y = wBWallY + 2; y < wBGroundY; y += 3) {
    s.line(wBLeft + 1, y, wBRight - 1, y, wall.dark);
  }
  // Wing B roof — perpendicular to wing A, shorter
  const ridgeBY = wBWallY - 10, eaveBY = wBWallY;
  s.fillRect(wBLeft - 1, eaveBY - 2, wBRight - wBLeft + 2, 2, roof.dark);
  s.fillRect(wBLeft, ridgeBY, wBRight - wBLeft, eaveBY - ridgeBY - 2, roof.mid);
  for (let y = ridgeBY + 3; y < eaveBY - 2; y += 4) {
    s.line(wBLeft, y, wBRight, y, roof.dark);
    s.line(wBLeft, y + 1, wBRight, y + 1, roof.light);
  }
  s.fillRect(wBLeft, ridgeBY, 6, eaveBY - ridgeBY - 2, roof.light);
  s.fillRect(wBLeft, ridgeBY - 1, wBRight - wBLeft, 2, roof.dark);
  s.fillRect(wBLeft + 1, ridgeBY - 1, wBRight - wBLeft - 6, 1, roof.hi);

  // Window on wing B
  drawWindow(s, wBLeft + 6, wBWallY + 2, 6, 6, null);
  // Door on wing B
  drawDoor(s, wBLeft + 18, wBWallY + 2, wBGroundY);

  // --- Courtyard in the empty L-corner (bottom-left) ---
  // Covered porch — a small wooden awning from wing A's south wall
  s.fillRect(5, wAGroundY - 2, 24, 2, WALL_TIMBER.mid);
  s.fillRect(5, wAGroundY - 2, 24, 1, WALL_TIMBER.light);
  // Support posts
  s.fillRect(5, wAGroundY, 2, 8, WALL_TIMBER.mid);
  s.fillRect(27, wAGroundY, 2, 8, WALL_TIMBER.mid);
  // Courtyard dressing — barrels and crate under the porch
  s.fillRect(9, wAGroundY + 2, 5, 4, "#5a3d22"); // barrel
  s.fillRect(9, wAGroundY + 2, 5, 1, "#6a4a2a"); // barrel lit
  s.fillRect(16, wAGroundY + 3, 4, 4, "#4a3a28"); // crate
  s.fillRect(16, wAGroundY + 3, 4, 1, "#5a4a38"); // crate lit

  // Chimney on wing A
  s.fillRect(14, 0, 7, 8, wall.dark);
  s.fillRect(15, 1, 5, 6, wall.mid);
  s.fillRect(13, 0, 9, 2, wall.mid);
  s.fillRect(16, 2, 3, 1, "#0f0d0c");
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

/** Della the grocer: cream shirt, green apron, sleeves rolled up for a day of shelf-stocking. */
function grocerFrame() {
  const s = new Sprite(16, 16);
  const shirt = "#e8e0c8";
  const shirtLo = "#c8bfa0";
  const apron = "#4a7a4a";
  const apronHi = "#5c945c";
  const apronLo = "#365a36";
  const skin = "#d9a06c";
  const hair = "#7a4a26";
  s.fillRect(6, 12, 2, 2, "#3a2717");
  s.fillRect(8, 12, 2, 2, "#3a2717");
  // Long apron over the shirt, straps crossing at the chest
  s.fillRect(5, 9, 6, 4, apron);
  s.fillRect(5, 9, 1, 4, apronLo);
  s.fillRect(10, 9, 1, 4, apronLo);
  s.fillRect(6, 10, 4, 1, apronHi); // pocket seam
  // Shirt visible above the apron and at the rolled-up sleeves
  s.fillRect(4, 6, 8, 4, shirt);
  s.fillRect(4, 6, 8, 1, shirtLo);
  s.fillRect(6, 8, 4, 1, apron); // apron bib
  s.setPixel(6, 8, apronHi);
  s.setPixel(9, 8, apronHi);
  // Arms, sleeves rolled to the elbow
  s.fillRect(3, 7, 1, 2, shirt);
  s.fillRect(12, 7, 1, 2, shirt);
  s.setPixel(3, 9, skin);
  s.setPixel(12, 9, skin);
  // Head
  s.fillCircle(8, 3, 2.4, skin);
  s.fillRect(6, 1, 4, 1, hair);
  s.setPixel(5, 2, hair);
  s.setPixel(10, 2, hair);
  s.setPixel(7, 3, "#241a12");
  s.setPixel(9, 3, "#241a12");
  return s;
}

/** The banker: dark waistcoat, a coin pouch at the hip, silver chain. */
function bankerFrame() {
  const s = new Sprite(16, 16);
  const coat = "#2b2830";
  const coatHi = "#3d3947";
  const shirt = "#e8e0c8";
  const skin = "#c98a5c";
  const gold = "#c9a24a";
  const boot = "#3a2717";
  s.fillRect(6, 12, 2, 2, boot);
  s.fillRect(8, 12, 2, 2, boot);
  // Long dark trousers under the waistcoat
  s.fillRect(6, 9, 2, 3, "#1c1a20");
  s.fillRect(8, 9, 2, 3, "#1c1a20");
  // Waistcoat body
  s.fillRect(4, 6, 8, 6, coat);
  s.fillRect(4, 6, 8, 1, coatHi);
  s.fillRect(7, 6, 2, 5, shirt); // shirt / cravat down the middle
  s.setPixel(7, 7, gold); // pocket-watch chain
  s.setPixel(8, 7, gold);
  // Arms
  s.fillRect(3, 7, 1, 3, coat);
  s.fillRect(12, 7, 1, 3, coat);
  // Coin pouch at the hip
  s.fillRect(11, 9, 2, 2, "#5a3d22");
  s.setPixel(11, 9, gold);
  s.setPixel(12, 9, gold);
  // Head
  s.fillCircle(8, 3, 2.4, skin);
  s.fillRect(6, 1, 4, 1, "#241a12"); // hair
  s.setPixel(7, 3, "#241a12");
  s.setPixel(9, 3, "#241a12");
  return s;
}

/** Father Aldwin, the temple priest: white cassock, gold sash, holy symbol at the neck. */
function priestFrame() {
  const s = new Sprite(16, 16);
  const cassock = "#e8e4d0";
  const cassockDark = "#b8b4a0";
  const cassockLo = "#8a8770";
  const gold = "#c9a24a";
  const goldHi = "#f0d67a";
  const skin = "#e0b58a";
  s.setPixel(6, 13, "#241a12");
  s.setPixel(9, 13, "#241a12");
  // Long white cassock reaching the ground
  s.fillRect(5, 9, 6, 4, cassock);
  s.fillRect(5, 9, 1, 4, cassockDark);
  s.fillRect(10, 9, 1, 4, cassockDark);
  s.fillRect(5, 12, 6, 1, cassockLo);
  // Gold rope belt
  s.fillRect(5, 11, 6, 1, gold);
  // Upper body
  s.fillRect(5, 6, 6, 4, cassock);
  s.fillRect(5, 6, 1, 4, cassockDark);
  s.fillRect(10, 6, 1, 4, cassockDark);
  // Arms
  s.fillRect(4, 7, 1, 3, cassock);
  s.fillRect(11, 7, 1, 3, cassock);
  // Holy symbol pendant
  s.setPixel(8, 7, gold);
  s.setPixel(8, 8, goldHi);
  s.setPixel(7, 8, gold);
  s.setPixel(9, 8, gold);
  // Head with short tonsure fringe
  s.fillCircle(8, 3, 2.4, skin);
  s.fillRect(6, 1, 4, 1, "#5a3d22");
  s.setPixel(7, 3, "#241a12");
  s.setPixel(9, 3, "#241a12");
  return s;
}

/** Fenn the Fletcher: green cloak, quiver over the shoulder, bow at the hip. */
function fennFrame() {
  const s = new Sprite(16, 16);
  const cloak = "#3a6b2a";
  const cloakDark = "#254a1a";
  const skin = "#e0b58a";
  const boot = "#4a2f1a";
  const bow = "#8a6a3d";

  // boots + trousers, seen under the tunic hem
  s.fillRect(6, 12, 2, 2, boot);
  s.fillRect(8, 12, 2, 2, boot);
  s.fillRect(6, 10, 2, 2, "#5a4028");
  s.fillRect(8, 10, 2, 2, "#5a4028");
  // tunic body, belted
  s.fillRect(4, 6, 8, 5, cloak);
  s.fillRect(4, 6, 8, 1, cloakDark);
  s.fillRect(4, 10, 8, 1, "#4a2f1a"); // belt
  // arms
  s.fillRect(3, 7, 1, 3, cloak);
  s.fillRect(12, 7, 1, 3, cloak);
  // hood + face
  s.fillCircle(8, 3, 2.8, cloakDark);
  s.fillEllipse(8, 4, 1.8, 1.5, skin);
  s.setPixel(7, 4, "#241a12");
  s.setPixel(9, 4, "#241a12");
  // quiver over the right shoulder, arrows fletched grey
  s.fillRect(11, 3, 2, 5, "#5a3d22");
  s.setPixel(11, 3, "#c9c9c9");
  s.setPixel(12, 3, "#c9c9c9");
  s.setPixel(13, 3, "#c9c9c9");
  // slung bow at the left hip
  s.line(2, 8, 2, 12, bow);
  s.setPixel(1, 8, bow);
  s.setPixel(1, 12, bow);
  s.line(2, 8, 2, 12, "#e8e0c8"); // bowstring, subtle
  return s;
}

/** Farmer: straw hat, roll-sleeve tunic, brown apron. Background prop, no dialogue. */
function farmerFrame(variant = 0) {
  const s = new Sprite(16, 16);
  const skin = "#c98a5c";
  const straw = "#c9a24a";
  const strawDark = "#8a6a1a";
  const tunic = variant === 0 ? "#a89060" : "#7a5c3e";
  const tunicDark = variant === 0 ? "#7a6338" : "#5a3d22";
  const trousers = "#3a2717";

  s.fillRect(6, 12, 2, 2, trousers);
  s.fillRect(8, 12, 2, 2, trousers);
  // tunic body
  s.fillRect(4, 6, 8, 6, tunic);
  s.fillRect(4, 6, 8, 1, tunicDark);
  // apron front
  s.fillRect(6, 7, 4, 5, "#8a6a3d");
  s.fillRect(6, 7, 4, 1, "#5a3d22");
  // arms (skin at forearm)
  s.fillRect(3, 7, 1, 3, tunic);
  s.fillRect(12, 7, 1, 3, tunic);
  s.setPixel(3, 10, skin);
  s.setPixel(12, 10, skin);
  // head
  s.fillCircle(8, 3, 2.4, skin);
  s.setPixel(7, 3, "#241a12");
  s.setPixel(9, 3, "#241a12");
  // straw hat brim + crown
  s.fillRect(4, 1, 8, 1, straw);
  s.fillRect(4, 2, 8, 1, strawDark);
  s.fillRect(6, 0, 4, 1, straw);
  return s;
}

/**
 * Small farm animals — chickens, sheep, cats. Rendered as one-tile sprites,
 * intentionally short and low-detail so they sit as background dressing
 * beside the player rather than reading as gameplay enemies. Anchored at
 * the bottom-right like everything else so their tile aligns with prop
 * placement (see tileAnchor / origin(1,1) in WorldScene).
 */
function chickenSprite() {
  const s = new Sprite(16, 16);
  const body = "#e8e4d4";
  const bodyDark = "#b8b4a4";
  const beak = "#e6c34a";
  const comb = "#c9302f";
  // ground shadow
  s.fillEllipse(8, 13, 2.8, 0.9, "#000000");
  // body
  s.fillEllipse(8, 11, 3, 2, body);
  s.fillEllipse(8, 12, 3, 1, bodyDark);
  // head
  s.fillCircle(10, 9, 1.5, body);
  s.setPixel(11, 9, "#1a1a1a"); // eye
  // beak + comb
  s.setPixel(12, 9, beak);
  s.setPixel(10, 7, comb);
  s.setPixel(11, 7, comb);
  // legs
  s.setPixel(7, 13, beak);
  s.setPixel(9, 13, beak);
  return s;
}

function sheepSprite() {
  const s = new Sprite(16, 16);
  const fleece = "#e4e0d0";
  const fleeceHi = "#f4f0e0";
  const fleeceLo = "#b8b4a4";
  const face = "#3a2a1c";
  // ground shadow
  s.fillEllipse(8, 14, 4.5, 1.1, "#000000");
  // fleece body
  s.fillEllipse(8, 11, 5, 2.6, fleece);
  s.fillEllipse(8, 10, 4.5, 2, fleeceHi);
  // bumps around the silhouette for the woolly look
  s.setPixel(4, 10, fleeceHi);
  s.setPixel(6, 8, fleeceHi);
  s.setPixel(9, 8, fleeceHi);
  s.setPixel(12, 10, fleeceHi);
  s.setPixel(4, 12, fleeceLo);
  s.setPixel(12, 12, fleeceLo);
  // dark face
  s.fillCircle(4, 10, 1.5, face);
  s.setPixel(4, 10, "#f0f0f0"); // eye
  // dark legs
  s.fillRect(5, 13, 1, 1, face);
  s.fillRect(7, 13, 1, 1, face);
  s.fillRect(10, 13, 1, 1, face);
  s.fillRect(12, 13, 1, 1, face);
  return s;
}

function catSprite() {
  const s = new Sprite(16, 16);
  const fur = "#c9762a";
  const furDark = "#8a4a1a";
  const furLo = "#5a2f0a";
  // ground shadow
  s.fillEllipse(8, 13, 3, 0.8, "#000000");
  // body
  s.fillEllipse(9, 11, 3.4, 1.6, fur);
  s.fillEllipse(9, 11, 3.4, 1.4, fur);
  // stripes
  s.setPixel(8, 10, furDark);
  s.setPixel(10, 10, furDark);
  // head
  s.fillCircle(5, 9, 1.7, fur);
  // ears
  s.setPixel(4, 7, fur);
  s.setPixel(6, 7, fur);
  s.setPixel(4, 8, furDark);
  s.setPixel(6, 8, furDark);
  // eyes + nose
  s.setPixel(4, 9, "#1a2a1a");
  s.setPixel(6, 9, "#1a2a1a");
  s.setPixel(5, 10, furLo);
  // tail curling up-back
  s.setPixel(12, 11, fur);
  s.setPixel(13, 10, fur);
  s.setPixel(13, 9, fur);
  // legs
  s.setPixel(6, 13, furLo);
  s.setPixel(9, 13, furLo);
  s.setPixel(11, 13, furLo);
  return s;
}

/**
 * Warm plank floor for the inside of houses and shops. Buildings are drawn
 * roofless — walls and floor visible from above — so this tile is what the
 * player is standing on whenever they step under a doorway.
 */
function woodFloorTile() {
  const s = new Sprite(16, 16);
  const plankMid = "#8a6a3d";
  const plankHi = "#a3814f";
  const plankLo = "#5a3d22";
  const gap = "#3a2717";
  // Two horizontal courses of planks, staggered so the seams don't line up.
  const courses = [
    { y: 0, h: 7, xs: [0, 6, 12] },
    { y: 7, h: 9, xs: [0, 4, 10] },
  ];
  for (const c of courses) {
    for (let i = 0; i < c.xs.length; i++) {
      const x = c.xs[i];
      const w = (c.xs[i + 1] ?? 16) - x - 1;
      if (w <= 0) continue;
      s.fillRect(x, c.y, w, c.h - 1, plankMid);
      s.fillRect(x, c.y, w, 1, plankHi);
      s.fillRect(x, c.y + c.h - 2, w, 1, plankLo);
      s.setPixel(x + 1, c.y + 1, plankHi);
    }
    s.fillRect(0, c.y + c.h - 1, 16, 1, gap); // course gap
  }
  // A few knot-holes to break the pattern.
  s.setPixel(3, 4, plankLo);
  s.setPixel(11, 3, plankLo);
  s.setPixel(6, 11, plankLo);
  s.setPixel(13, 12, plankLo);
  return s;
}

/**
 * Small hero statue on a stone pedestal: the plaza centrepiece. Blocks
 * movement and is anchored at its base like every other tall thing.
 */
function statueSprite() {
  const s = new Sprite(16, 16);
  const stoneHi = "#a29cac";
  const stone = "#7d7887";
  const stoneLo = "#4a4650";
  const shadow = "#0a0a0a";
  s.fillEllipse(8, 15, 5, 1, shadow); // ground shadow
  // Pedestal (three stepped tiers)
  s.fillRect(3, 12, 10, 3, stone);
  s.fillRect(3, 12, 10, 1, stoneHi);
  s.fillRect(3, 14, 10, 1, stoneLo);
  s.fillRect(4, 11, 8, 1, stoneHi);
  // Figure: a robed hero silhouette
  s.fillRect(6, 3, 4, 8, stone); // body
  s.fillRect(6, 3, 4, 1, stoneHi);
  s.fillRect(6, 10, 4, 1, stoneLo);
  s.fillCircle(8, 3, 1.8, stone); // head
  s.setPixel(7, 2, stoneHi);
  // A sword held vertically down at the pedestal — reads at this size
  s.fillRect(11, 4, 1, 7, stoneLo);
  s.setPixel(11, 3, stoneHi);
  s.fillRect(10, 10, 3, 1, stoneLo); // crossguard
  return s;
}

/**
 * Small stone planter with a flowering bush inside — plaza corner decoration.
 * Blocks movement but is short enough not to hide the plaza behind it.
 */
function planterSprite() {
  const s = new Sprite(16, 16);
  const stone = "#7d7887";
  const stoneHi = "#a29cac";
  const stoneLo = "#4a4650";
  const leaf = "#3d6b2a";
  const leafHi = "#61944a";
  const petal = "#c9302f";
  const petalHi = "#ff9f4a";
  s.fillEllipse(8, 15, 5, 1, "#0a0a0a"); // shadow
  // Planter box
  s.fillRect(3, 10, 10, 5, stone);
  s.fillRect(3, 10, 10, 1, stoneHi);
  s.fillRect(3, 14, 10, 1, stoneLo);
  s.fillRect(3, 10, 1, 5, stoneLo);
  s.fillRect(12, 10, 1, 5, stoneLo);
  // Foliage inside the planter
  s.fillEllipse(8, 8, 4, 3, leaf);
  s.fillEllipse(7, 7, 3, 2, leafHi);
  // Two little flowers
  s.setPixel(5, 6, petal);
  s.setPixel(6, 6, petalHi);
  s.setPixel(10, 7, petal);
  s.setPixel(11, 6, petalHi);
  return s;
}

/** Wooden gate: a fence with the middle rail replaced by an open swing. */
function fenceGateSprite() {
  const s = new Sprite(16, 16);
  const wood = "#8a6a3d";
  const woodDark = "#5a3d22";
  const iron = "#4a4650";
  // posts
  s.fillRect(1, 6, 2, 8, wood);
  s.fillRect(13, 6, 2, 8, wood);
  s.fillRect(1, 6, 2, 1, woodDark);
  s.fillRect(13, 6, 2, 1, woodDark);
  // ground shadow
  s.fillRect(1, 14, 2, 1, "#0a0a0a");
  s.fillRect(13, 14, 2, 1, "#0a0a0a");
  // gate leaf angled slightly ajar, hinged to the left post
  s.fillRect(3, 8, 5, 1, wood);
  s.fillRect(3, 11, 5, 1, wood);
  s.fillRect(3, 8, 1, 4, wood);
  s.fillRect(7, 8, 1, 4, wood);
  // hinges + latch
  s.setPixel(3, 9, iron);
  s.setPixel(3, 11, iron);
  s.setPixel(7, 10, iron);
  return s;
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

/**
 * A rat, redrawn for a clean silhouette: dark back catching the upper-left
 * light, a pale belly/feet/ear-interior family (the two-tone "dark back,
 * light underside" read that makes a rodent instantly recognisable at this
 * size), a properly pointed snout, one oversized ear, and a tail with a
 * slight curl instead of one straight diagonal line.
 *
 * Still the game's top-down oblique perspective, not a side-view critter
 * sprite — the belly shows as a crescent along the tile-facing front edge,
 * the same way a building shows a band of wall below its roof.
 */
function ratFrame({
  furBase = "#7a5c3e",
  furDark = "#4a3626",
  belly = "#c9a688",
  earPink = "#d69a92",
  eye = "#1a1a1a",
  scale = 1,
  step = 0,
} = {}) {
  const s = new Sprite(16, 16);
  const bob = step === 0 ? 0 : 1;
  const rx = 5 * scale;
  const ry = 3 * scale;
  const cx = 7;
  const cy = 10 - bob;

  // Ground contact shadow — tied to the same bob offset as the body and
  // placed strictly below the feet, not overlapping them (overlapping was
  // an earlier bug: the feet are only 1px wide each, so a wider shadow
  // showed through as black between them). A soft warm dark rather than
  // pure black, matching the other creatures' contact shadows.
  s.fillEllipse(cx, cy + ry + 0.7, rx * 0.75, 0.5, "#160f09");

  // Body: dark back dominates (this is what reads as "rat" at a glance);
  // the lit patch and belly crescent are accents, not half the body each.
  s.fillEllipse(cx, cy, rx, ry, furDark);
  s.fillEllipse(cx - rx * 0.2, cy - ry * 0.4, rx * 0.5, ry * 0.35, furBase);
  s.fillEllipse(cx + rx * 0.1, cy + ry * 0.68, rx * 0.45, ry * 0.24, belly);

  // Head, ahead of the body, tapering to a snout tip.
  const hx = cx + rx - 0.6;
  const hy = cy - 1.3 * scale;
  s.fillEllipse(hx, hy, 2.6 * scale, 2.1 * scale, furDark);
  s.fillEllipse(hx - 0.5, hy - 0.5, 1.3 * scale, 1 * scale, furBase);
  s.setPixel(Math.round(hx + 2.4 * scale), Math.round(hy + 0.6), furDark);
  s.setPixel(Math.round(hx + 2.8 * scale), Math.round(hy + 0.7), "#241a12"); // nose tip

  // One big rounded ear (the oblique angle hides the far one), pink interior.
  s.fillCircle(hx + 0.2, hy - 1.9 * scale, 1.5 * scale, furDark);
  s.fillCircle(hx + 0.2, hy - 1.9 * scale, 0.9 * scale, earPink);

  s.setPixel(Math.round(hx + 1.1 * scale), Math.round(hy - 0.3), eye);

  // Tail: bare and pink like the real thing, not fur-coloured, with a slight
  // curl (two segments) instead of one stiff diagonal line.
  const tx = Math.round(cx - rx);
  const ty = Math.round(cy + 0.5);
  s.line(tx, ty, tx - 3, ty + 1, belly);
  s.line(tx - 3, ty + 1, tx - 4, ty - 1, belly);

  // Feet, matching the belly family.
  s.fillRect(Math.round(cx - 2), Math.round(cy + ry - 1), 1, 2, belly);
  s.fillRect(Math.round(cx + 1), Math.round(cy + ry - 1), 1, 2, belly);
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

/** Raw meat: a red cut with darker marbling and a bone stub. */
function meatIcon() {
  const s = new Sprite(16, 16);
  s.fillEllipse(9, 9, 5.5, 4.5, "#a8402f");
  s.fillEllipse(8, 7.5, 4.2, 3, "#c9584a");
  s.fillRect(3, 8, 3, 2, "#e8dcc2"); // bone stub
  s.fillRect(3, 8, 3, 1, "#f5eeda");
  s.setPixel(9, 8, "#8a2f20"); // marbling
  s.setPixel(11, 10, "#8a2f20");
  s.setPixel(7, 10, "#8a2f20");
  return s;
}

/** Bear paw: a rounded pad with claw tips, the trophy-drop look. */
function bearPawIcon() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 10, 5, 4, "#6b4a2e"); // pad
  s.fillEllipse(7, 9, 3.4, 2.6, "#8a6440");
  for (const [x, y] of [
    [4, 5],
    [7, 4],
    [10, 4],
    [12, 5.5],
  ]) {
    s.fillRect(x, y, 1.5, 3, "#5a3d22"); // claw/toe
    s.setPixel(Math.round(x), Math.round(y), "#e8dcc2"); // claw tip
  }
  return s;
}

/** Honeycomb: hexagonal amber cells, a small chunk broken off the comb. */
function honeycombIcon() {
  const s = new Sprite(16, 16);
  s.fillEllipse(8, 8, 6, 5.5, "#c9942f");
  s.fillEllipse(8, 8, 5.2, 4.7, "#e6b13f");
  for (const [x, y] of [
    [5, 6],
    [8, 5],
    [11, 6],
    [6, 9],
    [9, 9],
    [7, 11],
  ]) {
    s.fillCircle(x, y, 1.1, "#f5cf6a");
    s.setPixel(x, y, "#a8781f");
  }
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
saveSprite(caveFloorTile(), SCALE, `${OUT}/terrain/cave_floor_01.png`);
saveSprite(cobbleTile(), SCALE, `${OUT}/terrain/cobble_01.png`);
saveSprite(stoneWallTile(), SCALE, `${OUT}/terrain/wall_stone_01.png`);
saveSprite(rockyGroundTile(), SCALE, `${OUT}/terrain/ground_rocky_01.png`);
saveSprite(voidWallTile(), SCALE, `${OUT}/terrain/void_01.png`);
saveSprite(mountainTile(), SCALE, `${OUT}/terrain/mountain_01.png`);
saveSprite(woodFloorTile(), SCALE, `${OUT}/terrain/wood_floor_01.png`);

// Water is real art now (see assets.ts) — nothing to generate here.

// --- environment ---------------------------------------------------------
// Trees are real art now (see assets.ts) — nothing to generate here.
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
saveSprite(wellSprite(), SCALE, `${OUT}/props/well_01.png`);
saveSprite(signpostSprite(), SCALE, `${OUT}/props/sign_01.png`);
saveSprite(fenceSprite(), SCALE, `${OUT}/props/fence_01.png`);
saveSprite(fenceVerticalSprite(), SCALE, `${OUT}/props/fence_v_01.png`);
saveSprite(benchSprite(), SCALE, `${OUT}/props/bench_01.png`);
saveSprite(cartSprite(), SCALE, `${OUT}/props/cart_01.png`);
saveSprite(campfireSprite(), SCALE, `${OUT}/props/campfire_01.png`);
saveSprite(torchSprite(), SCALE, `${OUT}/props/torch_01.png`);
saveSprite(gravestoneSprite(), SCALE, `${OUT}/props/gravestone_01.png`);
saveSprite(chestSprite(), SCALE, `${OUT}/props/chest_01.png`);
// ladder_up_01.png and sewer_entrance_01.png are real art now (cropped from
// the user's ladder sheet and cave-hole image), not generated here — same
// treatment as player_base_sheet.png etc.
saveSprite(sackSprite(), SCALE, `${OUT}/props/sack_01.png`);
saveSprite(fenceGateSprite(), SCALE, `${OUT}/props/fence_gate_01.png`);
saveSprite(statueSprite(), SCALE, `${OUT}/props/statue_01.png`);
saveSprite(planterSprite(), SCALE, `${OUT}/props/planter_01.png`);
saveSprite(altarSprite(), SCALE, `${OUT}/props/altar_01.png`);
saveSprite(stairsUpSprite(), SCALE, `${OUT}/props/stairs_up_01.png`);
saveSprite(stairsDownSprite(), SCALE, `${OUT}/props/stairs_down_01.png`);
saveSprite(shopSignSprite("sword-shield"), SCALE, `${OUT}/props/shop_sign_melee_01.png`);
saveSprite(shopSignSprite("bow-arrow"), SCALE, `${OUT}/props/shop_sign_ranged_01.png`);
saveSprite(shopSignSprite("potion-wand"), SCALE, `${OUT}/props/shop_sign_magic_01.png`);
saveSprite(shopSignSprite("coin"), SCALE, `${OUT}/props/shop_sign_bank_01.png`);
saveSprite(shopSignSprite("depot"), SCALE, `${OUT}/props/shop_sign_depot_01.png`);

// --- farm animals (background dressing) ----------------------------------
saveSprite(chickenSprite(), SCALE, `${OUT}/props/animal_chicken_01.png`);
saveSprite(sheepSprite(), SCALE, `${OUT}/props/animal_sheep_01.png`);
saveSprite(catSprite(), SCALE, `${OUT}/props/animal_cat_01.png`);

// --- buildings -----------------------------------------------------------
saveSprite(buildingForge(), SCALE, `${OUT}/buildings/forge_01.png`);
saveSprite(buildingCottage(), SCALE, `${OUT}/buildings/cottage_01.png`);
saveSprite(buildingHouse(), SCALE, `${OUT}/buildings/house_01.png`);
saveSprite(buildingGuardPost(), SCALE, `${OUT}/buildings/guardpost_01.png`);
saveSprite(buildingChurch(), SCALE, `${OUT}/buildings/church_01.png`);
saveSprite(buildingTimberHall(), SCALE, `${OUT}/buildings/timber_hall_01.png`);
saveSprite(buildingTowerHouse(), SCALE, `${OUT}/buildings/tower_01.png`);
saveSprite(buildingLogCabin(), SCALE, `${OUT}/buildings/log_cabin_01.png`);
saveSprite(buildingWorkshop(), SCALE, `${OUT}/buildings/workshop_01.png`);
saveSprite(buildingFarmhouse(), SCALE, `${OUT}/buildings/farmhouse_01.png`);
saveSprite(buildingLHouse(), SCALE, `${OUT}/buildings/l_house_01.png`);

// --- characters ----------------------------------------------------------
// player_base_sheet.png is real art, not generated here (see the comment
// above the troll section) — no paper-doll equipment layers to generate
// alongside it any more either.
saveSprite(borinFrame(), SCALE, `${OUT}/characters/npc_borin.png`);
saveSprite(wrenFrame(), SCALE, `${OUT}/characters/npc_wren.png`);
saveSprite(elderFrame(), SCALE, `${OUT}/characters/npc_corwin.png`);
saveSprite(fennFrame(), SCALE, `${OUT}/characters/npc_fenn.png`);
saveSprite(farmerFrame(0), SCALE, `${OUT}/characters/npc_farmer_01.png`);
saveSprite(farmerFrame(1), SCALE, `${OUT}/characters/npc_farmer_02.png`);
saveSprite(priestFrame(), SCALE, `${OUT}/characters/npc_priest.png`);
saveSprite(bankerFrame(), SCALE, `${OUT}/characters/npc_banker.png`);
saveSprite(grocerFrame(), SCALE, `${OUT}/characters/npc_grocer.png`);

// --- creatures -----------------------------------------------------------
const trollMeta = saveSpriteSheet(directionalFrames(trollFrame), SCALE, `${OUT}/creatures/troll_sheet.png`);
const ratFrames = [ratFrame({ step: 0 }), ratFrame({ step: 1 })];
const ratMeta = saveSpriteSheet(ratFrames, SCALE, `${OUT}/creatures/rat_sheet.png`);
// cave_rat_sheet.png is no longer generated here — it's hand/AI-authored art
// (4 directions x idle/move, assembled by a one-off import script) checked
// straight into public/assets/creatures/. Don't regenerate over it.
const slimeFrames = [slimeFrame({ squish: false }), slimeFrame({ squish: true })];
const slimeMeta = saveSpriteSheet(slimeFrames, SCALE, `${OUT}/creatures/slime_sheet.png`);

// --- effects -------------------------------------------------------------
saveSprite(hitSparkSprite(), SCALE, `${OUT}/effects/hit_spark_01.png`);
saveSprite(bloodSprite(), SCALE, `${OUT}/effects/blood_01.png`);
saveSprite(dustSprite(), SCALE, `${OUT}/effects/dust_01.png`);
saveSprite(sparkleSprite(), SCALE, `${OUT}/effects/sparkle_01.png`);
saveSprite(smokePuffSprite(), SCALE, `${OUT}/effects/smoke_puff.png`);

// --- items ---------------------------------------------------------------
// Almost the whole equipment/consumable icon set is real art now (cropped
// from the user's icon sheet): weapon_sword/axe/bow/wand,
// weapon_sword_two_handed, ammo_arrow, shield_wooden/steel,
// armor_helmet_leather/steel, armor_body_leather/plate,
// armor_legs_leather/plate, armor_boots_leather, jewel_amulet/ring,
// potion_health/mana, coin_gold (+ its gold-coin-N pile tiers) and
// food_cheese/ham — none of those are generated here, same treatment as
// player_base_sheet.png etc. Only the items the sheet didn't cover
// (container_bag, food_meat, trophy_bear_paw, food_honeycomb, the spell
// icons) still come from the procedural generator below.
// container_backpack.png (and its red/blue/green/gray/tan variants) are also
// real art (cropped from the user's backpack sheet).
saveSprite(bagIcon(), SCALE, `${OUT}/items/container_bag.png`);
saveSprite(meatIcon(), SCALE, `${OUT}/items/food_meat.png`);
saveSprite(bearPawIcon(), SCALE, `${OUT}/items/trophy_bear_paw.png`);
saveSprite(honeycombIcon(), SCALE, `${OUT}/items/food_honeycomb.png`);
saveSprite(healSpellIcon(), SCALE, `${OUT}/items/spell_heal.png`);
saveSprite(flameSpellIcon(), SCALE, `${OUT}/items/spell_flame.png`);

savePNG(appIcon(192).toPNG(1), `${ICONS}/icon-192.png`);
savePNG(appIcon(512).toPNG(1), `${ICONS}/icon-512.png`);

console.log("Generated every game asset: terrain, environment, props, buildings, characters, creatures, effects, items, app icons.");
console.log("PLAYER_SHEET (real art, not generated) is 32x32 x16 frames.");
console.log("TROLL_SHEET must match:", trollMeta);
console.log("rat sheet meta:", ratMeta);
