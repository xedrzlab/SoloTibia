// Generates every game sprite procedurally (original pixel art, no external
// assets) into public/assets and public/icons. Run with `npm run gen:assets`.
// Re-run any time sprite definitions below change.

import { Sprite, saveSprite, saveSpriteSheet, savePNG } from "./pixel-canvas.mjs";

const OUT = "public/assets";
const ICONS = "public/icons";
const SCALE = 2; // 16x16 source canvas -> 32x32 tiles, matching the 1-tile-per-sqm convention

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function grassTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#3a7d34");
  s.speckle(70, "#2f6b2a", 11);
  s.speckle(35, "#4f9c46", 22);
  return s;
}

function caveFloorTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#4a4a52");
  s.speckle(60, "#3a3a40", 33);
  s.speckle(28, "#5c5c66", 44);
  return s;
}

function dirtPathTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#6b4a2f");
  s.speckle(60, "#573c26", 55);
  s.speckle(24, "#7d5a3d", 66);
  return s;
}

function stoneWallTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#5c5c66");
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    s.fillRect(0, y + 3, 16, 1, "#3a3a44");
    const offset = row % 2 === 0 ? 0 : 4;
    for (let x = offset - 8; x < 16; x += 8) s.fillRect(x, y, 1, 3, "#3a3a44");
  }
  s.speckle(15, "#6d6d78", 77);
  return s;
}

function waterTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#2a5c8a");
  s.speckle(40, "#3a72ab", 88);
  s.speckle(15, "#1f4568", 99);
  return s;
}

function voidWallTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#1c1c20");
  s.speckle(25, "#26262c", 111);
  return s;
}

function templeFloorTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#c9c3b0");
  s.fillRect(0, 0, 16, 1, "#a89f88");
  s.fillRect(0, 15, 16, 1, "#a89f88");
  s.fillRect(0, 0, 1, 16, "#a89f88");
  s.fillRect(15, 0, 1, 16, "#a89f88");
  s.speckle(12, "#b3ab95", 121);
  return s;
}

// ---------------------------------------------------------------------------
// Player (4-direction, 2-frame walk cycle)
// ---------------------------------------------------------------------------

const SKIN = "#e0ac69";
const HAIR = "#4a2e1a";
const TUNIC = "#2f6fa8";
const PANTS = "#33363b";
const BOOTS = "#241a12";
const EYE = "#1a1a1a";

function drawBody(s, legOffset) {
  // feet / legs
  s.fillRect(5, 11 + legOffset.left, 2, 3, BOOTS);
  s.fillRect(9, 11 + legOffset.right, 2, 3, BOOTS);
  s.fillRect(5, 9, 2, 3, PANTS);
  s.fillRect(9, 9, 2, 3, PANTS);
  // torso
  s.fillRect(4, 5, 8, 5, TUNIC);
  s.fillRect(4, 5, 1, 5, "#255a8a");
  s.fillRect(11, 5, 1, 5, "#255a8a");
  // arms
  s.fillRect(3, 6, 1, 4, TUNIC);
  s.fillRect(12, 6, 1, 4, TUNIC);
  s.setPixel(3, 10, SKIN);
  s.setPixel(12, 10, SKIN);
}

function playerFrame(direction, step) {
  const s = new Sprite(16, 16);
  const legOffset =
    step === 0 ? { left: 0, right: 1 } : { left: 1, right: 0 };
  drawBody(s, legOffset);

  // head
  s.fillCircle(8, 3.5, 3, SKIN);

  if (direction === "up") {
    // back of head: fully covered by hair, no face
    s.fillCircle(8, 3.5, 3, HAIR);
  } else if (direction === "down") {
    s.fillRect(5, 1, 6, 2, HAIR);
    s.setPixel(6, 4, EYE);
    s.setPixel(9, 4, EYE);
  } else {
    // side (authored facing right; "left" is a horizontal flip of this frame)
    s.fillRect(5, 1, 6, 2, HAIR);
    s.setPixel(10, 4, EYE);
  }
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

saveSprite(grassTile(), SCALE, `${OUT}/tiles/grass.png`);
saveSprite(caveFloorTile(), SCALE, `${OUT}/tiles/cave-floor.png`);
saveSprite(dirtPathTile(), SCALE, `${OUT}/tiles/dirt.png`);
saveSprite(stoneWallTile(), SCALE, `${OUT}/tiles/stone-wall.png`);
saveSprite(waterTile(), SCALE, `${OUT}/tiles/water.png`);
saveSprite(voidWallTile(), SCALE, `${OUT}/tiles/void-wall.png`);
saveSprite(templeFloorTile(), SCALE, `${OUT}/tiles/temple-floor.png`);

// Player sheet: 8 frames in a fixed order the game code indexes by name.
const playerFrames = [
  playerFrame("down", 0),
  playerFrame("down", 1),
  playerFrame("up", 0),
  playerFrame("up", 1),
  playerFrame("side", 0),
  playerFrame("side", 1),
];
const PLAYER_FRAME_INDEX = {
  downIdle: 0,
  downStep: 1,
  upIdle: 2,
  upStep: 3,
  rightIdle: 4,
  rightStep: 5,
};
const playerMeta = saveSpriteSheet(playerFrames, SCALE, `${OUT}/entities/player.png`);

const ratFrames = [
  ratFrame({ step: 0 }),
  ratFrame({ step: 1 }),
];
const ratMeta = saveSpriteSheet(ratFrames, SCALE, `${OUT}/entities/rat.png`);

const caveRatFrames = [
  ratFrame({ furBase: "#4a3626", furDark: "#3a2a1c", eye: "#a83232", scale: 1.15, step: 0 }),
  ratFrame({ furBase: "#4a3626", furDark: "#3a2a1c", eye: "#a83232", scale: 1.15, step: 1 }),
];
const caveRatMeta = saveSpriteSheet(caveRatFrames, SCALE, `${OUT}/entities/cave-rat.png`);

saveSprite(swordIcon(), SCALE, `${OUT}/items/sword.png`);
saveSprite(healthPotionIcon(), SCALE, `${OUT}/items/health-potion.png`);
saveSprite(manaPotionIcon(), SCALE, `${OUT}/items/mana-potion.png`);
saveSprite(goldCoinIcon(), SCALE, `${OUT}/items/gold-coin.png`);

savePNG(appIcon(192).toPNG(1), `${ICONS}/icon-192.png`);
savePNG(appIcon(512).toPNG(1), `${ICONS}/icon-512.png`);

console.log("Generated tiles, player sheet, rat sheets, items, and app icons.");
console.log("player sheet meta:", playerMeta, PLAYER_FRAME_INDEX);
console.log("rat sheet meta:", ratMeta);
console.log("cave rat sheet meta:", caveRatMeta);
