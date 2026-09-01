import Phaser from "phaser";
import { TILE_SIZE, NPC_INTERACT_RANGE } from "../game/constants";
import { tileAnchorX, tileAnchorY, depthForTileY } from "../game/tileAnchor";
import { INTERIORS, InteriorRoom, InteriorNpc, isFloorTile } from "../data/interiors";
import { chebyshevDistance, TileCoord } from "../game/pathfinding";
import { Player } from "../game/entities/Player";
import { bus, EVENTS, SetMoveDirectionPayload } from "../game/events";
import { Direction, directionFromDelta, directionalFrameIndex, walkAnimKey } from "../game/directionalSprite";

const ROOM_MARGIN_TILES = 2;

/**
 * A building's interior — a small room the player has zoned into from the
 * world, or transitioned into from another interior room (via stairs).
 *
 * Data comes in via scene.launch(..., { roomId, returnTile, playerState,
 * onExit, onTransition }). WorldScene owns the outdoor player and stays
 * paused while any interior is up; interior→interior transitions restart
 * this same scene with the new roomId.
 */

interface InteriorInit {
  roomId: string;
  /** Tile in the outdoor world to return the player to on exit. */
  returnTile: { x: number; y: number };
  /** Optional override for the player's spawn tile inside the room. */
  spawn?: { x: number; y: number };
  /** Snapshot of the player so we can rebuild them here without cloning sprites. */
  playerState: {
    vocation: string;
    exp: number;
    hp: number;
    mana: number;
  };
  /** Called with final HP/mana when the interior exits back to the world. */
  onExit: (finalState: { hp: number; mana: number }) => void;
}

const CH_WALL = "W";
const CH_COUNTER = "C";
const CH_DOOR = "D";
const CH_STAIRS_UP = "U";
const CH_STAIRS_DOWN = "d";
const CH_DEPOT = "X";

/** How a room's floor/walls are dressed. Only the named shops + the bank got the real wood set; only the temple got the real stone set. */
type WallStyle = "stone" | "wood-panel" | "plain";

// Five floor planks that are all the same style (only shade/wear differs), so
// they're picked per-cell like an outdoor grass variant — never a jarring mix.
const SHOP_FLOOR_VARIANTS = [
  "shop-wood-floor-basic",
  "shop-wood-floor-light",
  "shop-wood-floor-dark",
  "shop-wood-floor-staggered",
  "shop-wood-floor-worn",
];

// Six flagstone tiles, same shared-pool idea as the shop floor — but unlike
// that set, two of these six (5 and 6) are noticeably darker/lighter than
// the rest rather than just a different crack pattern, so picking all six
// with equal odds read as a distracting checkerboard rather than a worn
// stone floor. Entries are repeated to weight the pick instead: the four
// even-toned tiles at 3x, the two standout ones at 1x, so 5/6 show up as an
// occasional worn/lit flagstone rather than every few tiles.
const TEMPLE_FLOOR_VARIANTS = [
  "temple-stone-floor-1",
  "temple-stone-floor-1",
  "temple-stone-floor-1",
  "temple-stone-floor-2",
  "temple-stone-floor-2",
  "temple-stone-floor-2",
  "temple-stone-floor-3",
  "temple-stone-floor-3",
  "temple-stone-floor-3",
  "temple-stone-floor-4",
  "temple-stone-floor-4",
  "temple-stone-floor-4",
  "temple-stone-floor-5",
  "temple-stone-floor-6",
];

function interiorCellHash(x: number, y: number): number {
  return Math.abs(Math.imul(x * 374761393 + y * 668265263, 1274126177)) >>> 0;
}

export class InteriorScene extends Phaser.Scene {
  private room!: InteriorRoom;
  private roomW = 0;
  private roomH = 0;
  private tileOffsetX = 0;
  private tileOffsetY = 0;
  private initData!: InteriorInit;

  private player!: Player;
  private npcSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null = null;
  /**
   * State for a directional (spritesheet) NPC — tracks facing, the tile the
   * NPC is currently standing on (may differ from its data-file spawn if it
   * has wandered), a cooldown counter for the next wander step, and whether
   * a wander step tween is currently in flight. Undefined for static NPCs.
   */
  private npcAi: {
    def: InteriorNpc;
    facing: Direction;
    tileX: number;
    tileY: number;
    /** Ambient-wander cooldown in ms — the NPC only considers stepping once this drops to ≤0. */
    wanderCooldown: number;
    /** True while a step tween is animating so we don't kick a second one. */
    stepping: boolean;
    /** True while a dialogue is open — freezes wander and faces the player. */
    conversing: boolean;
  } | null = null;
  /** Direction held on the on-screen D-pad — the only way to move now. */
  private heldDirection: TileCoord | null = null;
  private transitionScheduled = false;

  constructor() {
    super("Interior");
  }

  init(data: InteriorInit) {
    this.initData = data;
    this.transitionScheduled = false;
    this.heldDirection = null;
  }

  create() {
    const room = INTERIORS[this.initData.roomId];
    if (!room) {
      this.exitToWorld();
      return;
    }
    this.room = room;
    this.roomW = room.rows[0].length;
    this.roomH = room.rows.length;

    const worldSize = {
      w: (this.roomW + ROOM_MARGIN_TILES * 2) * TILE_SIZE,
      h: (this.roomH + ROOM_MARGIN_TILES * 2) * TILE_SIZE,
    };
    this.tileOffsetX = ROOM_MARGIN_TILES;
    this.tileOffsetY = ROOM_MARGIN_TILES;

    this.cameras.main.setBackgroundColor("#0a0a0a");
    this.cameras.main.setBounds(0, 0, worldSize.w, worldSize.h);
    this.cameras.main.centerOn(worldSize.w / 2, worldSize.h / 2);
    this.applyZoom(worldSize);

    // Always hide World while we're up. Belt-and-braces: setVisible works for
    // the initial launch but Phaser's scene.restart appears to re-show a
    // sibling scene, so we also lay a black backdrop underneath everything
    // in the interior at scroll-factor 0 to cover anything that leaks
    // through around the room.
    this.scene.setVisible(false, "World");
    const backdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0a0a0a)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-1000);
    this.scale.on("resize", () => backdrop.setSize(this.scale.width, this.scale.height));

    const wallStyle = this.roomWallStyle();

    // Paint the room, tile by tile. Every cell gets a floor, then walls,
    // counter or stairs sit on top of it as their own sprites.
    for (let y = 0; y < this.roomH; y++) {
      for (let x = 0; x < this.roomW; x++) {
        const ch = room.rows[y][x];
        const wx = this.tileWorldX(x);
        const wy = this.tileWorldY(y);
        const worldTileY = y + this.tileOffsetY;
        // Floor beneath every cell — the real stone set in the church/
        // temple, the real wood-plank set in the shops/bank, the old flat
        // plank everywhere else (currently just the depot). Walls draw over
        // their own base so the wall has something to hide under its
        // silhouette.
        const floorKey =
          wallStyle === "stone"
            ? this.templeFloorVariant(x, y)
            : wallStyle === "wood-panel"
              ? this.shopFloorVariant(x, y)
              : "wood-floor";
        this.add.image(wx, wy, floorKey).setOrigin(0, 0).setDepth(0);
        if (ch === CH_WALL) {
          if (wallStyle === "wood-panel") {
            const wall = this.shopWallTextureFor(x, y);
            this.add
              .image(wx, wy, wall.key)
              .setOrigin(0, 0)
              .setFlipY(wall.flipY)
              .setDepth(depthForTileY(worldTileY));
          } else if (wallStyle === "stone") {
            const wall = this.templeWallTextureFor(x, y);
            this.add
              .image(wx, wy, wall.key)
              .setOrigin(0, 0)
              .setFlipX(wall.flipX)
              .setFlipY(wall.flipY)
              .setDepth(depthForTileY(worldTileY));
          } else {
            this.add.image(wx, wy, "stone-wall").setOrigin(0, 0).setDepth(depthForTileY(worldTileY));
          }
        } else if (ch === CH_COUNTER) {
          this.add
            .image(tileAnchorX(x + this.tileOffsetX), tileAnchorY(worldTileY), this.shopCounterTextureFor(x, y))
            .setOrigin(1, 1)
            .setDepth(depthForTileY(worldTileY));
        }
        // CH_DOOR / CH_STAIRS_UP / CH_STAIRS_DOWN don't draw here — they're
        // added by the room's own `decor` list where a visible prop is
        // wanted (e.g. the stairs sprite over a U tile).
      }
    }

    for (const decor of room.decor) {
      this.add
        .image(tileAnchorX(decor.x + this.tileOffsetX), tileAnchorY(decor.y + this.tileOffsetY), decor.textureKey)
        .setOrigin(1, 1)
        .setDepth(depthForTileY(decor.y + this.tileOffsetY));
    }

    if (room.npc) {
      const npc = room.npc;
      const worldX = tileAnchorX(npc.x + this.tileOffsetX);
      const worldY = tileAnchorY(npc.y + this.tileOffsetY);
      if (npc.directional) {
        // Directional sprite: 4×N frames, initial pose is idle-frame of
        // whatever direction the room says the NPC starts facing.
        const facing: Direction = npc.directional.initialFacing ?? "down";
        const idleFrame = directionalFrameIndex(facing, 1, npc.directional.framesPerDirection);
        this.npcSprite = this.add
          .sprite(worldX, worldY, npc.textureKey, idleFrame)
          .setOrigin(1, 1)
          .setScale(npc.directional.scale ?? 1)
          .setDepth(depthForTileY(npc.y + this.tileOffsetY))
          .setInteractive({ useHandCursor: true });
        // Shop NPCs render at 48 px on screen (32-art × 1.5 scale, or
        // 48-art × 1). Either way the SCALED sprite is wider than one tile,
        // so origin (1,1) leaves the extra width hanging LEFT of the tile.
        // Shift right by half that overhang so the silhouette centres over
        // the tile column (mirrors Player.ts's PLAYER_ANCHOR_OFFSET).
        this.npcSprite.x += (this.npcSprite.displayWidth - TILE_SIZE) / 2;
        this.npcAi = {
          def: npc,
          facing,
          tileX: npc.x + this.tileOffsetX,
          tileY: npc.y + this.tileOffsetY,
          wanderCooldown: 1800 + Math.random() * 1200,
          stepping: false,
          conversing: false,
        };
      } else {
        this.npcSprite = this.add
          .image(worldX, worldY, npc.textureKey)
          .setOrigin(1, 1)
          .setDepth(depthForTileY(npc.y + this.tileOffsetY))
          .setInteractive({ useHandCursor: true });
      }
      this.npcSprite.on("pointerdown", () => this.talkToNpc());
    }

    const spawn = this.initData.spawn ?? room.spawn;
    const spawnWorld = {
      x: spawn.x + this.tileOffsetX,
      y: spawn.y + this.tileOffsetY,
    };
    this.player = new Player(this, spawnWorld.x, spawnWorld.y, {
      vocation: this.initData.playerState.vocation as never,
      exp: this.initData.playerState.exp,
    });
    this.player.hp = this.initData.playerState.hp;
    this.player.mana = this.initData.playerState.mana;

    const onMoveDirection = (payload: SetMoveDirectionPayload) => {
      this.heldDirection = payload.dx === 0 && payload.dy === 0 ? null : { x: payload.dx, y: payload.dy };
    };
    bus.on(EVENTS.SET_MOVE_DIRECTION, onMoveDirection);

    // Tell the UI we're indoors — it hides the action bar and anything else
    // that would clutter or overlap the tiny interior room.
    bus.emit(EVENTS.INTERIOR_STATE, { active: true });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      bus.off(EVENTS.SET_MOVE_DIRECTION, onMoveDirection);
      // Only broadcast "back outside" if we're actually exiting to the
      // world; a room-to-room transition (SHUTDOWN + create) keeps the
      // action bar hidden by re-emitting active:true in the new create.
    });
    this.scale.on("resize", () => this.applyZoom(worldSize));
  }

  /** Which floor/wall dressing a room gets: stone (temple), the new wood-panel set (shops + bank), or the old flat plank (everything else — currently just the depot). */
  private roomWallStyle(): WallStyle {
    if (this.room.id.startsWith("temple_")) return "stone";
    if (["melee_shop", "ranged_shop", "bank", "magic_shop", "general_store"].includes(this.room.id)) return "wood-panel";
    return "plain";
  }

  /** One of five compatible plank shades, picked per-cell so the floor doesn't look like one tile stamped on repeat. */
  private shopFloorVariant(x: number, y: number): string {
    return SHOP_FLOOR_VARIANTS[interiorCellHash(x, y) % SHOP_FLOOR_VARIANTS.length];
  }

  /**
   * The room's walls are always a plain rectangular perimeter, so every W
   * cell is exactly one of: a corner, a top/bottom/left/right edge segment.
   * Each direction has its own tile (N/S/E/W) and each outer corner is its
   * own composed piece (corner-NW/NE/SW/SE) — the corner tiles are stitched
   * from the same straight-wall bands the edges use, mitered at 45°, so
   * every wall/corner join lands on matching pixels with no stagger.
   */
  private shopWallTextureFor(x: number, y: number): { key: string; flipY: boolean } {
    const isTop = y === 0;
    const isBottom = y === this.roomH - 1;
    const isLeft = x === 0;
    const isRight = x === this.roomW - 1;
    if (isTop && isLeft) return { key: "shop-wall-corner-NW", flipY: false };
    if (isTop && isRight) return { key: "shop-wall-corner-NE", flipY: false };
    if (isBottom && isLeft) return { key: "shop-wall-corner-SW", flipY: false };
    if (isBottom && isRight) return { key: "shop-wall-corner-SE", flipY: false };
    if (isTop) return { key: "shop-wall-N", flipY: false };
    if (isBottom) return { key: "shop-wall-S", flipY: false };
    if (isLeft) return { key: "shop-wall-W", flipY: false };
    if (isRight) return { key: "shop-wall-E", flipY: false };
    // Rectangular shops don't have interior wall cells, but if one ever gets
    // added the north-edge tile is a safe generic wall body.
    return { key: "shop-wall-N", flipY: false };
  }

  /** The counter is a run of consecutive "C" cells in one row — left/right end caps at the run's edges, center tiled between them. */
  private shopCounterTextureFor(x: number, y: number): string {
    const row = this.room.rows[y];
    const first = row.indexOf(CH_COUNTER);
    const last = row.lastIndexOf(CH_COUNTER);
    if (x === first) return "shop-counter-left";
    if (x === last) return "shop-counter-right";
    return "shop-counter-center";
  }

  /** One of six compatible flagstone tiles (a couple carry a subtle crack), picked per-cell like the shop floor. */
  private templeFloorVariant(x: number, y: number): string {
    return TEMPLE_FLOOR_VARIANTS[interiorCellHash(x, y) % TEMPLE_FLOOR_VARIANTS.length];
  }

  /**
   * Same plain-rectangle-perimeter reasoning as shopWallTextureFor, but only
   * one corner piece shipped this time (a top-left shape: trim across the
   * top, trim down the left) — so the other three corners reuse it mirrored
   * horizontally and/or vertically instead of needing four separate pieces.
   */
  private templeWallTextureFor(x: number, y: number): { key: string; flipX: boolean; flipY: boolean } {
    const isTop = y === 0;
    const isBottom = y === this.roomH - 1;
    const isLeft = x === 0;
    const isRight = x === this.roomW - 1;
    if (isTop && isLeft) return { key: "temple-wall-corner", flipX: false, flipY: false };
    if (isTop && isRight) return { key: "temple-wall-corner", flipX: true, flipY: false };
    if (isBottom && isLeft) return { key: "temple-wall-corner", flipX: false, flipY: true };
    if (isBottom && isRight) return { key: "temple-wall-corner", flipX: true, flipY: true };
    if (isTop) return { key: "temple-wall-top", flipX: false, flipY: false };
    if (isBottom) return { key: "temple-wall-bottom", flipX: false, flipY: false };
    if (isLeft) return { key: "temple-wall-left", flipX: false, flipY: false };
    if (isRight) return { key: "temple-wall-right", flipX: false, flipY: false };
    return { key: "temple-wall-top", flipX: false, flipY: false };
  }

  private applyZoom(worldSize: { w: number; h: number }) {
    const zoomX = this.scale.width / worldSize.w;
    const zoomY = this.scale.height / worldSize.h;
    const zoom = Math.max(1, Math.min(zoomX, zoomY, 4));
    this.cameras.main.setZoom(zoom);
  }

  // --- Movement & interaction --------------------------------------------

  /** Diagonal corner-cutting is blocked exactly like the outdoor world's rule — never squeeze between two solid tiles. */
  private canStepInDirection(dir: TileCoord): boolean {
    const next = { x: this.player.tileX + dir.x, y: this.player.tileY + dir.y };
    if (!this.isWalkableWorld(next.x, next.y)) return false;
    if (dir.x !== 0 && dir.y !== 0) {
      if (!this.isWalkableWorld(this.player.tileX + dir.x, this.player.tileY)) return false;
      if (!this.isWalkableWorld(this.player.tileX, this.player.tileY + dir.y)) return false;
    }
    return true;
  }

  update(_time: number, delta: number) {
    if (this.transitionScheduled) return;
    this.updateNpc(delta);
    if (this.player.moving) return;
    this.checkTransition();
    if (!this.heldDirection || !this.canStepInDirection(this.heldDirection)) return;
    const next = { x: this.player.tileX + this.heldDirection.x, y: this.player.tileY + this.heldDirection.y };
    // Interior floors are always cobble/plank — friction 100, same as a
    // town street. Interiors don't need per-tile friction lookup.
    void this.player.stepTo(next.x, next.y, 100).then(() => this.checkTransition());
  }

  /**
   * Ambient behaviour for a directional NPC:
   *  - if the player is within talking range, the NPC freezes at its current
   *    tile and turns to face the player, so a shopkeeper never wanders mid-
   *    dialogue or presents their back to a customer
   *  - otherwise, if the NPC wanders, it takes 1-tile steps around its spawn
   *    with an idle pause between steps ("one left, idle, one right, idle…")
   *    staying within a 2-tile radius so it never drifts across the room
   */
  private updateNpc(delta: number) {
    const ai = this.npcAi;
    if (!ai) return;
    const inTalkRange = chebyshevDistance(
      { x: this.player.tileX, y: this.player.tileY },
      { x: ai.tileX, y: ai.tileY },
    ) <= NPC_INTERACT_RANGE;
    if (inTalkRange) {
      ai.conversing = true;
      // Face the player. If the player is standing on the NPC's own tile
      // (shouldn't happen — NPC blocks it — but be defensive) keep facing.
      const dx = this.player.tileX - ai.tileX;
      const dy = this.player.tileY - ai.tileY;
      if (dx !== 0 || dy !== 0) this.setNpcFacing(directionFromDelta(dx, dy, ai.facing));
      return;
    }
    if (ai.conversing) {
      // Just left talking range — reset the wander cooldown so the shopkeeper
      // doesn't instantly step the moment the player walks away.
      ai.conversing = false;
      ai.wanderCooldown = 900 + Math.random() * 900;
    }
    if (!ai.def.directional?.wanders || ai.stepping) return;
    ai.wanderCooldown -= delta;
    if (ai.wanderCooldown > 0) return;
    this.tryWanderStep();
    ai.wanderCooldown = 1500 + Math.random() * 2200;
  }

  private setNpcFacing(direction: Direction) {
    const ai = this.npcAi;
    if (!ai || !ai.def.directional) return;
    if (ai.facing === direction) return;
    ai.facing = direction;
    if (this.npcSprite instanceof Phaser.GameObjects.Sprite) {
      const idleFrame = directionalFrameIndex(direction, 1, ai.def.directional.framesPerDirection);
      this.npcSprite.stop();
      this.npcSprite.setFrame(idleFrame);
    }
  }

  /**
   * Pick a random adjacent walkable tile within the wander radius and step
   * the NPC onto it. The step tween mirrors the player's own step feel
   * (roughly a tile-time at friction 100) and plays the NPC's per-direction
   * walk animation for the duration; a completed step lands on the new
   * tile's idle frame.
   */
  private tryWanderStep() {
    const ai = this.npcAi;
    if (!ai || !ai.def.directional || !this.npcSprite) return;
    if (!(this.npcSprite instanceof Phaser.GameObjects.Sprite)) return;
    const spawnX = ai.def.x + this.tileOffsetX;
    const spawnY = ai.def.y + this.tileOffsetY;
    const WANDER_RADIUS = 2;
    const dirs: Array<[number, number, Direction]> = [
      [ 0,  1, "down"],
      [ 0, -1, "up"],
      [ 1,  0, "right"],
      [-1,  0, "left"],
    ];
    // Shuffle so the choice is random each tick
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy, dir] of dirs) {
      const nx = ai.tileX + dx;
      const ny = ai.tileY + dy;
      if (Math.abs(nx - spawnX) > WANDER_RADIUS) continue;
      if (Math.abs(ny - spawnY) > WANDER_RADIUS) continue;
      if (!this.isWalkableWorld(nx, ny)) continue;
      this.stepNpcTo(nx, ny, dir);
      return;
    }
    // No valid neighbor — just idle, but still update facing so the shop-
    // keeper occasionally turns to look elsewhere even when boxed in.
    const [, , dir] = dirs[0];
    this.setNpcFacing(dir);
  }

  private stepNpcTo(tileX: number, tileY: number, direction: Direction) {
    const ai = this.npcAi;
    if (!ai || !ai.def.directional) return;
    const sprite = this.npcSprite;
    if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;
    ai.stepping = true;
    ai.tileX = tileX;
    ai.tileY = tileY;
    ai.facing = direction;
    // Play the per-direction walk anim while the tween runs, then hold the
    // idle frame of the new facing when the step completes.
    sprite.play(walkAnimKey(ai.def.textureKey, direction));
    // See create() — wider-than-tile sprites get shifted right by half the
    // overhang so the silhouette centres over the tile; the wander step
    // target has to keep that same offset or the NPC would drift left over
    // time (each new step tile would re-anchor at the raw tile edge).
    const anchorOffset = (sprite.displayWidth - TILE_SIZE) / 2;
    const targetX = tileAnchorX(tileX) + anchorOffset;
    const targetY = tileAnchorY(tileY);
    // Match the player's own step duration at friction 100 for a shared
    // sense of pace inside the shop.
    const STEP_MS = 360;
    this.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      duration: STEP_MS,
      ease: "Linear",
      onUpdate: () => sprite.setDepth(depthForTileY(tileY)),
      onComplete: () => {
        ai.stepping = false;
        sprite.stop();
        sprite.setFrame(directionalFrameIndex(direction, 1, ai.def.directional!.framesPerDirection));
        sprite.setDepth(depthForTileY(tileY));
      },
    });
  }

  /** After each step, decide whether the tile the player just landed on triggers a transition. */
  private checkTransition() {
    const localX = this.player.tileX - this.tileOffsetX;
    const localY = this.player.tileY - this.tileOffsetY;
    if (localY < 0 || localY >= this.roomH || localX < 0 || localX >= this.roomW) return;
    const ch = this.room.rows[localY][localX];

    if (ch === CH_DOOR) {
      this.exitToWorld();
      return;
    }
    if (ch === CH_STAIRS_UP && this.room.stairsUp) {
      this.transitionToRoom(this.room.stairsUp.toRoomId, this.room.stairsUp.spawn);
      return;
    }
    if (ch === CH_STAIRS_DOWN && this.room.stairsDown) {
      this.transitionToRoom(this.room.stairsDown.toRoomId, this.room.stairsDown.spawn);
      return;
    }
    if (ch === CH_DEPOT) {
      // Ask the outdoor world (which owns the real player instance) to open
      // the player's depot container in the sidebar. Emitting once per step
      // is fine — WorldScene ignores a duplicate open of the same container.
      bus.emit(EVENTS.OPEN_DEPOT, {});
      return;
    }
  }

  /** Move to another interior room, keeping the outdoor return tile and player state. */
  private transitionToRoom(toRoomId: string, spawn: { x: number; y: number }) {
    if (this.transitionScheduled) return;
    this.transitionScheduled = true;
    const nextInit: InteriorInit = {
      roomId: toRoomId,
      returnTile: this.initData.returnTile,
      spawn,
      playerState: {
        vocation: this.initData.playerState.vocation,
        exp: this.initData.playerState.exp,
        hp: this.player.hp,
        mana: this.player.mana,
      },
      onExit: this.initData.onExit,
    };
    // Restart in place: Phaser tears down and reboots this scene with the
    // new init data. Simpler than stop-then-launch, and it keeps the scene
    // lifecycle strictly serial.
    this.scene.restart(nextInit);
  }

  private exitToWorld() {
    if (this.transitionScheduled) return;
    this.transitionScheduled = true;
    this.initData.onExit({ hp: this.player.hp, mana: this.player.mana });
    bus.emit(EVENTS.INTERIOR_STATE, { active: false });
    this.scene.stop("Interior");
    this.scene.resume("World");
    this.scene.setVisible(true, "World");
  }

  private talkToNpc() {
    if (!this.room.npc) return;
    const npc = this.room.npc;
    // Use the NPC's CURRENT tile if it wanders (npcAi tracks it); otherwise
    // the static spawn tile from the room def. Without this, a wandered
    // shopkeeper's tap-to-talk still measures range from the old spawn tile.
    const npcTile = this.npcAi
      ? { x: this.npcAi.tileX, y: this.npcAi.tileY }
      : { x: npc.x + this.tileOffsetX, y: npc.y + this.tileOffsetY };
    if (chebyshevDistance(this.player.tile, npcTile) > NPC_INTERACT_RANGE) {
      bus.emit(EVENTS.LOG, { kind: "info", text: `Walk closer to talk to ${npc.name}.` });
      return;
    }
    bus.emit(EVENTS.OPEN_DIALOGUE, {
      npcId: npc.id,
      npcName: npc.name,
      textureKey: npc.textureKey,
      role: npc.role,
      greeting: npc.greeting,
      about: npc.about,
    });
  }

  // --- Grid helpers -------------------------------------------------------

  private tileWorldX(localX: number): number {
    return (localX + this.tileOffsetX) * TILE_SIZE;
  }

  private tileWorldY(localY: number): number {
    return (localY + this.tileOffsetY) * TILE_SIZE;
  }

  private isWalkableWorld(worldTileX: number, worldTileY: number): boolean {
    const localX = worldTileX - this.tileOffsetX;
    const localY = worldTileY - this.tileOffsetY;
    if (localY < 0 || localY >= this.roomH || localX < 0 || localX >= this.roomW) return false;
    const ch = this.room.rows[localY][localX];
    if (!isFloorTile(ch)) return false;
    // NPC blocks its current tile. Directional NPCs may have wandered off the
    // spawn tile, so we check the live position tracked in npcAi first;
    // static NPCs use the room-def spawn.
    if (this.npcAi) {
      if (this.npcAi.tileX === worldTileX && this.npcAi.tileY === worldTileY) return false;
    } else if (this.room.npc && this.room.npc.x === localX && this.room.npc.y === localY) {
      return false;
    }
    // A wandering NPC's step target also can't be the player's own tile.
    if (this.player && this.player.tileX === worldTileX && this.player.tileY === worldTileY) return false;
    for (const d of this.room.decor) {
      if (d.blocks && d.x === localX && d.y === localY) return false;
    }
    return true;
  }
}

// Silence unused-import warnings.
void isFloorTile;
