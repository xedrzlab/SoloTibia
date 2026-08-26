import Phaser from "phaser";
import { TILE_SIZE, NPC_INTERACT_RANGE } from "../game/constants";
import { tileAnchorX, tileAnchorY, depthForTileY } from "../game/tileAnchor";
import { INTERIORS, InteriorRoom, isFloorTile } from "../data/interiors";
import { findPath, chebyshevDistance, TileCoord } from "../game/pathfinding";
import { Player } from "../game/entities/Player";
import { bus, EVENTS } from "../game/events";

/** How much dead space to leave around the room, so it's not flush against the viewport edges. */
const ROOM_MARGIN_TILES = 2;

/**
 * A shop interior — a small room the player has zoned into from the world.
 * Renders its own tilemap (walls + wooden floor + door), places the
 * shopkeeper behind their counter, and hands NPC/dialogue events to the same
 * global bus the outdoor game uses so the shop UI just works.
 *
 * Data comes in via scene.launch(..., { roomId, returnTile, playerState }).
 * WorldScene is paused while the interior is up; on exit we resume it and
 * put the player back on the door tile they stepped through.
 */

interface InteriorInit {
  roomId: string;
  /** Tile in the outdoor world to return the player to on exit. */
  returnTile: { x: number; y: number };
  /** Snapshot of the player so we can rebuild them here without cloning sprites. */
  playerState: {
    vocation: string;
    exp: number;
    hp: number;
    mana: number;
  };
  /**
   * Called with the departing interior state when the scene stops, so the
   * outdoor WorldScene can absorb any HP/mana changes and know we're back.
   */
  onExit: (finalState: { hp: number; mana: number }) => void;
}

// Marker letters in the room grid. Kept here rather than exported since only
// this scene consumes them; the data file describes what each means.
const CH_WALL = "W";
const CH_COUNTER = "C";
const CH_DOOR = "D";

export class InteriorScene extends Phaser.Scene {
  private room!: InteriorRoom;
  private roomW = 0;
  private roomH = 0;
  private tileOffsetX = 0;
  private tileOffsetY = 0;
  private initData!: InteriorInit;

  private player!: Player;
  private npcSprite!: Phaser.GameObjects.Image;
  private playerPath: TileCoord[] = [];
  private exitScheduled = false;

  constructor() {
    super("Interior");
  }

  init(data: InteriorInit) {
    this.initData = data;
    this.exitScheduled = false;
    this.playerPath = [];
  }

  // ---------------------------------------------------------------------

  create() {
    const room = INTERIORS[this.initData.roomId];
    if (!room) {
      // If we can't find the room, don't strand the player — bounce right
      // back to the world.
      this.exitToWorld();
      return;
    }
    this.room = room;
    this.roomW = room.rows[0].length;
    this.roomH = room.rows.length;

    // Centre the room in the viewport so the whole shop fits, with a small
    // margin so walls aren't flush against the screen edges.
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

    // --- Paint the room. Walls, floor, counter and door are drawn per-tile
    // rather than baked into one texture — a shop is tiny, redrawing it is
    // effectively free, and per-tile sprites keep the door sortable against
    // the player like every other tall object in the game.
    for (let y = 0; y < this.roomH; y++) {
      for (let x = 0; x < this.roomW; x++) {
        const ch = room.rows[y][x];
        const wx = this.tileWorldX(x);
        const wy = this.tileWorldY(y);
        // Every cell has a floor beneath it (walls sit ON a wooden floor
        // strip so the wall base has something to hide against).
        this.add.image(wx, wy, "wood-floor").setOrigin(0, 0).setDepth(0);
        if (ch === CH_WALL) {
          this.add.image(wx, wy, "stone-wall").setOrigin(0, 0).setDepth(depthForTileY(y + this.tileOffsetY));
        } else if (ch === CH_COUNTER) {
          this.add
            .image(tileAnchorX(x + this.tileOffsetX), tileAnchorY(y + this.tileOffsetY), "counter")
            .setOrigin(1, 1)
            .setDepth(depthForTileY(y + this.tileOffsetY));
        }
        // CH_DOOR draws no extra sprite — it's just a walkable floor tile
        // whose position triggers the exit. The door is visually the gap in
        // the south wall.
      }
    }

    // Decor from the room definition.
    for (const decor of room.decor) {
      this.add
        .image(tileAnchorX(decor.x + this.tileOffsetX), tileAnchorY(decor.y + this.tileOffsetY), decor.textureKey)
        .setOrigin(1, 1)
        .setDepth(depthForTileY(decor.y + this.tileOffsetY));
    }

    // Shopkeeper NPC, tap-interactive.
    this.npcSprite = this.add
      .image(
        tileAnchorX(room.npc.x + this.tileOffsetX),
        tileAnchorY(room.npc.y + this.tileOffsetY),
        room.npc.textureKey,
      )
      .setOrigin(1, 1)
      .setDepth(depthForTileY(room.npc.y + this.tileOffsetY))
      .setInteractive({ useHandCursor: true });
    this.npcSprite.on("pointerdown", () => this.talkToNpc());

    // Player — a fresh Player instance in this scene, hydrated from the
    // exterior character's saved state. Combat isn't a thing indoors, so
    // this instance is only used for rendering and movement.
    const spawn = {
      x: room.spawn.x + this.tileOffsetX,
      y: room.spawn.y + this.tileOffsetY,
    };
    this.player = new Player(this, spawn.x, spawn.y, {
      vocation: this.initData.playerState.vocation as never,
      exp: this.initData.playerState.exp,
    });
    this.player.hp = this.initData.playerState.hp;
    this.player.mana = this.initData.playerState.mana;

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handleTap(pointer));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.removeAllListeners());

    this.scale.on("resize", () => this.applyZoom(worldSize));
  }

  private applyZoom(worldSize: { w: number; h: number }) {
    const zoomX = this.scale.width / worldSize.w;
    const zoomY = this.scale.height / worldSize.h;
    const zoom = Math.max(1, Math.min(zoomX, zoomY, 4));
    this.cameras.main.setZoom(zoom);
  }

  // --- Movement & interaction --------------------------------------------

  private handleTap(pointer: Phaser.Input.Pointer) {
    if (this.exitScheduled) return;

    // Tap on the NPC sprite goes through its own handler.
    if (this.npcSprite.getBounds().contains(pointer.worldX, pointer.worldY)) return;

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
    if (this.exitScheduled) return;
    if (this.player.moving || this.playerPath.length === 0) {
      // Also check for exit any time we're standing still, so a player who
      // tapped the door and finished walking there gets out on this frame.
      if (!this.player.moving) this.checkExit();
      return;
    }
    const next = this.playerPath.shift()!;
    void this.player.stepTo(next.x, next.y).then(() => this.checkExit());
  }

  private checkExit() {
    const localX = this.player.tileX - this.tileOffsetX;
    const localY = this.player.tileY - this.tileOffsetY;
    if (localY < 0 || localY >= this.roomH || localX < 0 || localX >= this.roomW) return;
    if (this.room.rows[localY][localX] === CH_DOOR) this.exitToWorld();
  }

  private exitToWorld() {
    if (this.exitScheduled) return;
    this.exitScheduled = true;
    // Forward the player's carried-over HP/mana so the outdoor scene can
    // resume with them, then hand control back to the world.
    this.initData.onExit({ hp: this.player.hp, mana: this.player.mana });
    this.scene.stop("Interior");
    this.scene.resume("World");
  }

  private talkToNpc() {
    // Same range/emit shape the outdoor NPC talk uses, so the UI's shop and
    // vocation panels light up exactly the way they do outside.
    if (chebyshevDistance(this.player.tile, { x: this.room.npc.x + this.tileOffsetX, y: this.room.npc.y + this.tileOffsetY }) > NPC_INTERACT_RANGE) {
      bus.emit(EVENTS.LOG, { kind: "info", text: `Walk closer to talk to ${this.room.npc.name}.` });
      return;
    }
    bus.emit(EVENTS.OPEN_DIALOGUE, {
      npcId: this.room.npc.id,
      npcName: this.room.npc.name,
      textureKey: this.room.npc.textureKey,
      role: this.room.npc.role,
      greeting: this.room.npc.greeting,
      about: this.room.npc.about,
    });
  }

  // --- Grid helpers -------------------------------------------------------

  private tileWorldX(localX: number): number {
    return (localX + this.tileOffsetX) * TILE_SIZE;
  }

  private tileWorldY(localY: number): number {
    return (localY + this.tileOffsetY) * TILE_SIZE;
  }

  /** True if a world-tile position sits inside the room and is walkable. */
  private isWalkableWorld(worldTileX: number, worldTileY: number): boolean {
    const localX = worldTileX - this.tileOffsetX;
    const localY = worldTileY - this.tileOffsetY;
    if (localY < 0 || localY >= this.roomH || localX < 0 || localX >= this.roomW) return false;
    const ch = this.room.rows[localY][localX];
    if (!isFloorTile(ch)) return false;
    // Decor and the NPC block their tiles too.
    if (this.room.npc.x === localX && this.room.npc.y === localY) return false;
    for (const d of this.room.decor) {
      if (d.blocks && d.x === localX && d.y === localY) return false;
    }
    return true;
  }

}
