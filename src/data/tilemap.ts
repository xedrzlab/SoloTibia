// The world: Oakhollow, a small starter island. Water rings the whole map;
// the interior is a walled town at the centre with a farm on the south
// shore. Everything the player needs to learn the game is inside the wall
// or a short walk south of it. Built procedurally with MapBuilder rather
// than hand-typed ASCII — a map this size can't be kept aligned by hand
// reliably.
//
// Houses are drawn roofless: walls and interior floor are laid as tiles, the
// door is an opening in the wall, and the shopkeeper stands behind a counter
// inside. This reads at gameplay zoom without a scene change — the player
// walks in, taps the shopkeeper, and everything is in one continuous world.
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

b.rect(34, TOWN.y, 2, TOWN.h, "R");
b.rect(TOWN.x, 24, TOWN.w, 2, "R");

// Central plaza (safe zone) — laid after roads so plaza tiles win.
const PLAZA = { x: 30, y: 21, w: 10, h: 8 };
b.rect(PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h, "T");
export const TEMPLE_SPAWN = { x: 34, y: 24 };

// Dirt alleys threading between the housing blocks.
b.rect(23, 17, 3, 1, "D");
b.rect(44, 17, 3, 1, "D");
b.rect(23, 31, 3, 1, "D");
b.rect(44, 31, 3, 1, "D");

// ---------------------------------------------------------------------------
// Houses — every building is a roofless room on the tilemap
// ---------------------------------------------------------------------------

export interface HouseRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the doorway opens; a coordinate that sits on the room's wall border. */
  door: { x: number; y: number };
  label?: string;
}

/**
 * Paint one house: border of stone wall, interior of wooden plank floor, and
 * one wall tile replaced by a floor tile at the door position so the player
 * can walk in.
 */
function paintRoom(room: HouseRoom) {
  b.rect(room.x, room.y, room.w, room.h, "F"); // wooden floor everywhere inside
  b.border(room.x, room.y, room.w, room.h, "W"); // stone walls on the border
  b.set(room.door.x, room.door.y, "F"); // punch the doorway
}

// Four shops + Elder + civilian house — arranged inside the town wall so
// each faces the cobble street it opens onto.
const HOUSES: (HouseRoom & { id: string })[] = [
  // North-west block: Borin the Blacksmith (melee shop). Door faces south.
  { id: "melee_shop", x: 23, y: 15, w: 6, h: 5, door: { x: 25, y: 19 } },
  // North-east block: Fenn the Fletcher (ranged shop). Door faces south.
  { id: "ranged_shop", x: 41, y: 15, w: 6, h: 5, door: { x: 44, y: 19 } },
  // South-west block: Wren the Apothecary (magic shop). Door faces north.
  { id: "magic_shop", x: 23, y: 30, w: 6, h: 5, door: { x: 25, y: 30 } },
  // South-east block: Elder Corwin's cottage (vocation NPC). Door faces north.
  { id: "elder_house", x: 41, y: 30, w: 6, h: 5, door: { x: 44, y: 30 } },
  // Extra civilian house on the SE, tucked to the far side so it doesn't
  // crowd the Elder. Door faces the east street.
  { id: "civilian_house", x: 41, y: 22, w: 5, h: 4, door: { x: 41, y: 23 } },
  // A small watchpost near the north gate.
  { id: "watchpost", x: 27, y: 22, w: 3, h: 3, door: { x: 29, y: 23 } },
];
for (const house of HOUSES) paintRoom(house);

// The farmer's cottage on the south road, drawn the same way.
const FARM_HOUSE: HouseRoom = { x: 31, y: 40, w: 5, h: 4, door: { x: 33, y: 43 } };
paintRoom(FARM_HOUSE);

// ---------------------------------------------------------------------------
// Farm areas — outside the south gate
// ---------------------------------------------------------------------------

// South road extends from the town's south gate out toward the farm.
b.rect(34, TOWN.y + TOWN.h, 2, 8, "R");

const PEN = { x: 39, y: 40, w: 8, h: 6 };
const YARD = { x: 24, y: 41, w: 5, h: 4 };
b.rect(37, 42, 2, 1, "D");
b.rect(37, 42, 1, 1, "D");

// A short pier of dirt tiles into the south water.
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
// Props — furniture inside houses, plaza dressing, farm animals
// ---------------------------------------------------------------------------

export interface PropPlacement {
  textureKey: string;
  x: number;
  y: number;
  blocks?: boolean;
}

// Build the fence line around the sheep pen, with a gate opening in the top
// row (the gate itself is a decorative prop at that gap).
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

  // --- Sheep & chickens on the farm ------------------------------------
  { textureKey: "sheep", x: 41, y: 42 },
  { textureKey: "sheep", x: 44, y: 43 },
  { textureKey: "sheep", x: 42, y: 44 },
  { textureKey: "sheep", x: 45, y: 42 },
  { textureKey: "chicken", x: 25, y: 42 },
  { textureKey: "chicken", x: 27, y: 43 },
  { textureKey: "chicken", x: 26, y: 44 },
  { textureKey: "chicken", x: 28, y: 42 },

  // --- Cats around town -------------------------------------------------
  { textureKey: "cat", x: 26, y: 20 },
  { textureKey: "cat", x: 43, y: 20 },
  { textureKey: "cat", x: 39, y: 33 },
  { textureKey: "cat", x: 30, y: 26 }, // one lounging on the plaza

  // --- Shop interiors: counter + shopkeeper standing behind it ---------
  // Borin's forge (melee): counter across the room, weapon rack in the corner.
  { textureKey: "counter", x: 25, y: 17, blocks: true },
  { textureKey: "counter", x: 26, y: 17, blocks: true },
  { textureKey: "weapon-rack", x: 24, y: 16, blocks: true },
  { textureKey: "sack", x: 27, y: 16, blocks: true },
  { textureKey: "barrel", x: 28, y: 16, blocks: true },

  // Fenn's fletchery (ranged): counter + a barrel of arrows behind her.
  { textureKey: "counter", x: 43, y: 17, blocks: true },
  { textureKey: "counter", x: 44, y: 17, blocks: true },
  { textureKey: "barrel", x: 42, y: 16, blocks: true },
  { textureKey: "crate", x: 45, y: 16, blocks: true },
  { textureKey: "weapon-rack", x: 46, y: 16, blocks: true },

  // Wren's apothecary (magic): counter, potion shelves, a chest of remedies.
  { textureKey: "counter", x: 25, y: 32, blocks: true },
  { textureKey: "counter", x: 26, y: 32, blocks: true },
  { textureKey: "chest", x: 24, y: 31, blocks: true },
  { textureKey: "crate", x: 27, y: 31, blocks: true },
  { textureKey: "barrel", x: 28, y: 31, blocks: true },

  // Elder Corwin's study: a table (bench stands in) and a chest of scrolls.
  { textureKey: "bench", x: 43, y: 31, blocks: true },
  { textureKey: "chest", x: 42, y: 31, blocks: true },
  { textureKey: "barrel", x: 45, y: 31, blocks: true },

  // Civilian house: a bed (bench) and a chest.
  { textureKey: "bench", x: 42, y: 23, blocks: true },
  { textureKey: "chest", x: 45, y: 24, blocks: true },

  // Watchpost: a torch by the door, gear on a rack.
  { textureKey: "weapon-rack", x: 28, y: 23, blocks: true },

  // Farmer's cottage interior.
  { textureKey: "bench", x: 32, y: 41, blocks: true },
  { textureKey: "chest", x: 34, y: 41, blocks: true },
  { textureKey: "barrel", x: 32, y: 42, blocks: true },

  // --- Plaza dressing -------------------------------------------------
  // Statue on the tile diagonal to the spawn, so a fresh character lands on
  // the crossroads next to it rather than through it.
  { textureKey: "statue", x: 35, y: 25, blocks: true },
  // The well tucked into the plaza's north-west quadrant.
  { textureKey: "well", x: 32, y: 22, blocks: true },
  // Four planters at the plaza corners.
  { textureKey: "planter", x: PLAZA.x, y: PLAZA.y, blocks: true },
  { textureKey: "planter", x: PLAZA.x + PLAZA.w - 1, y: PLAZA.y, blocks: true },
  { textureKey: "planter", x: PLAZA.x, y: PLAZA.y + PLAZA.h - 1, blocks: true },
  { textureKey: "planter", x: PLAZA.x + PLAZA.w - 1, y: PLAZA.y + PLAZA.h - 1, blocks: true },
  // Torches around the statue, so the plaza reads as lit at night.
  { textureKey: "torch", x: 32, y: 25, blocks: true },
  { textureKey: "torch", x: 37, y: 25, blocks: true },
  { textureKey: "torch", x: 32, y: 27, blocks: true },
  { textureKey: "torch", x: 37, y: 27, blocks: true },
  // Benches facing the statue, so a returning player has a place to pause.
  { textureKey: "bench", x: 34, y: 26, blocks: true },
  { textureKey: "bench", x: 36, y: 22, blocks: true },
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
  { x: 30, y: 19, text: "Borin's Forge — weapons & armour." },
  { x: 46, y: 19, text: "Fenn's Fletchery — bows & arrows." },
  { x: 30, y: 30, text: "Wren's Apothecary — magic & remedies." },
  { x: 46, y: 30, text: "Elder Corwin — a path to walk." },
];

// ---------------------------------------------------------------------------
// NPCs — three shopkeepers behind their counters, one vocation guide inside,
// plus a couple of ambient farm workers.
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
  {
    id: "blacksmith",
    name: "Borin",
    textureKey: "npc-borin",
    role: "shop",
    greeting: "Steel or leather, traveller?",
    about:
      "I've been the blacksmith here in Oakhollow for twenty years. Swords, axes, plate — if it's for a close fight, I forge it.",
    x: 25,
    y: 16, // behind the melee-shop counter
  },
  {
    id: "fletcher",
    name: "Fenn",
    textureKey: "npc-fenn",
    role: "shop",
    greeting: "Bows, arrows, quivers — take your pick.",
    about:
      "I fletch arrows and string bows. If you'd sooner keep the fight at a distance, this is the shop.",
    x: 43,
    y: 16,
  },
  {
    id: "apothecary",
    name: "Wren",
    textureKey: "npc-wren",
    role: "shop",
    greeting: "Wands, potions, a charm or two — I have them all.",
    about:
      "The apothecary handles anything with mana in it: wands for the caster, potions for the tired, and a jewel to keep death at arm's length.",
    x: 25,
    y: 33,
  },
  {
    id: "elder",
    name: "Elder Corwin",
    textureKey: "npc-elder-corwin",
    role: "vocation",
    greeting: "Welcome, young one.",
    about:
      "I have watched many adventurers pass through Oakhollow and find their calling. When you are ready, come find me and we'll speak of yours.",
    x: 44,
    y: 33,
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

// Force every point-feature tile back to its intended terrain, in case a
// scatter pass (which runs earlier) happened to land on the same cell.
for (const prop of PROPS) {
  if (b.get(prop.x, prop.y) === "t" || b.get(prop.x, prop.y) === "p" || b.get(prop.x, prop.y) === "b") {
    b.set(prop.x, prop.y, ".");
  }
}
for (const npc of NPC_SPAWNS) {
  // Scatter can't run on wood-floor or cobble, so this is only needed where
  // a farmer landed on a scattered grass overlay.
  if (b.get(npc.x, npc.y) === "t" || b.get(npc.x, npc.y) === "p" || b.get(npc.x, npc.y) === "b") {
    b.set(npc.x, npc.y, ".");
  }
}

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
  // Wooden house floor — safe indoors, so a returning character resurrected
  // in a shop's doorway can't be aggro'd by anything that walked in behind them.
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

// Empty — buildings are now painted onto the tilemap, not composited as
// separate sprite images. Kept as an export so the WorldScene iteration
// stays valid without a signature change.
export interface BuildingPlacement {
  textureKey: string;
  footprintX: number;
  footprintY: number;
  footprintW: number;
  footprintH: number;
}
export const BUILDINGS: BuildingPlacement[] = [];

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
