import Phaser from "phaser";

// A tiny scene-to-scene message bus (WorldScene <-> UIScene) so the HUD
// doesn't need direct references into world/game-logic internals.
export const bus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  PLAYER_STATS: "player-stats",
  TARGET: "target",
  LOG: "log",
  INVENTORY: "inventory",
  USE_ITEM: "use-item",
  OPEN_SHOP: "open-shop",
  BUY_ITEM: "buy-item",
  SELL_ITEM: "sell-item",
  OPEN_VOCATION_CHOICE: "open-vocation-choice",
  CHOOSE_VOCATION: "choose-vocation",
  MODAL_STATE: "modal-state",
  OPEN_DIALOGUE: "open-dialogue",
  REQUEST_VOCATION_TALK: "request-vocation-talk",
} as const;

export interface PlayerStatsPayload {
  level: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  exp: number;
  expIntoLevel: number;
  expForLevel: number;
}

export interface TargetPayload {
  name: string;
  hp: number;
  maxHp: number;
}

export type LogKind = "damage" | "loot" | "xp" | "info" | "levelup";

export interface LogPayload {
  kind: LogKind;
  text: string;
}

export interface InventoryPayload {
  items: Record<string, number>;
}

export interface UseItemPayload {
  itemId: string;
}

export interface OpenShopPayload {
  npcId: string;
  npcName: string;
}

export interface BuyItemPayload {
  npcId: string;
  itemId: string;
}

export interface SellItemPayload {
  npcId: string;
  itemId: string;
}

export interface ChooseVocationPayload {
  vocation: string;
}

export interface ModalStatePayload {
  open: boolean;
}

export interface OpenDialoguePayload {
  npcId: string;
  npcName: string;
  textureKey: string;
  role: "shop" | "vocation";
  greeting: string;
  about: string;
}

export interface RequestVocationTalkPayload {
  npcId: string;
}
