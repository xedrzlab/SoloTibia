// The world: a safe starting town (Oakhollow) with shop NPCs, surrounded by
// three hunting grounds — a mountain to the north, plains to the south, and
// an underground cave reached via a trail off the plains. Built procedurally
// with MapBuilder (regions/roads/scatter) rather than hand-typed ASCII, since
// a map this size can't be kept aligned by hand reliably.

import { MapBuilder } from "../game/mapBuilder";

export const MAP_WIDTH = 70;
export const MAP_HEIGHT = 50;

const b = new MapBuilder(MAP_WIDTH, MAP_HEIGHT, "#");

// --- Base terrain ---
b.rect(1, 1, MAP_WIDTH - 2, MAP_HEIGHT - 2, "."); // grass everywhere inside the border
b.rect(1, 1, MAP_WIDTH - 2, 17, "g"); // mountain region: rocky ground base (rows 1-17)
// plains region (rows 34-48) stays grass — no overlay needed

// --- Roads: one north-south spine through town, one east-west town street ---
b.vline(34, 1, 47, "R", 2); // x34-35, full height
b.hline(22, 25, 24, "R", 2); // y25-26, across town

// --- Town plaza (safe zone, drawn after roads so the plaza wins at the crossing) ---
b.rect(31, 22, 7, 6, "T");
export const TEMPLE_SPAWN = { x: 34, y: 24 };

// --- Mountain hunting ground: scattered blocking peaks over the rocky ground ---
b.scatter(1, 1, MAP_WIDTH - 2, 17, "M", ["g"], 0.18, 501);

// --- Plains hunting ground: trees/bushes/boulders scattered over grass ---
b.scatter(1, 34, MAP_WIDTH - 2, 15, "t", ["."], 0.07, 601);
b.scatter(1, 34, MAP_WIDTH - 2, 15, "b", ["."], 0.035, 602);
b.scatter(1, 34, MAP_WIDTH - 2, 15, "o", ["."], 0.025, 603);
// light decoration on the approach bands between town and each hunting ground
b.scatter(1, 18, MAP_WIDTH - 2, 4, "t", ["."], 0.03, 604);
b.scatter(1, 29, MAP_WIDTH - 2, 5, "t", ["."], 0.03, 605);

// --- Underground cave (reached by trail off the plains) ---
const CAVE = { x: 12, y: 36, w: 15, h: 12 };
b.border(CAVE.x, CAVE.y, CAVE.w, CAVE.h, "W");
b.rect(CAVE.x + 1, CAVE.y + 1, CAVE.w - 2, CAVE.h - 2, "C");
b.set(19, CAVE.y, "C"); // entrance gap in the north wall

// Trail connecting the cave entrance up to the main road.
b.path(
  [
    { x: 19, y: 35 },
    { x: 19, y: 33 },
    { x: 34, y: 33 },
  ],
  "D",
);

// --- Buildings (decorative image + a blocked tile footprint underneath) ---
export interface BuildingPlacement {
  textureKey: string;
  footprintX: number;
  footprintY: number;
  footprintW: number;
  footprintH: number;
}

export const BUILDINGS: BuildingPlacement[] = [
  { textureKey: "building-weaponshop", footprintX: 26, footprintY: 20, footprintW: 3, footprintH: 3 },
  { textureKey: "building-cottage", footprintX: 40, footprintY: 20, footprintW: 3, footprintH: 3 },
  { textureKey: "building-house", footprintX: 36, footprintY: 29, footprintW: 3, footprintH: 3 },
];
for (const building of BUILDINGS) {
  b.rect(building.footprintX, building.footprintY, building.footprintW, building.footprintH, "W");
}

// --- Signposts (decorative, non-blocking, placed just off the road) ---
export interface SignPlacement {
  x: number;
  y: number;
  text: string;
}
export const SIGNS: SignPlacement[] = [
  { x: 33, y: 17, text: "North: the Highlands" },
  { x: 33, y: 33, text: "South: the Lowlands" },
  { x: 18, y: 35, text: "West: the Old Mine" },
];
// Signs are rendered as their own sprite in WorldScene (on top of whatever
// terrain is already there — grass, road, trail) rather than as a grid tile,
// since a sign's underlying terrain varies by placement.

// --- NPCs (shops + the vocation guide) ---
export interface NpcSpawn {
  id: string;
  name: string;
  textureKey: string;
  role: "shop" | "vocation";
  x: number;
  y: number;
}

export const NPC_SPAWNS: NpcSpawn[] = [
  { id: "blacksmith", name: "Borin", textureKey: "blacksmith", role: "shop", x: 27, y: 23 },
  { id: "herbalist", name: "Wren", textureKey: "herbalist", role: "shop", x: 41, y: 23 },
  { id: "elder", name: "Elder Corwin", textureKey: "elder", role: "vocation", x: 37, y: 28 },
];

// --- Monster spawns (none in town — mountain/plains/cave only) ---
export interface MonsterSpawn {
  monsterId: string;
  x: number;
  y: number;
}

export const MONSTER_SPAWNS: MonsterSpawn[] = [
  // Mountain — Trolls
  { monsterId: "troll", x: 12, y: 8 },
  { monsterId: "troll", x: 55, y: 6 },
  { monsterId: "troll", x: 34, y: 4 },
  // Plains — Rats & Slimes
  { monsterId: "rat", x: 45, y: 40 },
  { monsterId: "rat", x: 55, y: 44 },
  { monsterId: "slime", x: 50, y: 38 },
  { monsterId: "slime", x: 60, y: 42 },
  { monsterId: "rat", x: 38, y: 46 },
  // Underground cave — Rats & Cave Rats
  { monsterId: "rat", x: 16, y: 40 },
  { monsterId: "rat", x: 22, y: 42 },
  { monsterId: "cave_rat", x: 18, y: 44 },
  { monsterId: "cave_rat", x: 24, y: 39 },
];

// Force every point-feature tile back to its intended terrain, in case a
// scatter pass (which runs earlier) happened to land on the same cell.
for (const npc of NPC_SPAWNS) b.set(npc.x, npc.y, ".");
for (const spawn of MONSTER_SPAWNS) {
  const inMountain = spawn.y <= 17;
  const inCave = spawn.x >= CAVE.x + 1 && spawn.x < CAVE.x + CAVE.w - 1 && spawn.y >= CAVE.y + 1 && spawn.y < CAVE.y + CAVE.h - 1;
  b.set(spawn.x, spawn.y, inCave ? "C" : inMountain ? "g" : ".");
}
b.set(TEMPLE_SPAWN.x, TEMPLE_SPAWN.y, "T");

// ---------------------------------------------------------------------------

export interface TileInfo {
  walkable: boolean;
  textureKey: string;
  /** A transparent-background decoration drawn on top of textureKey (e.g. a tree over grass). */
  overlayKey?: string;
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
  g: { walkable: true, textureKey: "rocky-ground", safe: false },
  M: { walkable: false, textureKey: "mountain", safe: false },
  R: { walkable: true, textureKey: "road", safe: false },
  // t/b/o only ever scatter onto grass ('.') cells (see the scatter() calls
  // above), so grass is always the correct base to draw underneath them.
  t: { walkable: false, textureKey: "grass", overlayKey: "tree", safe: false },
  b: { walkable: false, textureKey: "grass", overlayKey: "bush", safe: false },
  o: { walkable: false, textureKey: "grass", overlayKey: "boulder", safe: false },
};

const MAP_ROWS: string[] = b.rows();

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
