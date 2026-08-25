import Phaser from "phaser";
import {
  TILE_SIZE,
  BASE_STEP_MS,
  MELEE_RANGE,
  MONSTER_AGGRO_RANGE,
  MONSTER_RESPAWN_MS,
  RESPAWN_SAFE_DISTANCE,
} from "../constants";
import { MonsterDef } from "../../data/monsters";
import { findPath, chebyshevDistance, TileCoord } from "../pathfinding";
import { rollDamage } from "../combat";
import { Direction, directionFromDelta, directionalFrameIndex } from "../directionalSprite";

const AI_TICK_MS = 400; // throttle pathfinding/decision-making for battery friendliness

export class Monster {
  sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  hp: number;
  alive = true;
  moving = false;
  facing: Direction = "down";
  private stepToggle = false;

  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private aiTimer = Math.random() * AI_TICK_MS; // desync monsters so they don't all decide on the same frame
  private attackCooldown = 0;
  private respawnTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly def: MonsterDef,
    readonly spawnX: number,
    readonly spawnY: number,
  ) {
    this.tileX = spawnX;
    this.tileY = spawnY;
    this.hp = def.hp;

    this.sprite = scene.add.sprite(
      spawnX * TILE_SIZE + TILE_SIZE / 2,
      spawnY * TILE_SIZE + TILE_SIZE / 2,
      def.textureKey,
      0,
    );
    this.sprite.setDepth(5);

    const barY = this.barY();
    this.hpBarBg = scene.add.rectangle(this.sprite.x, barY, 24, 4, 0x000000, 0.6).setDepth(6).setVisible(false);
    this.hpBarFill = scene.add.rectangle(this.sprite.x, barY, 24, 4, 0xc9302f).setDepth(7).setVisible(false);
  }

  get tile(): TileCoord {
    return { x: this.tileX, y: this.tileY };
  }

  /** A few px above the sprite's own top edge, so taller monsters (e.g. the troll) don't have their HP bar overlapping their head. */
  private barY(): number {
    return this.sprite.y - this.sprite.displayHeight / 2 - 6;
  }

  private updateHpBar() {
    const pct = Phaser.Math.Clamp(this.hp / this.def.hp, 0, 1);
    this.hpBarFill.width = 24 * pct;
    const visible = this.alive && pct < 1;
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
    this.syncBarPosition();
  }

  private syncBarPosition() {
    const barY = this.barY();
    this.hpBarBg.setPosition(this.sprite.x, barY);
    this.hpBarFill.y = barY;
    this.hpBarFill.x = this.sprite.x - (24 - this.hpBarFill.width) / 2;
  }

  /** Directional sheets (framesPerDirection set) index by facing + idle/step; simple 2-frame sheets just toggle frame 0/1, flipped horizontally for movement direction. */
  private applyFrame(idle: boolean) {
    const perDir = this.def.framesPerDirection;
    if (perDir) {
      const frameInDirection = idle ? 0 : this.stepToggle ? 1 : 2;
      this.sprite.setFrame(directionalFrameIndex(this.facing, frameInDirection, perDir));
    } else {
      this.sprite.setFrame(idle ? 0 : 1 % this.def.frameCount);
    }
  }

  private stepTo(x: number, y: number): Promise<void> {
    const dx = x - this.tileX;
    const dy = y - this.tileY;
    return new Promise((resolve) => {
      if (this.def.framesPerDirection) {
        this.facing = directionFromDelta(dx, dy, this.facing);
      } else if (dx !== 0) {
        this.sprite.setFlipX(dx < 0);
      }
      this.tileX = x;
      this.tileY = y;
      this.moving = true;
      this.stepToggle = !this.stepToggle;
      this.applyFrame(false);
      this.scene.tweens.add({
        targets: this.sprite,
        x: x * TILE_SIZE + TILE_SIZE / 2,
        y: y * TILE_SIZE + TILE_SIZE / 2,
        duration: BASE_STEP_MS,
        onUpdate: () => this.syncBarPosition(),
        onComplete: () => {
          this.moving = false;
          this.applyFrame(true);
          resolve();
        },
      });
    });
  }

  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die() {
    this.alive = false;
    this.sprite.setVisible(false);
    this.hpBarBg.setVisible(false);
    this.hpBarFill.setVisible(false);
    this.respawnTimer = MONSTER_RESPAWN_MS;
  }

  private revive() {
    this.alive = true;
    this.hp = this.def.hp;
    this.tileX = this.spawnX;
    this.tileY = this.spawnY;
    this.sprite.setPosition(
      this.spawnX * TILE_SIZE + TILE_SIZE / 2,
      this.spawnY * TILE_SIZE + TILE_SIZE / 2,
    );
    this.facing = "down";
    this.applyFrame(true);
    this.sprite.setVisible(true);
    this.updateHpBar();
  }

  /**
   * Advance AI/movement/attacks for this frame. Decision-making (pathfinding)
   * is throttled to AI_TICK_MS rather than run every frame, both to save
   * battery and because it reads better than instant micro-corrections.
   */
  update(
    dtMs: number,
    playerTile: TileCoord,
    playerAlive: boolean,
    isWalkable: (x: number, y: number) => boolean,
    onAttackPlayer: (damage: number) => void,
  ) {
    if (!this.alive) {
      this.respawnTimer -= dtMs;
      if (
        this.respawnTimer <= 0 &&
        chebyshevDistance(playerTile, { x: this.spawnX, y: this.spawnY }) >= RESPAWN_SAFE_DISTANCE
      ) {
        this.revive();
      }
      return;
    }

    if (!playerAlive) return;

    this.attackCooldown -= dtMs;
    const dist = chebyshevDistance(this.tile, playerTile);

    if (dist <= MELEE_RANGE) {
      if (this.attackCooldown <= 0) {
        onAttackPlayer(rollDamage(this.def.minDamage, this.def.maxDamage));
        this.attackCooldown = this.def.attackIntervalMs;
      }
      return;
    }

    if (this.moving) return;

    this.aiTimer -= dtMs;
    if (this.aiTimer > 0) return;
    this.aiTimer = AI_TICK_MS;

    if (dist <= MONSTER_AGGRO_RANGE) {
      const path = findPath(isWalkable, this.tile, playerTile);
      if (path.length > 0) void this.stepTo(path[0].x, path[0].y);
    } else if (this.tileX !== this.spawnX || this.tileY !== this.spawnY) {
      const path = findPath(isWalkable, this.tile, { x: this.spawnX, y: this.spawnY });
      if (path.length > 0) void this.stepTo(path[0].x, path[0].y);
    }
  }

  destroy() {
    this.sprite.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
  }
}
