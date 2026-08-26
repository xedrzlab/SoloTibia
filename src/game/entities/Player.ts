import Phaser from "phaser";
import { BASE_STEP_MS } from "../constants";
import { tileAnchorX, tileAnchorY, depthForTileY } from "../tileAnchor";
import {
  Vocation,
  maxHpFor,
  maxManaFor,
  maxCapacityFor,
  levelForExp,
  expIntoCurrentLevel,
  expNeededForNextLevel,
} from "../stats";
import { SkillSet } from "../skills";
import { Equipment } from "../equipment";
import { Container, createStack } from "../containers";
import { ITEMS } from "../../data/items";
import { PAPER_DOLL_ORDER, paperDollKey } from "../../data/assets";
import { Direction, directionFromDelta, directionalFrameIndex } from "../directionalSprite";

// Matches the player sheet built by scripts/generate-assets.mjs:
// 4 frames per direction (0 = idle, 1/2 = alternating walk steps, 3 = attack).
const PLAYER_FRAMES_PER_DIRECTION = 4;
const ATTACK_FRAME = 3;
/** How long the swing pose is held. Short enough not to fight the walk cycle. */
const ATTACK_POSE_MS = 180;

/** Base swing/shot interval in ms, before any gear or skill adjustment. */
export const BASE_ATTACK_INTERVAL_MS = 2000;

export class Player {
  sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  facing: Direction = "down";
  moving = false;
  private stepToggle = false;

  vocation: Vocation = "none";
  level = 1;
  exp = 0;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  maxCapacity: number;

  readonly skills = new SkillSet();
  readonly equipment = new Equipment();
  /** Worn layers drawn over the base body, rebuilt when equipment changes. */
  private equipLayers: Phaser.GameObjects.Sprite[] = [];
  private silhouette!: Phaser.GameObjects.Sprite;

  attackIntervalMs = BASE_ATTACK_INTERVAL_MS;
  attackCooldown = 0;

  constructor(
    private scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    init?: { vocation?: Vocation; exp?: number },
  ) {
    this.tileX = tileX;
    this.tileY = tileY;
    // A returning character hydrates their vocation and exp from the saved
    // profile; level is derived from exp so it stays consistent with the
    // curve if the numbers ever change.
    if (init?.vocation) this.vocation = init.vocation;
    if (init?.exp && init.exp > 0) {
      this.exp = init.exp;
      this.level = levelForExp(this.exp);
    }
    this.maxHp = maxHpFor(this.vocation, this.level);
    this.hp = this.maxHp;
    this.maxMana = maxManaFor(this.vocation, this.level);
    this.mana = this.maxMana;
    this.maxCapacity = maxCapacityFor(this.vocation, this.level);

    this.equipStartingGear();

    this.sprite = scene.add.sprite(
      tileAnchorX(tileX),
      tileAnchorY(tileY),
      "player",
      directionalFrameIndex("down", 0, PLAYER_FRAMES_PER_DIRECTION),
    );
    this.sprite.setOrigin(1, 1);
    this.sprite.setDepth(depthForTileY(tileY));

    // A silhouette cast one pixel down-right, behind the body. Two jobs: it
    // follows the world's upper-left light like every other shadow, and it
    // keeps the player separable from the ground they're standing on —
    // plate armour on the cobbled plaza is grey on grey without it, and the
    // player has to stay the easiest figure on screen to find.
    this.silhouette = scene.add
      .sprite(this.sprite.x + 1, this.sprite.y + 1, "player", this.sprite.frame.name)
      .setOrigin(1, 1)
      .setTint(0x000000)
      .setAlpha(0.4)
      .setDepth(this.sprite.depth - 0.05);

    this.refreshAppearance();
  }

  /**
   * Rebuild the worn layers from what's equipped. Called whenever equipment
   * changes, so armour and weapons are visible on the character rather than
   * only in the stat readout.
   */
  refreshAppearance() {
    for (const layer of this.equipLayers) layer.destroy();
    this.equipLayers = [];

    // Depth steps stay under 1 so the whole doll still sorts as one figure
    // against everything standing on neighbouring tiles.
    let depthStep = 0.1;
    for (const slot of PAPER_DOLL_ORDER) {
      const stack = this.equipment.get(slot);
      const layerName = stack ? ITEMS[stack.itemId]?.paperDoll : undefined;
      if (!layerName) continue;
      const sprite = this.scene.add
        .sprite(this.sprite.x, this.sprite.y, paperDollKey(layerName), this.sprite.frame.name)
        .setOrigin(1, 1)
        .setDepth(this.sprite.depth + depthStep);
      this.equipLayers.push(sprite);
      depthStep += 0.1;
    }
  }

  /** Keep the worn layers on the body: same position, frame and sort order. */
  private syncLayers() {
    this.silhouette.setPosition(this.sprite.x + 1, this.sprite.y + 1);
    this.silhouette.setFrame(this.sprite.frame.name);
    this.silhouette.setDepth(this.sprite.depth - 0.05);

    let depthStep = 0.1;
    for (const layer of this.equipLayers) {
      layer.setPosition(this.sprite.x, this.sprite.y);
      layer.setFrame(this.sprite.frame.name);
      layer.setDepth(this.sprite.depth + depthStep);
      depthStep += 0.1;
    }
  }

  private equipStartingGear() {
    this.equipment.set("back", createStack("backpack", 1));
    this.equipment.set("left", createStack("sword", 1));
    this.equipment.set("armor", createStack("leather_armor", 1));

    const backpack = this.backpack;
    if (!backpack) return;
    backpack.addItem("health_potion", 3);
    backpack.addItem("mana_potion", 1);
    backpack.addItem("wooden_shield", 1);
    backpack.addItem("leather_helmet", 1);
    // A spare bag, so nested containers are discoverable from the first minute.
    backpack.addItem("bag", 1);
  }

  /** Root of the inventory tree — null only if the backpack slot is emptied. */
  get backpack(): Container | null {
    return this.equipment.backpack;
  }

  get tile(): { x: number; y: number } {
    return { x: this.tileX, y: this.tileY };
  }

  setFacing(dx: number, dy: number) {
    this.facing = directionFromDelta(dx, dy, this.facing);
  }

  private applyFrame(idle: boolean) {
    const frameInDirection = idle ? 0 : this.stepToggle ? 1 : 2;
    this.sprite.setFrame(directionalFrameIndex(this.facing, frameInDirection, PLAYER_FRAMES_PER_DIRECTION));
    this.syncLayers();
  }

  /** Hold the swing pose briefly, so a blow reads as an action. */
  playAttack() {
    this.sprite.setFrame(directionalFrameIndex(this.facing, ATTACK_FRAME, PLAYER_FRAMES_PER_DIRECTION));
    this.syncLayers();
    this.scene.time.delayedCall(ATTACK_POSE_MS, () => {
      // Walking takes priority: stepTo drives the frame itself while moving.
      if (!this.moving) this.applyFrame(true);
    });
  }

  /** Animate one tile step; resolves once the tween completes. */
  stepTo(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      this.setFacing(x - this.tileX, y - this.tileY);
      this.tileX = x;
      this.tileY = y;
      this.moving = true;
      this.stepToggle = !this.stepToggle;
      this.applyFrame(false);
      this.sprite.setDepth(depthForTileY(y));
      this.scene.tweens.add({
        targets: this.sprite,
        x: tileAnchorX(x),
        y: tileAnchorY(y),
        duration: BASE_STEP_MS,
        onUpdate: () => this.syncLayers(), // layers ride the tween with the body
        onComplete: () => {
          this.moving = false;
          this.applyFrame(true);
          resolve();
        },
      });
    });
  }

  gainExp(amount: number): { leveledUp: boolean } {
    this.exp += amount;
    const newLevel = levelForExp(this.exp);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.maxHp = maxHpFor(this.vocation, this.level);
      this.maxMana = maxManaFor(this.vocation, this.level);
      this.maxCapacity = maxCapacityFor(this.vocation, this.level);
      this.hp = this.maxHp;
      this.mana = this.maxMana;
      return { leveledUp: true };
    }
    return { leveledUp: false };
  }

  setVocation(vocation: Vocation) {
    this.vocation = vocation;
    this.maxHp = maxHpFor(this.vocation, this.level);
    this.maxMana = maxManaFor(this.vocation, this.level);
    this.maxCapacity = maxCapacityFor(this.vocation, this.level);
    this.hp = this.maxHp;
    this.mana = this.maxMana;
  }

  expIntoLevel(): number {
    return expIntoCurrentLevel(this.exp, this.level);
  }

  expForLevel(): number {
    return expNeededForNextLevel(this.level);
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  restoreMana(amount: number) {
    this.mana = Math.min(this.maxMana, this.mana + amount);
  }

  spendMana(amount: number): boolean {
    if (this.mana < amount) return false;
    this.mana -= amount;
    return true;
  }

  // --- Inventory helpers, all routed through the worn backpack -------------

  countItem(itemId: string): number {
    return this.backpack?.countItem(itemId) ?? 0;
  }

  /** Adds to the backpack; returns how many didn't fit. */
  addItem(itemId: string, amount: number): number {
    const backpack = this.backpack;
    if (!backpack) return amount;
    return backpack.addItem(itemId, amount);
  }

  removeItem(itemId: string, amount: number): boolean {
    const backpack = this.backpack;
    if (!backpack || backpack.countItem(itemId) < amount) return false;
    backpack.removeItem(itemId, amount);
    return true;
  }

  /** Flattened item counts for the shop and action-bar views. */
  inventoryTotals(): Record<string, number> {
    return this.backpack?.totals() ?? {};
  }

  /** Weight carried, in oz, against maxCapacity. */
  capacityUsed(): number {
    return this.equipment.weight();
  }

  capacityFree(): number {
    return Math.max(0, this.maxCapacity - this.capacityUsed());
  }

  teleportTo(x: number, y: number) {
    this.tileX = x;
    this.tileY = y;
    this.sprite.x = tileAnchorX(x);
    this.sprite.y = tileAnchorY(y);
    this.sprite.setDepth(depthForTileY(y));
    this.syncLayers();
  }
}
