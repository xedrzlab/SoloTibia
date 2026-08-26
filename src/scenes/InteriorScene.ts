import Phaser from "phaser";
import { TILE_SIZE, NPC_INTERACT_RANGE } from "../game/constants";
import { tileAnchorX, tileAnchorY, depthForTileY } from "../game/tileAnchor";
import { INTERIORS, InteriorRoom, isFloorTile, tileKind } from "../data/interiors";
import { findPath, chebyshevDistance, TileCoord } from "../game/pathfinding";
import { Player } from "../game/entities/Player";
import { bus, EVENTS } from "../game/events";

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

export class InteriorScene extends Phaser.Scene {
  private room!: InteriorRoom;
  private roomW = 0;
  private roomH = 0;
  private tileOffsetX = 0;
  private tileOffsetY = 0;
  private initData!: InteriorInit;

  private player!: Player;
  private npcSprite: Phaser.GameObjects.Image | null = null;
  private playerPath: TileCoord[] = [];
  private transitionScheduled = false;

  constructor() {
    super("Interior");
  }

  init(data: InteriorInit) {
    this.initData = data;
    this.transitionScheduled = false;
    this.playerPath = [];
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

    // Paint the room, tile by tile. Every cell gets a floor, then walls,
    // counter or stairs sit on top of it as their own sprites.
    for (let y = 0; y < this.roomH; y++) {
      for (let x = 0; x < this.roomW; x++) {
        const ch = room.rows[y][x];
        const wx = this.tileWorldX(x);
        const wy = this.tileWorldY(y);
        const worldTileY = y + this.tileOffsetY;
        const kind = tileKind(ch);
        // Floor beneath every cell — stone in the church/temple, wooden
        // planks in the shops. Walls draw over their own base so the wall
        // has something to hide under its silhouette.
        const floorKey = kind === "stone-floor" || ch === CH_WALL && this.roomLooksLikeTemple() ? "temple-floor" : "wood-floor";
        this.add.image(wx, wy, floorKey).setOrigin(0, 0).setDepth(0);
        if (ch === CH_WALL) {
          this.add.image(wx, wy, "stone-wall").setOrigin(0, 0).setDepth(depthForTileY(worldTileY));
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

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handleTap(pointer));

    // Tell the UI we're indoors — it hides the action bar and anything else
    // that would clutter or overlap the tiny interior room.
    bus.emit(EVENTS.INTERIOR_STATE, { active: true });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      // Only broadcast "back outside" if we're actually exiting to the
      // world; a room-to-room transition (SHUTDOWN + create) keeps the
      // action bar hidden by re-emitting active:true in the new create.
    });
    this.scale.on("resize", () => this.applyZoom(worldSize));
  }

  /** Very rough — the temple rooms use stone floor; shops use wood. */
  private roomLooksLikeTemple(): boolean {
    return this.room.id.startsWith("temple_");
  }

  private applyZoom(worldSize: { w: number; h: number }) {
    const zoomX = this.scale.width / worldSize.w;
    const zoomY = this.scale.height / worldSize.h;
    const zoom = Math.max(1, Math.min(zoomX, zoomY, 4));
    this.cameras.main.setZoom(zoom);
  }

  // --- Movement & interaction --------------------------------------------

  private handleTap(pointer: Phaser.Input.Pointer) {
    if (this.transitionScheduled) return;
    if (this.npcSprite && this.npcSprite.getBounds().contains(pointer.worldX, pointer.worldY)) return;

    const tx = Math.floor(pointer.worldX / TILE_SIZE);
    const ty = Math.floor(pointer.worldY / TILE_SIZE);
    if (!this.isWalkableWorld(tx, ty)) return;

    const path = findPath(
      (x, y) => this.isWalkableWorld(x, y),
      { x: this.player.tileX, y: this.player.tileY },
      { x: tx, y: ty },
    );
    this.playerPath = path;
  }

  update() {
    if (this.transitionScheduled) return;
    if (this.player.moving || this.playerPath.length === 0) {
      if (!this.player.moving) this.checkTransition();
      return;
    }
    const next = this.playerPath.shift()!;
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
