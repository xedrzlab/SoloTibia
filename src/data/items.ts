// Item catalogue. Beyond the original consumables, items now carry the data
// the equipment/container systems need: which slot they fit, what they add to
// attack/defense/armor, how much they weigh against carry capacity, and (for
// bags and backpacks) how many slots they hold.

export type ItemKind = "consumable" | "currency" | "equipment" | "container" | "ammo" | "trophy";

/** The ten Tibia paper-doll slots, laid out 3-wide in the sidebar. */
export type EquipSlot = "head" | "neck" | "back" | "armor" | "left" | "right" | "legs" | "feet" | "ring" | "ammo";

export type WeaponType = "melee" | "distance" | "wand";

export interface ItemDef {
  id: string;
  name: string;
  textureKey: string;
  kind: ItemKind;
  stackable: boolean;
  /** Weight in oz, charged against the player's capacity. */
  weight: number;
  healAmount?: number;
  manaAmount?: number;
  /**
   * Heal-over-time food, distinct from healAmount's instant potion heal:
   * eating restores regenPercentOfMaxHp of max HP spread evenly across
   * regenSeconds (see Player.addFoodRegen / WorldScene.regenerate). Always
   * set together.
   */
  regenSeconds?: number;
  regenPercentOfMaxHp?: number;
  equipSlot?: EquipSlot;
  weaponType?: WeaponType;
  attack?: number;
  defense?: number;
  armor?: number;
  /** Tiles a distance weapon can reach. */
  range?: number;
  /** A two-handed weapon occupies the shield slot too — see Equipment.canEquip(). */
  twoHanded?: boolean;
  /** Slot count when this item is a container. */
  containerCapacity?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  // --- Currency & consumables -------------------------------------------
  gold_coin: {
    id: "gold_coin",
    name: "Gold Coin",
    textureKey: "gold-coin",
    kind: "currency",
    stackable: true,
    weight: 0.1,
  },
  cheese: {
    id: "cheese",
    name: "Cheese",
    textureKey: "cheese",
    kind: "consumable",
    stackable: true,
    weight: 4,
    regenSeconds: 108,
    regenPercentOfMaxHp: 0.09,
  },
  // Bear's TibiaWiki loot table: Meat, Ham, Bear Paw, Honeycomb — added so
  // that loot table has real items to drop instead of an empty one.
  meat: {
    id: "meat",
    name: "Meat",
    textureKey: "meat",
    kind: "consumable",
    stackable: true,
    weight: 13,
    regenSeconds: 180,
    regenPercentOfMaxHp: 0.15,
  },
  ham: {
    id: "ham",
    name: "Ham",
    textureKey: "ham",
    kind: "consumable",
    stackable: true,
    weight: 20,
    regenSeconds: 360,
    regenPercentOfMaxHp: 0.3,
  },
  // Trophy drops for now (not food) — kind "trophy" didn't exist before
  // bear's loot table needed it.
  honeycomb: {
    id: "honeycomb",
    name: "Honeycomb",
    textureKey: "honeycomb",
    kind: "trophy",
    stackable: true,
    weight: 6,
  },
  bear_paw: {
    id: "bear_paw",
    name: "Bear Paw",
    textureKey: "bear-paw",
    kind: "trophy",
    stackable: false,
    weight: 8,
  },
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    textureKey: "health-potion",
    kind: "consumable",
    stackable: true,
    weight: 2.7,
    healAmount: 40,
  },
  mana_potion: {
    id: "mana_potion",
    name: "Mana Potion",
    textureKey: "mana-potion",
    kind: "consumable",
    stackable: true,
    weight: 2.7,
    manaAmount: 30,
  },

  // --- Containers --------------------------------------------------------
  backpack: {
    id: "backpack",
    name: "Backpack",
    textureKey: "backpack",
    kind: "container",
    stackable: false,
    weight: 18,
    equipSlot: "back",
    containerCapacity: 12,
  },
  // Same backpack, purely cosmetic color variants — sold at the General
  // Store alongside the default brown one.
  backpack_red: {
    id: "backpack_red",
    name: "Red Backpack",
    textureKey: "backpack-red",
    kind: "container",
    stackable: false,
    weight: 18,
    equipSlot: "back",
    containerCapacity: 12,
  },
  backpack_blue: {
    id: "backpack_blue",
    name: "Blue Backpack",
    textureKey: "backpack-blue",
    kind: "container",
    stackable: false,
    weight: 18,
    equipSlot: "back",
    containerCapacity: 12,
  },
  backpack_green: {
    id: "backpack_green",
    name: "Green Backpack",
    textureKey: "backpack-green",
    kind: "container",
    stackable: false,
    weight: 18,
    equipSlot: "back",
    containerCapacity: 12,
  },
  backpack_gray: {
    id: "backpack_gray",
    name: "Gray Backpack",
    textureKey: "backpack-gray",
    kind: "container",
    stackable: false,
    weight: 18,
    equipSlot: "back",
    containerCapacity: 12,
  },
  backpack_tan: {
    id: "backpack_tan",
    name: "Tan Backpack",
    textureKey: "backpack-tan",
    kind: "container",
    stackable: false,
    weight: 18,
    equipSlot: "back",
    containerCapacity: 12,
  },
  bag: {
    id: "bag",
    name: "Bag",
    textureKey: "bag",
    kind: "container",
    stackable: false,
    weight: 6,
    equipSlot: "back",
    containerCapacity: 8,
  },

  // --- Melee weapons -----------------------------------------------------
  sword: {
    id: "sword",
    name: "Sword",
    textureKey: "sword",
    kind: "equipment",
    stackable: false,
    weight: 35,
    equipSlot: "left",
    weaponType: "melee",
    attack: 12,
    defense: 11,
  },
  axe: {
    id: "axe",
    name: "Axe",
    textureKey: "axe",
    kind: "equipment",
    stackable: false,
    weight: 40,
    equipSlot: "left",
    weaponType: "melee",
    attack: 15,
    defense: 8,
  },
  two_handed_sword: {
    id: "two_handed_sword",
    name: "Two Handed Sword",
    textureKey: "sword-two-handed",
    kind: "equipment",
    stackable: false,
    weight: 75,
    equipSlot: "left",
    weaponType: "melee",
    twoHanded: true,
    attack: 23,
    defense: 0,
  },

  // --- Distance weapons & ammo -------------------------------------------
  bow: {
    id: "bow",
    name: "Bow",
    textureKey: "bow",
    kind: "equipment",
    stackable: false,
    weight: 32,
    equipSlot: "left",
    weaponType: "distance",
    attack: 0, // a bow's damage comes from its ammunition
    range: 5,
  },
  arrow: {
    id: "arrow",
    name: "Arrow",
    textureKey: "arrow",
    kind: "ammo",
    stackable: true,
    weight: 0.7,
    equipSlot: "ammo",
    attack: 14,
  },

  // --- Wands -------------------------------------------------------------
  wand_of_vortex: {
    id: "wand_of_vortex",
    name: "Wand of Vortex",
    textureKey: "wand",
    kind: "equipment",
    stackable: false,
    weight: 19,
    equipSlot: "left",
    weaponType: "wand",
    attack: 8,
    defense: 5,
  },

  // --- Shields -----------------------------------------------------------
  wooden_shield: {
    id: "wooden_shield",
    name: "Wooden Shield",
    textureKey: "wooden-shield",
    kind: "equipment",
    stackable: false,
    weight: 40,
    equipSlot: "right",
    defense: 9,
  },
  steel_shield: {
    id: "steel_shield",
    name: "Steel Shield",
    textureKey: "steel-shield",
    kind: "equipment",
    stackable: false,
    weight: 60,
    equipSlot: "right",
    defense: 15,
  },

  // --- Armor -------------------------------------------------------------
  leather_helmet: {
    id: "leather_helmet",
    name: "Leather Helmet",
    textureKey: "leather-helmet",
    kind: "equipment",
    stackable: false,
    weight: 12,
    equipSlot: "head",
    armor: 1,
  },
  steel_helmet: {
    id: "steel_helmet",
    name: "Steel Helmet",
    textureKey: "steel-helmet",
    kind: "equipment",
    stackable: false,
    weight: 46,
    equipSlot: "head",
    armor: 6,
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    textureKey: "leather-armor",
    kind: "equipment",
    stackable: false,
    weight: 40,
    equipSlot: "armor",
    armor: 4,
  },
  plate_armor: {
    id: "plate_armor",
    name: "Plate Armor",
    textureKey: "plate-armor",
    kind: "equipment",
    stackable: false,
    weight: 110,
    equipSlot: "armor",
    armor: 10,
  },
  leather_legs: {
    id: "leather_legs",
    name: "Leather Legs",
    textureKey: "leather-legs",
    kind: "equipment",
    stackable: false,
    weight: 22,
    equipSlot: "legs",
    armor: 1,
  },
  plate_legs: {
    id: "plate_legs",
    name: "Plate Legs",
    textureKey: "plate-legs",
    kind: "equipment",
    stackable: false,
    weight: 85,
    equipSlot: "legs",
    armor: 7,
  },
  leather_boots: {
    id: "leather_boots",
    name: "Leather Boots",
    textureKey: "leather-boots",
    kind: "equipment",
    stackable: false,
    weight: 8,
    equipSlot: "feet",
    armor: 1,
  },

  // --- Jewellery ---------------------------------------------------------
  amulet_of_life: {
    id: "amulet_of_life",
    name: "Amulet of Protection",
    textureKey: "amulet",
    kind: "equipment",
    stackable: false,
    weight: 6,
    equipSlot: "neck",
    armor: 1,
  },
  ring_of_healing: {
    id: "ring_of_healing",
    name: "Ring of Healing",
    textureKey: "ring",
    kind: "equipment",
    stackable: false,
    weight: 2,
    equipSlot: "ring",
    armor: 1,
  },
};

/** Bare-handed attack value, so a weaponless character still does something. */
export const FIST_ATTACK = 7;

export function itemWeight(itemId: string, count = 1): number {
  return (ITEMS[itemId]?.weight ?? 0) * count;
}

/** Ascending stack-size breakpoints with a dedicated gold coin pile icon. */
const GOLD_COIN_TIERS = [1, 5, 10, 20, 50, 100];

/** Picks the smallest coin-pile icon whose count is >= the stack's count. */
export function goldCoinTextureFor(count: number): string {
  for (const tier of GOLD_COIN_TIERS) {
    if (count <= tier) return `gold-coin-${tier}`;
  }
  return `gold-coin-${GOLD_COIN_TIERS[GOLD_COIN_TIERS.length - 1]}`;
}
