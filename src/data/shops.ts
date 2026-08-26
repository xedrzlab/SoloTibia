// Three shops, split by fighting style. Each keeps its own inventory — a
// magic buyer isn't going to trade in a sword, and a blacksmith won't touch a
// wand — which is what the world tells the player through the shop signs.

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
  // Borin — everything for a close fight. Weapons, shields, armour, helmets,
  // legs, boots. Also stocks the everyday carry containers.
  blacksmith: {
    npcId: "blacksmith",
    sells: [
      { itemId: "sword", price: 50 },
      { itemId: "axe", price: 70 },
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

  // Fenn — the ranged shop. Bows and arrows only; her stock is deliberately
  // narrow so a player who commits to distance gets a shop that specialises.
  fletcher: {
    npcId: "fletcher",
    sells: [
      { itemId: "bow", price: 90 },
      { itemId: "arrow", price: 3 },
    ],
    buys: [
      { itemId: "bow", price: 36 },
      { itemId: "arrow", price: 1 },
    ],
  },

  // Wren — the magic shop. Wands, potions, jewellery, the tools of a caster.
  // She won't touch a blade.
  apothecary: {
    npcId: "apothecary",
    sells: [
      { itemId: "wand_of_vortex", price: 120 },
      { itemId: "health_potion", price: 15 },
      { itemId: "mana_potion", price: 15 },
      { itemId: "amulet_of_life", price: 90 },
      { itemId: "ring_of_healing", price: 110 },
    ],
    buys: [
      { itemId: "wand_of_vortex", price: 48 },
      { itemId: "amulet_of_life", price: 36 },
      { itemId: "ring_of_healing", price: 44 },
    ],
  },
};
