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
