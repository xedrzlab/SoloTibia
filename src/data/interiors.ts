// Interior rooms — one per building the player can zone into. Each room has
// its own tilemap laid out as an ASCII grid, plus an NPC, a set of
// decorations, and the tile the player lands on when they enter.
//
// Legend:
//   W  stone wall (blocking)
//   .  wooden plank floor
//   S  stone floor (grey flagstones — used in the church/temple)
//   C  wooden counter (blocking, drawn as a prop on top of a floor tile)
//   D  doorway back out to the world (walkable floor tile; stepping on it
//      exits the interior — see `exit` on the room)
//   U  stairs going up (walkable; steps onto it transition per `stairsUp`)
//   d  stairs going down (walkable; per `stairsDown`)
//   X  depot access — walkable, but stepping on it opens the player's
//      depot container in the sidebar (Tibia-style, one tile in front of
//      the depot chests).
//
// The letter grid describes visuals + walkability. NPC and decor placement is
// listed separately so a room can be tweaked without redrawing the grid.

export type InteriorTile = "W" | "." | "S" | "C" | "D" | "U" | "d" | "X";

export interface InteriorNpc {
  id: string;
  name: string;
  textureKey: string;
  role: "shop" | "vocation" | "bank";
  greeting: string;
  about: string;
  x: number;
  y: number;
  /**
   * If set, this NPC uses a directional 4×N spritesheet (see
   * directionalSprite.ts DIRECTION_ORDER) rather than a static single image,
   * and can idle-wander around its spawn tile. Facing state and the number
   * of frames per direction come from here. Undefined = static image, no
   * wander, no facing (the legacy behaviour every other NPC uses).
   */
  directional?: {
    framesPerDirection: number;
    /** Which way the NPC is facing when the room loads. Defaults to "down". */
    initialFacing?: "down" | "left" | "right" | "up";
    /**
     * If true, the NPC takes 1-tile idle steps around its spawn tile between
     * long pauses — "pace one left, idle, one right, idle" and so on. The
     * wander pauses (and the NPC faces the player) whenever the player is
     * within talking range so the shopkeeper actually looks at their
     * customer rather than shuffling around during a chat.
     */
    wanders?: boolean;
    /**
     * On-screen scale for the sprite. Defaults to 1. The player is 32×32
     * art rendered at 1.5× (48 tall on screen); a 32×32 NPC uses the same
     * 1.5 to match player size, while a 48×48-authored NPC leaves this at
     * 1 since 48 art × 1 = 48 on screen, already matching.
     */
    scale?: number;
  };
}

export interface InteriorDecor {
  textureKey: string;
  x: number;
  y: number;
  /** When true, the tile is impassable. Counters and heavy furniture only. */
  blocks?: boolean;
}

/** Where an in-room transition tile leads. */
export interface RoomTransition {
  toRoomId: string;
  /** Where the player lands in the target room. */
  spawn: { x: number; y: number };
}

export interface InteriorRoom {
  id: string;
  title: string;
  /** Row-major grid; every row must share the same length. */
  rows: string[];
  /** Where the player appears when they zone in from outside. */
  spawn: { x: number; y: number };
  /** Optional NPC standing inside. Rooms without a keeper (like the basement) omit this. */
  npc?: InteriorNpc;
  decor: InteriorDecor[];
  /** Step onto a U tile → this transition. */
  stairsUp?: RoomTransition;
  /** Step onto a d tile → this transition. */
  stairsDown?: RoomTransition;
}

const SHOP_ROWS = [
  "WWWWWWWWWW",
  "W........W",
  "W........W",
  "W...N....W",
  "WCCCCCCCCW",
  "W........W",
  "W........W",
  "WWWWDDWWWW",
];

const SHOP_SPAWN = { x: 4, y: 6 };

export const INTERIORS: Record<string, InteriorRoom> = {
  // ---------------------------------------------------------------------
  // Temple basement — where a new character wakes on the starter island.
  // ---------------------------------------------------------------------
  temple_basement: {
    id: "temple_basement",
    title: "Temple Basement",
    // A small stone chamber with an altar in the middle and a staircase at
    // the top wall leading up to the main church floor. No exit door here —
    // the only way out is the stairs.
    //
    //   W W W W W W W W        row 0
    //   W W W W U W W W        row 1 — U = stairs up to the main floor
    //   W S S S S S S W        row 2
    //   W S S S S S S W        row 3
    //   W S S S S S S W        row 4 — player spawns here
    //   W S S S S S S W        row 5
    //   W W W W W W W W        row 6
    rows: [
      "WWWWWWWW",
      "WWWWUWWW",
      "WSSSSSSW",
      "WSSSSSSW",
      "WSSSSSSW",
      "WSSSSSSW",
      "WWWWWWWW",
    ],
    spawn: { x: 3, y: 4 },
    decor: [
      // Central altar as the focal point.
      { textureKey: "altar", x: 3, y: 3, blocks: true },
      // Candles / torches on the walls.
      { textureKey: "torch", x: 1, y: 2, blocks: true },
      { textureKey: "torch", x: 6, y: 2, blocks: true },
      { textureKey: "torch", x: 1, y: 5, blocks: true },
      { textureKey: "torch", x: 6, y: 5, blocks: true },
      // The stairs prop draws on top of the U tile so the eye finds the exit.
      { textureKey: "stairs-up", x: 4, y: 1 },
    ],
    stairsUp: {
      toRoomId: "temple_main",
      // Player arrives one tile west of the temple's stairs-down prop, in
      // the middle of the nave — never on the door tile.
      spawn: { x: 7, y: 7 },
    },
  },

  // ---------------------------------------------------------------------
  // Temple main floor — the church proper, with pews, altar, priest.
  // ---------------------------------------------------------------------
  temple_main: {
    id: "temple_main",
    title: "Oakhollow Church",
    // Long central hall with the altar at the far end and pews down each
    // side. Stairs down at the front-right of the nave; a big double door at
    // the south wall leads out to the town.
    //
    //   W W W W W W W W W W W        row 0
    //   W S S S A A S S S S W        row 1 — A = altar (decor)
    //   W S S S S S S S S S W        row 2
    //   W S P S S S S S P S W        row 3 — pews (bench decor)
    //   W S P S S N S S P S W        row 4 — priest NPC
    //   W S P S S S S S P S W        row 5
    //   W S P S S S S S P S W        row 6
    //   W S S S S S S S S S W        row 7 — front of nave, stairs+spawn
    //   W W W W D D W W W W W        row 8 — D = door out to town
    rows: [
      "WWWWWWWWWWW",
      "WSSSSSSSSSW",
      "WSSSSSSSSSW",
      "WSSSSSSSSSW",
      "WSSSSSSSSSW",
      "WSSSSSSSSSW",
      "WSSSSSSSSSW",
      "WSSSSSSSSSW",
      "WWWWDDWWWWW",
    ],
    spawn: { x: 5, y: 7 },
    npc: {
      id: "priest",
      name: "Father Aldwin",
      textureKey: "npc-priest",
      role: "vocation",
      greeting: "Welcome to Oakhollow, child. Rest a moment before the road.",
      about:
        "I keep the temple, and I keep the names of those who wake beneath it. Stay a while — the world outside these doors is waiting.",
      x: 5,
      y: 3,
    },
    decor: [
      // Altar with candles at the north end.
      { textureKey: "altar", x: 5, y: 1, blocks: true },
      { textureKey: "torch", x: 3, y: 1, blocks: true },
      { textureKey: "torch", x: 7, y: 1, blocks: true },
      // Pews down the left and right of the nave (benches stand in as pews).
      { textureKey: "bench", x: 2, y: 3, blocks: true },
      { textureKey: "bench", x: 2, y: 5, blocks: true },
      { textureKey: "bench", x: 2, y: 6, blocks: true },
      { textureKey: "bench", x: 8, y: 3, blocks: true },
      { textureKey: "bench", x: 8, y: 5, blocks: true },
      { textureKey: "bench", x: 8, y: 6, blocks: true },
      // Torches midway up the walls to keep the interior warm-lit.
      { textureKey: "torch", x: 1, y: 4, blocks: true },
      { textureKey: "torch", x: 9, y: 4, blocks: true },
      // Stairs down to the basement, near the front-right of the nave.
      { textureKey: "stairs-down", x: 8, y: 7 },
    ],
    stairsDown: {
      toRoomId: "temple_basement",
      // Arrive one tile south of the basement's stairs-up prop.
      spawn: { x: 4, y: 2 },
    },
  },

  // ---------------------------------------------------------------------
  // Shops — one common template.
  // ---------------------------------------------------------------------
  melee_shop: {
    id: "melee_shop",
    title: "Borin's Forge",
    rows: SHOP_ROWS,
    spawn: SHOP_SPAWN,
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
      directional: { framesPerDirection: 3, initialFacing: "down", wanders: true, scale: 1.5 },
    },
    decor: [],
  },

  ranged_shop: {
    id: "ranged_shop",
    title: "Fenn's Fletchery",
    rows: SHOP_ROWS,
    spawn: SHOP_SPAWN,
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
      directional: { framesPerDirection: 3, initialFacing: "down", wanders: true },
    },
    decor: [],
  },

  general_store: {
    id: "general_store",
    title: "Oakhollow General Store",
    rows: SHOP_ROWS,
    spawn: SHOP_SPAWN,
    npc: {
      id: "grocer",
      name: "Della",
      textureKey: "npc-grocer",
      role: "shop",
      greeting: "Cheese, ham, a spare pack — what'll it be?",
      about:
        "I keep the shelves stocked with whatever a traveller might've forgotten to pack — food for the road, and a backpack for everything else.",
      x: 4,
      y: 3,
    },
    decor: [],
  },

  // ---------------------------------------------------------------------
  // Bank — deposit and withdraw gold. Same shop template, different keeper.
  // ---------------------------------------------------------------------
  bank: {
    id: "bank",
    title: "Oakhollow Bank",
    rows: SHOP_ROWS,
    spawn: SHOP_SPAWN,
    npc: {
      id: "banker",
      name: "Mira",
      textureKey: "npc-banker",
      role: "bank",
      greeting: "The bank is open. Depositing or withdrawing today?",
      about:
        "I keep your gold safe. Deposit it here and it stays with you between deaths and journeys — no one can loot what's in the vault.",
      x: 4,
      y: 3,
    },
    decor: [],
  },

  // ---------------------------------------------------------------------
  // Depot — a rack of locked chests. No NPC; tap a chest to open a shared
  // container. The container lives in WorldScene as the player's global
  // stash.
  // ---------------------------------------------------------------------
  depot: {
    id: "depot",
    title: "Oakhollow Depot",
    // Row 2 holds four chests along the back wall; row 3 (the X tiles) is
    // where the player stands to open the depot — stepping onto any of
    // them opens the character's personal depot container in the sidebar.
    rows: [
      "WWWWWWWWWW",
      "W........W",
      "W........W", // chests are drawn as decor
      "W..XXXX..W", // depot-access strip in front of the chests
      "W........W",
      "W........W",
      "W........W",
      "WWWWDDWWWW",
    ],
    spawn: SHOP_SPAWN,
    // No NPC — the depot has no keeper. A "chest" prop stands in for each
    // slot in the back row.
    decor: [
      { textureKey: "chest", x: 3, y: 2, blocks: true },
      { textureKey: "chest", x: 4, y: 2, blocks: true },
      { textureKey: "chest", x: 5, y: 2, blocks: true },
      { textureKey: "chest", x: 6, y: 2, blocks: true },
      { textureKey: "barrel", x: 1, y: 6, blocks: true },
      { textureKey: "sack", x: 8, y: 6, blocks: true },
    ],
  },

  magic_shop: {
    id: "magic_shop",
    title: "Wren's Apothecary",
    rows: SHOP_ROWS,
    spawn: SHOP_SPAWN,
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
    decor: [],
  },
};

/** True if a room tile is walkable. Walls and counters block; everything else lets the player pass. */
export function isFloorTile(ch: string): boolean {
  return ch === "." || ch === "S" || ch === "D" || ch === "U" || ch === "d" || ch === "X";
}
