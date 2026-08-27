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
export const MAP_HEIGHT = 58;

const b = new MapBuilder(MAP_WIDTH, MAP_HEIGHT, "~"); // start as ocean

// ---------------------------------------------------------------------------
// Island shape
// ---------------------------------------------------------------------------

const ISLAND_CX = 35;
const ISLAND_CY = 27;
const ISLAND_RX = 30;
const ISLAND_RY = 26;

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

// Roughly doubled from the original 28x24 — the island shape sets the ceiling
// (the ellipse is 30x21 half-axes centred at 35, 25), so this is about as
// large as the wall can go without punching through the coast.
const TOWN = { x: 13, y: 8, w: 44, h: 32 };
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

// Streets used to be perfectly straight — a grid the eye reads as a housing
// estate, not a village. Every street now has at least one jog in it so
// walking through town isn't a straight line; houses on each row sit against
// whichever segment their door faces.
//
// N-S spine: straight through the north gate, jogs east once, jogs back.
b.path(
  [
    { x: 34, y: TOWN.y },
    { x: 34, y: 20 },
    { x: 37, y: 20 },
    { x: 37, y: 30 },
    { x: 34, y: 30 },
    { x: 34, y: TOWN.y + TOWN.h - 1 },
  ],
  "R",
  2,
);

// E-W spine stays straight — five buildings on the middle band open onto it
// (bank, Wren, church, Elder, depot), so jogging it would strand their doors.
b.rect(TOWN.x, 24, TOWN.w, 2, "R");

// Secondary E-W streets serving each row of houses — kept straight because
// each row's houses depend on the street's Y coordinate matching their door
// row. The winding character of the town comes from the N-S spine above and
// from short diagonal-feeling dirt alleys added further down.
b.rect(TOWN.x, 13, TOWN.w, 1, "R"); // upper street
b.rect(TOWN.x, 30, TOWN.w, 1, "R"); // lower street
b.rect(TOWN.x, 36, TOWN.w, 1, "R"); // southernmost

// Approach lanes for the northern shops — the N-S spine no longer runs
// straight past them (it jogs east at y=20), so each shop gets a short
// cobble spur back to the spine.
b.rect(26, 20, 9, 1, "R"); // Borin's approach
b.rect(35, 20, 9, 1, "R"); // Fenn's approach
// A short dirt alley between the north and middle rows on each side, so
// the two rows aren't hermetically separated.
b.rect(24, 14, 1, 3, "D"); // west side alley — through grass gap
b.rect(45, 14, 1, 3, "D"); // east side mirror

// The old flagstone plaza is gone — an empty stone rectangle reads as a
// parade ground, not a working village. In its place: a tiny safe-zone
// square at the crossroads (2x2, so a respawn always lands on safe cobble)
// and short branch streets that connect each shop's door back to the main
// spine, so buildings hang off the road network rather than sitting alone
// in the middle of grass.
b.rect(34, 24, 2, 2, "T");
export const TEMPLE_SPAWN = { x: 34, y: 26 }; // one tile south of the church door

// Short spur north connecting the forge street to the upper road.
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

// Every building sits north of the road its door opens onto, because the
// sprite always draws its door on the south face. Rows of houses line each
// E-W street, with irregular gaps so the town reads as grown rather than
// planned. The named services (shops, church, guardpost, bank, depot) mix
// in with the decorative houses on the same rows.
export const BUILDINGS: BuildingPlacement[] = [
  // --- Upper row (footprints y=10..12, doors y=12, road y=13) ---
  // Narrow stone tower on the far west — 2 tiles wide.
  { textureKey: "building-tower", footprintX: 16, footprintY: 10, footprintW: 2, footprintH: 3 },
  { textureKey: "building-cottage", footprintX: 20, footprintY: 10, footprintW: 3, footprintH: 3 },
  // Wide timber-frame hall — 4 tiles across.
  { textureKey: "building-timber-hall", footprintX: 27, footprintY: 10, footprintW: 4, footprintH: 3 },
  // Log cabin with steep A-frame roof.
  { textureKey: "building-log-cabin", footprintX: 38, footprintY: 10, footprintW: 3, footprintH: 3 },
  { textureKey: "building-cottage", footprintX: 45, footprintY: 10, footprintW: 3, footprintH: 3 },
  { textureKey: "building-house", footprintX: 49, footprintY: 10, footprintW: 3, footprintH: 3 },

  // --- Northern shops row (footprints y=17..19, doors y=19, road y=20) ---
  // Borin's forge — melee shop.
  { textureKey: "building-forge", footprintX: 25, footprintY: 17, footprintW: 3, footprintH: 3 },
  // Fenn's fletchery — ranged shop.
  { textureKey: "building-cottage", footprintX: 42, footprintY: 17, footprintW: 3, footprintH: 3 },
  // Guardposts flank the town gates from outside the wall.
  { textureKey: "building-guardpost", footprintX: 36, footprintY: 5, footprintW: 3, footprintH: 3 },  // north gate, east side
  { textureKey: "building-guardpost", footprintX: 36, footprintY: 40, footprintW: 3, footprintH: 3 }, // south gate, east side
  // Flat-roof stone workshop beside the forge.
  { textureKey: "building-workshop", footprintX: 20, footprintY: 17, footprintW: 3, footprintH: 3 },
  // Another tower on the east side.
  { textureKey: "building-tower", footprintX: 47, footprintY: 17, footprintW: 2, footprintH: 3 },
  { textureKey: "building-house", footprintX: 51, footprintY: 17, footprintW: 3, footprintH: 3 },

  // --- Middle band (footprints y=21..23, doors y=23, road y=24-25) ---
  // Bank at the far west.
  { textureKey: "building-house", footprintX: 14, footprintY: 21, footprintW: 3, footprintH: 3 }, // bank
  { textureKey: "building-log-cabin", footprintX: 18, footprintY: 21, footprintW: 3, footprintH: 3 },
  // Wren's apothecary.
  { textureKey: "building-house", footprintX: 25, footprintY: 21, footprintW: 3, footprintH: 3 },
  // The church.
  { textureKey: "building-church", footprintX: 32, footprintY: 21, footprintW: 4, footprintH: 3 },
  // Elder Corwin's cottage.
  { textureKey: "building-cottage", footprintX: 42, footprintY: 21, footprintW: 3, footprintH: 3 },
  { textureKey: "building-house", footprintX: 47, footprintY: 21, footprintW: 3, footprintH: 3 },
  { textureKey: "building-cottage", footprintX: 51, footprintY: 21, footprintW: 3, footprintH: 3 }, // depot

  // --- Lower row (footprints y=27..29, doors y=29, road y=30) ---
  // Wide farmhouse on the west end — 5 tiles across.
  { textureKey: "building-farmhouse", footprintX: 15, footprintY: 27, footprintW: 5, footprintH: 3 },
  { textureKey: "building-house", footprintX: 21, footprintY: 27, footprintW: 3, footprintH: 3 },
  // Timber hall in the middle of the lower row.
  { textureKey: "building-timber-hall", footprintX: 28, footprintY: 27, footprintW: 4, footprintH: 3 },
  { textureKey: "building-house", footprintX: 38, footprintY: 27, footprintW: 3, footprintH: 3 },
  { textureKey: "building-cottage", footprintX: 45, footprintY: 27, footprintW: 3, footprintH: 3 },
  // Workshop on the east end.
  { textureKey: "building-workshop", footprintX: 49, footprintY: 27, footprintW: 3, footprintH: 3 },

  // --- Southernmost row (footprints y=33..35, doors y=35, road y=36) ---
  { textureKey: "building-house", footprintX: 20, footprintY: 33, footprintW: 3, footprintH: 3 },
  // L-shaped brick house — 4x4 footprint with courtyard.
  { textureKey: "building-l-house", footprintX: 26, footprintY: 32, footprintW: 4, footprintH: 4 },
  { textureKey: "building-log-cabin", footprintX: 40, footprintY: 33, footprintW: 3, footprintH: 3 },
  { textureKey: "building-house", footprintX: 47, footprintY: 33, footprintW: 3, footprintH: 3 },

  // --- Farmer's farmhouse southwest of the south gate ---
  { textureKey: "building-farmhouse", footprintX: 22, footprintY: 43, footprintW: 5, footprintH: 3 },
];
for (const building of BUILDINGS) {
  b.rect(building.footprintX, building.footprintY, building.footprintW, building.footprintH, "B");
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
  /** Where to put the player when they exit the interior. Defaults to (x, y+1) — one south of the door. */
  exitX?: number;
  exitY?: number;
}

// Every entry now sits on its building's south-face door tile, and every
// door tile is adjacent to a real road — the northern shops open onto the
// y=20 branch street, and the middle-band shops open onto the E-W spine at
// y=24. No more "walk into the back wall" moments.
export const ENTRY_POINTS: EntryPoint[] = [
  { x: 26, y: 19, interiorId: "melee_shop" }, // Borin's forge
  { x: 43, y: 19, interiorId: "ranged_shop" }, // Fenn's fletchery
  { x: 26, y: 23, interiorId: "magic_shop" }, // Wren's apothecary
  { x: 43, y: 23, interiorId: "elder_house" }, // Elder Corwin's cottage
  { x: 34, y: 23, interiorId: "temple_main" }, // church arched doors
  { x: 15, y: 23, interiorId: "bank" }, // bank
  { x: 52, y: 23, interiorId: "depot" }, // depot
];
// Punch each door tile out of the wall paint above, so the player can
// actually step onto it. The building sprite still draws over the tile —
// the player briefly disappears behind the roofline before the interior
// scene takes over, which reads as walking in through the door.
for (const entry of ENTRY_POINTS) {
  b.set(entry.x, entry.y, "D");
}

// ---------------------------------------------------------------------------
// Farm areas — southwest of the south gate
// ---------------------------------------------------------------------------

// Road from the south gate heads south, then a dirt path forks west to the farm.
b.rect(34, TOWN.y + TOWN.h, 2, 6, "R");
b.rect(22, 45, 14, 1, "D");
b.rect(22, 46, 1, 3, "D");

// The farm compound sits in the expanded southern grassland.
const PEN = { x: 20, y: 46, w: 7, h: 5 };
const YARD = { x: 29, y: 47, w: 5, h: 4 };

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

b.scatter(2, 32, MAP_WIDTH - 4, 24, "t", ["."], 0.05, 740);
b.scatter(2, 32, MAP_WIDTH - 4, 24, "b", ["."], 0.02, 741);
b.scatter(2, 32, MAP_WIDTH - 4, 24, "f", ["."], 0.04, 742);

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
  penFences.push({ textureKey: "fence-v", x: PEN.x, y: yy, blocks: true });
  penFences.push({ textureKey: "fence-v", x: PEN.x + PEN.w - 1, y: yy, blocks: true });
}
penFences.push({ textureKey: "fence-gate", x: PEN_GATE_X + 1, y: PEN.y });

const yardFences: PropPlacement[] = [];
const YARD_GATE_X = YARD.x + 2;
for (let xx = YARD.x; xx < YARD.x + YARD.w; xx++) {
  yardFences.push({ textureKey: "fence", x: xx, y: YARD.y, blocks: true });
  if (xx !== YARD_GATE_X) yardFences.push({ textureKey: "fence", x: xx, y: YARD.y + YARD.h - 1, blocks: true });
}
for (let yy = YARD.y + 1; yy < YARD.y + YARD.h - 1; yy++) {
  yardFences.push({ textureKey: "fence-v", x: YARD.x, y: yy, blocks: true });
  yardFences.push({ textureKey: "fence-v", x: YARD.x + YARD.w - 1, y: yy, blocks: true });
}

export const PROPS: PropPlacement[] = [
  ...penFences,
  ...yardFences,

  // Farm animals — sheep in the pen, chickens in the yard.
  { textureKey: "sheep", x: 22, y: 47 },
  { textureKey: "sheep", x: 24, y: 48 },
  { textureKey: "sheep", x: 21, y: 49 },
  { textureKey: "sheep", x: 25, y: 47 },
  { textureKey: "chicken", x: 30, y: 48 },
  { textureKey: "chicken", x: 32, y: 49 },
  { textureKey: "chicken", x: 31, y: 48 },
  { textureKey: "chicken", x: 30, y: 49 },

  // Town cats.
  { textureKey: "cat", x: 22, y: 20 },
  { textureKey: "cat", x: 47, y: 20 },
  { textureKey: "cat", x: 38, y: 30 },
  { textureKey: "cat", x: 30, y: 26 },

  // --- Icon shop-signs sit on the corner tile immediately adjacent to each
  // --- shop's door — same row as the door on the road side, one tile east
  // --- of the door itself. On the corner, over the roof-line edge, so the
  // --- sign hangs "on the shop" visually rather than floating on the road.
  { textureKey: "shop-sign-melee", x: 28, y: 19 }, // Borin — sword + shield
  { textureKey: "shop-sign-ranged", x: 45, y: 19 }, // Fenn — bow + arrow
  { textureKey: "shop-sign-magic", x: 28, y: 23 }, // Wren — potion + wand
  { textureKey: "shop-sign-bank", x: 17, y: 23 }, // Bank — coin with green $
  { textureKey: "shop-sign-depot", x: 54, y: 23 }, // Depot — metal box

  // --- Small pieces of street furniture along the roads. Kept sparse — the
  // --- plaza is gone on purpose, so nothing here should read as one. ---
  // A well on the grass, north-west of the church.
  { textureKey: "well", x: 30, y: 22, blocks: true },
  // A planter tucked between the well and the church's north-west corner.
  { textureKey: "planter", x: 31, y: 22, blocks: true },
  // A bench on the south branch by the church, opposite the door.
  { textureKey: "bench", x: 37, y: 26, blocks: true },
  // Two torches on the grass strip immediately south of the church door,
  // one either side of the doorway. They light the safe zone at night
  // without blocking the E-W spine.
  { textureKey: "torch", x: 33, y: 26, blocks: true },
  { textureKey: "torch", x: 36, y: 26, blocks: true },

  // --- Backyards: fenced patches behind selected houses with small props,
  // so each corner of town has its own character. ---

  // Tower (x:16, y:10) — side yard to the west with barrels.
  { textureKey: "fence-v", x: 14, y: 10, blocks: true },
  { textureKey: "fence-v", x: 14, y: 11, blocks: true },
  { textureKey: "fence", x: 14, y: 9, blocks: true },
  { textureKey: "fence", x: 15, y: 9, blocks: true },
  { textureKey: "fence", x: 14, y: 12, blocks: true },
  { textureKey: "fence", x: 15, y: 12, blocks: true },
  { textureKey: "barrel", x: 15, y: 10, blocks: true },
  { textureKey: "crate", x: 15, y: 11, blocks: true },

  // Log cabin (x:38, y:10) — garden to the east with planters.
  { textureKey: "fence", x: 41, y: 9, blocks: true },
  { textureKey: "fence", x: 42, y: 9, blocks: true },
  { textureKey: "fence", x: 43, y: 9, blocks: true },
  { textureKey: "fence-v", x: 43, y: 10, blocks: true },
  { textureKey: "fence-v", x: 43, y: 11, blocks: true },
  { textureKey: "fence", x: 41, y: 12, blocks: true },
  { textureKey: "fence", x: 42, y: 12, blocks: true },
  { textureKey: "fence", x: 43, y: 12, blocks: true },
  { textureKey: "planter", x: 41, y: 10, blocks: true },
  { textureKey: "planter", x: 42, y: 11, blocks: true },

  // Farmhouse (x:15, y:27) — large yard to the south matching its 5-wide footprint.
  { textureKey: "fence", x: 15, y: 31, blocks: true },
  { textureKey: "fence", x: 16, y: 31, blocks: true },
  { textureKey: "fence", x: 17, y: 31, blocks: true },
  { textureKey: "fence", x: 18, y: 31, blocks: true },
  { textureKey: "fence", x: 19, y: 31, blocks: true },
  { textureKey: "fence-v", x: 15, y: 32, blocks: true },
  { textureKey: "fence-v", x: 19, y: 32, blocks: true },
  { textureKey: "barrel", x: 16, y: 32, blocks: true },
  { textureKey: "sack", x: 17, y: 32, blocks: true },
  { textureKey: "crate", x: 18, y: 32, blocks: true },

  // Timber hall (x:28, y:27) — yard to the south with a cart.
  { textureKey: "fence", x: 28, y: 31, blocks: true },
  { textureKey: "fence", x: 29, y: 31, blocks: true },
  { textureKey: "fence", x: 30, y: 31, blocks: true },
  { textureKey: "fence", x: 31, y: 31, blocks: true },
  { textureKey: "fence-v", x: 31, y: 32, blocks: true },
  { textureKey: "fence-v", x: 28, y: 32, blocks: true },
  { textureKey: "cart", x: 29, y: 32, blocks: true },
  { textureKey: "barrel", x: 30, y: 32, blocks: true },

  // Log cabin south row (x:40, y:33) — woodsy backyard to the south.
  { textureKey: "fence", x: 40, y: 37, blocks: true },
  { textureKey: "fence", x: 41, y: 37, blocks: true },
  { textureKey: "fence", x: 42, y: 37, blocks: true },
  { textureKey: "fence", x: 43, y: 37, blocks: true },
  { textureKey: "fence-v", x: 43, y: 38, blocks: true },
  { textureKey: "fence-v", x: 40, y: 38, blocks: true },
  { textureKey: "barrel", x: 41, y: 38, blocks: true },
  { textureKey: "sack", x: 42, y: 38, blocks: true },

  // Farm yard dressing around the farmhouse (footprint 22,43 5x3).
  { textureKey: "barrel", x: 21, y: 44, blocks: true },
  { textureKey: "sack", x: 28, y: 44, blocks: true },
  { textureKey: "crate", x: 28, y: 45, blocks: true },
  { textureKey: "cart", x: 19, y: 45, blocks: true },
  { textureKey: "well", x: 30, y: 45, blocks: true },
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
  { x: 33, y: 7, text: "Oakhollow — welcome, traveller." },
  { x: 33, y: 41, text: "South: the farm and the shore." },
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
  // Every shopkeeper and the elder live inside their buildings now; the
  // outdoor NPC list is just ambient farm dressing.
  // Ambient farmers standing in the yard — no dialogue attached.
  {
    id: "farmer_gil",
    name: "Farmer",
    textureKey: "npc-farmer-01",
    role: "ambient",
    greeting: "",
    about: "",
    x: 24,
    y: 45,
  },
  {
    id: "farmer_ana",
    name: "Farmhand",
    textureKey: "npc-farmer-02",
    role: "ambient",
    greeting: "",
    about: "",
    x: 27,
    y: 47,
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
  /**
   * Old-Tibia "ground speed" divisor. Higher = slower to walk on. Reference
   * values: town cobble 100, road 130, cave floor 140, grass 150, sand 160,
   * water 250. Used with the step-duration formula in constants.ts.
   */
  groundFriction?: number;
}

/** Fallback friction for tiles that don't declare one — the value of grass. */
export const DEFAULT_FRICTION = 150;

export function frictionAt(x: number, y: number): number {
  return tileAt(x, y).groundFriction ?? DEFAULT_FRICTION;
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
  ".": { walkable: true, textureKey: "grass", variants: ["grass", "grass-2", "grass-3"], safe: false, groundFriction: 150 },
  T: { walkable: true, textureKey: "temple-floor", safe: true, groundFriction: 100 },
  D: { walkable: true, textureKey: "dirt", variants: ["dirt", "dirt-2"], safe: false, groundFriction: 130 },
  C: { walkable: true, textureKey: "cave-floor", safe: false, groundFriction: 140 },
  W: { walkable: false, textureKey: "stone-wall", safe: false },
  B: { walkable: false, textureKey: "grass", variants: ["grass", "grass-2", "grass-3"], safe: false },
  "~": { walkable: false, textureKey: "water", animated: true, safe: false, groundFriction: 250 },
  g: { walkable: true, textureKey: "rocky-ground", safe: false, groundFriction: 160 },
  M: { walkable: false, textureKey: "mountain", safe: false },
  R: { walkable: true, textureKey: "road", safe: false, groundFriction: 110 },
  F: { walkable: true, textureKey: "wood-floor", safe: true, groundFriction: 100 },

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

  f: { walkable: true, textureKey: "grass", variants: ["grass", "grass-2"], overlayKey: "flowers", safe: false, groundFriction: 150 },
  m: { walkable: true, textureKey: "grass", overlayKey: "mushrooms", safe: false, groundFriction: 150 },
  n: { walkable: true, textureKey: "grass", variants: ["grass", "grass-3"], overlayKey: "rock-small", safe: false, groundFriction: 150 },
  N: { walkable: true, textureKey: "cave-floor", overlayKey: "rock-small", safe: false, groundFriction: 140 },

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
