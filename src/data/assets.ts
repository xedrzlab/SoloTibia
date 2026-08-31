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
  // The original procedural grass_01/02/03 and the first real-art grass
  // batch's plain/sparse/autumn/mossy variants are gone — dropped in favor
  // of the grass-clean/short/light set below once mixing three different
  // grass "eras" into one variants pool started looking inconsistent.
  // grass-flowers-* survives because "z" (a deliberate rare meadow-patch
  // accent, not part of the base-ground mixing problem) still uses it.
  { key: "grass-flowers-white", path: "terrain/grass-flowers-white.png" },
  { key: "grass-flowers-yellow", path: "terrain/grass-flowers-yellow.png" },
  { key: "grass-flowers-red", path: "terrain/grass-flowers-red.png" },
  { key: "grass-flowers-blue", path: "terrain/grass-flowers-blue.png" },
  { key: "grass-flowers-pink", path: "terrain/grass-flowers-pink.png" },
  { key: "grass-flowers-purple", path: "terrain/grass-flowers-purple.png" },
  { key: "grass-flowers-orange", path: "terrain/grass-flowers-orange.png" },
  { key: "grass-flowers-mixed", path: "terrain/grass-flowers-mixed.png" },
  // 20 more tiles the user supplied as individual, already-32x32,
  // already-named files (grass_tiles_32x32_individual.zip, not checked
  // into the repo) — no cropping needed, just registered under the same
  // key style. Unlike the flat swatches above, these are meant to be used
  // by rarity tier, not thrown into one shared pool: grass-clean/short/light
  // join the base "." variants below (subtle, common); the rest get their
  // own low-density LEGEND tile letters (h/i/j/l) further down, each
  // scattered far more sparingly than the base tier — see the comment by
  // the "h" entry for why a flat equal-weight variants list was the
  // mistake last time.
  { key: "grass-clean", path: "terrain/grass-clean.png" },
  { key: "grass-short", path: "terrain/grass-short.png" },
  { key: "grass-light", path: "terrain/grass-light.png" },
  { key: "grass-tuft", path: "terrain/grass-tuft.png" },
  { key: "grass-two-tufts", path: "terrain/grass-two-tufts.png" },
  { key: "grass-small-weeds", path: "terrain/grass-small-weeds.png" },
  { key: "grass-mixed-weeds", path: "terrain/grass-mixed-weeds.png" },
  { key: "grass-small-rocks", path: "terrain/grass-small-rocks.png" },
  { key: "grass-pebbles", path: "terrain/grass-pebbles.png" },
  { key: "grass-twig", path: "terrain/grass-twig.png" },
  { key: "grass-leaf-clusters", path: "terrain/grass-leaf-clusters.png" },
  { key: "grass-mud-patch", path: "terrain/grass-mud-patch.png" },
  { key: "grass-dark-patch", path: "terrain/grass-dark-patch.png" },
  { key: "grass-light-patch", path: "terrain/grass-light-patch.png" },
  { key: "grass-flower-white", path: "terrain/grass-flower-white.png" },
  { key: "grass-flower-yellow", path: "terrain/grass-flower-yellow.png" },
  { key: "grass-flower-red", path: "terrain/grass-flower-red.png" },
  { key: "grass-flower-blue", path: "terrain/grass-flower-blue.png" },
  { key: "grass-flower-purple", path: "terrain/grass-flower-purple.png" },
  { key: "grass-mixed-flowers", path: "terrain/grass-mixed-flowers.png" },
  // Real art the user supplied (DirtTiles.zip, not checked into the repo),
  // replacing the old procedural dirt_01/02 the same way the cobble set
  // replaced "road" — see the "D" LEGEND entry for the base pair and
  // q/s/v for the low-density accent tiers (patches/debris/vegetation).
  { key: "dirt-clean", path: "terrain/dirt-clean.png" },
  { key: "dirt-dark", path: "terrain/dirt-dark.png" },
  { key: "dirt-dark-patches", path: "terrain/dirt-dark-patches.png" },
  { key: "dirt-pebbles", path: "terrain/dirt-pebbles.png" },
  { key: "dirt-small-rock", path: "terrain/dirt-small-rock.png" },
  { key: "dirt-twigs", path: "terrain/dirt-twigs.png" },
  { key: "dirt-weeds", path: "terrain/dirt-weeds.png" },
  { key: "dirt-mixed", path: "terrain/dirt-mixed.png" },
  // Real art (UnderGroundWalkDirtTiles.zip, not checked into the repo) for
  // the cave's walkable floor ("K"). Six of its seven tiles are pixel-
  // identical to the surface dirt set above; the one new tile is
  // "dirt_light" (renamed "dirt-underground" here) — despite the name it's
  // noticeably darker/muted than dirt-clean, which is exactly why it
  // exists: the surface dirt-clean/dirt-dark pair read as too bright and
  // sunlit once used underground.
  //
  // The debris accents (dirt-pebbles etc.) were drawn on the brighter
  // dirt-clean base, so dropping them into the K mix as-is produced the
  // same too-bright clash, just patchy instead of uniform — a handful of
  // noticeably lighter tiles scattered across the darker floor. The
  // "-underground" copies below are those same tiles color-matched to
  // dirt-underground's tone (scaled by the exact per-channel ratio between
  // dirt-underground and dirt-clean) so the debris still reads clearly
  // without breaking the floor's overall tone. See the "K" LEGEND entry.
  { key: "dirt-underground", path: "terrain/dirt-underground.png" },
  { key: "dirt-pebbles-underground", path: "terrain/dirt-pebbles-underground.png" },
  { key: "dirt-small-rock-underground", path: "terrain/dirt-small-rock-underground.png" },
  { key: "dirt-twigs-underground", path: "terrain/dirt-twigs-underground.png" },
  // Real art (cavedirttiles2.zip, not checked into the repo) — 21 subtle
  // gravelly variants keyed off a black-background sheet. Replaces the old
  // dirt-underground family as the cave floor mix (see LEGEND K): a much
  // wider variant pool per cell so the floor stops reading as a repeating
  // pattern, and matches the color/tone of the new cave wall art.
  ...Array.from({ length: 21 }, (_, i) => ({
    key: `cave-dirt-mix-${i + 1}`,
    path: `terrain/cave-dirt-mix-${i + 1}.png`,
  })),
  // Sewer wall tiles — 20 variants per side (N/S/E/W), each fills a 32×32
  // cell edge-to-edge (no transparent margin) and is composited onto a
  // floor-mix base so it tiles seamlessly against neighbor dirt cells with
  // no visible seam. See tilemap.ts caveWallOverlay for the per-cell
  // selection based on which side has walkable floor.
  ...(["N", "S", "E", "W"].flatMap((side) =>
    Array.from({ length: 20 }, (_, i) => ({
      key: `cave-wall-${side}-${i + 1}`,
      path: `terrain/cave-wall-${side}-${i + 1}.png`,
    })),
  )),
  // Real art (UndergroundWallsOutofBound.zip, not checked into the repo) —
  // the earthen out-of-bounds fill for the cave under the town, replacing
  // the old procedural wall-sewer. Same "walkable-looking but isn't" trick
  // Tibia uses: it reads as more dirt, but the "K"/"V" LEGEND split still
  // makes it solid. Eight near-identical speckle variants, picked per-cell
  // like grass/dirt — no bold accent among them, so no tiering needed.
  { key: "cave-wall-earth-1", path: "terrain/cave-wall-earth-1.png" },
  { key: "cave-wall-earth-2", path: "terrain/cave-wall-earth-2.png" },
  { key: "cave-wall-earth-3", path: "terrain/cave-wall-earth-3.png" },
  { key: "cave-wall-earth-4", path: "terrain/cave-wall-earth-4.png" },
  { key: "cave-wall-earth-5", path: "terrain/cave-wall-earth-5.png" },
  { key: "cave-wall-earth-6", path: "terrain/cave-wall-earth-6.png" },
  { key: "cave-wall-earth-7", path: "terrain/cave-wall-earth-7.png" },
  { key: "cave-wall-earth-8", path: "terrain/cave-wall-earth-8.png" },
  { key: "cave-floor", path: "terrain/cave_floor_01.png" },
  { key: "temple-floor", path: "terrain/cobble_01.png" },
  { key: "stone-wall", path: "terrain/wall_stone_01.png" },
  { key: "rocky-ground", path: "terrain/ground_rocky_01.png" },
  { key: "void-wall", path: "terrain/void_01.png" },
  { key: "mountain", path: "terrain/mountain_01.png" },
  // Real art the user supplied (cobble_road_.zip, not checked into the
  // repo), replacing the old procedural "road" (a dirt/tan travel-path
  // texture) for the town's streets — see the "R"/"P" LEGEND entries.
  { key: "cobble-clean", path: "terrain/cobble-clean.png" },
  { key: "cobble-cracked", path: "terrain/cobble-cracked.png" },
  { key: "cobble-mossy", path: "terrain/cobble-mossy.png" },
  { key: "cobble-road", path: "terrain/cobble-road.png" },
  { key: "cobble-town-street", path: "terrain/cobble-town-street.png" },
  // Still used by the depot's plain back room — everything else with a
  // wooden interior now uses the shop-* set below instead.
  { key: "wood-floor", path: "terrain/wood_floor_01.png" },

  // Real art (TempleFloorAndWalls.zip, not checked into the repo) for the
  // church/temple interiors — replaces the flat generated temple-floor/
  // stone-wall for those two rooms only (temple-floor/stone-wall themselves
  // stay registered — the outdoor plaza and cave walls still use them). Six
  // flagstone tiles are one cohesive set (a few carry a subtle crack) so
  // they're picked per-cell like grass/wood; the wall pieces are a proper
  // edge/corner set (see InteriorScene's templeWallTextureFor) — only one
  // corner piece ships, so all four corners reuse it mirrored horizontally
  // and/or vertically rather than a flat tile repeated on every side.
  { key: "temple-stone-floor-1", path: "terrain/temple-stone-floor-1.png" },
  { key: "temple-stone-floor-2", path: "terrain/temple-stone-floor-2.png" },
  { key: "temple-stone-floor-3", path: "terrain/temple-stone-floor-3.png" },
  { key: "temple-stone-floor-4", path: "terrain/temple-stone-floor-4.png" },
  { key: "temple-stone-floor-5", path: "terrain/temple-stone-floor-5.png" },
  { key: "temple-stone-floor-6", path: "terrain/temple-stone-floor-6.png" },
  { key: "temple-wall-corner", path: "terrain/temple-wall-corner.png" },
  { key: "temple-wall-top", path: "terrain/temple-wall-top.png" },
  { key: "temple-wall-bottom", path: "terrain/temple-wall-bottom.png" },
  { key: "temple-wall-left", path: "terrain/temple-wall-left.png" },
  { key: "temple-wall-right", path: "terrain/temple-wall-right.png" },

  // Real art (WoodWallsAndFloorShops.zip, not checked into the repo) for the
  // shop/bank interiors — replaces the flat generated wood-floor/stone-wall
  // for those rooms. Five floor planks read as one cohesive set (same plank
  // style, only shade/wear differs) so they're picked per-cell like grass;
  // the wall pieces are a proper edge/corner set (see InteriorScene's
  // shopWallTextureFor) so the room's perimeter reads as one built wall
  // instead of a single tile repeated on every side.
  { key: "shop-wood-floor-basic", path: "terrain/wood-floor-basic.png" },
  { key: "shop-wood-floor-dark", path: "terrain/wood-floor-dark.png" },
  { key: "shop-wood-floor-light", path: "terrain/wood-floor-light.png" },
  { key: "shop-wood-floor-staggered", path: "terrain/wood-floor-staggered.png" },
  { key: "shop-wood-floor-worn", path: "terrain/wood-floor-worn.png" },
  { key: "shop-wall-corner-tl", path: "terrain/shop-wall-corner.png" },
  { key: "shop-wall-corner-tr", path: "terrain/shop-wall-corner-tr.png" },
  { key: "shop-wall-top", path: "terrain/shop-wall-top.png" },
  { key: "shop-wall-bottom", path: "terrain/shop-wall-bottom.png" },
  { key: "shop-wall-left", path: "terrain/shop-wall-left.png" },
  { key: "shop-wall-right", path: "terrain/shop-wall-right.png" },
  { key: "shop-wall-basic", path: "terrain/shop-wall-basic.png" },

  // --- environment ---
  { key: "bush", path: "environment/bush_01.png" },
  { key: "rock-small", path: "environment/rock_small_01.png" },
  { key: "rock-medium", path: "environment/rock_medium_01.png" },
  { key: "boulder", path: "environment/rock_large_01.png" },
  { key: "rock-mossy", path: "environment/rock_mossy_01.png" },
  { key: "stump", path: "environment/stump_01.png" },
  { key: "mushrooms", path: "environment/mushrooms_01.png" },
  { key: "flowers", path: "environment/flowers_01.png" },
  // Third tree pass — six distinct species (Trees.zip, not checked into the
  // repo), each its own single-sprite (trunk+foliage baked in) image with a
  // ~70%-scale "-small" companion for size variety within one species. Both
  // the original procedural split trunk/canopy system (oak/pine/dead) and
  // the second pass's 24-tree mixed-species pool are gone — replaced by
  // dedicated per-species LEGEND letters (see tilemap.ts) so a forest patch
  // stays one species rather than mixing, e.g., a maple next to a palm.
  { key: "tree-pine", path: "environment/tree-pine.png" },
  { key: "tree-pine-small", path: "environment/tree-pine-small.png" },
  { key: "tree-large-pine", path: "environment/tree-large-pine.png" },
  { key: "tree-large-pine-small", path: "environment/tree-large-pine-small.png" },
  { key: "tree-dark-forest", path: "environment/tree-dark-forest.png" },
  { key: "tree-dark-forest-small", path: "environment/tree-dark-forest-small.png" },
  { key: "tree-light-green", path: "environment/tree-light-green.png" },
  { key: "tree-light-green-small", path: "environment/tree-light-green-small.png" },
  { key: "tree-autumn", path: "environment/tree-autumn.png" },
  { key: "tree-autumn-small", path: "environment/tree-autumn-small.png" },
  { key: "tree-tall", path: "environment/tree-tall.png" },
  { key: "tree-tall-small", path: "environment/tree-tall-small.png" },

  // --- props ---
  { key: "barrel", path: "props/barrel_01.png" },
  { key: "well", path: "props/well_01.png" },
  { key: "signpost", path: "props/sign_01.png" },
  { key: "fence", path: "props/fence_01.png" },
  { key: "fence-v", path: "props/fence_v_01.png" },
  { key: "bench", path: "props/bench_01.png" },
  { key: "cart", path: "props/cart_01.png" },
  { key: "campfire", path: "props/campfire_01.png" },
  { key: "gravestone", path: "props/gravestone_01.png" },
  // Real art cropped from the user's transparent props sheet (not procedural
  // like the rest of this list) — a testing placement, see tilemap.ts PROPS.
  { key: "chimney-brick", path: "props/chimney_brick.png" },
  { key: "chest", path: "props/chest_01.png" },
  { key: "ladder-up", path: "props/ladder_up_01.png" },
  { key: "sewer-entrance", path: "props/sewer_entrance_01.png" },
  { key: "sack", path: "props/sack_01.png" },
  // Real art (ShopCounter.zip, not checked into the repo), replacing the
  // old procedural single-tile "counter". Three pieces so a multi-tile
  // counter reads as one built bar with proper end caps rather than a flat
  // texture repeated across the row — see InteriorScene's shopCounterFor.
  // Each source tile had a few px of transparent margin plus its own
  // dark plank-seam border on BOTH edges (a leftover from being drawn as
  // a standalone piece), so placed side by side they read as separate
  // boxes rather than one bar. Edited: the seam/border along whichever
  // edge touches a neighbor is replaced with the plain body fill (sampled
  // from the piece's own clean center column) so only the two true end
  // posts (the outer edges of "left" and "right") still show a border.
  { key: "shop-counter-left", path: "props/shop-counter-left.png" },
  { key: "shop-counter-center", path: "props/shop-counter-center.png" },
  { key: "shop-counter-right", path: "props/shop-counter-right.png" },
  { key: "fence-gate", path: "props/fence_gate_01.png" },
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
  // The five named service buildings — currently the user's second matched
  // set (Bank/Church/DistanceShop/MeleeShop/MagicPotion.png, not checked
  // into the repo), replacing an earlier mismatched set the same way. Same
  // crop-to-bbox + Lanczos downscale treatment as the houses (checkerboard
  // conversion for the two that needed it), sized a notch larger (6 tiles
  // wide) since these read as grander storefronts with their own signage
  // baked in. building-temple is used for temple_main.
  { key: "building-bank", path: "buildings/bank_01.png", smooth: true },
  { key: "building-melee-shop", path: "buildings/melee_shop_01.png", smooth: true },
  { key: "building-ranged-shop", path: "buildings/ranged_shop_01.png", smooth: true },
  { key: "building-magic-shop", path: "buildings/magic_shop_01.png", smooth: true },
  { key: "building-temple", path: "buildings/temple_01.png", smooth: true },
  { key: "building-general-store", path: "buildings/general_store_01.png", smooth: true },

  // --- npcs ---
  { key: "npc-borin", path: "characters/npc_borin.png" },
  { key: "npc-wren", path: "characters/npc_wren.png" },
  { key: "npc-elder-corwin", path: "characters/npc_corwin.png" },
  { key: "npc-fenn", path: "characters/npc_fenn.png" },
  { key: "npc-farmer-01", path: "characters/npc_farmer_01.png" },
  { key: "npc-farmer-02", path: "characters/npc_farmer_02.png" },
  { key: "npc-priest", path: "characters/npc_priest.png" },
  { key: "npc-banker", path: "characters/npc_banker.png" },
  { key: "npc-grocer", path: "characters/npc_grocer.png" },

  // --- effects ---
  { key: "fx-hit", path: "effects/hit_spark_01.png" },
  { key: "fx-blood", path: "effects/blood_01.png" },
  { key: "fx-dust", path: "effects/dust_01.png" },
  { key: "fx-sparkle", path: "effects/sparkle_01.png" },
  { key: "fx-smoke", path: "effects/smoke_puff.png" },

  // --- item icons; keys match ItemDef.textureKey in src/data/items.ts ---
  { key: "sword", path: "items/weapon_sword.png" },
  { key: "sword-two-handed", path: "items/weapon_sword_two_handed.png" },
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
  { key: "backpack-red", path: "items/container_backpack_red.png" },
  { key: "backpack-blue", path: "items/container_backpack_blue.png" },
  { key: "backpack-green", path: "items/container_backpack_green.png" },
  { key: "backpack-gray", path: "items/container_backpack_gray.png" },
  { key: "backpack-tan", path: "items/container_backpack_tan.png" },
  { key: "bag", path: "items/container_bag.png" },
  { key: "loot-bag", path: "items/loot_bag.png" },
  { key: "health-potion", path: "items/potion_health.png" },
  { key: "mana-potion", path: "items/potion_mana.png" },
  // "gold-coin" is the plain fallback; the tiered keys are what the UI
  // actually shows for a stack, picked by items.ts's goldCoinTextureFor.
  { key: "gold-coin", path: "items/coin_gold.png" },
  { key: "gold-coin-1", path: "items/coin_gold_1.png" },
  { key: "gold-coin-5", path: "items/coin_gold_5.png" },
  { key: "gold-coin-10", path: "items/coin_gold_10.png" },
  { key: "gold-coin-20", path: "items/coin_gold_20.png" },
  { key: "gold-coin-50", path: "items/coin_gold_50.png" },
  { key: "gold-coin-100", path: "items/coin_gold_100.png" },
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
  // 4-frame flicker cycle, bottom-anchored like the other leaning props (see
  // tileAnchor.ts) but twice the tile height since the flame extends above it.
  { key: "torch", path: "props/torch_01.png", frameWidth: 32, frameHeight: 64 },
];

/** How many frames the water cycle has, and how long each is held. */
export const WATER_FRAME_COUNT = 4;
export const WATER_FRAME_MS = 420;

