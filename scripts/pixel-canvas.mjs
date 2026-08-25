// Tiny procedural pixel-art toolkit: draw shapes onto a small RGBA grid, then
// nearest-neighbor upscale for a crisp retro pixel-art look, and encode as PNG.
// No external art/image tools involved — every sprite is generated from code.

import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class Sprite {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4); // RGBA, starts transparent
  }

  setPixel(x, y, hex) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b, a] = parseColor(hex);
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  fillRect(x, y, w, h, hex) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w);
    const y1 = Math.round(y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.setPixel(xx, yy, hex);
    }
  }

  fillCircle(cx, cy, r, hex) {
    this.fillEllipse(cx, cy, r, r, hex);
  }

  fillEllipse(cx, cy, rx, ry, hex) {
    for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
      for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const nx = (xx + 0.5 - cx) / rx;
        const ny = (yy + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.setPixel(xx, yy, hex);
      }
    }
  }

  line(x0, y0, x1, y1, hex) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.setPixel(x0, y0, hex);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Scatter deterministic speckle dots for tile texture (pure JS seeded PRNG, no deps). */
  speckle(count, hex, seed = 1) {
    let s = seed;
    const rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * this.width);
      const y = Math.floor(rand() * this.height);
      this.setPixel(x, y, hex);
    }
  }

  flippedHorizontal() {
    const out = new Sprite(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;
        const j = (y * this.width + (this.width - 1 - x)) * 4;
        out.data[j] = this.data[i];
        out.data[j + 1] = this.data[i + 1];
        out.data[j + 2] = this.data[i + 2];
        out.data[j + 3] = this.data[i + 3];
      }
    }
    return out;
  }

  toPNG(scale = 1) {
    const w = this.width * scale;
    const h = this.height * scale;
    const png = new PNG({ width: w, height: h });
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const si = (y * this.width + x) * 4;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = x * scale + dx;
            const py = y * scale + dy;
            const di = (py * w + px) * 4;
            png.data[di] = this.data[si];
            png.data[di + 1] = this.data[si + 1];
            png.data[di + 2] = this.data[si + 2];
            png.data[di + 3] = this.data[si + 3];
          }
        }
      }
    }
    return png;
  }
}

function parseColor(hex) {
  if (!hex) return [0, 0, 0, 0];
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

export function savePNG(png, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, PNG.sync.write(png));
}

export function saveSprite(sprite, scale, outPath) {
  savePNG(sprite.toPNG(scale), outPath);
}

/** Pack equal-sized sprites side by side into one sheet PNG (for Phaser spritesheet loader). */
export function saveSpriteSheet(sprites, scale, outPath) {
  const frameW = sprites[0].width * scale;
  const frameH = sprites[0].height * scale;
  const sheet = new PNG({ width: frameW * sprites.length, height: frameH });
  sprites.forEach((sprite, i) => {
    const framePng = sprite.toPNG(scale);
    PNG.bitblt(framePng, sheet, 0, 0, frameW, frameH, i * frameW, 0);
  });
  savePNG(sheet, outPath);
  return { frameWidth: frameW, frameHeight: frameH, frameCount: sprites.length };
}
