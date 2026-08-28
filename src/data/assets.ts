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
  /**
   * Everything else here is procedurally-drawn hard-edged pixel art, where
   * the renderer's global nearest-neighbor filtering (pixelArt: true in
   * main.ts) is exactly right. A handful of images are smooth/shaded
   * external art instead (e.g. AI-generated creature frames, the Tudor
   * house cropped from a real art sheet) — nearest-neighbor scaling those
   * turns fine detail into a muddy, jagged blob (confirmed: it looked
   * correct at desktop test zoom but wrong on an actual phone, where the
   * same texture renders at a different size). Setting this flag switches
   * just that texture to linear filtering in BootScene, leaving every real
   * pixel-art image untouched.
   */
  smooth?: boolean;
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
  // 15 more ground variants cropped from the user's GrassTiles.png (not
  // checked into the repo) — a 5x3 sheet of pre-tiled 32x32-ish swatches,
  // cropped to each cell's bounding box and resized to exactly 32x32. Real
  // pixel art at native tile resolution already, so no smooth flag needed
  // (unlike the AI-generated buildings).
  { key: "grass-plain-1", path: "terrain/grass-plain-1.png" },
  { key: "grass-plain-2", path: "terrain/grass-plain-2.png" },
  { key: "grass-clover", path: "terrain/grass-clover.png" },
  { key: "grass-autumn", path: "terrain/grass-autumn.png" },
  { key: "grass-mossy", path: "terrain/grass-mossy.png" },
  { key: "grass-sparse-1", path: "terrain/grass-sparse-1.png" },
  { key: "grass-sparse-2", path: "terrain/grass-sparse-2.png" },
  { key: "grass-flowers-white", path: "terrain/grass-flowers-white.png" },
  { key: "grass-flowers-yellow", path: "terrain/grass-flowers-yellow.png" },
  { key: "grass-flowers-red", path: "terrain/grass-flowers-red.png" },
  { key: "grass-flowers-blue", path: "terrain/grass-flowers-blue.png" },
  { key: "grass-flowers-pink", path: "terrain/grass-flowers-pink.png" },
  { key: "grass-flowers-purple", path: "terrain/grass-flowers-purple.png" },
  { key: "grass-flowers-orange", path: "terrain/grass-flowers-orange.png" },
  { key: "grass-flowers-mixed", path: "terrain/grass-flowers-mixed.png" },
  { key: "dirt", path: "terrain/dirt_01.png" },
  { key: "dirt-2", path: "terrain/dirt_02.png" },
  { key: "cave-floor", path: "terrain/cave_floor_01.png" },
  { key: "sewer-floor", path: "terrain/sewer_floor_01.png" },
  { key: "wall-sewer", path: "terrain/wall_sewer_01.png" },
  { key: "temple-floor", path: "terrain/cobble_01.png" },
  { key: "stone-wall", path: "terrain/wall_stone_01.png" },
  { key: "rocky-ground", path: "terrain/ground_rocky_01.png" },
  { key: "void-wall", path: "terrain/void_01.png" },
  { key: "mountain", path: "terrain/mountain_01.png" },
  { key: "road", path: "terrain/road_01.png" },
  { key: "wood-floor", path: "terrain/wood_floor_01.png" },

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
  // 24 single-sprite trees (trunk+foliage baked into one image, unlike the
  // split trunk/canopy pairs above) cropped from the user's Trees.png (not
  // checked into the repo) — a 6x4 sheet on a solid-black background,
  // chroma-keyed to real alpha, cropped to each tree's bounding box with
  // margin, then downscaled (Lanczos) by a uniform factor so relative size
  // differences between trees survive. Real pixel art, but soft-shaded
  // (not hard-edged like the procedural sheets) — smooth-filtered for the
  // same reason the AI-generated buildings are.
  { key: "tree-oak-round-1", path: "environment/tree-oak-round-1.png", smooth: true },
  { key: "tree-oak-round-2", path: "environment/tree-oak-round-2.png", smooth: true },
  { key: "tree-oak-round-3", path: "environment/tree-oak-round-3.png", smooth: true },
  { key: "tree-oak-round-4", path: "environment/tree-oak-round-4.png", smooth: true },
  { key: "tree-oak-round-5", path: "environment/tree-oak-round-5.png", smooth: true },
  { key: "tree-oak-cluster", path: "environment/tree-oak-cluster.png", smooth: true },
  { key: "tree-spruce", path: "environment/tree-spruce.png", smooth: true },
  { key: "tree-spruce-teal", path: "environment/tree-spruce-teal.png", smooth: true },
  { key: "tree-spruce-dark", path: "environment/tree-spruce-dark.png", smooth: true },
  { key: "tree-pine-small", path: "environment/tree-pine-small.png", smooth: true },
  { key: "tree-cypress", path: "environment/tree-cypress.png", smooth: true },
  { key: "tree-cypress-slim", path: "environment/tree-cypress-slim.png", smooth: true },
  { key: "tree-willow", path: "environment/tree-willow.png", smooth: true },
  { key: "tree-cherry-white", path: "environment/tree-cherry-white.png", smooth: true },
  { key: "tree-cherry-pink", path: "environment/tree-cherry-pink.png", smooth: true },
  { key: "tree-maple-red", path: "environment/tree-maple-red.png", smooth: true },
  { key: "tree-maple-orange", path: "environment/tree-maple-orange.png", smooth: true },
  { key: "tree-maple-yellow", path: "environment/tree-maple-yellow.png", smooth: true },
  { key: "tree-birch", path: "environment/tree-birch.png", smooth: true },
  { key: "tree-dead-bare", path: "environment/tree-dead-bare.png", smooth: true },
  { key: "tree-apple", path: "environment/tree-apple.png", smooth: true },
  { key: "tree-orange-fruit", path: "environment/tree-orange-fruit.png", smooth: true },
  { key: "tree-bush-small", path: "environment/tree-bush-small.png", smooth: true },
  { key: "tree-palm", path: "environment/tree-palm.png", smooth: true },

  // --- props ---
  { key: "barrel", path: "props/barrel_01.png" },
  { key: "crate", path: "props/crate_01.png" },
  { key: "well", path: "props/well_01.png" },
  { key: "signpost", path: "props/sign_01.png" },
  { key: "fence", path: "props/fence_01.png" },
  { key: "fence-v", path: "props/fence_v_01.png" },
  { key: "bench", path: "props/bench_01.png" },
  { key: "cart", path: "props/cart_01.png" },
  { key: "campfire", path: "props/campfire_01.png" },
  { key: "torch", path: "props/torch_01.png" },
  { key: "gravestone", path: "props/gravestone_01.png" },
  // Real art cropped from the user's transparent props sheet (not procedural
  // like the rest of this list) — a testing placement, see tilemap.ts PROPS.
  { key: "chimney-brick", path: "props/chimney_brick.png" },
  { key: "chest", path: "props/chest_01.png" },
  { key: "ladder-up", path: "props/ladder_up_01.png" },
  { key: "sewer-entrance", path: "props/sewer_entrance_01.png" },
  { key: "sack", path: "props/sack_01.png" },
  { key: "weapon-rack", path: "props/weapon_rack_01.png" },
  { key: "fence-gate", path: "props/fence_gate_01.png" },
  { key: "counter", path: "props/counter_01.png" },
  { key: "statue", path: "props/statue_01.png" },
  { key: "planter", path: "props/planter_01.png" },
  { key: "altar", path: "props/altar_01.png" },
  { key: "stairs-up", path: "props/stairs_up_01.png" },
  { key: "stairs-down", path: "props/stairs_down_01.png" },
  { key: "shop-sign-melee", path: "props/shop_sign_melee_01.png" },
  { key: "shop-sign-ranged", path: "props/shop_sign_ranged_01.png" },
  { key: "shop-sign-magic", path: "props/shop_sign_magic_01.png" },
  { key: "shop-sign-bank", path: "props/shop_sign_bank_01.png" },
  { key: "shop-sign-depot", path: "props/shop_sign_depot_01.png" },
  // Farm-animal props — static one-tile sprites used as background dressing,
  // not creatures (they don't fight, patrol or drop loot).
  { key: "chicken", path: "props/animal_chicken_01.png" },
  { key: "sheep", path: "props/animal_sheep_01.png" },
  { key: "cat", path: "props/animal_cat_01.png" },

  // --- buildings ---
  { key: "building-forge", path: "buildings/forge_01.png" },
  { key: "building-cottage", path: "buildings/cottage_01.png" },
  { key: "building-house", path: "buildings/house_01.png" },
  { key: "building-guardpost", path: "buildings/guardpost_01.png" },
  { key: "building-church", path: "buildings/church_01.png" },
  { key: "building-timber-hall", path: "buildings/timber_hall_01.png" },
  { key: "building-tower", path: "buildings/tower_01.png" },
  { key: "building-log-cabin", path: "buildings/log_cabin_01.png" },
  { key: "building-workshop", path: "buildings/workshop_01.png" },
  { key: "building-farmhouse", path: "buildings/farmhouse_01.png" },
  { key: "building-l-house", path: "buildings/l_house_01.png" },
  // A single AI-generated house icon the user supplied (House1.png, not
  // checked into the repo) — a complete building already: shingled roof,
  // stone chimney, timber porch, door, two windows and a stone path.
  // Its background was a two-tone checkerboard baked into the RGB pixels
  // (no real alpha) rather than true transparency, so it was rebuilt into
  // one via a near-neutral/near-white color match, then cropped to the
  // house's bounding box and downscaled (Lanczos) from ~930x1026 to
  // 128x141. Smooth/shaded art like the goblin, bear and cave-rat
  // sheets — linear-filtered in BootScene rather than left on the
  // renderer's default nearest-neighbor pixel-art filtering.
  { key: "building-tudor-house", path: "buildings/tudor_house_01.png", smooth: true },
  // Six more AI-generated house icons the user supplied (House2-7.png, not
  // checked into the repo), processed the same way as building-tudor-house:
  // checkerboard/near-white background matched to real alpha, cropped to
  // each house's bounding box, downscaled (Lanczos) to a clean multiple of
  // TILE_SIZE. Also linear-filtered — same reasoning as building-tudor-house.
  { key: "building-house2", path: "buildings/house2_01.png", smooth: true },
  { key: "building-house3", path: "buildings/house3_01.png", smooth: true },
  { key: "building-house4", path: "buildings/house4_01.png", smooth: true },
  { key: "building-house5", path: "buildings/house5_01.png", smooth: true },
  { key: "building-house6", path: "buildings/house6_01.png", smooth: true },
  { key: "building-house7", path: "buildings/house7_01.png", smooth: true },
  // The five named service buildings the user supplied (bankhouse/temple/
  // distanceshop/meleeshop/potionmagicshop, not checked into the repo) —
  // four already had real alpha; only temple.png needed the checkerboard
  // conversion the houses above use. Same crop-to-bbox + Lanczos downscale
  // treatment, sized a notch larger (6 tiles wide) than the plain houses
  // since these read as grander storefronts with their own signage baked
  // in. Replaces the old procedural building-church for temple_main.
  { key: "building-bank", path: "buildings/bank_01.png", smooth: true },
  { key: "building-melee-shop", path: "buildings/melee_shop_01.png", smooth: true },
  { key: "building-ranged-shop", path: "buildings/ranged_shop_01.png", smooth: true },
  { key: "building-magic-shop", path: "buildings/magic_shop_01.png", smooth: true },
  { key: "building-temple", path: "buildings/temple_01.png", smooth: true },

  // --- npcs ---
  { key: "npc-borin", path: "characters/npc_borin.png" },
  { key: "npc-wren", path: "characters/npc_wren.png" },
  { key: "npc-elder-corwin", path: "characters/npc_corwin.png" },
  { key: "npc-fenn", path: "characters/npc_fenn.png" },
  { key: "npc-farmer-01", path: "characters/npc_farmer_01.png" },
  { key: "npc-farmer-02", path: "characters/npc_farmer_02.png" },
  { key: "npc-priest", path: "characters/npc_priest.png" },
  { key: "npc-banker", path: "characters/npc_banker.png" },

  // --- effects ---
  { key: "fx-hit", path: "effects/hit_spark_01.png" },
  { key: "fx-blood", path: "effects/blood_01.png" },
  { key: "fx-dust", path: "effects/dust_01.png" },
  { key: "fx-sparkle", path: "effects/sparkle_01.png" },
  { key: "fx-smoke", path: "effects/smoke_puff.png" },

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
  { key: "cheese", path: "items/food_cheese.png" },
  { key: "meat", path: "items/food_meat.png" },
  { key: "ham", path: "items/food_ham.png" },
  { key: "bear-paw", path: "items/trophy_bear_paw.png" },
  { key: "honeycomb", path: "items/food_honeycomb.png" },
  { key: "spell-heal", path: "items/spell_heal.png" },
  { key: "spell-flame", path: "items/spell_flame.png" },
];

// Frame sizes must match the meta printed by `npm run gen:assets`.
export const SHEET_ASSETS: SheetAsset[] = [
  { key: "water", path: "terrain/water_sheet.png", ...TILE_FRAME },

  // Equipment doesn't render on the character any more (see items.ts) — the
  // player is just this one body sheet now, no paper-doll layers stacked on
  // top of it.
  { key: "player", path: "characters/player_base_sheet.png", ...TILE_FRAME },
  { key: "rat", path: "creatures/rat_sheet.png", ...TILE_FRAME },
  { key: "cave-rat", path: "creatures/cave_rat_sheet.png", frameWidth: 40, frameHeight: 40, smooth: true },
  { key: "slime", path: "creatures/slime_sheet.png", ...TILE_FRAME },
  { key: "troll", path: "creatures/troll_sheet.png", frameWidth: 40, frameHeight: 52 },
  { key: "goblin", path: "creatures/goblin_sheet.png", ...TILE_FRAME, smooth: true },
  { key: "bear", path: "creatures/bear_sheet.png", ...TILE_FRAME, smooth: true },
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

