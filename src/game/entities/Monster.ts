import Phaser from "phaser";
import {
  MELEE_RANGE,
  MONSTER_AGGRO_RANGE,
  MONSTER_RESPAWN_MS,
  RESPAWN_SAFE_DISTANCE,
  stepDurationMs,
} from "../constants";
import { MonsterDef, TargetBox } from "../../data/monsters";
import { findPath, chebyshevDistance, closestChebyshevDistance, TileCoord } from "../pathfinding";
import { Direction, directionFromDelta, directionalFrameIndex, walkAnimKey } from "../directionalSprite";
import { tileAnchorX, tileAnchorY, depthForTileY, LABEL_DEPTH } from "../tileAnchor";

const AI_TICK_MS = 400; // throttle pathfinding/decision-making for battery friendliness

// Sheet layout shared with the player: frame 3 of each direction is the swing.
const ATTACK_FRAME = 3;
const ATTACK_POSE_MS = 180;

export class Monster {
  sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  hp: number;
  alive = true;
  moving = false;
  facing: Direction = "down";
  private stepToggle = false;
  /**
   * Tiles trailing behind the front (tileX, tileY), most recent first —
   * where a multi-tile creature's back segments actually are, built from
   * its own step history so a turn drags the tail around the corner
   * instead of cutting across it. Length is always def.footprintTiles - 1;
   * stays empty for every 1-tile creature.
   */
  private trail: TileCoord[] = [];

  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private nameLabel: Phaser.GameObjects.Text;
  private targetFrame: Phaser.GameObjects.Rectangle;
  private aiTimer = Math.random() * AI_TICK_MS; // desync monsters so they don't all decide on the same frame
  private attackCooldown = 0;
  /** Counts down the brief swing pose so face-tracking doesn't stomp it mid-attack. */
  private poseTimer = 0;
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
    this.trail = Array.from({ length: (def.footprintTiles ?? 1) - 1 }, () => ({ x: spawnX, y: spawnY }));

    this.sprite = scene.add.sprite(tileAnchorX(spawnX), tileAnchorY(spawnY), def.textureKey, 0);
    this.sprite.setOrigin(1, 1);
    if (def.scale) this.sprite.setScale(def.scale);
    this.sprite.setDepth(depthForTileY(spawnY));

    const barY = this.barY();
    const barX = this.barX();
    // Nameplate (name + HP bar) always draws above world geometry — see LABEL_DEPTH.
    this.hpBarBg = scene.add.rectangle(barX, barY, 24, 4, 0x000000, 0.6).setDepth(LABEL_DEPTH).setVisible(false);
    this.hpBarFill = scene.add.rectangle(barX, barY, 24, 4, 0xc9302f).setDepth(LABEL_DEPTH).setVisible(false);

    // Name tag: always up while the monster is alive (unlike the HP bar,
    // which only shows once damaged) — so a player can tell what they're
    // looking at before ever landing a hit.
    this.nameLabel = scene.add
      .text(barX, this.nameY(), def.name, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(LABEL_DEPTH + 1);

    // Show full and green from the start, not just once damaged — a
    // player should be able to read a monster's health at a glance the
    // moment they see it, the same way the name tag already works.
    this.updateHpBar();

    // Red outline around the sprite while this monster is the current
    // target — hidden by default, toggled by WorldScene.setTarget/clearTarget.
    // Sized from def.targetBox (the creature's actual silhouette within its
    // frame) rather than the full frame — most sheets have real transparent
    // padding around the art (a ground creature like the rat/slime doesn't
    // fill anywhere near the full frame height), so a frame-sized outline
    // reads as loose/mis-fit around the creature. syncBarPosition() (called
    // continuously during movement) keeps both size and position current
    // as facing changes, for creatures whose box differs per direction.
    this.targetFrame = scene.add
      .rectangle(0, 0, 0, 0, 0x000000, 0)
      .setStrokeStyle(2, 0xff2020, 1)
      .setDepth(8)
      .setVisible(false);
    this.syncBarPosition();
  }

  get tile(): TileCoord {
    return { x: this.tileX, y: this.tileY };
  }

  /** Every tile this creature's body actually covers right now — the front tile plus any trailing segments (see `trail`). Empty-footprint creatures just get the one. */
  occupiedTiles(): TileCoord[] {
    return [this.tile, ...this.trail];
  }

  /** Toggled by WorldScene.setTarget/clearTarget — a red outline around the sprite while this monster is the current target. */
  setTargeted(targeted: boolean) {
    this.targetFrame.setVisible(targeted);
  }

  /** Sprite origin is bottom-right (oblique-projection anchor), so the horizontal center is offset left by half the width. */
  private barX(): number {
    return this.sprite.x - this.sprite.displayWidth / 2;
  }

  /** A few px above the sprite's own top edge, so taller monsters (e.g. the troll) don't have their HP bar overlapping their head. */
  private barY(): number {
    return this.sprite.y - this.sprite.displayHeight - 6;
  }

  /** Above the HP bar's row, whether or not the bar itself is currently shown. */
  private nameY(): number {
    return this.barY() - 4;
  }

  /** Green full health down through yellow/red/deep-red at lower thresholds — a glance should tell how much danger the fight still has left. */
  private static hpBarColor(pct: number): number {
    if (pct <= 0.1) return 0x6b0f0f; // deep red
    if (pct <= 0.25) return 0xc9302f; // red
    if (pct <= 0.5) return 0xe0b93a; // yellow
    return 0x3fae4a; // green
  }

  private updateHpBar() {
    const pct = Phaser.Math.Clamp(this.hp / this.def.hp, 0, 1);
    this.hpBarFill.width = 24 * pct;
    this.hpBarFill.setFillStyle(Monster.hpBarColor(pct));
    const visible = this.alive;
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
    this.syncBarPosition();
  }

  private syncBarPosition() {
    const barY = this.barY();
    const barX = this.barX();
    this.hpBarBg.setPosition(barX, barY);
    this.hpBarFill.y = barY;
    this.hpBarFill.x = barX - (24 - this.hpBarFill.width) / 2;
    this.nameLabel.setPosition(barX, this.nameY());
    // Guarded: called once from updateHpBar() in the constructor, before
    // targetFrame exists yet — the explicit call right after creating it
    // covers that first positioning. Resized and centered on the current
    // direction's targetBox (not necessarily the full frame's center, and
    // not necessarily the same size as the last direction's box — see
    // resolveTargetBox()) every call, so it tracks facing changes too.
    const box = this.resolveTargetBox();
    const frameTopLeftX = this.sprite.x - this.sprite.displayWidth;
    const frameTopLeftY = this.sprite.y - this.sprite.displayHeight;
    this.targetFrame?.setSize(
      this.sprite.displayWidth * (box.xMax - box.xMin),
      this.sprite.displayHeight * (box.yMax - box.yMin),
    );
    this.targetFrame?.setPosition(
      frameTopLeftX + ((box.xMin + box.xMax) / 2) * this.sprite.displayWidth,
      frameTopLeftY + ((box.yMin + box.yMax) / 2) * this.sprite.displayHeight,
    );
  }

  /** def.targetBox is either one box for every direction, or a per-direction map (see the MonsterDef comment) — resolve to the box for the current facing. */
  private resolveTargetBox(): TargetBox {
    const box = this.def.targetBox;
    if (!box) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    if ("xMin" in box) return box;
    return box[this.facing] ?? { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }

  /**
   * Directional sheets (framesPerDirection set) index by facing + idle/step;
   * simple 2-frame sheets just toggle frame 0/1, flipped horizontally for
   * movement direction. A 4-pose sheet (troll: idle/stepA/stepB/attack)
   * alternates between the two dedicated step frames (1/2) once per tile
   * step, which is how that art was designed to read. A `continuousWalk`
   * sheet (no separate step-alternation/attack art — cave_rat's idle+move,
   * goblin's 6-frame walk cycle) has no fixed step frame to hold and looks
   * static/gliding if held on one frame per step; instead it plays a real,
   * continuously looping walk animation (registered in BootScene) that only
   * restarts when the facing direction actually changes, not on every step
   * boundary.
   */
  private applyFrame(idle: boolean) {
    const perDir = this.def.framesPerDirection;
    if (perDir && this.def.continuousWalk) {
      if (idle) {
        this.sprite.anims.stop();
        this.sprite.setFrame(directionalFrameIndex(this.facing, 0, perDir));
      } else {
        // Each step's completion stops the anim (idle, above) before the
        // next one starts it again — same key, so also check isPlaying, or
        // a same-direction restart after that stop would never fire and the
        // sprite would sit frozen on the idle frame forever.
        const key = walkAnimKey(this.def.textureKey, this.facing);
        if (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
      }
      return;
    }
    if (perDir) {
      const frameInDirection = idle ? 0 : this.stepToggle ? 1 : 2;
      this.sprite.setFrame(directionalFrameIndex(this.facing, frameInDirection, perDir));
    } else {
      this.sprite.setFrame(idle ? 0 : 1 % this.def.frameCount);
    }
  }

  /**
   * Hold the swing pose briefly. Only directional sheets carry an attack
   * frame; the simple two-frame creatures lunge instead, which reads well
   * enough for a rat and costs no extra art.
   */
  playAttack() {
    const perDir = this.def.framesPerDirection;
    if (perDir && perDir > ATTACK_FRAME && !this.def.continuousWalk) {
      this.sprite.setFrame(directionalFrameIndex(this.facing, ATTACK_FRAME, perDir));
      this.scene.time.delayedCall(ATTACK_POSE_MS, () => {
        if (this.alive && !this.moving) this.applyFrame(true);
      });
      return;
    }
    const restX = this.sprite.x;
    this.scene.tweens.add({
      targets: this.sprite,
      x: restX + (this.sprite.flipX ? -4 : 4),
      duration: ATTACK_POSE_MS / 2,
      yoyo: true,
      onComplete: () => {
        this.sprite.x = restX;
        this.syncBarPosition();
      },
    });
  }

  /**
   * `friction` is the ground-friction value of the destination tile (see
   * Player.stepTo) — every monster runs the same step-duration formula, just
   * fed its own def.speed instead of the player's totalSpeed(), so a rat and
   * a troll cover the same tile at their own genuinely different pace.
   */
  private stepTo(x: number, y: number, friction: number): Promise<void> {
    const dx = x - this.tileX;
    const dy = y - this.tileY;
    const diagonal = dx !== 0 && dy !== 0;
    const duration = stepDurationMs(this.def.speed, friction, diagonal);
    return new Promise((resolve) => {
      if (this.def.framesPerDirection) {
        this.facing = directionFromDelta(dx, dy, this.facing);
      } else if (dx !== 0) {
        this.sprite.setFlipX(dx < 0);
      }
      // The tile it's stepping off becomes the new front of the trail — the
      // tail follows the exact path taken, so a turn drags it around the
      // corner rather than cutting across it.
      const footprint = this.def.footprintTiles ?? 1;
      if (footprint > 1) {
        this.trail.unshift({ x: this.tileX, y: this.tileY });
        this.trail.length = footprint - 1;
      }
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
        duration,
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
    this.nameLabel.setVisible(false);
    this.targetFrame.setVisible(false);
    this.respawnTimer = MONSTER_RESPAWN_MS;
  }

  private revive() {
    this.alive = true;
    this.hp = this.def.hp;
    this.tileX = this.spawnX;
    this.tileY = this.spawnY;
    this.trail = Array.from({ length: (this.def.footprintTiles ?? 1) - 1 }, () => ({
      x: this.spawnX,
      y: this.spawnY,
    }));
    this.sprite.setPosition(tileAnchorX(this.spawnX), tileAnchorY(this.spawnY));
    this.sprite.setDepth(depthForTileY(this.spawnY));
    this.facing = "down";
    this.applyFrame(true);
    this.sprite.setVisible(true);
    this.nameLabel.setVisible(true);
    this.updateHpBar();
  }

  /**
   * Turn to look at a target tile without moving. Directional sheets swap to
   * the matching facing's idle pose (unless a swing pose is still showing, or
   * mid-step); flip-only sheets (rat/slime) just mirror left/right.
   */
  private faceToward(target: TileCoord) {
    const dx = target.x - this.tileX;
    const dy = target.y - this.tileY;
    if (dx === 0 && dy === 0) return;
    if (this.def.framesPerDirection) {
      const next = directionFromDelta(dx, dy, this.facing);
      if (next !== this.facing) {
        this.facing = next;
        if (!this.moving && this.poseTimer <= 0) this.applyFrame(true);
      }
    } else if (dx !== 0) {
      this.sprite.setFlipX(dx < 0);
    }
  }

  /**
   * Next step toward a free tile adjacent to the player (MELEE_RANGE = 1, so
   * the eight surrounding tiles), preferring the one nearest this monster and
   * skipping any it can't actually reach — this is what makes a pack surround
   * the player rather than pile onto a single approach tile. `isWalkable`
   * already treats other monsters' occupied tiles as blocked, so two monsters
   * settle on different sides. Falls back to closing on the player's own tile
   * when the ring is full or unreachable.
   */
  private surroundStep(playerTile: TileCoord, isWalkable: (x: number, y: number) => boolean): TileCoord | null {
    const ring: TileCoord[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const t = { x: playerTile.x + dx, y: playerTile.y + dy };
        if (isWalkable(t.x, t.y)) ring.push(t);
      }
    }
    ring.sort((a, b) => chebyshevDistance(this.tile, a) - chebyshevDistance(this.tile, b));
    for (const goal of ring) {
      const path = findPath(isWalkable, this.tile, goal);
      if (path.length > 0) return path[0];
    }
    const fallback = findPath(isWalkable, this.tile, playerTile);
    return fallback.length > 0 ? fallback[0] : null;
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
    onAttackPlayer: (attacker: MonsterDef) => void,
    frictionAt: (x: number, y: number) => number,
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
    this.poseTimer = Math.max(0, this.poseTimer - dtMs);
    // Closest occupied tile, not just the front one — a bear can bite from
    // its back legs' tile just as well as its head's.
    const dist = closestChebyshevDistance(playerTile, this.occupiedTiles());

    if (dist <= MELEE_RANGE) {
      // Always turn to look at the player while in melee, not just on the
      // swing tick — a player circling an adjacent monster is tracked.
      this.faceToward(playerTile);
      if (this.attackCooldown <= 0) {
        this.playAttack();
        this.poseTimer = ATTACK_POSE_MS;
        // Hit chance, damage roll, and the whole defense pipeline are the
        // world's job to resolve centrally (calculateArmorMitigation etc.
        // must not be duplicated per-attacker) — this only reports that an
        // attack is happening, with the stats it's happening with.
        onAttackPlayer(this.def);
        this.attackCooldown = this.def.attackIntervalMs;
      }
      return;
    }

    if (this.moving) return;

    this.aiTimer -= dtMs;
    if (this.aiTimer > 0) return;
    this.aiTimer = AI_TICK_MS;

    if (dist <= MONSTER_AGGRO_RANGE) {
      // Head for a free tile *beside* the player, not the player's own tile,
      // so a pack fans out and takes the ring of tiles around them instead of
      // all queuing behind each other on one approach.
      const step = this.surroundStep(playerTile, isWalkable);
      if (step) void this.stepTo(step.x, step.y, frictionAt(step.x, step.y));
    } else if (this.tileX !== this.spawnX || this.tileY !== this.spawnY) {
      const path = findPath(isWalkable, this.tile, { x: this.spawnX, y: this.spawnY });
      if (path.length > 0) void this.stepTo(path[0].x, path[0].y, frictionAt(path[0].x, path[0].y));
    }
  }

  destroy() {
    this.sprite.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.nameLabel.destroy();
    this.targetFrame.destroy();
  }
}
