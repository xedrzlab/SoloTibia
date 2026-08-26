// Interior rooms — one per shop the player can zone into. Each room has its
// own tiny tilemap laid out as an ASCII grid, plus a shopkeeper NPC, a set of
// decorations, and the tile the player lands on when they enter.
//
// Legend (kept small on purpose — a shop interior isn't a biome):
//   W  stone wall (blocking)
//   .  wooden plank floor
//   C  wooden counter (blocking, drawn as a prop on top of a floor tile)
//   D  doorway back out to the world (walkable floor tile; stepping on it
//      exits the interior)
//
// The letter grid describes visuals + walkability. NPC and decor placement is
// listed separately so a room can be tweaked without redrawing the grid.

export type InteriorTile = "W" | "." | "C" | "D";

export interface InteriorNpc {
  id: string;
  name: string;
  textureKey: string;
  role: "shop" | "vocation";
  greeting: string;
  about: string;
  x: number;
  y: number;
}

export interface InteriorDecor {
  textureKey: string;
  x: number;
  y: number;
  /** When true, the tile is impassable. Counters and heavy furniture only. */
  blocks?: boolean;
}

export interface InteriorRoom {
  id: string;
  title: string;
  /** Row-major grid; every row must share the same length. */
  rows: string[];
  /** Where the player appears when they zone in. */
  spawn: { x: number; y: number };
  npc: InteriorNpc;
  decor: InteriorDecor[];
}

// A common 10x8 template — big enough for a shopkeeper behind a counter with
// shelves of stock behind them, small enough that the room reads in one
// glance without panning.
//
//   W W W W W W W W W W        row 0
//   W . . . . . . . . W        row 1
//   W . . . . . . . . W        row 2 — decor along the back wall
//   W . . . N . . . . W        row 3 — NPC stands here
//   W C C C C C C C C W        row 4 — counter divides customer from keeper
//   W . . . . . . . . W        row 5 — customer floor
//   W . . . . . . . . W        row 6
//   W W W W D D W W W W        row 7 — door back to the world
//
const COMMON_ROWS = [
  "WWWWWWWWWW",
  "W........W",
  "W........W",
  "W...N....W",
  "WCCCCCCCCW",
  "W........W",
  "W........W",
  "WWWWDDWWWW",
];

/** Player spawn in the customer half, on the tile just north of the door. */
const COMMON_SPAWN = { x: 4, y: 6 };

export const INTERIORS: Record<string, InteriorRoom> = {
  melee_shop: {
    id: "melee_shop",
    title: "Borin's Forge",
    rows: COMMON_ROWS,
    spawn: COMMON_SPAWN,
    npc: {
      id: "blacksmith",
      name: "Borin",
      textureKey: "npc-borin",
      role: "shop",
      greeting: "Steel or leather, traveller?",
      about:
        "I've been the blacksmith here in Oakhollow for twenty years. Swords, axes, plate — if it's for a close fight, I forge it.",
      x: 4,
      y: 3,
    },
    decor: [
      // Behind the keeper: weapon rack, sacks, a small work anvil (crate).
      { textureKey: "weapon-rack", x: 1, y: 2, blocks: true },
      { textureKey: "sack", x: 3, y: 2, blocks: true },
      { textureKey: "sack", x: 7, y: 2, blocks: true },
      { textureKey: "crate", x: 8, y: 2, blocks: true },
      // Customer side: a barrel and a chest for atmosphere.
      { textureKey: "barrel", x: 1, y: 6, blocks: true },
      { textureKey: "chest", x: 8, y: 6, blocks: true },
    ],
  },

  ranged_shop: {
    id: "ranged_shop",
    title: "Fenn's Fletchery",
    rows: COMMON_ROWS,
    spawn: COMMON_SPAWN,
    npc: {
      id: "fletcher",
      name: "Fenn",
      textureKey: "npc-fenn",
      role: "shop",
      greeting: "Bows, arrows, quivers — take your pick.",
      about:
        "I fletch arrows and string bows. If you'd sooner keep the fight at a distance, this is the shop.",
      x: 4,
      y: 3,
    },
    decor: [
      { textureKey: "weapon-rack", x: 2, y: 2, blocks: true },
      { textureKey: "weapon-rack", x: 7, y: 2, blocks: true },
      { textureKey: "barrel", x: 1, y: 2, blocks: true },
      { textureKey: "crate", x: 8, y: 2, blocks: true },
      { textureKey: "sack", x: 1, y: 6, blocks: true },
      { textureKey: "sack", x: 8, y: 6, blocks: true },
    ],
  },

  magic_shop: {
    id: "magic_shop",
    title: "Wren's Apothecary",
    rows: COMMON_ROWS,
    spawn: COMMON_SPAWN,
    npc: {
      id: "apothecary",
      name: "Wren",
      textureKey: "npc-wren",
      role: "shop",
      greeting: "Wands, potions, a charm or two — I have them all.",
      about:
        "The apothecary handles anything with mana in it: wands for the caster, potions for the tired, and a jewel to keep death at arm's length.",
      x: 4,
      y: 3,
    },
    decor: [
      { textureKey: "chest", x: 1, y: 2, blocks: true },
      { textureKey: "barrel", x: 2, y: 2, blocks: true },
      { textureKey: "barrel", x: 7, y: 2, blocks: true },
      { textureKey: "crate", x: 8, y: 2, blocks: true },
      { textureKey: "bench", x: 1, y: 6, blocks: true },
      { textureKey: "chest", x: 8, y: 6, blocks: true },
    ],
  },

  elder_house: {
    id: "elder_house",
    title: "Elder Corwin's Study",
    rows: COMMON_ROWS,
    spawn: COMMON_SPAWN,
    npc: {
      id: "elder",
      name: "Elder Corwin",
      textureKey: "npc-elder-corwin",
      role: "vocation",
      greeting: "Welcome, young one.",
      about:
        "I have watched many adventurers pass through Oakhollow and find their calling. When you are ready, come find me and we'll speak of yours.",
      x: 4,
      y: 3,
    },
    decor: [
      { textureKey: "bench", x: 2, y: 2, blocks: true },
      { textureKey: "chest", x: 6, y: 2, blocks: true },
      { textureKey: "barrel", x: 1, y: 6, blocks: true },
      { textureKey: "chest", x: 8, y: 6, blocks: true },
    ],
  },
};

/** True if a room tile is walkable — .  or D  are floor; W/C block. */
export function isFloorTile(ch: string): boolean {
  return ch === "." || ch === "D";
}
