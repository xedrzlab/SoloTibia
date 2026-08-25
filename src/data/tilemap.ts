// Hand-built starter zone: a small grass field with a safe temple, a dirt
// path leading to a walled rat cellar. Matches the "starter zone" pattern in
// docs/GAME_DESIGN.md §4 — tiny, self-contained, one safe hub, one hunting
// ground reached by a short walk.
//
// Rows are built from repeated segments (not hand-typed dot-counting) so
// row lengths can't silently drift out of alignment.

const seg = (ch: string, n: number) => ch.repeat(n);
const W = 22;

const MAP_ROWS: string[] = [
  seg("#", W),
  "#" + seg(".", 20) + "#",
  "#" + seg(".", 4) + seg("T", 4) + seg(".", 12) + "#",
  "#" + seg(".", 4) + seg("T", 4) + seg(".", 5) + seg("~", 2) + seg(".", 5) + "#",
  "#" + seg(".", 4) + seg("T", 4) + seg(".", 5) + seg("~", 2) + seg(".", 5) + "#",
  "#" + seg(".", 9) + "D" + seg(".", 10) + "#",
  "#" + seg(".", 9) + "D" + seg(".", 10) + "#",
  "#" + seg(".", 9) + "D" + seg(".", 10) + "#",
  "#" + seg(".", 7) + seg("W", 2) + "C" + seg("W", 3) + seg(".", 7) + "#",
  "#" + seg(".", 7) + "W" + seg("C", 4) + "W" + seg(".", 7) + "#",
  "#" + seg(".", 7) + "W" + seg("C", 4) + "W" + seg(".", 7) + "#",
  "#" + seg(".", 7) + seg("W", 6) + seg(".", 7) + "#",
  "#" + seg(".", 20) + "#",
  seg("#", W),
];

export interface TileInfo {
  walkable: boolean;
  textureKey: string;
  safe: boolean; // protection-zone tiles: no monster aggro, valid respawn point
}

const LEGEND: Record<string, TileInfo> = {
  "#": { walkable: false, textureKey: "void-wall", safe: false },
  ".": { walkable: true, textureKey: "grass", safe: false },
  T: { walkable: true, textureKey: "temple-floor", safe: true },
  D: { walkable: true, textureKey: "dirt", safe: false },
  C: { walkable: true, textureKey: "cave-floor", safe: false },
  W: { walkable: false, textureKey: "stone-wall", safe: false },
  "~": { walkable: false, textureKey: "water", safe: false },
};

export const MAP_WIDTH = W;
export const MAP_HEIGHT = MAP_ROWS.length;

export function tileAt(x: number, y: number): TileInfo {
  if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
    return LEGEND["#"];
  }
  const ch = MAP_ROWS[y][x];
  return LEGEND[ch] ?? LEGEND["#"];
}

export function isWalkable(x: number, y: number): boolean {
  return tileAt(x, y).walkable;
}

export function forEachTile(cb: (x: number, y: number, tile: TileInfo) => void): void {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) cb(x, y, tileAt(x, y));
  }
}

export const TEMPLE_SPAWN = { x: 6, y: 3 };

export interface MonsterSpawn {
  monsterId: string;
  x: number;
  y: number;
}

export const MONSTER_SPAWNS: MonsterSpawn[] = [
  { monsterId: "rat", x: 15, y: 6 },
  { monsterId: "rat", x: 9, y: 9 },
  { monsterId: "rat", x: 11, y: 9 },
  { monsterId: "cave_rat", x: 10, y: 10 },
  { monsterId: "slime", x: 4, y: 11 },
  { monsterId: "slime", x: 17, y: 11 },
  { monsterId: "troll", x: 10, y: 12 },
];

/** Decorative-only for now (no dialogue system yet) — see docs/GAME_DESIGN.md §5. */
export const NPC_SPAWNS = [{ id: "jim", textureKey: "npc-jim", x: 9, y: 3 }];
