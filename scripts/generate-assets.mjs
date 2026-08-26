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

saveSprite(voidWallTile(), SCALE, `${OUT}/tiles/void-wall.png`);
saveSprite(mountainTile(), SCALE, `${OUT}/tiles/mountain.png`);
saveSprite(roadTile(), SCALE, `${OUT}/tiles/road.png`);

saveSprite(treeSprite(), SCALE, `${OUT}/props/tree.png`);
saveSprite(bushSprite(), SCALE, `${OUT}/props/bush.png`);

saveSprite(borinFrame(), SCALE, `${OUT}/npcs/borin.png`);
saveSprite(wrenFrame(), SCALE, `${OUT}/npcs/wren.png`);
saveSprite(elderFrame(), SCALE, `${OUT}/npcs/elder-corwin.png`);
saveSprite(boulderSprite(), SCALE, `${OUT}/props/boulder.png`);
saveSprite(signpostSprite(), SCALE, `${OUT}/props/signpost.png`);
saveSprite(barrelSprite(), SCALE, `${OUT}/props/barrel.png`);
saveSprite(crateSprite(), SCALE, `${OUT}/props/crate.png`);
saveSprite(wellSprite(), SCALE, `${OUT}/props/well.png`);

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

saveSprite(backpackIcon(), SCALE, `${OUT}/items/backpack.png`);
saveSprite(bagIcon(), SCALE, `${OUT}/items/bag.png`);
saveSprite(axeIcon(), SCALE, `${OUT}/items/axe.png`);
saveSprite(bowIcon(), SCALE, `${OUT}/items/bow.png`);
saveSprite(arrowIcon(), SCALE, `${OUT}/items/arrow.png`);
saveSprite(wandIcon(), SCALE, `${OUT}/items/wand.png`);
saveSprite(woodenShieldIcon(), SCALE, `${OUT}/items/wooden-shield.png`);
saveSprite(steelShieldIcon(), SCALE, `${OUT}/items/steel-shield.png`);
saveSprite(leatherHelmetIcon(), SCALE, `${OUT}/items/leather-helmet.png`);
saveSprite(steelHelmetIcon(), SCALE, `${OUT}/items/steel-helmet.png`);
saveSprite(leatherArmorIcon(), SCALE, `${OUT}/items/leather-armor.png`);
saveSprite(plateArmorIcon(), SCALE, `${OUT}/items/plate-armor.png`);
saveSprite(leatherLegsIcon(), SCALE, `${OUT}/items/leather-legs.png`);
saveSprite(plateLegsIcon(), SCALE, `${OUT}/items/plate-legs.png`);
saveSprite(leatherBootsIcon(), SCALE, `${OUT}/items/leather-boots.png`);
saveSprite(amuletIcon(), SCALE, `${OUT}/items/amulet.png`);
saveSprite(ringIcon(), SCALE, `${OUT}/items/ring.png`);
saveSprite(healSpellIcon(), SCALE, `${OUT}/items/spell-heal.png`);
saveSprite(flameSpellIcon(), SCALE, `${OUT}/items/spell-flame.png`);

savePNG(appIcon(192).toPNG(1), `${ICONS}/icon-192.png`);
savePNG(appIcon(512).toPNG(1), `${ICONS}/icon-512.png`);

console.log("Generated void-wall tile, rat/cave-rat/slime sheets, items, and app icons.");
console.log("rat sheet meta:", ratMeta);
console.log("cave rat sheet meta:", caveRatMeta);
console.log("slime sheet meta:", slimeMeta);
