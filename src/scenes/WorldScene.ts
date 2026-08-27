import Phaser from "phaser";
import { TILE_SIZE, MELEE_RANGE, NPC_INTERACT_RANGE, VOCATION_CHOICE_LEVEL } from "../game/constants";
import { tileAnchorX, tileAnchorY, depthForTileY } from "../game/tileAnchor";
import {
  forEachTile,
  frictionAt,
  isWalkable,
  MAP_WIDTH,
  MAP_HEIGHT,
  TEMPLE_SPAWN,
  MONSTER_SPAWNS,
  NPC_SPAWNS,
  BUILDINGS,
  SIGNS,
  NpcSpawn,
  PROPS,
  variantForCell,
  overlayForCell,
  entryPointAt,
  sewerLinkAtSurface,
  sewerLinkAtSewer,
  SewerLink,
} from "../data/tilemap";
import { MONSTERS } from "../data/monsters";
import { TREE_DETAILS, TREE_LAYERS, TreeSpecies } from "../data/assets";
import { EquipSlot, ITEMS } from "../data/items";
import { SHOPS } from "../data/shops";
import { SPELLS } from "../data/spells";
import { ChosenVocation, VOCATION_NAMES, vocationDisplayName } from "../game/stats";
import { Player } from "../game/entities/Player";
import { Monster } from "../game/entities/Monster";
import { findPath, chebyshevDistance, TileCoord } from "../game/pathfinding";
import { DebugOverlay } from "../game/debugOverlay";
import { DayNightCycle } from "../game/dayNight";
import { getActiveCharacter, updateActiveCharacter, setActiveCharacter } from "../game/profile";
import { rollDamage, rollLoot } from "../game/combat";
import { Container, ItemStack, SlotAccessor, SlotRef, moveStack } from "../game/containers";
import {
  SKILL_NAMES,
  SKILL_ORDER,
  SkillId,
  armorReduction,
  blockChance,
  spellDamage,
  weaponMaxDamage,
  weaponMinDamage,
} from "../game/skills";
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
  MoveItemPayload,
  OpenContainerPayload,
  CloseContainerPayload,
  CastSpellPayload,
  LootAllPayload,
  UiLayoutPayload,
  SelectTargetPayload,
} from "../game/events";

const RECHASE_INTERVAL_MS = 300;
const DEATH_RESPAWN_HP_FRACTION = 0.5;
const CORPSE_DECAY_MS = 60_000;

/** Slots in a monster corpse's loot bag. */
const CORPSE_CAPACITY = 8;

/** Wands fire a small magic bolt: cheap on mana, shorter reach than a bow. */
const WAND_MANA_COST = 4;
const WAND_RANGE = 3;

// Canopy placement, relative to the trunk tile's bottom-right anchor. The
// canopy is 48px against a 32px tile, so it overhangs; the offsets sit it on
// top of the trunk and lean it up and left like every other tall thing here.
const CANOPY_OFFSET_X = 6;
const CANOPY_OFFSET_Y = -14;
/**
 * How far above its own tile the canopy sorts. One step is enough to cover a
 * player on the tile behind the trunk without covering one standing in front.
 */
const CANOPY_DEPTH_LIFT = 1;

/** How often the Battle tab's nearby-monster list refreshes, and how far it looks. */
const BATTLE_LIST_INTERVAL_MS = 400;
const BATTLE_LIST_RANGE = 8;

// Slow passive regeneration, so mana (and therefore magic training) is a
// renewable resource rather than a one-shot pool between potion purchases.
const REGEN_INTERVAL_MS = 3000;
const HP_REGEN_FRACTION = 0.01;
const MANA_REGEN_FRACTION = 0.03;

/** How the equipped weapon decides to attack, once ammo and mana are checked. */
type AttackMode = "melee" | "distance" | "wand";

interface Corpse {
  sprite: Phaser.GameObjects.Sprite;
  container: Container;
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
  /** Container windows the player has open — backpacks, bags, corpses. */
  private openContainers: Container[] = [];
  /** Sidebar width the world view must leave free on the right. */
  private uiSidebarWidth = 0;
  /** Right-edge strip owned by the UI, so world taps landing on it are ignored. */
  private uiReservedWidth = 0;
  /** Set by skill training; flushed once per frame instead of per hit. */
  private skillsDirty = false;
  private battleListTimer = 0;
  private regenTimer = REGEN_INTERVAL_MS;
  private debug!: DebugOverlay;
  private dayNight!: DayNightCycle;
  /**
   * Ladders are taller than one tile (see ladderUpSprite in generate-assets.mjs)
   * and, anchored at their base like any tall prop, visually cover the tile
   * directly behind/above them. Tracked here so that tile can fade the
   * ladder's alpha instead of hiding the player standing on it — a tree's
   * canopy is allowed to hide the player behind it (see art direction on
   * layered trees); a ladder is not, since its footprint is only one tile
   * wide and there's nowhere else to route around it.
   */
  private ladders: { sprite: Phaser.GameObjects.Image; tileX: number; tileY: number }[] = [];
  private static readonly LADDER_OCCLUDED_ALPHA = 0.35;

  // --- Climb (sewer ladder/hatch) hold-to-confirm ---------------------------
  private pendingClimb: { surface: { x: number; y: number }; sewer: { x: number; y: number }; direction: "down" | "up" } | null = null;
  private climbHoldTimer: Phaser.Time.TimerEvent | null = null;
  private climbHoldCleanup: (() => void) | null = null;
  private static readonly CLIMB_HOLD_MS = 450;

  constructor() {
    super("World");
  }

  create() {
    this.buildTileLayer();
    this.buildEnvironmentDecoration();

    // Hydrate from the character the player picked on the select screen.
    // Missing (a bug in the flow, or storage wiped mid-session) falls through
    // to a defaultless player, which lets the world still boot rather than
    // dead-ending the user on a blank canvas.
    const character = getActiveCharacter();
    this.player = new Player(this, TEMPLE_SPAWN.x, TEMPLE_SPAWN.y, {
      vocation: character?.vocation,
      exp: character?.exp,
    });
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

    this.scale.on("resize", () => this.applyUiLayout(this.uiSidebarWidth, this.uiReservedWidth));

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handleTap(pointer));

    // Anything in the world that burns is a light at night. Deriving them from
    // the props means placing a torch lights the spot, with nothing to keep in
    // sync by hand.
    const LIGHT_RADII: Record<string, number> = { torch: 4.5, campfire: 6 };
    const lights = PROPS.filter((prop) => prop.textureKey in LIGHT_RADII).map((prop) => ({
      x: prop.x,
      y: prop.y,
      radius: LIGHT_RADII[prop.textureKey],
      flicker: 0.08,
    }));
    // The forge fire shows through its window whatever the hour.
    lights.push({ x: 27, y: 22, radius: 5, flicker: 0.05 });
    this.dayNight = new DayNightCycle(this, lights);
    this.buildLogoutButton();

    this.debug = new DebugOverlay(this, {
      sprites: () => [this.player.sprite, ...this.monsters.filter((m) => m.alive).map((m) => m.sprite)],
      isWalkable,
    });

    bus.on(EVENTS.USE_ITEM, (payload: UseItemPayload) => this.useItem(payload.itemId));
    bus.on(EVENTS.BUY_ITEM, (payload: BuyItemPayload) => this.buyItem(payload.npcId, payload.itemId));
    bus.on(EVENTS.SELL_ITEM, (payload: SellItemPayload) => this.sellItem(payload.npcId, payload.itemId));
    bus.on(EVENTS.CHOOSE_VOCATION, (payload: ChooseVocationPayload) =>
      this.chooseVocation(payload.vocation as ChosenVocation),
    );
    bus.on(EVENTS.MODAL_STATE, (payload: ModalStatePayload) => {
      this.modalOpen = payload.open;
    });
    bus.on(EVENTS.CLIMB_CONFIRM, () => this.performClimb());
    bus.on(EVENTS.REQUEST_VOCATION_TALK, (payload: RequestVocationTalkPayload) =>
      this.requestVocationTalk(payload.npcId),
    );
    bus.on(EVENTS.MOVE_ITEM, (payload: MoveItemPayload) => this.moveItem(payload.from, payload.to));
    bus.on(EVENTS.OPEN_CONTAINER, (payload: OpenContainerPayload) => this.openContainer(payload.container));
    // Depot access — stepping on the chest tile in the depot interior emits
    // this, and the outdoor player's depot container opens in the sidebar.
    // openContainer is already idempotent, so re-stepping on the tile is a
    // no-op instead of a duplicate window.
    bus.on(EVENTS.OPEN_DEPOT, () => this.openContainer(this.player.depot));
    bus.on(EVENTS.CLOSE_CONTAINER, (payload: CloseContainerPayload) => this.closeContainer(payload.container));
    bus.on(EVENTS.CAST_SPELL, (payload: CastSpellPayload) => this.castSpell(payload.spellId));
    bus.on(EVENTS.LOOT_ALL, (payload: LootAllPayload) => this.lootAll(payload.container));
    bus.on(EVENTS.UI_LAYOUT, (payload: UiLayoutPayload) =>
      this.applyUiLayout(payload.sidebarWidth, payload.reservedWidth),
    );
    bus.on(EVENTS.SELECT_TARGET, (payload: SelectTargetPayload) => {
      const monster = this.monsters[payload.id];
      if (monster?.alive) this.setTarget(monster);
    });

    // UIScene's create() (which subscribes to these events) runs in the same
    // scene-boot flush but isn't guaranteed to run first, so defer the
    // initial sync to the next update tick rather than risk it being missed.
    this.time.delayedCall(0, () => {
      // The backpack starts open, as it does on a fresh Tibia character.
      const backpack = this.player.backpack;
      if (backpack) this.openContainers = [backpack];
      this.emitPlayerStats();
      this.emitInventory();
      this.emitSkills();
      this.emitInventoryState();
      const greeting = character ? `You wake up in Oakhollow, ${character.name}.` : "You wake up in Oakhollow.";
      this.log("info", greeting);
      // A fresh character wakes in the temple basement — the tutorial flow
      // starts underground and climbs out through the church. Returning
      // characters skip this and stand outside the church door.
      if (character && !character.worldEntered) this.zoneIntoTemple();
    });
  }

  /** Keep the world view to the left of the sidebar, as in the Tibia client. */
  private applyUiLayout(sidebarWidth: number, reservedWidth: number) {
    this.uiSidebarWidth = sidebarWidth;
    this.uiReservedWidth = reservedWidth;
    const width = Math.max(1, this.scale.width - sidebarWidth);
    this.cameras.main.setViewport(0, 0, width, this.scale.height);
    this.applyZoom();
    this.dayNight?.resize();
  }

  private applyZoom() {
    // Matches classic Tibia's 15-tile-wide field of view (verified: the
    // client's game window renders 15x11 tiles at default zoom). Measured
    // against the camera viewport, not the canvas, so the sidebar doesn't
    // squeeze the world view.
    const desiredTilesVisible = 15;
    const zoom = Phaser.Math.Clamp(this.cameras.main.width / (desiredTilesVisible * TILE_SIZE), 0.5, 3);
    this.cameras.main.setZoom(zoom);
  }

  /**
   * Bake the static tile grid into one texture so it's a single draw call per
   * frame regardless of map size. Animated terrain can't be baked, so those
   * cells get a real sprite on a layer just above the baked one.
   */
  private buildTileLayer() {
    const mapWidthPx = MAP_WIDTH * TILE_SIZE;
    const mapHeightPx = MAP_HEIGHT * TILE_SIZE;
    const rt = this.add.renderTexture(0, 0, mapWidthPx, mapHeightPx).setOrigin(0, 0);
    rt.setDepth(0);

    const animatedCells: { x: number; y: number; key: string }[] = [];
    const treeCells: { x: number; y: number; species: TreeSpecies }[] = [];
    forEachTile((x, y, tile) => {
      if (tile.animated) {
        animatedCells.push({ x, y, key: tile.textureKey });
        return;
      }
      // A tree's ground still bakes; only its trunk and canopy stand apart.
      rt.draw(variantForCell(tile, x, y), x * TILE_SIZE, y * TILE_SIZE);
      if (tile.tree) treeCells.push({ x, y, species: tile.tree });
      const overlay = overlayForCell(tile, x, y);
      if (overlay) rt.draw(overlay, x * TILE_SIZE, y * TILE_SIZE);
    });

    for (const cell of animatedCells) {
      this.add
        .sprite(cell.x * TILE_SIZE, cell.y * TILE_SIZE, cell.key)
        .setOrigin(0, 0)
        .setDepth(1)
        .play("water-flow");
    }

    for (const cell of treeCells) this.buildTree(cell.x, cell.y, cell.species);
  }

  /**
   * Build one tree from its layers. The trunk sorts on its own tile so a
   * player standing in front of it draws over it; the canopy sorts a little
   * higher so a player walking behind is hidden by the leaves.
   */
  private buildTree(tileX: number, tileY: number, species: TreeSpecies) {
    const layers = TREE_LAYERS[species];
    const anchorX = tileAnchorX(tileX);
    const anchorY = tileAnchorY(tileY);

    this.add.image(anchorX, anchorY, layers.trunk).setOrigin(1, 1).setDepth(depthForTileY(tileY));

    if (layers.canopies.length === 0) return;

    // Deterministic per position, so a wood looks composed rather than rolled,
    // and looks the same every time the map is built.
    const hash = Math.abs(Math.imul(tileX * 668265263 + tileY * 374761393, 1274126177)) >>> 0;
    const canopyKey = layers.canopies[hash % layers.canopies.length];

    // The canopy is wider than its tile and leans up and to the left, matching
    // how every other tall thing in the world overhangs.
    const canopy = this.add
      .image(anchorX + CANOPY_OFFSET_X, anchorY + CANOPY_OFFSET_Y, canopyKey)
      .setOrigin(1, 1)
      .setDepth(depthForTileY(tileY) + CANOPY_DEPTH_LIFT);

    // Roughly a third of trees carry an accent, layered onto the canopy.
    if (hash % 3 === 0) {
      this.add
        .image(canopy.x, canopy.y, TREE_DETAILS[(hash >>> 8) % TREE_DETAILS.length])
        .setOrigin(1, 1)
        .setDepth(canopy.depth + 1);
    }
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
    // Props are anchored like everything else, so tall ones (torches, carts)
    // lean up-left and sort correctly against the player walking past them.
    for (const prop of PROPS) {
      // A rotated prop is flat and single-tile (no lean/occlusion needs), so
      // it rotates in place around its tile's center rather than the usual
      // bottom-right lean anchor.
      const sprite = prop.angle
        ? this.add
            .image(tileAnchorX(prop.x) - TILE_SIZE / 2, tileAnchorY(prop.y) - TILE_SIZE / 2, prop.textureKey)
            .setOrigin(0.5, 0.5)
            .setAngle(prop.angle)
            .setDepth(depthForTileY(prop.y))
        : this.add
            .image(tileAnchorX(prop.x), tileAnchorY(prop.y), prop.textureKey)
            .setOrigin(1, 1)
            .setDepth(depthForTileY(prop.y));
      // Ladders are two tiles tall and only one tile wide — there's no way
      // to walk "around" one the way you can skirt a tree's canopy, so it
      // fades instead of hiding the player standing behind it.
      if (prop.textureKey === "ladder-up") {
        this.ladders.push({ sprite, tileX: prop.x, tileY: prop.y });
      }
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

  /**
   * A short burst of pixel sprites thrown out from a point. Used for hits,
   * spell impacts and level-ups — enough to make an action read without
   * hiding what the player needs to see.
   */
  private burst(x: number, y: number, textureKey: string, count: number, spread: number, tint?: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = spread * (0.4 + Math.random() * 0.6);
      const particle = this.add.image(x, y, textureKey).setDepth(55).setScale(0.5 + Math.random() * 0.3);
      if (tint !== undefined) particle.setTint(tint);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: 260 + Math.random() * 160,
        ease: "Cubic.Out",
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** A single sprite that pops and fades in place, for the moment of impact. */
  private flash(x: number, y: number, textureKey: string, tint?: number) {
    const sprite = this.add.image(x, y, textureKey).setDepth(56).setScale(0.6);
    if (tint !== undefined) sprite.setTint(tint);
    this.tweens.add({
      targets: sprite,
      scale: 1.1,
      alpha: 0,
      duration: 220,
      ease: "Quad.Out",
      onComplete: () => sprite.destroy(),
    });
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
    if (this.modalOpen) return; // a UI panel (shop/vocation/dialogue) is up — don't also move the player
    // Taps on the sidebar belong to the UI, even though this scene also sees them.
    if (this.uiReservedWidth > 0 && pointer.x >= this.scale.width - this.uiReservedWidth) return;

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

    // A ladder/hatch only starts the hold-to-climb interaction once the
    // player is already on or right next to it — tapping one from across
    // the map is just a normal walk-there tap, same as any other tile.
    const down = sewerLinkAtSurface(tx, ty);
    const up = down ? null : sewerLinkAtSewer(tx, ty);
    const climbLink = down ?? up;
    if (climbLink && chebyshevDistance(this.player.tile, { x: tx, y: ty }) <= 1) {
      this.startClimbHold(pointer, climbLink, down ? "down" : "up", tx, ty);
      return;
    }

    const path = findPath(isWalkable, this.player.tile, { x: tx, y: ty });
    this.playerPath = path;
  }

  private interactWithNpc(npc: NpcSpawn) {
    // Ambient NPCs (farmers, background villagers) exist only for atmosphere;
    // tapping them is a no-op so they never open a dialogue that has nothing
    // to say.
    if (npc.role === "ambient") return;
    if (chebyshevDistance(this.player.tile, { x: npc.x, y: npc.y }) > NPC_INTERACT_RANGE) {
      this.log("info", `Walk closer to talk to ${npc.name}.`);
      return;
    }
    bus.emit(EVENTS.OPEN_DIALOGUE, {
      npcId: npc.id,
      npcName: npc.name,
      textureKey: npc.textureKey,
      role: npc.role as "shop" | "vocation", // ambient roles are filtered out above

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

    // Skill training fires many times a second; push one refresh per frame.
    if (this.skillsDirty) this.emitSkills();

    this.battleListTimer -= delta;
    if (this.battleListTimer <= 0) {
      this.battleListTimer = BATTLE_LIST_INTERVAL_MS;
      this.emitBattleList();
    }

    this.regenTimer -= delta;
    if (this.regenTimer <= 0) {
      this.regenTimer = REGEN_INTERVAL_MS;
      this.regenerate();
    }

    this.dayNight.update(delta, this.player.tile);
    this.updateLadderOcclusion();

    this.debug.update(this.player.tile, {
      mobs: this.monsters.filter((m) => m.alive).length,
      corpse: this.corpses.length,
      mode: this.resolveAttackMode().mode,
      time: this.dayNight.phaseName,
    });
  }

  private regenerate() {
    const player = this.player;
    const healedHp = player.hp < player.maxHp;
    const healedMana = player.mana < player.maxMana;
    if (!healedHp && !healedMana) return;

    player.heal(Math.max(1, Math.floor(player.maxHp * HP_REGEN_FRACTION)));
    player.restoreMana(Math.max(1, Math.floor(player.maxMana * MANA_REGEN_FRACTION)));
    this.emitPlayerStats();
  }

  /** Nearby monsters, for the Battle window — far easier to target than tapping a 32px sprite. */
  private emitBattleList() {
    const entries = this.monsters
      .map((monster, id) => ({ monster, id }))
      .filter(({ monster }) => monster.alive && chebyshevDistance(this.player.tile, monster.tile) <= BATTLE_LIST_RANGE)
      .sort((a, b) => {
        const distDiff =
          chebyshevDistance(this.player.tile, a.monster.tile) - chebyshevDistance(this.player.tile, b.monster.tile);
        return distDiff !== 0 ? distDiff : a.monster.hp - b.monster.hp;
      })
      .slice(0, 24)
      .map(({ monster, id }) => ({
        id,
        name: monster.def.name,
        hp: monster.hp,
        maxHp: monster.def.hp,
        targeted: monster === this.target,
      }));
    bus.emit(EVENTS.BATTLE_LIST, { entries });
  }

  /**
   * Decide how the equipped weapon actually attacks. A bow with no quiver and
   * a wand with no mana both fall back to swinging, so the player is never
   * left unable to fight.
   */
  private resolveAttackMode(): { mode: AttackMode; range: number } {
    const equipment = this.player.equipment;
    switch (equipment.weaponType()) {
      case "distance":
        if ((equipment.get("ammo")?.count ?? 0) > 0) return { mode: "distance", range: equipment.attackRange() };
        return { mode: "melee", range: MELEE_RANGE };
      case "wand":
        if (this.player.mana >= WAND_MANA_COST) return { mode: "wand", range: WAND_RANGE };
        return { mode: "melee", range: MELEE_RANGE };
      default:
        return { mode: "melee", range: MELEE_RANGE };
    }
  }

  private updateCombat(delta: number) {
    const target = this.target;
    if (!target || !target.alive) {
      if (target && !target.alive) this.clearTarget();
      return;
    }

    const { mode, range } = this.resolveAttackMode();
    const dist = chebyshevDistance(this.player.tile, target.tile);
    this.player.attackCooldown -= delta;

    if (dist <= range) {
      this.playerPath = []; // stop walking once in range, mirrors classic click-to-attack
      if (this.player.attackCooldown <= 0) this.performAttack(target, mode);
      return;
    }

    this.chaseTimer -= delta;
    if (this.chaseTimer <= 0 && !this.player.moving) {
      this.chaseTimer = RECHASE_INTERVAL_MS;
      this.playerPath = findPath(isWalkable, this.player.tile, target.tile);
    }
  }

  private performAttack(target: Monster, mode: AttackMode) {
    const player = this.player;
    const equipment = player.equipment;
    player.attackCooldown = player.attackIntervalMs;
    player.setFacing(target.tileX - player.tileX, target.tileY - player.tileY);
    player.playAttack();

    let damage: number;
    if (mode === "wand") {
      // Wands convert mana into magic damage, and that mana is what trains
      // magic level — same rule as casting a spell.
      player.spendMana(WAND_MANA_COST);
      this.trainSkill("magic", WAND_MANA_COST);
      damage = spellDamage(player.skills.level("magic"), player.level, equipment.attackValue(), 1.5);
      this.fireProjectile(target, "spell-flame");
    } else {
      const skill: SkillId = mode === "distance" ? "distance" : "melee";
      const max = weaponMaxDamage(player.skills.level(skill), equipment.attackValue(), player.level);
      damage = rollDamage(weaponMinDamage(max), max);
      this.trainSkill(skill, 1);
      if (mode === "distance") {
        this.consumeAmmo();
        this.fireProjectile(target, "arrow");
      }
    }

    const died = target.takeDamage(damage);
    this.log("damage", `You hit the ${target.def.name} for ${damage}.`);

    // Impact reads at the target: a flash on the blow, then debris.
    const hx = this.spriteCenterX(target.sprite);
    const hy = this.spriteTopY(target.sprite) + target.sprite.displayHeight / 2;
    if (mode === "wand") {
      this.flash(hx, hy, "fx-sparkle");
      this.burst(hx, hy, "fx-sparkle", 4, 14);
    } else {
      this.flash(hx, hy, "fx-hit");
      this.burst(hx, hy, "fx-blood", 4, 12);
    }
    this.floatText(this.spriteCenterX(target.sprite), this.spriteTopY(target.sprite), `-${damage}`, "#ffffff");

    if (died) {
      this.rewardKill(target);
      this.clearTarget();
    } else {
      bus.emit(EVENTS.TARGET, { name: target.def.name, hp: target.hp, maxHp: target.def.hp });
    }
    this.emitPlayerStats();
  }

  private consumeAmmo() {
    const equipment = this.player.equipment;
    const ammo = equipment.get("ammo");
    if (!ammo) return;
    ammo.count -= 1;
    if (ammo.count <= 0) {
      equipment.set("ammo", null);
      this.log("info", "You have run out of ammunition.");
    }
    this.emitInventoryState();
  }

  /** A quick sprite tween from the player to the target, for ranged attacks. */
  private fireProjectile(target: Monster, textureKey: string) {
    const shot = this.add
      .image(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite) + 12, textureKey)
      .setDepth(60)
      .setScale(0.7);
    this.tweens.add({
      targets: shot,
      x: this.spriteCenterX(target.sprite),
      y: this.spriteTopY(target.sprite) + 12,
      duration: 180,
      onComplete: () => shot.destroy(),
    });
  }

  /**
   * Feed tries into a skill and announce any level gained. The UI refresh is
   * deferred to the end of the frame — shielding trains on every incoming
   * blow, so this runs several times a second.
   */
  private trainSkill(skill: SkillId, amount: number) {
    const gained = this.player.skills.train(skill, amount, this.player.vocation);
    if (gained > 0) {
      this.log("levelup", `You advanced to ${SKILL_NAMES[skill]} level ${this.player.skills.level(skill)}.`);
    }
    this.skillsDirty = true;
  }

  private castSpell(spellId: string) {
    const spell = SPELLS[spellId];
    if (!spell) return;
    const player = this.player;

    if (player.mana < spell.manaCost) {
      this.log("info", "You do not have enough mana.");
      return;
    }

    let target: Monster | null = null;
    if (spell.kind === "attack") {
      target = this.target;
      if (!target || !target.alive) {
        this.log("info", "You need a target for that spell.");
        return;
      }
      if (chebyshevDistance(player.tile, target.tile) > (spell.range ?? 1)) {
        this.log("info", "The target is too far away.");
        return;
      }
    }

    player.spendMana(spell.manaCost);
    this.trainSkill("magic", spell.manaCost);
    this.log("info", `You say: "${spell.words}".`);

    const power = spellDamage(player.skills.level("magic"), player.level, spell.base, spell.factor);
    if (spell.kind === "heal") {
      player.heal(power);
      const px = this.spriteCenterX(player.sprite);
      const py = this.spriteTopY(player.sprite) + player.sprite.displayHeight / 2;
      this.burst(px, py, "fx-sparkle", 6, 16, 0x7cff7c);
      this.floatText(
        this.spriteCenterX(player.sprite),
        this.spriteTopY(player.sprite),
        `+${power}`,
        "#7cff7c",
      );
    } else if (target) {
      this.fireProjectile(target, spell.textureKey);
      const died = target.takeDamage(power);
      this.log("damage", `You hit the ${target.def.name} for ${power}.`);
      const hx = this.spriteCenterX(target.sprite);
      const hy = this.spriteTopY(target.sprite) + target.sprite.displayHeight / 2;
      this.flash(hx, hy, "fx-sparkle", 0xff9f4a);
      this.burst(hx, hy, "fx-dust", 5, 16, 0xff9f4a);
      this.floatText(this.spriteCenterX(target.sprite), this.spriteTopY(target.sprite), `-${power}`, "#ff9f4a");
      if (died) {
        this.rewardKill(target);
        this.clearTarget();
      } else {
        bus.emit(EVENTS.TARGET, { name: target.def.name, hp: target.hp, maxHp: target.def.hp });
      }
    }

    this.emitPlayerStats();
  }

  private updatePlayerMovement(_delta: number) {
    if (this.player.moving || this.playerPath.length === 0) return;
    const next = this.playerPath.shift()!;
    // Feed the destination tile's ground friction into stepTo so cobble
    // walks faster than grass and grass walks faster than sand — old-Tibia
    // step-time model. See src/game/constants.ts for the formula.
    void this.player.stepTo(next.x, next.y, frictionAt(next.x, next.y)).then(() => {
      this.emitPlayerStats();
      this.checkForZoneIn();
    });
  }

  /**
   * A fresh character's tutorial entry: skip the outdoor spawn tile and drop
   * straight into the temple basement. Once the character walks out of the
   * church, `worldEntered` flips true and this stops firing on future logins.
   */
  private zoneIntoTemple() {
    this.playerPath = [];
    this.clearTarget();
    // Pause halts updates but keeps the scene visible under the interior;
    // hiding as well prevents the outdoor tiles and NPCs showing through.
    this.scene.pause();
    this.scene.setVisible(false);
    this.scene.launch("Interior", {
      roomId: "temple_basement",
      returnTile: { x: TEMPLE_SPAWN.x, y: TEMPLE_SPAWN.y },
      playerState: {
        vocation: this.player.vocation,
        exp: this.player.exp,
        hp: this.player.hp,
        mana: this.player.mana,
      },
      onExit: (state: { hp: number; mana: number }) => {
        this.player.hp = state.hp;
        this.player.mana = state.mana;
        this.player.teleportTo(TEMPLE_SPAWN.x, TEMPLE_SPAWN.y);
        updateActiveCharacter({ worldEntered: true });
        this.emitPlayerStats();
      },
    });
  }

  /**
   * A ladder is anchored at its base tile and stands two tiles tall, so it
   * visually covers the tile directly north of that base. Checked every
   * frame (cheap — there are only ever a handful of ladders) rather than
   * only after a step, so it also catches the player arriving there by
   * teleport (climbing up lands the player one tile from a different
   * ladder's covered tile in general, but nothing guarantees that never
   * coincides).
   */
  private updateLadderOcclusion() {
    for (const ladder of this.ladders) {
      const behind = this.player.tileX === ladder.tileX && this.player.tileY === ladder.tileY - 1;
      ladder.sprite.setAlpha(behind ? WorldScene.LADDER_OCCLUDED_ALPHA : 1);
    }
  }

  /**
   * Sewer entrances/ladders are a same-scene teleport, not a scene change —
   * unlike shop doors, there's no interior room to launch: the sewer is just
   * more of this same tilemap, off camera until now. Teleporting the player
   * is a one-liner; performClimb() below does exactly that once the player
   * has actually confirmed it via the hold-prompt in handleTap/startClimbHold.
   */
  private performClimb() {
    const climb = this.pendingClimb;
    this.pendingClimb = null;
    if (!climb) return;
    this.playerPath = [];
    this.clearTarget();
    if (climb.direction === "down") {
      this.player.teleportTo(climb.sewer.x, climb.sewer.y);
      this.log("info", "You climb down into the sewers.");
    } else {
      this.player.teleportTo(climb.surface.x, climb.surface.y);
      this.log("info", "You climb back up to the street.");
    }
  }

  /**
   * Ladders/hatches don't teleport on a mere step anymore — walking through
   * one, or a path that just happened to cross it on the way somewhere else,
   * used to yank the player through instantly, which read as a bug rather
   * than a deliberate action. Instead, a tap that lands on one of these
   * tiles (and the player is already on/next to it) starts a hold timer; if
   * the press is held long enough it opens the Climb Down/Climb Up confirm
   * panel, and releasing early just falls back to a normal walk-there tap.
   */
  private startClimbHold(
    pointer: Phaser.Input.Pointer,
    link: SewerLink,
    direction: "down" | "up",
    tx: number,
    ty: number,
  ) {
    this.cancelClimbHold();
    const startX = pointer.x;
    const startY = pointer.y;

    const releaseAsWalk = () => {
      this.cancelClimbHold();
      this.playerPath = findPath(isWalkable, this.player.tile, { x: tx, y: ty });
    };
    const onMove = (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.x, p.y, startX, startY) > 12) releaseAsWalk();
    };

    this.input.on("pointerup", releaseAsWalk);
    this.input.on("pointermove", onMove);
    this.climbHoldCleanup = () => {
      this.input.off("pointerup", releaseAsWalk);
      this.input.off("pointermove", onMove);
    };

    this.climbHoldTimer = this.time.delayedCall(WorldScene.CLIMB_HOLD_MS, () => {
      this.climbHoldCleanup?.();
      this.climbHoldCleanup = null;
      this.climbHoldTimer = null;
      this.pendingClimb = { surface: link.surface, sewer: link.sewer, direction };
      bus.emit(EVENTS.OPEN_CLIMB_PROMPT, { direction });
    });
  }

  private cancelClimbHold() {
    this.climbHoldTimer?.remove();
    this.climbHoldTimer = null;
    this.climbHoldCleanup?.();
    this.climbHoldCleanup = null;
  }

  /**
   * If the player has just stepped onto a door tile in front of a shop,
   * pause the world and launch the interior scene for that shop. The
   * outdoor player state (HP/mana) rides along so the shop can render the
   * same character; when the interior stops it hands the updated HP/mana
   * back through `onExit`.
   */
  private checkForZoneIn() {
    const entry = entryPointAt(this.player.tileX, this.player.tileY);
    if (!entry) return;

    // Stop any pending path/target so we don't walk on the moment we come back.
    this.playerPath = [];
    this.clearTarget();

    // Pause halts updates but keeps the scene visible under the interior;
    // hiding as well prevents the outdoor tiles and NPCs showing through.
    this.scene.pause();
    this.scene.setVisible(false);
    this.scene.launch("Interior", {
      roomId: entry.interiorId,
      returnTile: { x: entry.x, y: entry.y },
      playerState: {
        vocation: this.player.vocation,
        exp: this.player.exp,
        hp: this.player.hp,
        mana: this.player.mana,
      },
      onExit: (state: { hp: number; mana: number }) => {
        // Take the interior's final HP/mana back onto the outdoor player.
        this.player.hp = state.hp;
        this.player.mana = state.mana;
        // Nudge one tile south of the door so the player faces the road
        // after exiting, rather than immediately re-triggering the door.
        this.player.teleportTo(entry.exitX ?? entry.x, entry.exitY ?? entry.y + 1);
        this.emitPlayerStats();
      },
    });
  }

  private saveCharacter() {
    updateActiveCharacter({
      vocation: this.player.vocation,
      level: this.player.level,
      exp: this.player.exp,
    });
  }

  /** DOM logout button in the corner of the viewport. */
  private logoutButton: HTMLButtonElement | null = null;

  /**
   * Log Out sits above the canvas as an HTML button. Doing it in the DOM
   * sidesteps camera zoom, scene draw-order and the sidebar's viewport
   * carve-out — the button is always exactly where and how big the CSS says.
   */
  private buildLogoutButton() {
    if (this.logoutButton) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Log Out";
    btn.style.cssText = [
      "position: absolute",
      "top: 8px",
      "left: 8px",
      "z-index: 20",
      "padding: 6px 12px",
      "font-family: monospace",
      "font-size: 12px",
      "color: #f4e6c8",
      "background: rgba(13,13,13,0.85)",
      "border: 1px solid #3a3a3a",
      "border-radius: 3px",
      "cursor: pointer",
    ].join(";");
    btn.addEventListener("click", () => this.logout());
    document.body.appendChild(btn);
    this.logoutButton = btn;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyLogoutButton());
  }

  private destroyLogoutButton() {
    if (this.logoutButton?.parentNode) this.logoutButton.parentNode.removeChild(this.logoutButton);
    this.logoutButton = null;
  }

  private logout() {
    this.saveCharacter();
    setActiveCharacter(null);
    this.destroyLogoutButton();
    // Fully tear the game down so the next login re-hydrates cleanly rather
    // than inheriting this session's sprites, tweens and event listeners.
    this.scene.stop("UI");
    this.scene.stop("World");
    this.scene.start("Select");
  }

  private rewardKill(monster: Monster) {
    const { leveledUp } = this.player.gainExp(monster.def.xp);
    this.saveCharacter(); // exp / level are what the select screen shows
    this.log("xp", `You destroy the ${monster.def.name}. +${monster.def.xp} exp.`);
    this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite) - 14, `+${monster.def.xp} xp`, "#8fd0ff");
    if (leveledUp) {
      this.log("levelup", `You advanced to level ${this.player.level}!`);
      this.burst(
        this.spriteCenterX(this.player.sprite),
        this.spriteTopY(this.player.sprite) + this.player.sprite.displayHeight / 2,
        "fx-sparkle",
        10,
        26,
        0xe6c34a,
      );
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

    // The corpse is just another container, so looting is the same drag the
    // player already uses between backpacks.
    const container = new Container(`Dead ${monster.def.name}`, monster.def.textureKey, CORPSE_CAPACITY);
    for (const drop of loot) container.addItem(drop.itemId, drop.amount);

    const corpse: Corpse = { sprite, container, name: monster.def.name };
    this.corpses.push(corpse);
    this.time.delayedCall(CORPSE_DECAY_MS, () => this.removeCorpse(corpse));
  }

  private removeCorpse(corpse: Corpse) {
    const idx = this.corpses.indexOf(corpse);
    if (idx >= 0) this.corpses.splice(idx, 1);
    this.closeContainer(corpse.container); // don't leave a window onto a vanished corpse
    corpse.sprite.destroy();
  }

  private lootCorpse(corpse: Corpse) {
    if (corpse.container.usedSlots === 0) {
      this.log("info", "There is nothing left to loot.");
      this.removeCorpse(corpse);
      return;
    }
    this.openContainer(corpse.container);
  }

  // --- Container windows --------------------------------------------------

  private openContainer(container: Container) {
    if (!this.openContainers.includes(container)) this.openContainers.push(container);
    this.emitInventoryState();
  }

  private closeContainer(container: Container) {
    const idx = this.openContainers.indexOf(container);
    if (idx < 0) return;
    this.openContainers.splice(idx, 1);
    this.emitInventoryState();
  }

  /** The convenience button on a loot window: sweep everything into the backpack. */
  private lootAll(container: Container) {
    const backpack = this.player.backpack;
    if (!backpack) return;

    let tookSomething = false;
    let full = false;
    for (let i = 0; i < container.slots.length; i++) {
      const stack = container.slots[i];
      if (!stack) continue;
      const leftover = backpack.addItem(stack.itemId, stack.count);
      const moved = stack.count - leftover;
      if (moved > 0) {
        this.log("loot", `Looted ${moved}x ${ITEMS[stack.itemId]?.name ?? stack.itemId}.`);
        tookSomething = true;
      }
      if (leftover > 0) {
        stack.count = leftover;
        full = true;
      } else {
        container.slots[i] = null;
      }
    }

    if (!tookSomething) this.log("info", "You cannot carry any more.");
    else if (full) this.log("info", "Your backpack is full.");

    // A corpse emptied by Loot All has served its purpose — clear it away.
    const corpse = this.corpses.find((c) => c.container === container);
    if (corpse && container.usedSlots === 0) this.removeCorpse(corpse);

    this.emitInventory();
    this.emitInventoryState();
  }

  // --- Item movement ------------------------------------------------------

  /**
   * The single point where inventory mutations happen. UIScene only ever
   * describes a move; the rules (does this fit the slot, would it orphan the
   * backpack) are enforced here.
   */
  private readonly slotAccessor: SlotAccessor = {
    get: (ref: SlotRef) =>
      ref.kind === "container" ? (ref.container.slots[ref.index] ?? null) : this.player.equipment.get(ref.slot as EquipSlot),
    canSet: (ref: SlotRef, stack: ItemStack | null) => {
      if (ref.kind === "container") return ref.index >= 0 && ref.index < ref.container.slots.length;
      // Taking the backpack off would strand every item inside it, so the
      // back slot may be swapped but never emptied.
      if (ref.slot === "back" && !stack) return false;
      return this.player.equipment.canEquip(ref.slot as EquipSlot, stack);
    },
    set: (ref: SlotRef, stack: ItemStack | null) => {
      if (ref.kind === "container") ref.container.slots[ref.index] = stack;
      else this.player.equipment.set(ref.slot as EquipSlot, stack);
    },
  };

  private moveItem(from: SlotRef, to: SlotRef) {
    if (!moveStack(this.slotAccessor, from, to)) return;

    // What the character is wearing just changed, so redraw the paper doll.
    if (from.kind === "equip" || to.kind === "equip") this.player.refreshAppearance();

    // A container that just left the tree (swapped out of a slot, dropped in a
    // corpse) shouldn't keep a window open onto it.
    for (const container of [...this.openContainers]) {
      if (!this.isContainerReachable(container)) this.closeContainer(container);
    }

    this.emitInventory();
    this.emitInventoryState();
    this.emitSkills(); // weapon/armor swaps change the attack & defense readouts
  }

  /** True if the container is the player's, nested in it, or an open corpse. */
  private isContainerReachable(container: Container): boolean {
    if (this.corpses.some((c) => c.container === container)) return true;
    const backpack = this.player.backpack;
    return backpack ? backpack.contains(container) : false;
  }

  private damagePlayer(amount: number, attackerName: string) {
    const equipment = this.player.equipment;
    const defense = equipment.defenseValue();

    // Shielding trains on every blow aimed at you, blocked or not.
    this.trainSkill("shielding", 1);

    if (defense > 0 && Math.random() < blockChance(this.player.skills.level("shielding"), defense)) {
      this.log("damage", `You block the ${attackerName}.`);
      this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite), "block", "#8fd0ff");
      return;
    }

    const reduced = Math.max(0, amount - armorReduction(equipment.armorValue()));
    if (reduced <= 0) {
      this.log("damage", `The ${attackerName} hits you, but your armor holds.`);
      return;
    }

    this.player.takeDamage(reduced);
    this.log("damage", `The ${attackerName} hits you for ${reduced}.`);
    const px = this.spriteCenterX(this.player.sprite);
    const py = this.spriteTopY(this.player.sprite) + this.player.sprite.displayHeight / 2;
    this.flash(px, py, "fx-hit", 0xff8080);
    this.burst(px, py, "fx-blood", 3, 10);
    this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite), `-${reduced}`, "#ff5c5c");
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
    this.emitInventoryState();
  }

  private buyItem(npcId: string, itemId: string) {
    const shop = SHOPS[npcId];
    const offer = shop?.sells.find((o) => o.itemId === itemId);
    if (!offer) return;
    const itemName = ITEMS[itemId]?.name ?? itemId;

    const backpack = this.player.backpack;
    if (!backpack?.hasRoomFor(itemId, 1)) {
      this.log("info", `You have no room for a ${itemName}.`);
      return;
    }
    if (!this.player.removeItem("gold_coin", offer.price)) {
      this.log("info", `You don't have enough gold for a ${itemName}.`);
      return;
    }
    this.player.addItem(itemId, 1);
    this.log("loot", `Bought a ${itemName} for ${offer.price} gold.`);
    this.emitInventory();
    this.emitInventoryState();
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
    this.emitInventoryState();
  }

  private chooseVocation(vocation: ChosenVocation) {
    if (this.player.vocation !== "none") return;
    this.player.setVocation(vocation);
    this.saveCharacter();
    this.log("levelup", `You have become a ${VOCATION_NAMES[vocation]}!`);
    this.emitPlayerStats();
    this.emitSkills(); // vocation changes how fast every skill trains
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
    bus.emit(EVENTS.INVENTORY, { items: this.player.inventoryTotals() });
  }

  private emitSkills() {
    const player = this.player;
    this.skillsDirty = false;
    bus.emit(EVENTS.SKILLS, {
      vocationName: vocationDisplayName(player.vocation),
      level: player.level,
      exp: player.exp,
      expIntoLevel: player.expIntoLevel(),
      expForLevel: player.expForLevel(),
      skills: SKILL_ORDER.map((id) => ({
        id,
        name: SKILL_NAMES[id],
        level: player.skills.level(id),
        progress: player.skills.progress(id, player.vocation),
      })),
      attack: player.equipment.attackValue(),
      defense: player.equipment.defenseValue(),
      armor: player.equipment.armorValue(),
    });
  }

  private emitInventoryState() {
    bus.emit(EVENTS.INVENTORY_STATE, {
      equipment: this.player.equipment,
      openContainers: [...this.openContainers],
      capacityUsed: this.player.capacityUsed(),
      maxCapacity: this.player.maxCapacity,
    });
  }

  private log(kind: LogKind, text: string) {
    bus.emit(EVENTS.LOG, { kind, text });
  }
}
