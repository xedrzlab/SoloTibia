import Phaser from "phaser";
import type { Container, SlotRef } from "./containers";
import type { Equipment } from "./equipment";
import type { SkillId } from "./skills";

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
  SKILLS: "skills",
  INVENTORY_STATE: "inventory-state",
  MOVE_ITEM: "move-item",
  OPEN_CONTAINER: "open-container",
  CLOSE_CONTAINER: "close-container",
  CAST_SPELL: "cast-spell",
  LOOT_ALL: "loot-all",
  UI_LAYOUT: "ui-layout",
  BATTLE_LIST: "battle-list",
  SELECT_TARGET: "select-target",
  /** true when the player is inside an interior room, false when back outdoors. */
  INTERIOR_STATE: "interior-state",
} as const;

export interface InteriorStatePayload {
  active: boolean;
}

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

// The inventory/equipment payloads carry live object references rather than
// serialized copies. Both scenes run in the same process, so the UI can render
// straight off the model — but it must never mutate it: every change goes back
// through MOVE_ITEM so WorldScene stays the single owner of game state.

export interface SkillRow {
  id: SkillId;
  name: string;
  level: number;
  progress: number;
}

export interface SkillsPayload {
  vocationName: string;
  level: number;
  exp: number;
  expIntoLevel: number;
  expForLevel: number;
  skills: SkillRow[];
  attack: number;
  defense: number;
  armor: number;
}

export interface InventoryStatePayload {
  equipment: Equipment;
  openContainers: Container[];
  capacityUsed: number;
  maxCapacity: number;
}

export interface MoveItemPayload {
  from: SlotRef;
  to: SlotRef;
}

export interface OpenContainerPayload {
  container: Container;
}

export interface CloseContainerPayload {
  container: Container;
}

export interface CastSpellPayload {
  spellId: string;
}

export interface LootAllPayload {
  container: Container;
}

export interface UiLayoutPayload {
  /** Width in CSS px of the right-hand sidebar, 0 when it's collapsed. */
  sidebarWidth: number;
  /** Sidebar plus its collapse tab — the strip where taps belong to the UI. */
  reservedWidth: number;
}

export interface BattleEntry {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  targeted: boolean;
}

export interface BattleListPayload {
  entries: BattleEntry[];
}

export interface SelectTargetPayload {
  id: number;
}
