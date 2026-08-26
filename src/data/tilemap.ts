// The world: Oakhollow, a small starter island. Water rings the whole map;
// the interior is a walled town at the centre with a farm on the south
// shore. Everything the player needs to learn the game is inside the wall
// or a short walk south of it. Built procedurally with MapBuilder rather
// than hand-typed ASCII — a map this size can't be kept aligned by hand
// reliably.
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

// Elliptical land mass, sand-ringed at the coast so grass never touches water
// directly. Values tuned so the island fills the frame with a comfortable
// margin of open water on every side.
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
      b.set(xx, yy, "D"); // sandy coast where the grass meets the surf
    }
  }
}

// ---------------------------------------------------------------------------
// Town — walled compound in the middle of the island
// ---------------------------------------------------------------------------

// Town bounding rectangle (inside the ring wall).
const TOWN = { x: 21, y: 13, w: 28, h: 24 };
const WALL_GATES = {
  north: { x: 34, w: 2 },
  south: { x: 34, w: 2 },
  east: { y: 24, h: 2 },
  west: { y: 24, h: 2 },
};

// Ring wall on the border of the town rectangle, then punch gate openings.
b.border(TOWN.x, TOWN.y, TOWN.w, TOWN.h, "W");
for (let i = 0; i < WALL_GATES.north.w; i++) {
  b.set(WALL_GATES.north.x + i, TOWN.y, "R");
  b.set(WALL_GATES.south.x + i, TOWN.y + TOWN.h - 1, "R");
}
for (let i = 0; i < WALL_GATES.east.h; i++) {
  b.set(TOWN.x + TOWN.w - 1, WALL_GATES.east.y + i, "R");
  b.set(TOWN.x, WALL_GATES.west.y + i, "R");
}

// Cobble streets: a north-south spine through both gates, and an east-west
// cross street through the west and east gates.
b.rect(34, TOWN.y, 2, TOWN.h, "R");
b.rect(TOWN.x, 24, TOWN.w, 2, "R");

// Central plaza (safe zone) at the crossroads — laid after the roads so its
// tile wins at the intersection.
const PLAZA = { x: 30, y: 21, w: 10, h: 8 };
b.rect(PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h, "T");
export const TEMPLE_SPAWN = { x: 34, y: 24 };

// Dirt alleys threading between the housing blocks, so a walker isn't stuck
// on the cobble grid alone. Kept off the plaza itself.
b.rect(24, 17, 6, 1, "D"); // between north-west shops and outer wall
b.rect(40, 17, 6, 1, "D");
b.rect(24, 31, 6, 1, "D"); // between south houses and outer wall
b.rect(40, 31, 6, 1, "D");
b.rect(28, 15, 1, 4, "D"); // vertical alley connecting the melee-shop block
b.rect(41, 15, 1, 4, "D"); // vertical alley on the ranged-shop block
b.rect(28, 30, 1, 4, "D"); // and mirrored below
b.rect(41, 30, 1, 4, "D");

// ---------------------------------------------------------------------------
// Buildings — three shops, a temple hall and a couple of houses inside the wall
// ---------------------------------------------------------------------------

export interface BuildingPlacement {
  textureKey: string;
  footprintX: number;
  footprintY: number;
  footprintW: number;
  footprintH: number;
}

export const BUILDINGS: BuildingPlacement[] = [
  // Melee shop — Borin the Blacksmith. Weapons and armour: the forge sprite.
  { textureKey: "building-forge", footprintX: 25, footprintY: 15, footprintW: 3, footprintH: 3 },
  // Ranged shop — Fenn the Fletcher. The cottage doubles as her workshop.
  { textureKey: "building-cottage", footprintX: 42, footprintY: 15, footprintW: 3, footprintH: 3 },
  // Magic shop — Wren the Apothecary. Wands, potions and jewellery.
  { textureKey: "building-house", footprintX: 25, footprintY: 32, footprintW: 3, footprintH: 3 },
  // Elder Corwin's cottage — the vocation NPC.
  { textureKey: "building-cottage", footprintX: 42, footprintY: 32, footprintW: 3, footprintH: 3 },
  // The guard post covers the north gate.
  { textureKey: "building-guardpost", footprintX: 32, footprintY: 15, footprintW: 3, footprintH: 3 },
  // A civilian house on the south block, so the plaza doesn't sit alone.
  { textureKey: "building-house", footprintX: 36, footprintY: 32, footprintW: 3, footprintH: 3 },

  // --- The farm, outside the south gate --------------------------------
  // Farmer's cottage on the south road, gable facing the town.
  { textureKey: "building-cottage", footprintX: 32, footprintY: 41, footprintW: 3, footprintH: 3 },
];
for (const building of BUILDINGS) {
  b.rect(building.footprintX, building.footprintY, building.footprintW, building.footprintH, "W");
}

// Short dirt walkways from each shop / cottage door out onto the street.
b.set(26, 18, "D"); // Borin -> alley
b.set(43, 18, "D"); // Fenn -> alley
b.set(26, 31, "D"); // Wren -> alley
b.set(43, 31, "D"); // Corwin -> alley
b.set(37, 31, "D"); // civilian house -> alley

// Plaza well, off the crossroads centre.
b.set(32, 23, "w");

// ---------------------------------------------------------------------------
// Farm — outside the south gate, on the way to the shore
// ---------------------------------------------------------------------------

// South road extends from the town's south gate out toward the farm.
b.rect(34, TOWN.y + TOWN.h, 2, 8, "R");

// Sheep pen: a fenced grass square with a gate opening on its north side, so
// the player walking down from the south gate can see the animals immediately.
const PEN = { x: 38, y: 40, w: 8, h: 6 };
// The pen is grass, not a special ground — sheep graze on grass. The visual
// fencing is done via PROP fence tiles below rather than terrain, so the
// interior stays walkable ground and grazing sprites read against grass.

// Chicken yard just west of the farmer's cottage, small and cluttered.
const YARD = { x: 26, y: 41, w: 5, h: 4 };
// Same story — the yard's ground stays grass; the coop is a prop.

// A dirt path from the south road out to the pen entrance.
b.rect(36, 42, 2, 1, "D");
b.rect(37, 42, 1, 1, "D");

// ---------------------------------------------------------------------------
// Coastline detail — a small dock and beach features
// ---------------------------------------------------------------------------

// A pier of dirt tiles into the south water, giving the coast a point of
// interest. Kept short so a curious player can walk to the end and turn back.
b.rect(35, 47, 1, 2, "D");

// ---------------------------------------------------------------------------
// Vegetation — dressing the island around the town
// ---------------------------------------------------------------------------

// Deciduous woods on the west side of the island, dense but not walled.
b.scatter(2, 4, 18, 20, "t", ["."], 0.14, 700);
b.scatter(2, 4, 18, 20, "b", ["."], 0.05, 701);
b.scatter(2, 4, 18, 20, "f", ["."], 0.04, 702);

// Pine wood on the east side, a different colour so the island has variety.
b.scatter(50, 4, 18, 20, "p", ["."], 0.14, 720);
b.scatter(50, 4, 18, 20, "m", ["."], 0.05, 721);
b.scatter(50, 4, 18, 20, "f", ["."], 0.03, 722);

// Ground cover in the town approach rings, so grass isn't uniform there.
b.scatter(TOWN.x - 3, TOWN.y - 3, TOWN.w + 6, TOWN.h + 6, "f", ["."], 0.03, 730);
b.scatter(TOWN.x - 3, TOWN.y - 3, TOWN.w + 6, TOWN.h + 6, "n", ["."], 0.02, 731);

// Southern shore: sparser trees, more open — the farm needs elbow room.
b.scatter(2, 32, MAP_WIDTH - 4, 15, "t", ["."], 0.03, 740);
b.scatter(2, 32, MAP_WIDTH - 4, 15, "f", ["."], 0.05, 741);

// ---------------------------------------------------------------------------
// Props — what makes a location read as a place rather than as terrain
// ---------------------------------------------------------------------------

export interface PropPlacement {
  textureKey: string;
  x: number;
  y: number;
  /** Blocks movement without changing the terrain drawn underneath it. */
  blocks?: boolean;
}

// Build the fence line around the sheep pen, with a gate opening in the top
// row (the gate itself is a decorative prop at that gap so the eye still
// reads a boundary).
const penFences: PropPlacement[] = [];
const PEN_GATE_X = PEN.x + Math.floor(PEN.w / 2); // gate opening on the north side
for (let xx = PEN.x; xx < PEN.x + PEN.w; xx++) {
  if (xx !== PEN_GATE_X && xx !== PEN_GATE_X + 1) {
    penFences.push({ textureKey: "fence", x: xx, y: PEN.y, blocks: true }); // north
  }
  penFences.push({ textureKey: "fence", x: xx, y: PEN.y + PEN.h - 1, blocks: true }); // south
}
for (let yy = PEN.y + 1; yy < PEN.y + PEN.h - 1; yy++) {
  penFences.push({ textureKey: "fence", x: PEN.x, y: yy, blocks: true }); // west
  penFences.push({ textureKey: "fence", x: PEN.x + PEN.w - 1, y: yy, blocks: true }); // east
}
// The gate leaf sits at the opening — walkable through, but visually a gate.
penFences.push({ textureKey: "fence-gate", x: PEN_GATE_X + 1, y: PEN.y });

// Chicken yard fences with a gap on the south side toward the cottage door.
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

  // --- Sheep in the pen (background dressing, not creatures) -----------
  { textureKey: "sheep", x: 40, y: 42 },
  { textureKey: "sheep", x: 43, y: 43 },
  { textureKey: "sheep", x: 41, y: 44 },
  { textureKey: "sheep", x: 44, y: 42 },

  // --- Chickens pecking in the yard ------------------------------------
  { textureKey: "chicken", x: 27, y: 42 },
  { textureKey: "chicken", x: 29, y: 43 },
  { textureKey: "chicken", x: 28, y: 44 },
  { textureKey: "chicken", x: 30, y: 42 },

  // --- Cats around town: alleys, plaza, on a barrel --------------------
  { textureKey: "cat", x: 26, y: 20 },
  { textureKey: "cat", x: 43, y: 20 },
  { textureKey: "cat", x: 33, y: 27 },
  { textureKey: "cat", x: 39, y: 33 },

  // --- Shop dressing ---------------------------------------------------
  { textureKey: "weapon-rack", x: 24, y: 17, blocks: true }, // outside Borin's forge
  { textureKey: "sack", x: 28, y: 17, blocks: true },
  { textureKey: "barrel", x: 42, y: 17, blocks: true }, // outside Fenn's shop
  { textureKey: "crate", x: 45, y: 17, blocks: true },
  { textureKey: "barrel", x: 24, y: 34, blocks: true }, // outside Wren's apothecary
  { textureKey: "crate", x: 28, y: 34, blocks: true },
  { textureKey: "sack", x: 45, y: 34, blocks: true }, // outside Elder Corwin's

  // --- Plaza dressing --------------------------------------------------
  { textureKey: "torch", x: 32, y: 22, blocks: true },
  { textureKey: "torch", x: 37, y: 22, blocks: true },
  { textureKey: "torch", x: 32, y: 28, blocks: true },
  { textureKey: "torch", x: 37, y: 28, blocks: true },
  { textureKey: "bench", x: 34, y: 21, blocks: true },
  { textureKey: "bench", x: 36, y: 27, blocks: true },

  // --- Farm dressing ---------------------------------------------------
  { textureKey: "sack", x: 32, y: 44, blocks: true }, // outside the farmer's cottage
  { textureKey: "crate", x: 34, y: 44, blocks: true },
  { textureKey: "chest", x: 30, y: 43, blocks: true }, // inside the chicken yard
];

// Collision is kept out of the tile grid on purpose: a prop should be able to
// block a square without changing the ground drawn beneath it, and a large
// sprite's footprint is rarely the same shape as its art (see the art
// direction on collision vs visual size).
const blockedCells = new Set<string>();
for (const prop of PROPS) {
  if (prop.blocks) blockedCells.add(`${prop.x},${prop.y}`);
}

// ---------------------------------------------------------------------------
// Signposts (decorative, non-blocking, placed just off the road)
// ---------------------------------------------------------------------------

export interface SignPlacement {
  x: number;
  y: number;
  text: string;
}
export const SIGNS: SignPlacement[] = [
  { x: 33, y: 14, text: "Oakhollow — welcome, traveller." },
  { x: 33, y: 38, text: "South: the farm and the shore." },
  { x: 26, y: 18, text: "Borin's Forge — weapons & armour." },
  { x: 43, y: 18, text: "Fenn's Fletchery — bows & arrows." },
  { x: 26, y: 31, text: "Wren's Apothecary — magic & remedies." },
  { x: 43, y: 31, text: "Elder Corwin — a path to walk." },
];

// ---------------------------------------------------------------------------
// NPCs — three shopkeepers, one vocation guide, and a couple of farm workers
// as background "props" (no interaction).
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
    x: 27,
    y: 19,
  },
  {
    id: "fletcher",
    name: "Fenn",
    textureKey: "npc-fenn",
    role: "shop",
    greeting: "Bows, arrows, quivers — take your pick.",
    about:
      "I fletch arrows and string bows. If you'd sooner keep the fight at a distance, this is the shop.",
    x: 44,
    y: 19,
  },
  {
    id: "apothecary",
    name: "Wren",
    textureKey: "npc-wren",
    role: "shop",
    greeting: "Wands, potions, a charm or two — I have them all.",
    about:
      "The apothecary handles anything with mana in it: wands for the caster, potions for the tired, and a jewel to keep death at arm's length.",
    x: 27,
    y: 34,
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
    y: 34,
  },

  // Farmers walk around their yard — background dressing, no dialogue attached.
  // Rendered by the same NPC path so anchoring and depth-sort work out of the
  // box; the "ambient" role tells the interaction code to ignore them.
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
// Monsters — none, while the tutorial area is being built. Restore by moving
// entries out of DISABLED_MONSTER_SPAWNS back into MONSTER_SPAWNS.
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
for (const npc of NPC_SPAWNS) b.set(npc.x, npc.y, ".");
b.set(TEMPLE_SPAWN.x, TEMPLE_SPAWN.y, "T");

// ---------------------------------------------------------------------------
// Tile legend and lookup helpers (unchanged behaviourally from the earlier
// map — same characters mean the same tiles).
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

  // Blocking vegetation and stone.
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

  // Walkable ground cover.
  f: { walkable: true, textureKey: "grass", variants: ["grass", "grass-2"], overlayKey: "flowers", safe: false },
  m: { walkable: true, textureKey: "grass", overlayKey: "mushrooms", safe: false },
  n: { walkable: true, textureKey: "grass", variants: ["grass", "grass-3"], overlayKey: "rock-small", safe: false },
  N: { walkable: true, textureKey: "cave-floor", overlayKey: "rock-small", safe: false },

  // Town dressing.
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
