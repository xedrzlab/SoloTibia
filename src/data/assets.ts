// The single registry of every art file the game loads.
//
// Texture keys (what the code asks for) and file paths (how the art is
// organised on disk) are deliberately separate: the folder layout can be
// reorganised without touching a line of game logic, and a missing file shows
// up here rather than as a silent blank sprite somewhere in a scene.
//
// Paths are relative to public/assets/ and are written by
// scripts/generate-assets.mjs.

export interface ImageAsset {
  key: string;
  path: string;
}

export interface SheetAsset extends ImageAsset {
  frameWidth: number;
  frameHeight: number;
}

/** Frame size shared by everything drawn on the standard one-tile canvas. */
const TILE_FRAME = { frameWidth: 32, frameHeight: 32 };

export const IMAGE_ASSETS: ImageAsset[] = [
  // --- terrain ---
  { key: "grass", path: "terrain/grass_01.png" },
  { key: "grass-2", path: "terrain/grass_02.png" },
  { key: "grass-3", path: "terrain/grass_03.png" },
  { key: "dirt", path: "terrain/dirt_01.png" },
  { key: "dirt-2", path: "terrain/dirt_02.png" },
  { key: "cave-floor", path: "terrain/cave_floor_01.png" },
  { key: "temple-floor", path: "terrain/cobble_01.png" },
  { key: "stone-wall", path: "terrain/wall_stone_01.png" },
  { key: "rocky-ground", path: "terrain/ground_rocky_01.png" },
  { key: "void-wall", path: "terrain/void_01.png" },
  { key: "mountain", path: "terrain/mountain_01.png" },
  { key: "road", path: "terrain/road_01.png" },

  // --- environment ---
  // Trees are layered: trunk, canopy and optional detail are separate sprites
  // so the canopy can sort above a player walking behind the trunk.
  { key: "tree-oak-trunk", path: "environment/tree_oak_trunk_01.png" },
  { key: "tree-oak-canopy", path: "environment/tree_oak_canopy_01.png" },
  { key: "tree-oak-canopy-2", path: "environment/tree_oak_canopy_02.png" },
  { key: "tree-pine-trunk", path: "environment/tree_pine_trunk_01.png" },
  { key: "tree-pine-canopy", path: "environment/tree_pine_canopy_01.png" },
  { key: "tree-dead-trunk", path: "environment/tree_dead_trunk_01.png" },
  { key: "tree-detail-fruit", path: "environment/tree_detail_fruit_01.png" },
  { key: "tree-detail-vine", path: "environment/tree_detail_vine_01.png" },
  { key: "tree-detail-moss", path: "environment/tree_detail_moss_01.png" },
  { key: "bush", path: "environment/bush_01.png" },
  { key: "rock-small", path: "environment/rock_small_01.png" },
  { key: "rock-medium", path: "environment/rock_medium_01.png" },
  { key: "boulder", path: "environment/rock_large_01.png" },
  { key: "rock-mossy", path: "environment/rock_mossy_01.png" },
  { key: "stump", path: "environment/stump_01.png" },
  { key: "mushrooms", path: "environment/mushrooms_01.png" },
  { key: "flowers", path: "environment/flowers_01.png" },

  // --- props ---
  { key: "barrel", path: "props/barrel_01.png" },
  { key: "crate", path: "props/crate_01.png" },
  { key: "well", path: "props/well_01.png" },
  { key: "signpost", path: "props/sign_01.png" },
  { key: "fence", path: "props/fence_01.png" },
  { key: "bench", path: "props/bench_01.png" },
  { key: "cart", path: "props/cart_01.png" },
  { key: "campfire", path: "props/campfire_01.png" },
  { key: "torch", path: "props/torch_01.png" },
  { key: "gravestone", path: "props/gravestone_01.png" },
  { key: "chest", path: "props/chest_01.png" },
  { key: "sack", path: "props/sack_01.png" },
  { key: "weapon-rack", path: "props/weapon_rack_01.png" },

  // --- buildings ---
  { key: "building-forge", path: "buildings/forge_01.png" },
  { key: "building-cottage", path: "buildings/cottage_01.png" },
  { key: "building-house", path: "buildings/house_01.png" },
  { key: "building-guardpost", path: "buildings/guardpost_01.png" },

  // --- npcs ---
  { key: "npc-borin", path: "characters/npc_borin.png" },
  { key: "npc-wren", path: "characters/npc_wren.png" },
  { key: "npc-elder-corwin", path: "characters/npc_corwin.png" },

  // --- effects ---
  { key: "fx-hit", path: "effects/hit_spark_01.png" },
  { key: "fx-blood", path: "effects/blood_01.png" },
  { key: "fx-dust", path: "effects/dust_01.png" },
  { key: "fx-sparkle", path: "effects/sparkle_01.png" },

  // --- item icons; keys match ItemDef.textureKey in src/data/items.ts ---
  { key: "sword", path: "items/weapon_sword.png" },
  { key: "axe", path: "items/weapon_axe.png" },
  { key: "bow", path: "items/weapon_bow.png" },
  { key: "wand", path: "items/weapon_wand.png" },
  { key: "arrow", path: "items/ammo_arrow.png" },
  { key: "wooden-shield", path: "items/shield_wooden.png" },
  { key: "steel-shield", path: "items/shield_steel.png" },
  { key: "leather-helmet", path: "items/armor_helmet_leather.png" },
  { key: "steel-helmet", path: "items/armor_helmet_steel.png" },
  { key: "leather-armor", path: "items/armor_body_leather.png" },
  { key: "plate-armor", path: "items/armor_body_plate.png" },
  { key: "leather-legs", path: "items/armor_legs_leather.png" },
  { key: "plate-legs", path: "items/armor_legs_plate.png" },
  { key: "leather-boots", path: "items/armor_boots_leather.png" },
  { key: "amulet", path: "items/jewel_amulet.png" },
  { key: "ring", path: "items/jewel_ring.png" },
  { key: "backpack", path: "items/container_backpack.png" },
  { key: "bag", path: "items/container_bag.png" },
  { key: "health-potion", path: "items/potion_health.png" },
  { key: "mana-potion", path: "items/potion_mana.png" },
  { key: "gold-coin", path: "items/coin_gold.png" },
  { key: "spell-heal", path: "items/spell_heal.png" },
  { key: "spell-flame", path: "items/spell_flame.png" },
];

// Frame sizes must match the meta printed by `npm run gen:assets`.
export const SHEET_ASSETS: SheetAsset[] = [
  { key: "water", path: "terrain/water_sheet.png", ...TILE_FRAME },
  { key: "player", path: "characters/player_sheet.png", ...TILE_FRAME },
  { key: "rat", path: "creatures/rat_sheet.png", ...TILE_FRAME },
  { key: "cave-rat", path: "creatures/cave_rat_sheet.png", ...TILE_FRAME },
  { key: "slime", path: "creatures/slime_sheet.png", ...TILE_FRAME },
  { key: "troll", path: "creatures/troll_sheet.png", frameWidth: 40, frameHeight: 52 },
];

/** How many frames the water cycle has, and how long each is held. */
export const WATER_FRAME_COUNT = 4;
export const WATER_FRAME_MS = 420;

export type TreeSpecies = "oak" | "pine" | "dead";

export interface TreeLayers {
  trunk: string;
  /** Canopy variants; empty for species whose branches live on the trunk. */
  canopies: string[];
}

export const TREE_LAYERS: Record<TreeSpecies, TreeLayers> = {
  oak: { trunk: "tree-oak-trunk", canopies: ["tree-oak-canopy", "tree-oak-canopy-2"] },
  pine: { trunk: "tree-pine-trunk", canopies: ["tree-pine-canopy"] },
  dead: { trunk: "tree-dead-trunk", canopies: [] },
};

/** Accents layered over a canopy on some trees, chosen per position. */
export const TREE_DETAILS = ["tree-detail-fruit", "tree-detail-vine", "tree-detail-moss"];

