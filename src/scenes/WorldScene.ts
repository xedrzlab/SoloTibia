import Phaser from "phaser";
import { TILE_SIZE, MELEE_RANGE, NPC_INTERACT_RANGE, VOCATION_CHOICE_LEVEL } from "../game/constants";
import { tileAnchorX, tileAnchorY, depthForTileY } from "../game/tileAnchor";
import {
  forEachTile,
  isWalkable,
  MAP_WIDTH,
  MAP_HEIGHT,
  TEMPLE_SPAWN,
  MONSTER_SPAWNS,
  NPC_SPAWNS,
  BUILDINGS,
  SIGNS,
  NpcSpawn,
} from "../data/tilemap";
import { MONSTERS } from "../data/monsters";
import { ITEMS } from "../data/items";
import { SHOPS } from "../data/shops";
import { ChosenVocation, VOCATION_NAMES } from "../game/stats";
import { Player } from "../game/entities/Player";
import { Monster } from "../game/entities/Monster";
import { findPath, chebyshevDistance, TileCoord } from "../game/pathfinding";
import { rollDamage, rollLoot } from "../game/combat";
import {
  bus,
  EVENTS,
  LogKind,
  UseItemPayload,
  BuyItemPayload,
  SellItemPayload,
  ChooseVocationPayload,
  ModalStatePayload,
  RequestVocationTalkPayload,
} from "../game/events";

const RECHASE_INTERVAL_MS = 300;
const DEATH_RESPAWN_HP_FRACTION = 0.5;
const CORPSE_DECAY_MS = 60_000;

interface Corpse {
  sprite: Phaser.GameObjects.Sprite;
  loot: { itemId: string; amount: number }[];
  name: string;
}

interface NpcInstance {
  def: NpcSpawn;
  sprite: Phaser.GameObjects.Image;
}

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private monsters: Monster[] = [];
  private npcs: NpcInstance[] = [];
  private corpses: Corpse[] = [];
  private target: Monster | null = null;
  private playerPath: TileCoord[] = [];
  private chaseTimer = 0;
  private modalOpen = false;

  constructor() {
    super("World");
  }

  create() {
    this.buildTileLayer();
    this.buildEnvironmentDecoration();

    this.player = new Player(this, TEMPLE_SPAWN.x, TEMPLE_SPAWN.y);
    this.buildNpcs();

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
    bus.on(EVENTS.BUY_ITEM, (payload: BuyItemPayload) => this.buyItem(payload.npcId, payload.itemId));
    bus.on(EVENTS.SELL_ITEM, (payload: SellItemPayload) => this.sellItem(payload.npcId, payload.itemId));
    bus.on(EVENTS.CHOOSE_VOCATION, (payload: ChooseVocationPayload) =>
      this.chooseVocation(payload.vocation as ChosenVocation),
    );
    bus.on(EVENTS.MODAL_STATE, (payload: ModalStatePayload) => {
      this.modalOpen = payload.open;
    });
    bus.on(EVENTS.REQUEST_VOCATION_TALK, (payload: RequestVocationTalkPayload) =>
      this.requestVocationTalk(payload.npcId),
    );

    // UIScene's create() (which subscribes to these events) runs in the same
    // scene-boot flush but isn't guaranteed to run first, so defer the
    // initial sync to the next update tick rather than risk it being missed.
    this.time.delayedCall(0, () => {
      this.emitPlayerStats();
      this.emitInventory();
      this.log("info", "You wake up in Oakhollow.");
    });
  }

  private applyZoom() {
    // Matches classic Tibia's 15-tile-wide field of view (verified: the
    // client's game window renders 15x11 tiles at default zoom).
    const desiredTilesVisible = 15;
    const zoom = Phaser.Math.Clamp(this.scale.width / (desiredTilesVisible * TILE_SIZE), 0.5, 3);
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
      if (tile.overlayKey) rt.draw(tile.overlayKey, x * TILE_SIZE, y * TILE_SIZE);
    });
  }

  private buildEnvironmentDecoration() {
    for (const building of BUILDINGS) {
      // Anchor at the bottom-right tile of the footprint (Tibia-style oblique
      // anchor) so the building leans up-left over the tiles behind it.
      const anchorTileX = building.footprintX + building.footprintW - 1;
      const anchorTileY = building.footprintY + building.footprintH - 1;
      this.add
        .image(tileAnchorX(anchorTileX), tileAnchorY(anchorTileY), building.textureKey)
        .setOrigin(1, 1)
        .setDepth(depthForTileY(anchorTileY));
    }
    for (const sign of SIGNS) {
      const sprite = this.add
        .image(tileAnchorX(sign.x), tileAnchorY(sign.y), "signpost")
        .setOrigin(1, 1)
        .setDepth(depthForTileY(sign.y))
        .setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.log("info", sign.text));
    }
  }

  private buildNpcs() {
    this.npcs = NPC_SPAWNS.map((def) => ({
      def,
      sprite: this.add
        .image(tileAnchorX(def.x), tileAnchorY(def.y), def.textureKey)
        .setOrigin(1, 1)
        .setDepth(depthForTileY(def.y)),
    }));
  }

  private handleTap(pointer: Phaser.Input.Pointer) {
    if (this.modalOpen) return; // a UI panel (shop/vocation/inventory) is up — don't also move the player

    const wx = pointer.worldX;
    const wy = pointer.worldY;

    const hitCorpse = this.corpses.find((c) => c.sprite.getBounds().contains(wx, wy));
    if (hitCorpse) {
      this.lootCorpse(hitCorpse);
      return;
    }

    const hitNpc = this.npcs.find((n) => n.sprite.getBounds().contains(wx, wy));
    if (hitNpc) {
      this.interactWithNpc(hitNpc.def);
      return;
    }

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

  private interactWithNpc(npc: NpcSpawn) {
    if (chebyshevDistance(this.player.tile, { x: npc.x, y: npc.y }) > NPC_INTERACT_RANGE) {
      this.log("info", `Walk closer to talk to ${npc.name}.`);
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

  /** The dialogue panel's "My Path" button — vocation eligibility is game state, so it's checked here, not in the UI. */
  private requestVocationTalk(npcId: string) {
    const npc = NPC_SPAWNS.find((n) => n.id === npcId);
    if (!npc) return;

    if (this.player.vocation !== "none") {
      this.log("info", `${npc.name}: "You have already chosen your path, ${VOCATION_NAMES[this.player.vocation]}."`);
      return;
    }
    if (this.player.level < VOCATION_CHOICE_LEVEL) {
      this.log(
        "info",
        `${npc.name}: "Return to me at level ${VOCATION_CHOICE_LEVEL} and I will help you choose your path."`,
      );
      return;
    }
    bus.emit(EVENTS.OPEN_VOCATION_CHOICE, {});
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
      monster.update(delta, this.player.tile, this.player.hp > 0, isWalkable, (damage, attackerName) =>
        this.damagePlayer(damage, attackerName),
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
        this.floatText(this.spriteCenterX(target.sprite), this.spriteTopY(target.sprite), `-${dmg}`, "#ffffff");
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
    this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite) - 14, `+${monster.def.xp} xp`, "#8fd0ff");
    if (leveledUp) {
      this.log("levelup", `You advanced to level ${this.player.level}!`);
    }

    const drops = rollLoot(monster.def.loot);
    this.spawnCorpse(monster, drops);
    this.emitPlayerStats();
  }

  private spawnCorpse(monster: Monster, loot: { itemId: string; amount: number }[]) {
    const sprite = this.add.sprite(monster.sprite.x, monster.sprite.y, monster.def.textureKey, 0);
    sprite
      .setOrigin(1, 1)
      .setDepth(depthForTileY(monster.tileY) - 1) // just under the live sprite it replaces
      .setTint(0x808080)
      .setScale(1, 0.55)
      .setAlpha(0.9);
    const corpse: Corpse = { sprite, loot, name: monster.def.name };
    this.corpses.push(corpse);
    this.time.delayedCall(CORPSE_DECAY_MS, () => this.removeCorpse(corpse));
  }

  private removeCorpse(corpse: Corpse) {
    const idx = this.corpses.indexOf(corpse);
    if (idx >= 0) this.corpses.splice(idx, 1);
    corpse.sprite.destroy();
  }

  private lootCorpse(corpse: Corpse) {
    if (corpse.loot.length === 0) {
      this.log("info", `There is nothing left to loot.`);
      this.removeCorpse(corpse);
      return;
    }
    for (const drop of corpse.loot) {
      this.player.addItem(drop.itemId, drop.amount);
      const name = ITEMS[drop.itemId]?.name ?? drop.itemId;
      this.log("loot", `Looted ${drop.amount}x ${name}.`);
    }
    this.emitInventory();
    this.removeCorpse(corpse);
  }

  private damagePlayer(amount: number, attackerName: string) {
    this.player.takeDamage(amount);
    this.log("damage", `The ${attackerName} hits you for ${amount}.`);
    this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite), `-${amount}`, "#ff5c5c");
    this.emitPlayerStats();
  }

  private handlePlayerDeath() {
    this.log("info", "You died... and wake up in Oakhollow.");
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

    if (item.healAmount) {
      this.player.heal(item.healAmount);
      this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite), `+${item.healAmount}`, "#7cff7c");
    }
    if (item.manaAmount) {
      this.player.restoreMana(item.manaAmount);
      this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite) - 14, `+${item.manaAmount} mp`, "#7cc8ff");
    }

    this.log("info", `You use a ${item.name}.`);
    this.emitPlayerStats();
    this.emitInventory();
  }

  private buyItem(npcId: string, itemId: string) {
    const shop = SHOPS[npcId];
    const offer = shop?.sells.find((o) => o.itemId === itemId);
    if (!offer) return;
    const itemName = ITEMS[itemId]?.name ?? itemId;

    if (!this.player.removeItem("gold_coin", offer.price)) {
      this.log("info", `You don't have enough gold for a ${itemName}.`);
      return;
    }
    this.player.addItem(itemId, 1);
    this.log("loot", `Bought a ${itemName} for ${offer.price} gold.`);
    this.emitInventory();
  }

  private sellItem(npcId: string, itemId: string) {
    const shop = SHOPS[npcId];
    const offer = shop?.buys.find((o) => o.itemId === itemId);
    if (!offer) return;
    const itemName = ITEMS[itemId]?.name ?? itemId;

    if (!this.player.removeItem(itemId, 1)) {
      this.log("info", `You don't have a ${itemName} to sell.`);
      return;
    }
    this.player.addItem("gold_coin", offer.price);
    this.log("loot", `Sold a ${itemName} for ${offer.price} gold.`);
    this.emitInventory();
  }

  private chooseVocation(vocation: ChosenVocation) {
    if (this.player.vocation !== "none") return;
    this.player.setVocation(vocation);
    this.log("levelup", `You have become a ${VOCATION_NAMES[vocation]}!`);
    this.emitPlayerStats();
  }

  // Sprites use a bottom-right origin (oblique-projection anchor), so the
  // visual center/top are offset from sprite.x/y rather than equal to it.
  private spriteCenterX(sprite: Phaser.GameObjects.Sprite): number {
    return sprite.x - sprite.displayWidth / 2;
  }

  private spriteTopY(sprite: Phaser.GameObjects.Sprite): number {
    return sprite.y - sprite.displayHeight;
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: "monospace",
        fontSize: "13px",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(50);
    this.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
      onComplete: () => t.destroy(),
    });
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
