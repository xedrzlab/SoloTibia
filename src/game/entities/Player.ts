import Phaser from "phaser";
import { TILE_SIZE, BASE_STEP_MS } from "../constants";
import {
  Vocation,
  maxHpFor,
  maxManaFor,
  maxCapacityFor,
  levelForExp,
  expIntoCurrentLevel,
  expNeededForNextLevel,
} from "../stats";

const FRAME = { downIdle: 0, downStep: 1, upIdle: 2, upStep: 3, rightIdle: 4, rightStep: 5 };

export type Facing = "down" | "up" | "left" | "right";

export class Player {
  sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  facing: Facing = "down";
  moving = false;

  vocation: Vocation = "knight";
  level = 1;
  exp = 0;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  maxCapacity: number;
  meleeSkill = 10;

  inventory: Record<string, number> = { health_potion: 3, mana_potion: 1 };

  weapon = { min: 3, max: 7, intervalMs: 2000 };
  attackCooldown = 0;

  constructor(
    private scene: Phaser.Scene,
    tileX: number,
    tileY: number,
  ) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.maxHp = maxHpFor(this.vocation, this.level);
    this.hp = this.maxHp;
    this.maxMana = maxManaFor(this.vocation, this.level);
    this.mana = this.maxMana;
    this.maxCapacity = maxCapacityFor(this.vocation, this.level);

    this.sprite = scene.add.sprite(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
      "player",
      FRAME.downIdle,
    );
    this.sprite.setDepth(10);
  }

  get tile(): { x: number; y: number } {
    return { x: this.tileX, y: this.tileY };
  }

  setFacing(dx: number, dy: number) {
    if (dx === 0 && dy < 0) this.facing = "up";
    else if (dx === 0 && dy > 0) this.facing = "down";
    else if (dx < 0) this.facing = "left";
    else if (dx > 0) this.facing = "right";
  }

  private frameFor(idle: boolean): number {
    switch (this.facing) {
      case "up":
        return idle ? FRAME.upIdle : FRAME.upStep;
      case "down":
        return idle ? FRAME.downIdle : FRAME.downStep;
      default:
        return idle ? FRAME.rightIdle : FRAME.rightStep;
    }
  }

  private applyFrame(idle: boolean) {
    this.sprite.setFlipX(this.facing === "left");
    this.sprite.setFrame(this.frameFor(idle));
  }

  /** Animate one tile step; resolves once the tween completes. */
  stepTo(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      this.setFacing(x - this.tileX, y - this.tileY);
      this.tileX = x;
      this.tileY = y;
      this.moving = true;
      this.applyFrame(false);
      this.scene.tweens.add({
        targets: this.sprite,
        x: x * TILE_SIZE + TILE_SIZE / 2,
        y: y * TILE_SIZE + TILE_SIZE / 2,
        duration: BASE_STEP_MS,
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

  addItem(itemId: string, amount: number) {
    this.inventory[itemId] = (this.inventory[itemId] ?? 0) + amount;
  }

  removeItem(itemId: string, amount: number): boolean {
    const have = this.inventory[itemId] ?? 0;
    if (have < amount) return false;
    this.inventory[itemId] = have - amount;
    if (this.inventory[itemId] <= 0) delete this.inventory[itemId];
    return true;
  }

  teleportTo(x: number, y: number) {
    this.tileX = x;
    this.tileY = y;
    this.sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
    this.sprite.y = y * TILE_SIZE + TILE_SIZE / 2;
  }
}
