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
    sells: [{ itemId: "sword", price: 50 }],
    buys: [{ itemId: "sword", price: 20 }],
  },
  herbalist: {
    npcId: "herbalist",
    sells: [
      { itemId: "health_potion", price: 15 },
      { itemId: "mana_potion", price: 15 },
    ],
    buys: [],
  },
};
