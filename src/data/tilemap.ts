// The world: Oakhollow, a small starter island. Water rings the whole map;
// the interior is a walled town at the centre with a farm on the south
// shore. Buildings are drawn as roofed sprites the way they always were;
// stepping onto the door tile in front of a shop zones the player into an
// interior scene (see src/data/interiors.ts + src/scenes/InteriorScene.ts).
//
// Monsters are intentionally absent while the tutorial area is being built
// out; see MONSTER_SPAWNS below.

import { MapBuilder } from "../game/mapBuilder";
import type { TreeSpecies } from "./assets";

export const MAP_WIDTH = 70;
export const MAP_HEIGHT = 50;

const b = new MapBuilder(MAP_WIDTH, MAP_HEIGHT, "~"); // start as ocean

// ---------------------------------------------------------------------------
// Island shape
// ---------------------------------------------------------------------------

const ISLAND_CX = 35;
const ISLAND_CY = 25;
const ISLAND_RX = 30;
const ISLAND_RY = 21;

function ellipseValue(x: number, y: number, rx: number, ry: number): number {
  const nx = (x - ISLAND_CX) / rx;
  const ny = (y - ISLAND_CY) / ry;
  return nx * nx + ny * ny;
}

for (let yy = 0; yy < MAP_HEIGHT; yy++) {
  for (let xx = 0; xx < MAP_WIDTH; xx++) {
    const inner = ellipseValue(xx, yy, ISLAND_RX, ISLAND_RY);
    if (inner <= 1) {
      b.set(xx, yy, ".");
    } else if (ellipseValue(xx, yy, ISLAND_RX + 1.6, ISLAND_RY + 1.4) <= 1) {
      b.set(xx, yy, "D");
    }
  }
}

// ---------------------------------------------------------------------------
// Town — walled compound in the middle of the island
// ---------------------------------------------------------------------------

const TOWN = { x: 21, y: 13, w: 28, h: 24 };
const WALL_GATES = {
  north: { x: 34, w: 2 },
  south: { x: 34, w: 2 },
  east: { y: 24, h: 2 },
  west: { y: 24, h: 2 },
};

b.border(TOWN.x, TOWN.y, TOWN.w, TOWN.h, "W");
for (let i = 0; i < WALL_GATES.north.w; i++) {
  b.set(WALL_GATES.north.x + i, TOWN.y, "R");
  b.set(WALL_GATES.south.x + i, TOWN.y + TOWN.h - 1, "R");
}
for (let i = 0; i < WALL_GATES.east.h; i++) {
  b.set(TOWN.x + TOWN.w - 1, WALL_GATES.east.y + i, "R");
  b.set(TOWN.x, WALL_GATES.west.y + i, "R");
}

// The two main street spines — a north-south road through both town gates
// and an east-west road through the east/west gates.
b.rect(34, TOWN.y, 2, TOWN.h, "R");
b.rect(TOWN.x, 24, TOWN.w, 2, "R");

// The old flagstone plaza is gone — an empty stone rectangle reads as a
// parade ground, not a working village. In its place: a tiny safe-zone
// square at the crossroads (2x2, so a respawn always lands on safe cobble)
// and short branch streets that connect each shop's door back to the main
// spine, so buildings hang off the road network rather than sitting alone
// in the middle of grass.
b.rect(34, 24, 2, 2, "T");
export const TEMPLE_SPAWN = { x: 34, y: 26 }; // one tile south of the church door

// Branch streets from the N-S spine out to each shop's door row.
b.rect(26, 20, 9, 1, "R"); // Borin's forge (NW) → spine
b.rect(35, 20, 9, 1, "R"); // Fenn's fletchery (NE) → spine
b.rect(26, 27, 9, 1, "R"); // Wren's apothecary (SW) → spine
b.rect(35, 27, 9, 1, "R"); // Elder Corwin's cottage (SE) → spine
// Short branch from the west spine (x=30..35) north to the guardpost door row.
b.rect(30, 18, 5, 1, "R");

// ---------------------------------------------------------------------------
// Buildings — drawn as roofed sprites. Doors are entry points into interiors.
// ---------------------------------------------------------------------------

export interface BuildingPlacement {
  textureKey: string;
  footprintX: number;
  footprintY: number;
  footprintW: number;
  footprintH: number;
}

export const BUILDINGS: BuildingPlacement[] = [
  // NW: Borin's forge — melee shop.
  { textureKey: "building-forge", footprintX: 25, footprintY: 17, footprintW: 3, footprintH: 3 },
  // NE: Fenn's fletchery — ranged shop.
  { textureKey: "building-cottage", footprintX: 42, footprintY: 17, footprintW: 3, footprintH: 3 },
  // SW: Wren's apothecary — magic shop.
  { textureKey: "building-house", footprintX: 25, footprintY: 28, footprintW: 3, footprintH: 3 },
  // SE: Elder Corwin's cottage — vocation NPC (interior later; outside for now).
  { textureKey: "building-cottage", footprintX: 42, footprintY: 28, footprintW: 3, footprintH: 3 },
  // Guardpost isn't over the north gate any more — the church is the town's
  // north-facing landmark now, and the guardpost is a small watchpost tucked
  // to the west of the plaza.
  { textureKey: "building-guardpost", footprintX: 30, footprintY: 15, footprintW: 3, footprintH: 3 },
  // Farmer's cottage on the south road.
  { textureKey: "building-cottage", footprintX: 32, footprintY: 40, footprintW: 3, footprintH: 3 },
  // The church — the centrepiece of town, footprint 4x3 tiles. The roof and
  // steeple in the sprite extend above the footprint by design (see the art
  // note on visual size vs collision footprint).
  { textureKey: "building-church", footprintX: 32, footprintY: 21, footprintW: 4, footprintH: 3 },
];
for (const building of BUILDINGS) {
  b.rect(building.footprintX, building.footprintY, building.footprintW, building.footprintH, "W");
}

// ---------------------------------------------------------------------------
// Entry points — walking onto one of these tiles opens the corresponding
// interior room. The tile itself stays walkable dirt; the door prop sits on
// top of it so the eye can find it, and WorldScene watches for the player's
// tile matching one of these after each step.
// ---------------------------------------------------------------------------

export interface EntryPoint {
  x: number;
  y: number;
  interiorId: string;
}

export const ENTRY_POINTS: EntryPoint[] = [
  { x: 26, y: 20, interiorId: "melee_shop" }, // in front of Borin's forge
  { x: 43, y: 20, interiorId: "ranged_shop" }, // in front of Fenn's cottage
  { x: 26, y: 27, interiorId: "magic_shop" }, // in front of Wren's house
  { x: 34, y: 25, interiorId: "temple_main" }, // in front of the church door
];
for (const entry of ENTRY_POINTS) {
  b.set(entry.x, entry.y, "D");
}

// ---------------------------------------------------------------------------
// Farm areas
// ---------------------------------------------------------------------------

b.rect(34, TOWN.y + TOWN.h, 2, 8, "R");

const PEN = { x: 39, y: 40, w: 8, h: 6 };
const YARD = { x: 24, y: 41, w: 5, h: 4 };
b.rect(37, 42, 2, 1, "D");
b.rect(37, 42, 1, 1, "D");
b.rect(35, 47, 1, 2, "D");

// ---------------------------------------------------------------------------
// Vegetation
// ---------------------------------------------------------------------------

b.scatter(2, 4, 18, 20, "t", ["."], 0.14, 700);
b.scatter(2, 4, 18, 20, "b", ["."], 0.05, 701);
b.scatter(2, 4, 18, 20, "f", ["."], 0.04, 702);

b.scatter(50, 4, 18, 20, "p", ["."], 0.14, 720);
b.scatter(50, 4, 18, 20, "m", ["."], 0.05, 721);
b.scatter(50, 4, 18, 20, "f", ["."], 0.03, 722);

b.scatter(TOWN.x - 3, TOWN.y - 3, TOWN.w + 6, TOWN.h + 6, "f", ["."], 0.03, 730);
b.scatter(TOWN.x - 3, TOWN.y - 3, TOWN.w + 6, TOWN.h + 6, "n", ["."], 0.02, 731);

b.scatter(2, 32, MAP_WIDTH - 4, 15, "t", ["."], 0.03, 740);
b.scatter(2, 32, MAP_WIDTH - 4, 15, "f", ["."], 0.05, 741);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PropPlacement {
  textureKey: string;
  x: number;
  y: number;
  blocks?: boolean;
}

const penFences: PropPlacement[] = [];
const PEN_GATE_X = PEN.x + Math.floor(PEN.w / 2);
for (let xx = PEN.x; xx < PEN.x + PEN.w; xx++) {
  if (xx !== PEN_GATE_X && xx !== PEN_GATE_X + 1) {
    penFences.push({ textureKey: "fence", x: xx, y: PEN.y, blocks: true });
  }
  penFences.push({ textureKey: "fence", x: xx, y: PEN.y + PEN.h - 1, blocks: true });
}
for (let yy = PEN.y + 1; yy < PEN.y + PEN.h - 1; yy++) {
  penFences.push({ textureKey: "fence", x: PEN.x, y: yy, blocks: true });
  penFences.push({ textureKey: "fence", x: PEN.x + PEN.w - 1, y: yy, blocks: true });
}
penFences.push({ textureKey: "fence-gate", x: PEN_GATE_X + 1, y: PEN.y });

const yardFences: PropPlacement[] = [];
for (let xx = YARD.x; xx < YARD.x + YARD.w; xx++) {
  yardFences.push({ textureKey: "fence", x: xx, y: YARD.y, blocks: true });
  if (xx !== YARD.x + 2) yardFences.push({ textureKey: "fence", x: xx, y: YARD.y + YARD.h - 1, blocks: true });
}
for (let yy = YARD.y + 1; yy < YARD.y + YARD.h - 1; yy++) {
  yardFences.push({ textureKey: "fence", x: YARD.x, y: yy, blocks: true });
  yardFences.push({ textureKey: "fence", x: YARD.x + YARD.w - 1, y: yy, blocks: true });
}

export const PROPS: PropPlacement[] = [
  ...penFences,
  ...yardFences,

  // Farm animals.
  { textureKey: "sheep", x: 41, y: 42 },
  { textureKey: "sheep", x: 44, y: 43 },
  { textureKey: "sheep", x: 42, y: 44 },
  { textureKey: "sheep", x: 45, y: 42 },
  { textureKey: "chicken", x: 25, y: 42 },
  { textureKey: "chicken", x: 27, y: 43 },
  { textureKey: "chicken", x: 26, y: 44 },
  { textureKey: "chicken", x: 28, y: 42 },

  // Town cats.
  { textureKey: "cat", x: 22, y: 20 },
  { textureKey: "cat", x: 47, y: 20 },
  { textureKey: "cat", x: 38, y: 30 },
  { textureKey: "cat", x: 30, y: 26 },

  // Shop-yard clutter (outside the buildings, on the alley tiles).
  { textureKey: "weapon-rack", x: 24, y: 20, blocks: true }, // Borin's yard
  { textureKey: "sack", x: 28, y: 20, blocks: true },
  { textureKey: "barrel", x: 45, y: 20, blocks: true }, // Fenn's yard
  { textureKey: "crate", x: 42, y: 20, blocks: true },
  { textureKey: "chest", x: 28, y: 27, blocks: true }, // Wren's yard
  { textureKey: "barrel", x: 45, y: 27, blocks: true }, // Elder's yard

  // --- Shop signs so a player can read what a shop is from the street. ---
  { textureKey: "shop-sign-sword", x: 27, y: 20 },
  { textureKey: "shop-sign-bow", x: 41, y: 20 },
  { textureKey: "shop-sign-potion", x: 27, y: 27 },

  // --- Small pieces of street furniture along the roads. Kept sparse — the
  // --- plaza is gone on purpose, so nothing here should read as one. ---
  // A well on the grass, north-west of the church.
  { textureKey: "well", x: 30, y: 22, blocks: true },
  // A planter tucked between the well and the church's north-west corner.
  { textureKey: "planter", x: 31, y: 22, blocks: true },
  // A bench on the south branch by the church, opposite the door.
  { textureKey: "bench", x: 37, y: 27, blocks: true },
  // Two torches on the grass strip immediately south of the church door,
  // one either side of the doorway. They light the safe zone at night
  // without blocking the E-W spine.
  { textureKey: "torch", x: 33, y: 26, blocks: true },
  { textureKey: "torch", x: 36, y: 26, blocks: true },

  // Farm yard dressing.
  { textureKey: "sack", x: 32, y: 44, blocks: true },
  { textureKey: "crate", x: 34, y: 44, blocks: true },
];

const blockedCells = new Set<string>();
for (const prop of PROPS) {
  if (prop.blocks) blockedCells.add(`${prop.x},${prop.y}`);
}

// ---------------------------------------------------------------------------
// Signposts
// ---------------------------------------------------------------------------

export interface SignPlacement {
  x: number;
  y: number;
  text: string;
}
export const SIGNS: SignPlacement[] = [
  { x: 33, y: 14, text: "Oakhollow — welcome, traveller." },
  { x: 33, y: 38, text: "South: the farm and the shore." },
  { x: 27, y: 20, text: "Borin's Forge — weapons & armour." },
  { x: 41, y: 20, text: "Fenn's Fletchery — bows & arrows." },
  { x: 27, y: 27, text: "Wren's Apothecary — magic & remedies." },
  { x: 41, y: 27, text: "Elder Corwin — a path to walk." },
];

// ---------------------------------------------------------------------------
// NPCs on the world map — only the outdoor ones. Shopkeepers live in their
// interior rooms; see src/data/interiors.ts.
// ---------------------------------------------------------------------------

export type NpcRole = "shop" | "vocation" | "ambient";

export interface NpcSpawn {
  id: string;
  name: string;
  textureKey: string;
  role: NpcRole;
  greeting: string;
  about: string;
  x: number;
  y: number;
}

export const NPC_SPAWNS: NpcSpawn[] = [
  // Elder Corwin stays outside on his front step — vocation talks happen in
  // the open, and he's the first face a new arrival sees on the south side.
  {
    id: "elder",
    name: "Elder Corwin",
    textureKey: "npc-elder-corwin",
    role: "vocation",
    greeting: "Welcome, young one.",
    about:
      "I have watched many adventurers pass through Oakhollow and find their calling. When you are ready, come find me and we'll speak of yours.",
    x: 43,
    y: 27,
  },
  // Ambient farmers standing in the yard — no dialogue attached.
  {
    id: "farmer_gil",
    name: "Farmer",
    textureKey: "npc-farmer-01",
    role: "ambient",
    greeting: "",
    about: "",
    x: 32,
    y: 45,
  },
  {
    id: "farmer_ana",
    name: "Farmhand",
    textureKey: "npc-farmer-02",
    role: "ambient",
    greeting: "",
    about: "",
    x: 44,
    y: 45,
  },
];

// ---------------------------------------------------------------------------
// Monsters — disabled during the tutorial rebuild.
// ---------------------------------------------------------------------------

export interface MonsterSpawn {
  monsterId: string;
  x: number;
  y: number;
}

export const MONSTER_SPAWNS: MonsterSpawn[] = [];

const DISABLED_MONSTER_SPAWNS: MonsterSpawn[] = [
  { monsterId: "troll", x: 12, y: 8 },
  { monsterId: "rat", x: 45, y: 40 },
  { monsterId: "slime", x: 50, y: 38 },
];
void DISABLED_MONSTER_SPAWNS;

for (const prop of PROPS) {
  if (b.get(prop.x, prop.y) === "t" || b.get(prop.x, prop.y) === "p" || b.get(prop.x, prop.y) === "b") {
    b.set(prop.x, prop.y, ".");
  }
}
for (const npc of NPC_SPAWNS) {
  if (b.get(npc.x, npc.y) === "t" || b.get(npc.x, npc.y) === "p" || b.get(npc.x, npc.y) === "b") {
    b.set(npc.x, npc.y, ".");
  }
}
b.set(TEMPLE_SPAWN.x, TEMPLE_SPAWN.y, "T");

// ---------------------------------------------------------------------------
// Tile legend and lookup helpers
// ---------------------------------------------------------------------------

export interface TileInfo {
  walkable: boolean;
  textureKey: string;
  variants?: string[];
  overlayKey?: string;
  overlayVariants?: string[];
  animated?: boolean;
  tree?: TreeSpecies;
  safe: boolean;
}

function cellHash(x: number, y: number): number {
  return Math.abs(Math.imul(x * 374761393 + y * 668265263, 1274126177)) >>> 0;
}

export function variantForCell(tile: TileInfo, x: number, y: number): string {
  if (!tile.variants || tile.variants.length === 0) return tile.textureKey;
  return tile.variants[cellHash(x, y) % tile.variants.length];
}

export function overlayForCell(tile: TileInfo, x: number, y: number): string | undefined {
  if (tile.overlayVariants && tile.overlayVariants.length > 0) {
    return tile.overlayVariants[cellHash(x + 7, y + 13) % tile.overlayVariants.length];
  }
  return tile.overlayKey;
}

const LEGEND: Record<string, TileInfo> = {
  "#": { walkable: false, textureKey: "void-wall", safe: false },
  ".": { walkable: true, textureKey: "grass", variants: ["grass", "grass-2", "grass-3"], safe: false },
  T: { walkable: true, textureKey: "temple-floor", safe: true },
  D: { walkable: true, textureKey: "dirt", variants: ["dirt", "dirt-2"], safe: false },
  C: { walkable: true, textureKey: "cave-floor", safe: false },
  W: { walkable: false, textureKey: "stone-wall", safe: false },
  "~": { walkable: false, textureKey: "water", animated: true, safe: false },
  g: { walkable: true, textureKey: "rocky-ground", safe: false },
  M: { walkable: false, textureKey: "mountain", safe: false },
  R: { walkable: true, textureKey: "road", safe: false },
  F: { walkable: true, textureKey: "wood-floor", safe: true },

  t: { walkable: false, textureKey: "grass", variants: ["grass", "grass-2"], tree: "oak", safe: false },
  p: { walkable: false, textureKey: "grass", variants: ["grass", "grass-2"], tree: "pine", safe: false },
  y: { walkable: false, textureKey: "rocky-ground", tree: "dead", safe: false },
  b: { walkable: false, textureKey: "grass", variants: ["grass", "grass-2"], overlayKey: "bush", safe: false },
  o: {
    walkable: false,
    textureKey: "grass",
    variants: ["grass", "grass-3"],
    overlayVariants: ["boulder", "rock-mossy"],
    safe: false,
  },
  r: { walkable: false, textureKey: "grass", variants: ["grass", "grass-3"], overlayKey: "rock-medium", safe: false },
  u: { walkable: false, textureKey: "grass", overlayKey: "stump", safe: false },

  f: { walkable: true, textureKey: "grass", variants: ["grass", "grass-2"], overlayKey: "flowers", safe: false },
  m: { walkable: true, textureKey: "grass", overlayKey: "mushrooms", safe: false },
  n: { walkable: true, textureKey: "grass", variants: ["grass", "grass-3"], overlayKey: "rock-small", safe: false },
  N: { walkable: true, textureKey: "cave-floor", overlayKey: "rock-small", safe: false },

  k: { walkable: false, textureKey: "grass", overlayKey: "barrel", safe: false },
  x: { walkable: false, textureKey: "grass", overlayKey: "crate", safe: false },
  w: { walkable: false, textureKey: "temple-floor", overlayKey: "well", safe: true },
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
  return tileAt(x, y).walkable && !blockedCells.has(`${x},${y}`);
}

export function forEachTile(cb: (x: number, y: number, tile: TileInfo) => void): void {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) cb(x, y, tileAt(x, y));
  }
}

/** Returns the interior room to zone into if `(x,y)` is a door tile. */
export function entryPointAt(x: number, y: number): EntryPoint | null {
  return ENTRY_POINTS.find((e) => e.x === x && e.y === y) ?? null;
}
