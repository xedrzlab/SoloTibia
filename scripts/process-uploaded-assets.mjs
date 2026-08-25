// One-off pipeline that turns the user-supplied Godot asset pack
// (raw-assets/, gitignored) into game-ready sprite sheets under
// public/assets/. Re-run with `npm run process:assets` if raw-assets/
// changes. Uses sharp for cropping/resizing (devDependency only — never
// shipped in the browser bundle).

import sharp from "sharp";
import { mkdirSync } from "node:fs";

const RAW = "raw-assets/assets";
const OUT = "public/assets";

mkdirSync(`${OUT}/entities`, { recursive: true });
mkdirSync(`${OUT}/tiles`, { recursive: true });
mkdirSync(`${OUT}/npcs`, { recursive: true });
mkdirSync(`${OUT}/props`, { recursive: true });

const DIRECTIONS = ["down", "left", "right", "up"];

/** Alpha-channel bounding box of the non-transparent content in a raw buffer. */
async function contentBBox(path) {
  const img = sharp(path);
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer();
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = raw[(y * width + x) * 4 + 3];
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function unionBBox(boxes) {
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Build a directional spritesheet: framesPerDirection frames for each of
 * down/left/right/up, all cropped to one shared bounding box (so the walk
 * cycle doesn't jitter) and scaled to the same final size, laid out
 * horizontally in DIRECTIONS order for Monster/Player to index into.
 */
async function buildDirectionalSheet({ pathFor, framesPerDirection, targetHeight, outPath }) {
  const paths = [];
  for (const dir of DIRECTIONS) {
    for (let i = 0; i < framesPerDirection; i++) paths.push(pathFor(dir, i));
  }

  const boxes = await Promise.all(paths.map(contentBBox));
  const crop = unionBBox(boxes);
  const scale = targetHeight / crop.height;
  const targetWidth = Math.round(crop.width * scale);

  const frames = await Promise.all(
    paths.map((p) =>
      sharp(p)
        .extract(crop)
        .resize(targetWidth, targetHeight, { fit: "fill" })
        .png()
        .toBuffer(),
    ),
  );

  const sheet = sharp({
    create: {
      width: targetWidth * paths.length,
      height: targetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(frames.map((buf, i) => ({ input: buf, left: i * targetWidth, top: 0 })));

  await sheet.png().toFile(outPath);
  return { frameWidth: targetWidth, frameHeight: targetHeight, frameCount: paths.length };
}

async function buildStaticSprite({ path, targetHeight, outPath }) {
  const box = await contentBBox(path);
  const scale = targetHeight / box.height;
  const targetWidth = Math.round(box.width * scale);
  await sharp(path)
    .extract(box)
    .resize(targetWidth, targetHeight, { fit: "fill" })
    .png()
    .toFile(outPath);
  return { width: targetWidth, height: targetHeight };
}

const results = {};

// --- Player: already clean 32x32 frames, just assemble the sheet. ---
results.player = await buildDirectionalSheet({
  pathFor: (dir, i) => `${RAW}/characters/Player/player_${dir}_${i}.png`,
  framesPerDirection: 3,
  targetHeight: 32,
  outPath: `${OUT}/entities/player.png`,
});

// --- Troll: AI-generated on an oversized canvas, needs crop + downscale. ---
results.troll = await buildDirectionalSheet({
  pathFor: (dir, i) => `${RAW}/monsters/Troll/troll_${dir}${i + 1}.png`,
  framesPerDirection: 3,
  targetHeight: 52, // taller/bulkier than the 32px player, still one-tile footprint
  outPath: `${OUT}/entities/troll.png`,
});

// NPCs (Borin, Wren, Elder Corwin) are now original procedural designs from
// scripts/generate-assets.mjs, not derived from the uploaded pack's "jim.png"
// — see docs discussion: they need to be distinct designs, not recolors.

// --- Building facades: decorative backdrops for shop NPCs in town. ---
results.building1 = await buildStaticSprite({
  path: `${RAW}/houses/hus1.png`,
  targetHeight: 110,
  outPath: `${OUT}/props/building-house.png`,
});
results.building2 = await buildStaticSprite({
  path: `${RAW}/houses/hus2.png`,
  targetHeight: 110,
  outPath: `${OUT}/props/building-cottage.png`,
});
results.weaponShop = await buildStaticSprite({
  path: `${RAW}/houses/weaponshop1.png`,
  targetHeight: 110,
  outPath: `${OUT}/props/building-weaponshop.png`,
});

// --- Floor / wall tiles: already clean 32x32 art, just copy/rename. ---
async function copyTile(srcName, outName) {
  await sharp(`${RAW}/floors/${srcName}`).png().toFile(`${OUT}/tiles/${outName}`);
}
await copyTile("grass32.png", "grass.png");
await copyTile("dirt_tile32.png", "dirt.png");
await copyTile("stone32.png", "cave-floor.png");
await copyTile("cobble_tile32.png", "temple-floor.png");
await copyTile("water_tile32.png", "water.png");

// Wall art is a 128x128 tileable texture; downscale to our 32px tile grid.
await sharp(`${RAW}/walls/wall_128_straight.png`).resize(32, 32).png().toFile(`${OUT}/tiles/stone-wall.png`);

// Rocky ground for the mountain hunting ground (already 32x32, opaque).
async function copyProp(srcName, outName) {
  await sharp(`${RAW}/props/${srcName}`).png().toFile(`${OUT}/tiles/${outName}`);
}
await copyProp("dirtwithstones.png", "rocky-ground.png");
await copyProp("dirtwithstones2.png", "rocky-ground-alt.png");

console.log("Processed uploaded asset pack:");
console.log(JSON.stringify(results, null, 2));
console.log("Tiles copied: grass, dirt, cave-floor, temple-floor, water, stone-wall, rocky-ground(+alt)");
console.log("void-wall.png left as the procedural version (no matching art in the pack).");
