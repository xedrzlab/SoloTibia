// Generates the sprites that don't (yet) have real-art replacements:
// void-wall tile, rat/cave-rat/slime monsters, item icons, and app icons.
// Player, troll, and the grass/dirt/cave-floor/temple-floor/water/stone-wall
// tiles now come from the uploaded asset pack via
// `npm run process:assets` (scripts/process-uploaded-assets.mjs) — don't
// regenerate those here, or this script would clobber the real art.
//
// Run with `npm run gen:assets`. Re-run any time definitions below change.

import { Sprite, saveSprite, saveSpriteSheet, savePNG } from "./pixel-canvas.mjs";

const OUT = "public/assets";
const ICONS = "public/icons";
const SCALE = 2; // 16x16 source canvas -> 32x32 tiles, matching the 1-tile-per-sqm convention

// ---------------------------------------------------------------------------
// Tiles (only the ones with no real-art replacement)
// ---------------------------------------------------------------------------

function voidWallTile() {
  const s = new Sprite(16, 16);
  s.fillRect(0, 0, 16, 16, "#1c1c20");
  s.speckle(25, "#26262c", 111);
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

saveSprite(voidWallTile(), SCALE, `${OUT}/tiles/void-wall.png`);

const ratFrames = [ratFrame({ step: 0 }), ratFrame({ step: 1 })];
const ratMeta = saveSpriteSheet(ratFrames, SCALE, `${OUT}/entities/rat.png`);

const caveRatFrames = [
  ratFrame({ furBase: "#4a3626", furDark: "#3a2a1c", eye: "#a83232", scale: 1.15, step: 0 }),
  ratFrame({ furBase: "#4a3626", furDark: "#3a2a1c", eye: "#a83232", scale: 1.15, step: 1 }),
];
const caveRatMeta = saveSpriteSheet(caveRatFrames, SCALE, `${OUT}/entities/cave-rat.png`);

const slimeFrames = [slimeFrame({ squish: false }), slimeFrame({ squish: true })];
const slimeMeta = saveSpriteSheet(slimeFrames, SCALE, `${OUT}/entities/slime.png`);

saveSprite(swordIcon(), SCALE, `${OUT}/items/sword.png`);
saveSprite(healthPotionIcon(), SCALE, `${OUT}/items/health-potion.png`);
saveSprite(manaPotionIcon(), SCALE, `${OUT}/items/mana-potion.png`);
saveSprite(goldCoinIcon(), SCALE, `${OUT}/items/gold-coin.png`);

savePNG(appIcon(192).toPNG(1), `${ICONS}/icon-192.png`);
savePNG(appIcon(512).toPNG(1), `${ICONS}/icon-512.png`);

console.log("Generated void-wall tile, rat/cave-rat/slime sheets, items, and app icons.");
console.log("rat sheet meta:", ratMeta);
console.log("cave rat sheet meta:", caveRatMeta);
console.log("slime sheet meta:", slimeMeta);
