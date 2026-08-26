export interface ShopOffer {
  itemId: string;
  price: number;
}

export interface ShopDef {
  npcId: string;
  sells: ShopOffer[]; // what the shop offers to sell to the player
  buys: ShopOffer[]; // what the shop will buy from the player, and for how much
}

export const SHOPS: Record<string, ShopDef> = {
  blacksmith: {
    npcId: "blacksmith",
    // Borin covers all three fighting styles: melee steel, a bow and arrows
    // for distance, and a wand for anyone training magic.
    sells: [
      { itemId: "sword", price: 50 },
      { itemId: "axe", price: 70 },
      { itemId: "bow", price: 90 },
      { itemId: "arrow", price: 3 },
      { itemId: "wand_of_vortex", price: 120 },
      { itemId: "wooden_shield", price: 40 },
      { itemId: "steel_shield", price: 180 },
      { itemId: "leather_helmet", price: 25 },
      { itemId: "steel_helmet", price: 140 },
      { itemId: "leather_armor", price: 45 },
      { itemId: "plate_armor", price: 260 },
      { itemId: "leather_legs", price: 30 },
      { itemId: "plate_legs", price: 190 },
      { itemId: "leather_boots", price: 20 },
      { itemId: "bag", price: 12 },
      { itemId: "backpack", price: 35 },
    ],
    buys: [
      { itemId: "sword", price: 20 },
      { itemId: "axe", price: 28 },
      { itemId: "wooden_shield", price: 16 },
      { itemId: "steel_shield", price: 72 },
      { itemId: "leather_helmet", price: 10 },
      { itemId: "steel_helmet", price: 56 },
      { itemId: "leather_armor", price: 18 },
      { itemId: "plate_armor", price: 104 },
      { itemId: "leather_legs", price: 12 },
      { itemId: "plate_legs", price: 76 },
      { itemId: "leather_boots", price: 8 },
    ],
  },
  herbalist: {
    npcId: "herbalist",
    sells: [
      { itemId: "health_potion", price: 15 },
      { itemId: "mana_potion", price: 15 },
      { itemId: "amulet_of_life", price: 90 },
      { itemId: "ring_of_healing", price: 110 },
    ],
    buys: [
      { itemId: "amulet_of_life", price: 36 },
      { itemId: "ring_of_healing", price: 44 },
    ],
  },
};
