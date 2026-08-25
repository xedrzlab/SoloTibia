import Phaser from "phaser";
import { TILE_SIZE, MELEE_RANGE } from "../game/constants";
import { forEachTile, isWalkable, MAP_WIDTH, MAP_HEIGHT, TEMPLE_SPAWN, MONSTER_SPAWNS } from "../data/tilemap";
import { MONSTERS } from "../data/monsters";
import { ITEMS } from "../data/items";
import { Player } from "../game/entities/Player";
import { Monster } from "../game/entities/Monster";
import { findPath, chebyshevDistance, TileCoord } from "../game/pathfinding";
import { rollDamage, rollLoot } from "../game/combat";
import { bus, EVENTS, LogKind, UseItemPayload } from "../game/events";

const RECHASE_INTERVAL_MS = 300;
const DEATH_RESPAWN_HP_FRACTION = 0.5;

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private monsters: Monster[] = [];
  private target: Monster | null = null;
  private playerPath: TileCoord[] = [];
  private chaseTimer = 0;

  constructor() {
    super("World");
  }

  create() {
    this.buildTileLayer();

    this.player = new Player(this, TEMPLE_SPAWN.x, TEMPLE_SPAWN.y);

    this.monsters = MONSTER_SPAWNS.map((spawn) => {
      const def = MONSTERS[spawn.monsterId];
      return new Monster(this, def, spawn.x, spawn.y);
    });

    const mapWidthPx = MAP_WIDTH * TILE_SIZE;
    const mapHeightPx = MAP_HEIGHT * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.applyZoom();
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);

    this.scale.on("resize", () => this.applyZoom());

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handleTap(pointer));

    bus.on(EVENTS.USE_ITEM, (payload: UseItemPayload) => this.useItem(payload.itemId));

    // UIScene's create() (which subscribes to these events) runs in the same
    // scene-boot flush but isn't guaranteed to run first, so defer the
    // initial sync to the next update tick rather than risk it being missed.
    this.time.delayedCall(0, () => {
      this.emitPlayerStats();
      this.emitInventory();
      this.log("info", "You wake up at the temple.");
    });
  }

  private applyZoom() {
    const desiredTilesVisible = 11;
    const zoom = Phaser.Math.Clamp(this.scale.width / (desiredTilesVisible * TILE_SIZE), 1, 3);
    this.cameras.main.setZoom(zoom);
  }

  /** Bake the static tile grid into one texture so it's a single draw call per frame. */
  private buildTileLayer() {
    const mapWidthPx = MAP_WIDTH * TILE_SIZE;
    const mapHeightPx = MAP_HEIGHT * TILE_SIZE;
    const rt = this.add.renderTexture(0, 0, mapWidthPx, mapHeightPx).setOrigin(0, 0);
    rt.setDepth(0);
    forEachTile((x, y, tile) => {
      rt.draw(tile.textureKey, x * TILE_SIZE, y * TILE_SIZE);
    });
  }

  private handleTap(pointer: Phaser.Input.Pointer) {
    const wx = pointer.worldX;
    const wy = pointer.worldY;

    const hitMonster = this.monsters.find((m) => m.alive && m.sprite.getBounds().contains(wx, wy));
    if (hitMonster) {
      this.setTarget(hitMonster);
      return;
    }

    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (!isWalkable(tx, ty)) return;

    const path = findPath(isWalkable, this.player.tile, { x: tx, y: ty });
    this.playerPath = path;
  }

  private setTarget(monster: Monster) {
    this.target = monster;
    this.chaseTimer = 0;
    bus.emit(EVENTS.TARGET, { name: monster.def.name, hp: monster.hp, maxHp: monster.def.hp });
  }

  private clearTarget() {
    this.target = null;
    bus.emit(EVENTS.TARGET, null);
  }

  update(_time: number, delta: number) {
    if (this.player.hp <= 0) {
      this.handlePlayerDeath();
      return;
    }

    for (const monster of this.monsters) {
      monster.update(delta, this.player.tile, this.player.hp > 0, isWalkable, (damage) =>
        this.damagePlayer(damage),
      );
    }

    this.updateCombat(delta);
    this.updatePlayerMovement(delta);
  }

  private updateCombat(delta: number) {
    const target = this.target;
    if (!target || !target.alive) {
      if (target && !target.alive) this.clearTarget();
      return;
    }

    const dist = chebyshevDistance(this.player.tile, target.tile);
    this.player.attackCooldown -= delta;

    if (dist <= MELEE_RANGE) {
      this.playerPath = []; // stop walking once in range, mirrors classic click-to-attack
      if (this.player.attackCooldown <= 0) {
        const dmg = rollDamage(this.player.weapon.min, this.player.weapon.max);
        const died = target.takeDamage(dmg);
        this.log("damage", `You hit the ${target.def.name} for ${dmg}.`);
        this.player.attackCooldown = this.player.weapon.intervalMs;

        if (died) {
          this.rewardKill(target);
          this.clearTarget();
        } else {
          bus.emit(EVENTS.TARGET, { name: target.def.name, hp: target.hp, maxHp: target.def.hp });
        }
      }
      return;
    }

    this.chaseTimer -= delta;
    if (this.chaseTimer <= 0 && !this.player.moving) {
      this.chaseTimer = RECHASE_INTERVAL_MS;
      this.playerPath = findPath(isWalkable, this.player.tile, target.tile);
    }
  }

  private updatePlayerMovement(_delta: number) {
    if (this.player.moving || this.playerPath.length === 0) return;
    const next = this.playerPath.shift()!;
    void this.player.stepTo(next.x, next.y).then(() => this.emitPlayerStats());
  }

  private rewardKill(monster: Monster) {
    const { leveledUp } = this.player.gainExp(monster.def.xp);
    this.log("xp", `You destroy the ${monster.def.name}. +${monster.def.xp} exp.`);
    if (leveledUp) {
      this.log("levelup", `You advanced to level ${this.player.level}!`);
    }

    const drops = rollLoot(monster.def.loot);
    for (const drop of drops) {
      this.player.addItem(drop.itemId, drop.amount);
      const name = ITEMS[drop.itemId]?.name ?? drop.itemId;
      this.log("loot", `Looted ${drop.amount}x ${name}.`);
    }
    if (drops.length > 0) this.emitInventory();

    this.emitPlayerStats();
  }

  private damagePlayer(amount: number) {
    this.player.takeDamage(amount);
    this.log("damage", `A creature hits you for ${amount}.`);
    this.emitPlayerStats();
  }

  private handlePlayerDeath() {
    this.log("info", "You died... and wake up at the temple.");
    this.clearTarget();
    this.playerPath = [];
    this.player.teleportTo(TEMPLE_SPAWN.x, TEMPLE_SPAWN.y);
    this.player.hp = Math.max(1, Math.floor(this.player.maxHp * DEATH_RESPAWN_HP_FRACTION));
    this.emitPlayerStats();
  }

  private useItem(itemId: string) {
    const item = ITEMS[itemId];
    if (!item || item.kind !== "consumable") return;
    if (!this.player.removeItem(itemId, 1)) return;

    if (item.healAmount) this.player.heal(item.healAmount);
    if (item.manaAmount) this.player.restoreMana(item.manaAmount);

    this.log("info", `You use a ${item.name}.`);
    this.emitPlayerStats();
    this.emitInventory();
  }

  private emitPlayerStats() {
    bus.emit(EVENTS.PLAYER_STATS, {
      level: this.player.level,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      mana: this.player.mana,
      maxMana: this.player.maxMana,
      exp: this.player.exp,
      expIntoLevel: this.player.expIntoLevel(),
      expForLevel: this.player.expForLevel(),
    });
  }

  private emitInventory() {
    bus.emit(EVENTS.INVENTORY, { items: { ...this.player.inventory } });
  }

  private log(kind: LogKind, text: string) {
    bus.emit(EVENTS.LOG, { kind, text });
  }
}
