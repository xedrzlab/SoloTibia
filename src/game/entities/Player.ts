import Phaser from "phaser";
import { BASE_SPEED, BASE_STEP_MS, SPEED_PER_LEVEL, TILE_SIZE, stepDurationMs as sharedStepDurationMs } from "../constants";
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
import { CombatStance, SkillSet } from "../skills";
import { Equipment } from "../equipment";
import { Container, createStack } from "../containers";
import { Direction, directionFromDelta, directionalFrameIndex, walkAnimKey } from "../directionalSprite";

// player_base_sheet.png is real art: a 4-frame walk cycle per direction with
// no dedicated standing-still or weapon-swing pose — frame 0 is used as the
// idle/rest pose, frames 1-3 play as a real looping animation (registered in
// BootScene) while moving, same treatment as the goblin/bear's
// continuousWalk monsters — holding a single frame for the whole tile-step
// tween reads as gliding with no leg motion, especially at low move speed
// where a step tween can take several hundred ms.
const PLAYER_FRAMES_PER_DIRECTION = 4;
/** Sprite scale multiplier — same knob Monster.ts uses per-monster, applied here for the player's own bump in size. */
const PLAYER_SCALE = 1.5;
/**
 * Horizontal centering. tileAnchorX (origin (1,1), the shared "leaning"
 * anchor every tall sprite uses — see tileAnchor.ts) pins the sprite's
 * right edge to the tile's right edge, so a sprite wider than one tile
 * (the character is, once scaled by PLAYER_SCALE) hangs its extra width
 * entirely to the left. The character's opaque pixels are horizontally
 * centered in their 32px frame, so we shift right by half the scale-added
 * width to re-center that silhouette over the tile column. Applied to X
 * only (see spriteAnchorY for the vertical rule).
 */
const PLAYER_ANCHOR_OFFSET = ((PLAYER_SCALE - 1) * TILE_SIZE) / 2;
/**
 * The row, in the unscaled 32px frame, the character's boots rest on — the
 * bbox bottom of the art (feet occupy up to row 29 in every frame, so the
 * floor line is ~30). Used to seat the FEET on the tile rather than the
 * frame, per spriteAnchorY.
 */
const PLAYER_FOOT_ROW = 30;
/** Gap from the scaled frame's bottom edge up to the feet, in screen px. */
const PLAYER_FEET_FROM_BOTTOM = (TILE_SIZE - PLAYER_FOOT_ROW) * PLAYER_SCALE;
/**
 * Small downward nudge so the feet sit just below the tile's exact centre
 * (in the lower half of the tile) rather than dead-centre — reads as more
 * grounded without letting the boots spill into the tile below.
 */
const PLAYER_FOOT_NUDGE = 5;
/** How long the attack lunge is held — no swing pose to hold instead (see comment above). */
const ATTACK_POSE_MS = 180;

/** Base swing/shot interval in ms, before any gear or skill adjustment. */
export const BASE_ATTACK_INTERVAL_MS = 2000;

export class Player {
  sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  facing: Direction = "down";
  moving = false;

  vocation: Vocation = "none";
  /** Full Attack/Balanced/Full Defense — scales only the skill x weapon-attack term of the damage formula. */
  combatStance: CombatStance = "attack";
  /**
   * Percentage (0-1) physical damage reduction, applied after ARM in the
   * defense pipeline — kept as a distinct stat per the design doc, even
   * though no equipment grants it yet (always 0 today). A hook for future
   * items, not a currently-tuned stat.
   */
  physicalResistance = 0;
  level = 1;
  exp = 0;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  maxCapacity: number;

  readonly skills = new SkillSet();
  readonly equipment = new Equipment();
  /**
   * The player's private depot — a large container the depot chests open
   * onto. Persistent for the session (in-memory); a follow-up pass can save
   * it to the character profile so it survives logout.
   */
  readonly depot = new Container("Depot", "chest", 24);
  private silhouette!: Phaser.GameObjects.Sprite;

  attackIntervalMs = BASE_ATTACK_INTERVAL_MS;
  attackCooldown = 0;

  /** Heal-over-time owed from eaten food (cheese etc.) — see addFoodRegen(). */
  foodRegenAmountRemaining = 0;
  foodRegenMsRemaining = 0;

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
      this.spriteAnchorX(tileX),
      this.spriteAnchorY(tileY),
      "player",
      directionalFrameIndex("down", 0, PLAYER_FRAMES_PER_DIRECTION),
    );
    this.sprite.setOrigin(1, 1);
    this.sprite.setScale(PLAYER_SCALE);
    this.sprite.setDepth(depthForTileY(tileY));

    // A silhouette cast one pixel down-right, behind the body. Two jobs: it
    // follows the world's upper-left light like every other shadow, and it
    // keeps the player separable from the ground they're standing on —
    // plate armour on the cobbled plaza is grey on grey without it, and the
    // player has to stay the easiest figure on screen to find.
    this.silhouette = scene.add
      .sprite(this.sprite.x + 1, this.sprite.y + 1, "player", this.sprite.frame.name)
      .setOrigin(1, 1)
      .setScale(PLAYER_SCALE)
      .setTint(0x000000)
      .setAlpha(0.4)
      .setDepth(this.sprite.depth - 0.05);
  }

  /**
   * Keep the silhouette shadow on the body: same position, frame and sort
   * order. Equipment doesn't render on the character (see items.ts), so
   * this is the only thing that needs to ride along with the body sprite.
   */
  private syncSilhouette() {
    this.silhouette.setPosition(this.sprite.x + 1, this.sprite.y + 1);
    this.silhouette.setFrame(this.sprite.frame.name);
    this.silhouette.setDepth(this.sprite.depth - 0.05);
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
  }

  /** Root of the inventory tree — null only if the backpack slot is emptied. */
  get backpack(): Container | null {
    return this.equipment.backpack;
  }

  get tile(): { x: number; y: number } {
    return { x: this.tileX, y: this.tileY };
  }

  /** Where the sprite itself (not the logical tile — see PLAYER_ANCHOR_OFFSET) should render for a given tile. */
  private spriteAnchorX(tileX: number): number {
    return tileAnchorX(tileX) + PLAYER_ANCHOR_OFFSET;
  }

  private spriteAnchorY(tileY: number): number {
    // Seat the FEET on the tile's centre, not the frame's bottom on the
    // tile's bottom. The body is taller than one tile and is meant to
    // overhang upward into the tiles above; what has to land squarely on
    // each destination tile is the feet, in the middle of its 32x32 square.
    // origin is (1,1), so sprite.y is the frame's bottom edge: back off half
    // a tile to reach the tile centre, then down by the frame-bottom-to-feet
    // gap so the feet (not the empty rows below them) hit that centre.
    return tileAnchorY(tileY) - TILE_SIZE / 2 + PLAYER_FEET_FROM_BOTTOM + PLAYER_FOOT_NUDGE;
  }

  setFacing(dx: number, dy: number) {
    this.facing = directionFromDelta(dx, dy, this.facing);
  }

  /**
   * `stepDurationMs` is the current tile-step's own tween duration — the
   * walk cycle is timed to that (not a fixed frame rate) so the walk
   * sequence plays out as exactly one cycle per tile-step, old-Tibia style:
   * legs never run ahead of or lag behind the body's actual travel time,
   * whether that's a slow level-1 step or a fast high-level/cobble one.
   * Unused (and omittable) on the idle branch.
   */
  private applyFrame(idle: boolean, stepDurationMs?: number) {
    if (idle) {
      this.sprite.anims.stop();
      this.sprite.setFrame(directionalFrameIndex(this.facing, 0, PLAYER_FRAMES_PER_DIRECTION));
    } else {
      // Every step (re)plays from the start, at that step's own duration —
      // never left looping or mid-cycle from the previous step, since the
      // next tile can have a different friction/diagonal and so a
      // different duration.
      //
      // Passing `duration` alone does NOT work here: BootScene registers
      // this animation with an explicit frameRate, and Phaser's
      // AnimationState.play() resolves a missing `frameRate` in the play
      // config by falling back to the anim's own registered frameRate
      // (Animation.calculateDuration always lets a non-null frameRate win
      // over duration, even a duration given in the same call) — so the
      // fixed 5fps/600ms cycle silently kept running regardless of this
      // step's real length. Compute frameRate directly instead: BootScene's
      // PLAYER_WALK_SEQUENCE (1,2,3,2 — 4 entries) evenly spanning
      // stepDurationMs, no fallback ambiguity.
      const key = walkAnimKey("player", this.facing);
      const frameRate = 4000 / (stepDurationMs || BASE_STEP_MS);
      this.sprite.anims.play({ key, frameRate, repeat: 0 });
    }
    this.syncSilhouette();
  }

  /**
   * No dedicated swing pose exists (see the frame-layout comment up top), so
   * an attack lunges forward and back instead — same fallback Monster.ts
   * uses for creatures without an attack frame.
   */
  playAttack() {
    const restX = this.sprite.x;
    this.scene.tweens.add({
      targets: this.sprite,
      x: restX + (this.facing === "left" ? -4 : 4),
      duration: ATTACK_POSE_MS / 2,
      yoyo: true,
      onUpdate: () => this.syncSilhouette(),
      onComplete: () => {
        this.sprite.x = restX;
        this.syncSilhouette();
      },
    });
  }

  /**
   * Current effective movement speed, used by the step-duration formula.
   * Simplified from Tibia's TFS default: BASE_SPEED + 2 * (level - 1) plus a
   * flat item bonus derived from worn equipment (nothing today; the equipment
   * system exposes this through Player.speedBonus if the caller wants to
   * override).
   */
  totalSpeed(): number {
    return BASE_SPEED + SPEED_PER_LEVEL * (this.level - 1);
  }

  stepDurationMs(friction: number, diagonal: boolean): number {
    return sharedStepDurationMs(this.totalSpeed(), friction, diagonal);
  }

  /**
   * Animate one tile step; resolves once the tween completes. `friction` is
   * the ground-friction value of the destination tile (grass 150, cobble 100,
   * water 250, etc.). When the caller can't produce a friction (interior
   * scene without a tilemap of its own), the flat BASE_STEP_MS fallback is
   * used — which lines up with roughly level-1-on-grass.
   */
  stepTo(x: number, y: number, friction?: number): Promise<void> {
    return new Promise((resolve) => {
      const dx = x - this.tileX;
      const dy = y - this.tileY;
      const diagonal = dx !== 0 && dy !== 0;
      const duration = friction === undefined ? BASE_STEP_MS : this.stepDurationMs(friction, diagonal);
      const fromY = this.tileY;
      this.setFacing(dx, dy);
      this.tileX = x;
      this.tileY = y;
      this.moving = true;
      this.applyFrame(false, duration);
      this.scene.tweens.add({
        targets: this.sprite,
        x: this.spriteAnchorX(x),
        y: this.spriteAnchorY(y),
        duration,
        // Depth tracks the tween's own progress (not the destination tile,
        // set up front) — moving up would otherwise drop the depth before
        // the sprite visually leaves its old row, so for the whole step it
        // renders as if already behind whatever's on the row it hasn't
        // reached yet, reading as a shadow passing over the character.
        onUpdate: (tween) => {
          this.sprite.setDepth(depthForTileY(fromY + (y - fromY) * tween.progress));
          this.syncSilhouette(); // shadow rides the tween with the body
        },
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

  /** Queue food's heal-over-time: stacks with whatever's already owed rather than replacing it. */
  addFoodRegen(totalHeal: number, durationMs: number) {
    this.foodRegenAmountRemaining += totalHeal;
    this.foodRegenMsRemaining += durationMs;
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
    this.sprite.x = this.spriteAnchorX(x);
    this.sprite.y = this.spriteAnchorY(y);
    this.sprite.setDepth(depthForTileY(y));
    this.syncSilhouette();
  }
}
