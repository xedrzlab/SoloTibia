export type ItemKind = "consumable" | "currency" | "weapon";

export interface ItemDef {
  id: string;
  name: string;
  textureKey: string;
  kind: ItemKind;
  stackable: boolean;
  healAmount?: number;
  manaAmount?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  gold_coin: {
    id: "gold_coin",
    name: "Gold Coin",
    textureKey: "gold-coin",
    kind: "currency",
    stackable: true,
  },
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    textureKey: "health-potion",
    kind: "consumable",
    stackable: true,
    healAmount: 40,
  },
  mana_potion: {
    id: "mana_potion",
    name: "Mana Potion",
    textureKey: "mana-potion",
    kind: "consumable",
    stackable: true,
    manaAmount: 30,
  },
  sword: {
    id: "sword",
    name: "Sword",
    textureKey: "sword",
    kind: "weapon",
    stackable: false,
  },
};
