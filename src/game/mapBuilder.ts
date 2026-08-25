// A small procedural map-authoring helper: compose the world out of filled
// regions, paths, and seeded scatter instead of hand-typing a giant ASCII
// grid (which doesn't scale past the size of the original starter map
// without becoming impossible to keep aligned by hand).

export interface Point {
  x: number;
  y: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export class MapBuilder {
  private grid: string[][];

  constructor(
    readonly width: number,
    readonly height: number,
    fill = "#",
  ) {
    this.grid = Array.from({ length: height }, () => Array(width).fill(fill));
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return "#";
    return this.grid[y][x];
  }

  set(x: number, y: number, ch: string) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.grid[y][x] = ch;
  }

  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch);
    }
  }

  border(x: number, y: number, w: number, h: number, ch: string) {
    this.rect(x, y, w, 1, ch);
    this.rect(x, y + h - 1, w, 1, ch);
    this.rect(x, y, 1, h, ch);
    this.rect(x + w - 1, y, 1, h, ch);
  }

  hline(x: number, y: number, length: number, ch: string, width = 1) {
    this.rect(Math.min(x, x + length), y, Math.abs(length) + 1, width, ch);
  }

  vline(x: number, y: number, length: number, ch: string, width = 1) {
    this.rect(x, Math.min(y, y + length), width, Math.abs(length) + 1, ch);
  }

  /** Orthogonal route through waypoints (horizontal-then-vertical between each pair). */
  path(points: Point[], ch: string, width = 1) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      this.hline(a.x, a.y, b.x - a.x, ch, width);
      this.vline(b.x, a.y, b.y - a.y, ch, width);
    }
  }

  /** Randomly place `ch` within a region at roughly `density` coverage, only on cells currently matching one of `onlyOn`. */
  scatter(x: number, y: number, w: number, h: number, ch: string, onlyOn: string[], density: number, seed: number) {
    const rand = seededRandom(seed);
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (onlyOn.includes(this.get(xx, yy)) && rand() < density) this.set(xx, yy, ch);
      }
    }
  }

  rows(): string[] {
    return this.grid.map((row) => row.join(""));
  }
}
