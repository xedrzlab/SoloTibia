import Phaser from "phaser";
import { TILE_SIZE, NPC_INTERACT_RANGE } from "../game/constants";
import { tileAnchorX, tileAnchorY, depthForTileY } from "../game/tileAnchor";
import { INTERIORS, InteriorRoom, isFloorTile } from "../data/interiors";
import { chebyshevDistance, TileCoord } from "../game/pathfinding";
import { Player } from "../game/entities/Player";
import { bus, EVENTS, SetMoveDirectionPayload } from "../game/events";

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

/** How a room's floor/walls are dressed. Only the four named shops + the bank got the real wood set; only the temple got the real stone set. */
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
  private npcSprite: Phaser.GameObjects.Image | null = null;
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
            .image(tileAnchorX(x + this.tileOffsetX), tileAnchorY(worldTileY), "counter")
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
      this.npcSprite = this.add
        .image(
          tileAnchorX(npc.x + this.tileOffsetX),
          tileAnchorY(npc.y + this.tileOffsetY),
          npc.textureKey,
        )
        .setOrigin(1, 1)
        .setDepth(depthForTileY(npc.y + this.tileOffsetY))
        .setInteractive({ useHandCursor: true });
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
    if (["melee_shop", "ranged_shop", "bank", "magic_shop"].includes(this.room.id)) return "wood-panel";
    return "plain";
  }

  /** One of five compatible plank shades, picked per-cell so the floor doesn't look like one tile stamped on repeat. */
  private shopFloorVariant(x: number, y: number): string {
    return SHOP_FLOOR_VARIANTS[interiorCellHash(x, y) % SHOP_FLOOR_VARIANTS.length];
  }

  /**
   * The room's walls are always a plain rectangular perimeter, so every W
   * cell is exactly one of: a corner, a top/bottom/left/right edge segment.
   * Only two corner pieces ship (top-left, top-right) — the bottom corners
   * reuse them flipped vertically, which moves the dark trim from the top
   * edge to the bottom edge without disturbing which side the vertical
   * beam sits on.
   */
  private shopWallTextureFor(x: number, y: number): { key: string; flipY: boolean } {
    const isTop = y === 0;
    const isBottom = y === this.roomH - 1;
    const isLeft = x === 0;
    const isRight = x === this.roomW - 1;
    if (isTop && isLeft) return { key: "shop-wall-corner-tl", flipY: false };
    if (isTop && isRight) return { key: "shop-wall-corner-tr", flipY: false };
    if (isBottom && isLeft) return { key: "shop-wall-corner-tl", flipY: true };
    if (isBottom && isRight) return { key: "shop-wall-corner-tr", flipY: true };
    if (isTop) return { key: "shop-wall-top", flipY: false };
    if (isBottom) return { key: "shop-wall-bottom", flipY: false };
    if (isLeft) return { key: "shop-wall-left", flipY: false };
    if (isRight) return { key: "shop-wall-right", flipY: false };
    return { key: "shop-wall-basic", flipY: false };
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

  update() {
    if (this.transitionScheduled) return;
    if (this.player.moving) return;
    this.checkTransition();
    if (!this.heldDirection || !this.canStepInDirection(this.heldDirection)) return;
    const next = { x: this.player.tileX + this.heldDirection.x, y: this.player.tileY + this.heldDirection.y };
    // Interior floors are always cobble/plank — friction 100, same as a
    // town street. Interiors don't need per-tile friction lookup.
    void this.player.stepTo(next.x, next.y, 100).then(() => this.checkTransition());
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
    if (chebyshevDistance(this.player.tile, { x: npc.x + this.tileOffsetX, y: npc.y + this.tileOffsetY }) > NPC_INTERACT_RANGE) {
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
    if (this.room.npc && this.room.npc.x === localX && this.room.npc.y === localY) return false;
    for (const d of this.room.decor) {
      if (d.blocks && d.x === localX && d.y === localY) return false;
    }
    return true;
  }
}

// Silence unused-import warnings.
void isFloorTile;
