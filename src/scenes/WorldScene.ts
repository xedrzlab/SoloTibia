import Phaser from "phaser";
import { TILE_SIZE, MELEE_RANGE, NPC_INTERACT_RANGE, VOCATION_CHOICE_LEVEL } from "../game/constants";
import { tileAnchorX, tileAnchorY, depthForTileY, LABEL_DEPTH } from "../game/tileAnchor";
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
  wholeTreeForCell,
  entryPointAt,
  sewerLinkAtSurface,
  sewerLinkAtSewer,
  SewerLink,
} from "../data/tilemap";
import { MONSTERS, MonsterDef } from "../data/monsters";
import { EquipSlot, ITEMS } from "../data/items";
import { SHOPS } from "../data/shops";
import { SPELLS } from "../data/spells";
import { ChosenVocation, VOCATION_NAMES, vocationDisplayName } from "../game/stats";
import { Player } from "../game/entities/Player";
import { Monster } from "../game/entities/Monster";
import { findPath, chebyshevDistance, closestChebyshevDistance, TileCoord } from "../game/pathfinding";
import { DebugOverlay } from "../game/debugOverlay";
import { DayNightCycle } from "../game/dayNight";
import { getActiveCharacter, updateActiveCharacter, setActiveCharacter } from "../game/profile";
import { rollDamage, rollLoot } from "../game/combat";
import { Container, ItemStack, SlotAccessor, SlotRef, STACK_MAX, moveStack } from "../game/containers";
import {
  SKILL_LOG_NAMES,
  SKILL_NAMES,
  SKILL_ORDER,
  SkillId,
  calculateArmorMitigation,
  calculatePhysicalResistance,
  calculateShieldDefense,
  rollMonsterHit,
  COMBAT_FACTORS,
  COMBAT_STANCE_NAMES,
  DEFENSE_FACTORS,
  distanceHitChance,
  distanceMaxDamage,
  distanceMinDamage,
  meleeMaxDamage,
  meleeMinDamage,
  spellMaxPower,
  spellMinPower,
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
  SetCombatStancePayload,
  DropItemPayload,
  PickupItemPayload,
  PickupPromptEntry,
  SetMoveDirectionPayload,
} from "../game/events";

const RECHASE_INTERVAL_MS = 300;
const DEATH_RESPAWN_HP_FRACTION = 0.5;
const CORPSE_DECAY_MS = 60_000;

/** Slots in a monster corpse's loot bag. */
const CORPSE_CAPACITY = 8;

/** How many tiles a loot bag can be "pushed" (dragged) from where it currently sits. */
const LOOT_BAG_PUSH_RANGE = 3;

/** Floating name above a loot bag — matches the creature name-label look. */
const CREATURE_LABEL_STYLE = {
  fontFamily: "monospace",
  fontSize: "11px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 3,
} as const;

/** How long a dropped item sits on the ground before vanishing, same as a corpse. */
const GROUND_PILE_DECAY_MS = 60_000;

/** Slots in one ground tile's item pile. */
const GROUND_PILE_CAPACITY = 8;

/** Wands fire a small magic bolt: cheap on mana, shorter reach than a bow. */
const WAND_MANA_COST = 4;
const WAND_RANGE = 3;


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
  /** The loot-bag sprite dropped where the monster died. */
  sprite: Phaser.GameObjects.Sprite;
  /** Floating "Dead <Monster>" name above the bag. */
  label: Phaser.GameObjects.Text;
  container: Container;
  name: string;
  tileX: number;
  tileY: number;
  decayTimer: Phaser.Time.TimerEvent;
  /** Set while the bag is being dragged ("pushed") so its release doesn't also open the loot window. */
  dragging: boolean;
}

/** Items dropped or thrown onto a tile — any item in the game can end up here, not just monster loot. */
interface GroundPile {
  sprite: Phaser.GameObjects.Sprite;
  container: Container;
  tileX: number;
  tileY: number;
  decayTimer: Phaser.Time.TimerEvent;
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
  /** Container ids that belong to loot bags — the UI lays these out in its auto grid. */
  private lootContainerIds = new Set<string>();
  private groundPiles: GroundPile[] = [];
  private target: Monster | null = null;
  private playerPath: TileCoord[] = [];
  /** Direction held on the on-screen D-pad — takes over from playerPath every frame it's set. */
  private heldDirection: TileCoord | null = null;
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
  /** Last emitted battle list, as a cheap comparison key — see emitBattleList(). */
  private lastBattleListKey = "";
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

  // --- Ground item pile hold-to-pick-up-menu ---------------------------------
  private pendingPickupPile: GroundPile | null = null;
  private pickupHoldTimer: Phaser.Time.TimerEvent | null = null;
  private pickupHoldCleanup: (() => void) | null = null;
  /** Set when the player tapped a pick-up row while out of melee range — the character walks over, then that same item is taken automatically. */
  private pendingWalkToPile: GroundPile | null = null;
  private pendingPickupIndex: number | null = null;
  private pickupChaseTimer = 0;

  private activeLevelUpBanners: Phaser.GameObjects.Text[] = [];

  /** The most recent distance attack's hit-chance roll, surfaced in the debug overlay (?debug=1). */
  private lastDistanceDebug: { distance: number; hitChance: number; roll: number; result: "HIT" | "MISS" } | null =
    null;

  /** The most recent monster attack against the player, surfaced in the debug overlay. */
  private lastMonsterAttackDebug: { name: string; hitChance: number; result: "HIT" | "MISS" | "BLOCK" } | null = null;

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
      const def = spawn.overrides ? { ...MONSTERS[spawn.monsterId], ...spawn.overrides } : MONSTERS[spawn.monsterId];
      return new Monster(this, def, spawn.x, spawn.y);
    });

    // A small drag threshold so a tap on a loot bag opens it, and only a real
    // drag past this distance "pushes" it to another tile.
    this.input.dragDistanceThreshold = 8;

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
    this.buildPauseButton();

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
    bus.on(EVENTS.SET_COMBAT_STANCE, (payload: SetCombatStancePayload) => {
      this.player.combatStance = payload.stance;
      // Push the new stance straight back to the UI so the Character panel's
      // tap-to-cycle row re-renders with it — otherwise the row's closure
      // stays stale at whatever stance was current when it was last drawn,
      // and every subsequent tap re-computes "next after the old stance".
      this.emitPlayerStats();
    });
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
      if (monster?.alive) this.toggleTarget(monster);
    });
    bus.on(EVENTS.DROP_ITEM, (payload: DropItemPayload) => this.dropItem(payload.from, payload.screenX, payload.screenY));
    bus.on(EVENTS.PICKUP_ITEM, (payload: PickupItemPayload) => this.pickupItem(payload.index));
    bus.on(EVENTS.CLOSE_PICKUP_PROMPT, () => {
      this.pendingPickupPile = null;
    });
    bus.on(EVENTS.SET_MOVE_DIRECTION, (payload: SetMoveDirectionPayload) => {
      this.heldDirection = payload.dx === 0 && payload.dy === 0 ? null : { x: payload.dx, y: payload.dy };
      // Manual D-pad input always wins over a queued auto-walk (chase-to-attack
      // aside — that's re-issued every RECHASE_INTERVAL_MS and just gets
      // overridden again next frame while a direction is held).
      if (this.heldDirection) this.playerPath = [];
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
    const wholeTreeCells: { x: number; y: number; textureKey: string }[] = [];
    forEachTile((x, y, tile) => {
      if (tile.animated) {
        animatedCells.push({ x, y, key: tile.textureKey });
        return;
      }
      rt.draw(variantForCell(tile, x, y), x * TILE_SIZE, y * TILE_SIZE);
      const wholeTree = wholeTreeForCell(tile, x, y);
      if (wholeTree) wholeTreeCells.push({ x, y, textureKey: wholeTree });
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

    // Single-sprite trees (trunk+foliage baked into one image) — anchored
    // and depth-sorted the same way a building is, so the player is
    // properly hidden walking behind one.
    for (const cell of wholeTreeCells) {
      this.add
        .image(tileAnchorX(cell.x), tileAnchorY(cell.y), cell.textureKey)
        .setOrigin(1, 1)
        .setDepth(depthForTileY(cell.y));
    }
  }

  private buildEnvironmentDecoration() {
    for (const building of BUILDINGS) {
      // Anchor at the bottom-right tile of the footprint (Tibia-style oblique
      // anchor) so the building leans up-left over the tiles behind it. Every
      // building image is drawn exactly footprintW * TILE_SIZE wide (see
      // generate-assets.mjs) so this lands flush against the footprint with
      // no gap or overlap.
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
      if (prop.textureKey === "chimney-brick") {
        this.startChimneySmoke(sprite);
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
   * Loops a drifting smoke puff above a chimney for as long as the scene
   * runs. The source art only has a static wisp baked in — this is what
   * actually gives it motion, same tween-and-destroy idiom as burst() below,
   * just repeating on a timer instead of firing once.
   */
  private startChimneySmoke(chimneySprite: Phaser.GameObjects.Image) {
    const topX = chimneySprite.x - chimneySprite.displayWidth / 2;
    const topY = chimneySprite.y - chimneySprite.displayHeight;
    const spawnPuff = () => {
      const puff = this.add
        .image(topX + (Math.random() * 6 - 3), topY, "fx-smoke")
        .setDepth(chimneySprite.depth + 0.1)
        .setAlpha(0.55)
        .setScale(0.5 + Math.random() * 0.15);
      this.tweens.add({
        targets: puff,
        x: puff.x + (Math.random() * 16 - 8),
        y: puff.y - 26 - Math.random() * 10,
        scale: puff.scaleX + 0.6,
        alpha: 0,
        duration: 2200 + Math.random() * 800,
        ease: "Sine.Out",
        onComplete: () => puff.destroy(),
      });
    };
    // Staggered start (not all chimneys puffing in lockstep) plus a steady
    // repeat — a new puff every ~900ms-1.3s reads as a light, continuous
    // trickle rather than a smoke machine.
    this.time.delayedCall(Math.random() * 900, () => {
      spawnPuff();
      this.time.addEvent({ delay: 900 + Math.random() * 400, loop: true, callback: spawnPuff });
    });
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

    // Any new tap-driven action supersedes an in-progress "walk over to a
    // pile so it can be picked up" — otherwise the periodic re-chase in
    // updatePickupWalk would keep overriding wherever the player just told
    // themselves to go instead.
    this.pendingWalkToPile = null;

    const wx = pointer.worldX;
    const wy = pointer.worldY;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);

    // Loot bags handle their own tap (open) and drag (push) via per-sprite
    // handlers in wireLootBagInput — the world tap just shouldn't fall through
    // to tile/climb logic when a bag was pressed.
    if (this.corpses.some((c) => c.sprite.getBounds().contains(wx, wy))) return;

    // A ground pile is picked up via hold-to-open-menu, not a plain tap.
    const hitPile = this.groundPiles.find((p) => p.sprite.getBounds().contains(wx, wy));
    if (hitPile) {
      this.startPickupHold(pointer, hitPile);
      return;
    }

    const hitNpc = this.npcs.find((n) => n.sprite.getBounds().contains(wx, wy));
    if (hitNpc) {
      this.interactWithNpc(hitNpc.def);
      return;
    }

    const hitMonster = this.monsters.find((m) => m.alive && m.sprite.getBounds().contains(wx, wy));
    if (hitMonster) {
      this.toggleTarget(hitMonster);
      return;
    }

    if (!this.isWalkableForMover(tx, ty)) return;

    // A ladder/hatch's hold-to-climb only starts once the player is already
    // on or right next to it (walked over via the D-pad) — the D-pad is the
    // only way to move now, so there's no "walk there" fallback left to fall
    // back to.
    const down = sewerLinkAtSurface(tx, ty);
    const up = down ? null : sewerLinkAtSewer(tx, ty);
    const climbLink = down ?? up;
    if (climbLink && chebyshevDistance(this.player.tile, { x: tx, y: ty }) <= 1) {
      this.startClimbHold(pointer, climbLink, down ? "down" : "up");
    }
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
    this.target?.setTargeted(false);
    this.target = monster;
    monster.setTargeted(true);
    this.chaseTimer = 0;
    bus.emit(EVENTS.TARGET, { name: monster.def.name, hp: monster.hp, maxHp: monster.def.hp });
  }

  /** Re-selecting the current target un-targets it instead — same toggle whether picked via the Battle window or tapped in the world. */
  private toggleTarget(monster: Monster) {
    if (this.target === monster) this.clearTarget();
    else this.setTarget(monster);
  }

  private clearTarget() {
    this.target?.setTargeted(false);
    this.target = null;
    bus.emit(EVENTS.TARGET, null);
    this.pendingWalkToPile = null;
    this.pendingPickupIndex = null;
  }

  /**
   * Living entities block a tile the same way solid terrain does — so
   * monsters can't stack on each other, and neither side can path onto the
   * other. The entity actually being chased (a combat target) is excluded:
   * both the player and monsters path toward their target's own tile as the
   * pathfinding goal, then stop once in range, so treating that one tile as
   * "occupied" would make findPath's goal-reachability check fail and break
   * chasing outright.
   */
  private isWalkableForMover(
    x: number,
    y: number,
    opts: { ignoreMonster?: Monster; ignorePlayer?: boolean } = {},
  ): boolean {
    if (!isWalkable(x, y)) return false;
    if (!opts.ignorePlayer && this.player.tileX === x && this.player.tileY === y) return false;
    for (const m of this.monsters) {
      if (!m.alive || m === opts.ignoreMonster) continue;
      // A multi-tile creature (see MonsterDef.footprintTiles) blocks every
      // tile its body actually covers, not just the one its sprite anchors
      // to — otherwise something could path straight through a bear's back
      // legs.
      if (m.occupiedTiles().some((t) => t.x === x && t.y === y)) return false;
    }
    return true;
  }

  update(_time: number, delta: number) {
    if (this.player.hp <= 0) {
      this.handlePlayerDeath();
      return;
    }

    for (const monster of this.monsters) {
      monster.update(
        delta,
        this.player.tile,
        this.player.hp > 0,
        (x, y) => this.isWalkableForMover(x, y, { ignorePlayer: true, ignoreMonster: monster }),
        (attacker) => this.resolveMonsterAttack(attacker),
        frictionAt,
      );
    }

    this.updateCombat(delta);
    this.updatePickupWalk(delta);
    this.updatePlayerMovement(delta);
    this.updateLootBagWindows();

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

    // Building the debug payload allocates several objects/arrays and calls
    // resolveAttackMode() purely for a readout — skip all of that when the
    // overlay isn't even showing (the overwhelmingly common case), rather
    // than paying the cost every frame regardless of ?debug=1.
    if (this.debug.isEnabled()) {
      this.debug.update(this.player.tile, {
        mobs: this.monsters.filter((m) => m.alive).length,
        corpse: this.corpses.length,
        mode: this.resolveAttackMode().mode,
        stance: COMBAT_STANCE_NAMES[this.player.combatStance],
        time: this.dayNight.phaseName,
        ...(this.lastDistanceDebug
          ? {
              "dist  ": `${this.lastDistanceDebug.distance} tiles`,
              "hit%  ": `${this.lastDistanceDebug.hitChance}%`,
              "roll  ": this.lastDistanceDebug.roll,
              "result": this.lastDistanceDebug.result,
            }
          : {}),
        ...(this.lastMonsterAttackDebug
          ? {
              "mAtk  ": this.lastMonsterAttackDebug.name,
              "mHit% ": `${this.lastMonsterAttackDebug.hitChance}%`,
              "mResult": this.lastMonsterAttackDebug.result,
            }
          : {}),
      });
    }
  }

  private regenerate() {
    const player = this.player;
    const healedHp = player.hp < player.maxHp;
    const healedMana = player.mana < player.maxMana;
    const hasFoodRegen = player.foodRegenMsRemaining > 0;
    if (!healedHp && !healedMana && !hasFoodRegen) return;

    player.heal(Math.max(1, Math.floor(player.maxHp * HP_REGEN_FRACTION)));
    player.restoreMana(Math.max(1, Math.floor(player.maxMana * MANA_REGEN_FRACTION)));

    if (hasFoodRegen) {
      // Spread whatever's still owed evenly over the ticks left, so it lands
      // on exactly 0 remaining at exactly 0 ms remaining regardless of how
      // many times more food gets eaten in between.
      const ticksLeft = Math.ceil(player.foodRegenMsRemaining / REGEN_INTERVAL_MS);
      const thisTick = Math.ceil(player.foodRegenAmountRemaining / ticksLeft);
      player.heal(thisTick);
      player.foodRegenAmountRemaining = Math.max(0, player.foodRegenAmountRemaining - thisTick);
      player.foodRegenMsRemaining = Math.max(0, player.foodRegenMsRemaining - REGEN_INTERVAL_MS);
    }

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

    // This runs every BATTLE_LIST_INTERVAL_MS regardless of whether anything
    // changed — while just walking around with no nearby monster in combat,
    // that's the same (usually empty) list, over and over. Emitting it
    // unconditionally used to force a full sidebar teardown-and-rebuild
    // (every open panel, not just the battle list) 2.5x/sec continuously,
    // which is real, felt stutter, not a one-off. Skip the emit entirely
    // when the list is unchanged from last time.
    const key = entries.map((e) => `${e.id}:${e.hp}:${e.targeted ? 1 : 0}`).join(",");
    if (key === this.lastBattleListKey) return;
    this.lastBattleListKey = key;
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
    // Distance to whichever occupied tile is closest — a multi-tile
    // creature's trailing tiles count the same as its front for range.
    const dist = closestChebyshevDistance(this.player.tile, target.occupiedTiles());
    this.player.attackCooldown -= delta;

    if (dist <= range) {
      this.playerPath = []; // stop walking once in range, mirrors classic click-to-attack
      if (this.player.attackCooldown <= 0) this.performAttack(target, mode);
      return;
    }

    this.chaseTimer -= delta;
    if (this.chaseTimer <= 0 && !this.player.moving) {
      this.chaseTimer = RECHASE_INTERVAL_MS;
      this.playerPath = findPath(
        (x, y) => this.isWalkableForMover(x, y, { ignoreMonster: target }),
        this.player.tile,
        target.tile,
      );
    }
  }

  /** Mirrors updateCombat's chase-then-act loop: walk toward a distant pile, then complete the pick-up the player already asked for once in melee range. */
  private updatePickupWalk(delta: number) {
    const pile = this.pendingWalkToPile;
    if (!pile) return;
    if (!this.groundPiles.includes(pile)) {
      this.pendingWalkToPile = null; // decayed while the player was still walking over
      this.pendingPickupIndex = null;
      return;
    }

    if (chebyshevDistance(this.player.tile, { x: pile.tileX, y: pile.tileY }) <= MELEE_RANGE) {
      this.pendingWalkToPile = null;
      this.playerPath = [];
      const index = this.pendingPickupIndex;
      this.pendingPickupIndex = null;
      if (index !== null) this.executePickup(pile, index);
      return;
    }

    this.pickupChaseTimer -= delta;
    if (this.pickupChaseTimer <= 0 && !this.player.moving) {
      this.pickupChaseTimer = RECHASE_INTERVAL_MS;
      const path = findPath((x, y) => this.isWalkableForMover(x, y), this.player.tile, { x: pile.tileX, y: pile.tileY });
      if (path.length === 0) {
        this.pendingWalkToPile = null; // unreachable — give up quietly rather than polling forever
        return;
      }
      this.playerPath = path;
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
      // magic level — same rule as casting a spell. There's no wand entry in
      // the spell table, so its min/max coefficients scale with the
      // equipped wand's own attack value instead of a fixed spell design —
      // a better wand still means more damage, same as melee/distance gear.
      player.spendMana(WAND_MANA_COST);
      this.trainSkill("magic", WAND_MANA_COST);
      const wandScale = equipment.attackValue() / 50;
      const magicLevel = player.skills.level("magic");
      const min = spellMinPower(magicLevel, player.level, 3 * wandScale);
      const max = spellMaxPower(magicLevel, player.level, 5 * wandScale);
      damage = rollDamage(min, max);
      this.fireProjectile(target, "spell-flame");
    } else {
      const skill: SkillId = mode === "distance" ? "distance" : "melee";
      const attack = equipment.attackValue();
      const skillLevel = player.skills.level(skill);
      const combatFactor = COMBAT_FACTORS[player.combatStance];
      if (mode === "distance") {
        // Hit chance is its own roll, entirely separate from the damage
        // range — a miss deals 0 and never touches meleeMinDamage/
        // distanceMaxDamage; a hit rolls the normal range untouched by
        // whatever the hit chance happened to be.
        const maxRange = equipment.attackRange();
        const dist = closestChebyshevDistance(player.tile, target.occupiedTiles());
        const hitChancePct = distanceHitChance(dist, maxRange) * 100;
        const roll = Math.random() * 100;
        const hit = roll < hitChancePct;
        this.lastDistanceDebug = {
          distance: dist,
          hitChance: Math.round(hitChancePct),
          roll: Math.round(roll * 10) / 10,
          result: hit ? "HIT" : "MISS",
        };
        if (hit) {
          const max = distanceMaxDamage(skillLevel, attack, player.level, combatFactor);
          damage = rollDamage(distanceMinDamage(player.level), max);
          // Only a landed hit counts as a "try" for training — a miss never happened as far as the skill is concerned.
          this.trainSkill(skill, 1);
        } else {
          damage = 0;
        }
        this.consumeAmmo();
        this.fireProjectile(target, "arrow");
      } else {
        const max = meleeMaxDamage(skillLevel, attack, player.level, combatFactor);
        damage = rollDamage(meleeMinDamage(max), max);
        this.trainSkill(skill, 1);
      }
    }

    // Magic (wand) damage skips physical armor mitigation per the design
    // doc — ARM/Shielding are a physical-combat concept and shouldn't
    // automatically blunt a magical attack the way they would a sword blow.
    if (mode !== "wand") {
      damage = calculateArmorMitigation(damage, target.def.armor);
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
      const text = `You advanced to ${SKILL_LOG_NAMES[skill]} level ${this.player.skills.level(skill)}.`;
      this.log("levelup", text);
      this.showLevelUpBanner(text);
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
      if (closestChebyshevDistance(player.tile, target.occupiedTiles()) > (spell.range ?? 1)) {
        this.log("info", "The target is too far away.");
        return;
      }
    }

    player.spendMana(spell.manaCost);
    this.trainSkill("magic", spell.manaCost);
    this.log("info", `You say: "${spell.words}".`);

    const magicLevel = player.skills.level("magic");
    const power = rollDamage(
      spellMinPower(magicLevel, player.level, spell.minCoefficient),
      spellMaxPower(magicLevel, player.level, spell.maxCoefficient),
    );
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

  /** Diagonal corner-cutting is blocked exactly like findPath's own rule — never squeeze between two solid tiles. */
  private canStepInDirection(dir: TileCoord): boolean {
    const next = { x: this.player.tileX + dir.x, y: this.player.tileY + dir.y };
    if (!this.isWalkableForMover(next.x, next.y)) return false;
    if (dir.x !== 0 && dir.y !== 0) {
      const cornerA = this.isWalkableForMover(this.player.tileX + dir.x, this.player.tileY);
      const cornerB = this.isWalkableForMover(this.player.tileX, this.player.tileY + dir.y);
      if (!cornerA || !cornerB) return false;
    }
    return true;
  }

  private updatePlayerMovement(_delta: number) {
    if (this.player.moving) return;

    if (this.heldDirection) {
      const dir = this.heldDirection;
      if (this.canStepInDirection(dir)) {
        const next = { x: this.player.tileX + dir.x, y: this.player.tileY + dir.y };
        void this.player.stepTo(next.x, next.y, frictionAt(next.x, next.y)).then(() => {
          this.emitPlayerStats();
          this.checkForZoneIn();
        });
      }
      return;
    }

    if (this.playerPath.length === 0) return;
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
   * panel, and releasing early just cancels — there's no walk-there fallback
   * now that the D-pad is the only way to move.
   */
  private startClimbHold(pointer: Phaser.Input.Pointer, link: SewerLink, direction: "down" | "up") {
    this.cancelClimbHold();
    const startX = pointer.x;
    const startY = pointer.y;

    const onMove = (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.x, p.y, startX, startY) > 12) this.cancelClimbHold();
    };

    this.input.on("pointerup", this.cancelClimbHold, this);
    this.input.on("pointermove", onMove);
    this.climbHoldCleanup = () => {
      this.input.off("pointerup", this.cancelClimbHold, this);
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
   * Same hold-then-confirm shape as startClimbHold: a short tap on the pile
   * just cancels, and a sustained hold opens the pick-up menu.
   */
  private startPickupHold(pointer: Phaser.Input.Pointer, pile: GroundPile) {
    this.cancelPickupHold();
    const startX = pointer.x;
    const startY = pointer.y;

    const onMove = (p: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(p.x, p.y, startX, startY) > 12) this.cancelPickupHold();
    };

    this.input.on("pointerup", this.cancelPickupHold, this);
    this.input.on("pointermove", onMove);
    this.pickupHoldCleanup = () => {
      this.input.off("pointerup", this.cancelPickupHold, this);
      this.input.off("pointermove", onMove);
    };

    // The menu itself opens from anywhere the pile is visible on screen —
    // same as a drop's screen range — only actually taking an item (see
    // pickupItem) is gated to melee range.
    this.pickupHoldTimer = this.time.delayedCall(WorldScene.CLIMB_HOLD_MS, () => {
      this.pickupHoldCleanup?.();
      this.pickupHoldCleanup = null;
      this.pickupHoldTimer = null;
      this.pendingPickupPile = pile;
      bus.emit(EVENTS.OPEN_PICKUP_PROMPT, { entries: this.pickupEntriesFor(pile) });
    });
  }

  private cancelPickupHold() {
    this.pickupHoldTimer?.remove();
    this.pickupHoldTimer = null;
    this.pickupHoldCleanup?.();
    this.pickupHoldCleanup = null;
  }

  private pickupEntriesFor(pile: GroundPile): PickupPromptEntry[] {
    const entries: PickupPromptEntry[] = [];
    pile.container.slots.forEach((slot, index) => {
      if (!slot) return;
      entries.push({ index, itemId: slot.itemId, name: ITEMS[slot.itemId]?.name ?? slot.itemId, count: slot.count });
    });
    return entries;
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

  // --- Pause / resume ------------------------------------------------------
  /** DOM pause/resume button, the "PAUSED" overlay, and the key handler. */
  private pauseButton: HTMLButtonElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;
  private pauseKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  /**
   * The scene we paused for the user, so Resume targets exactly it. null when
   * not user-paused. Kept separate from the engine's own scene.pause() used
   * for interiors/climbs so the two never get confused.
   */
  private userPausedScene: string | null = null;

  /**
   * Pause sits next to Log Out as an HTML button — same reasoning as
   * buildLogoutButton: a DOM control keeps working while the gameplay scene
   * itself is paused (a Phaser button on a paused scene would freeze with it),
   * and the P / Escape shortcut is a DOM key listener for the same reason.
   */
  private buildPauseButton() {
    if (this.pauseButton) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Pause";
    btn.style.cssText = [
      "position: absolute",
      "top: 8px",
      "left: 84px",
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
    btn.addEventListener("click", () => this.togglePause());
    document.body.appendChild(btn);
    this.pauseButton = btn;

    this.pauseKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        this.togglePause();
      }
    };
    window.addEventListener("keydown", this.pauseKeyHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyPauseButton());
  }

  private destroyPauseButton() {
    // Never leave the game frozen if the scene is torn down mid-pause.
    if (this.userPausedScene) this.resumeGame();
    if (this.pauseKeyHandler) window.removeEventListener("keydown", this.pauseKeyHandler);
    this.pauseKeyHandler = null;
    if (this.pauseButton?.parentNode) this.pauseButton.parentNode.removeChild(this.pauseButton);
    this.pauseButton = null;
    this.removePauseOverlay();
  }

  private togglePause() {
    if (this.userPausedScene) this.resumeGame();
    else this.pauseGame();
  }

  private pauseGame() {
    if (this.userPausedScene) return;
    // Freeze whichever gameplay scene is actually running: the interior when
    // one is open (World is already paused underneath it), otherwise World.
    const target = this.scene.isActive("Interior") ? "Interior" : this.scene.isActive("World") ? "World" : null;
    if (!target) return;
    this.scene.pause(target);
    this.userPausedScene = target;
    if (this.pauseButton) this.pauseButton.textContent = "Resume";
    this.showPauseOverlay();
  }

  private resumeGame() {
    if (!this.userPausedScene) return;
    this.scene.resume(this.userPausedScene);
    this.userPausedScene = null;
    if (this.pauseButton) this.pauseButton.textContent = "Pause";
    this.removePauseOverlay();
  }

  private showPauseOverlay() {
    if (this.pauseOverlay) return;
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position: absolute",
      "inset: 0",
      "z-index: 30",
      "display: flex",
      "flex-direction: column",
      "align-items: center",
      "justify-content: center",
      "gap: 16px",
      "background: rgba(0,0,0,0.6)",
      "font-family: monospace",
      "color: #f4e6c8",
      "cursor: pointer",
    ].join(";");

    const label = document.createElement("div");
    label.textContent = "PAUSED";
    label.style.cssText = "font-size: 32px; letter-spacing: 4px; text-shadow: 0 2px 4px #000";

    const resume = document.createElement("button");
    resume.type = "button";
    resume.textContent = "Resume";
    resume.style.cssText = [
      "padding: 8px 20px",
      "font-family: monospace",
      "font-size: 14px",
      "color: #f4e6c8",
      "background: rgba(13,13,13,0.9)",
      "border: 1px solid #6a5a34",
      "border-radius: 3px",
      "cursor: pointer",
    ].join(";");

    const hint = document.createElement("div");
    hint.textContent = "press P or Esc";
    hint.style.cssText = "font-size: 11px; opacity: 0.7";

    // A click anywhere on the dimmed backdrop resumes too, but not clicks that
    // land on the button itself (it handles its own).
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.resumeGame();
    });
    resume.addEventListener("click", () => this.resumeGame());

    overlay.appendChild(label);
    overlay.appendChild(resume);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
    this.pauseOverlay = overlay;
  }

  private removePauseOverlay() {
    if (this.pauseOverlay?.parentNode) this.pauseOverlay.parentNode.removeChild(this.pauseOverlay);
    this.pauseOverlay = null;
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
    const levelBefore = this.player.level;
    const { leveledUp } = this.player.gainExp(monster.def.xp);
    this.saveCharacter(); // exp / level are what the select screen shows
    this.log("xp", `You destroy the ${monster.def.name}. +${monster.def.xp} exp.`);
    this.floatText(this.spriteCenterX(this.player.sprite), this.spriteTopY(this.player.sprite) - 14, `+${monster.def.xp} xp`, "#8fd0ff");
    if (leveledUp) {
      const text = `You advanced from level ${levelBefore} to level ${this.player.level}.`;
      this.log("levelup", text);
      this.showLevelUpBanner(text);
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
    // No loot, no bag — the monster just vanishes (its sprite is already hidden by die()).
    if (drops.length > 0) this.spawnCorpse(monster, drops);
    this.emitPlayerStats();
  }

  /**
   * A monster that dropped loot leaves a loot bag centred on the tile it died
   * on (the monster's own sprite is already hidden by Monster.die()). The bag
   * is just a container, so looting reuses the same drag the player already
   * uses between backpacks — but its window auto-opens/closes with proximity
   * (see updateLootBagWindows) and it can be dragged around to "push" it.
   */
  private spawnCorpse(monster: Monster, loot: { itemId: string; amount: number }[]) {
    const tileX = monster.tileX;
    const tileY = monster.tileY;
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = tileY * TILE_SIZE + TILE_SIZE / 2;

    const sprite = this.add
      .sprite(cx, cy, "loot-bag")
      .setOrigin(0.5, 0.5)
      .setScale(0.85)
      .setDepth(depthForTileY(tileY) - 1)
      .setInteractive({ draggable: true, useHandCursor: true });

    const label = this.add
      .text(cx, tileY * TILE_SIZE - 2, `${monster.def.name} Loot`, {
        ...CREATURE_LABEL_STYLE,
      })
      .setOrigin(0.5, 1)
      .setDepth(LABEL_DEPTH + 1);

    const container = new Container(`${monster.def.name} Loot`, "loot-bag", CORPSE_CAPACITY);
    for (const drop of loot) container.addItem(drop.itemId, drop.amount);
    this.lootContainerIds.add(container.id);

    const corpse: Corpse = {
      sprite,
      label,
      container,
      name: monster.def.name,
      tileX,
      tileY,
      dragging: false,
      decayTimer: this.time.delayedCall(CORPSE_DECAY_MS, () => this.removeCorpse(corpse)),
    };
    this.corpses.push(corpse);
    this.wireLootBagInput(corpse);
  }

  /** Tap a bag (that wasn't a push-drag) to open it; drag it to push it to another tile. */
  private wireLootBagInput(corpse: Corpse) {
    corpse.sprite.on("dragstart", () => {
      corpse.dragging = true;
    });
    corpse.sprite.on("drag", (pointer: Phaser.Input.Pointer) => {
      corpse.sprite.setPosition(pointer.worldX, pointer.worldY);
      corpse.label.setPosition(pointer.worldX, pointer.worldY - TILE_SIZE / 2);
    });
    corpse.sprite.on("dragend", (pointer: Phaser.Input.Pointer) => {
      this.dropLootBag(corpse, pointer.worldX, pointer.worldY);
      // Reset on the next tick so the pointerup that follows dragend still sees dragging=true and skips opening.
      this.time.delayedCall(0, () => (corpse.dragging = false));
    });
    corpse.sprite.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (corpse.dragging || pointer.getDistance() > 8) return;
      this.tryOpenCorpse(corpse);
    });
  }

  /** Land a pushed bag on the nearest walkable tile under the release point (capped range), else snap back. */
  private dropLootBag(corpse: Corpse, worldX: number, worldY: number) {
    let tx = Math.floor(worldX / TILE_SIZE);
    let ty = Math.floor(worldY / TILE_SIZE);
    const withinReach = chebyshevDistance({ x: tx, y: ty }, { x: corpse.tileX, y: corpse.tileY }) <= LOOT_BAG_PUSH_RANGE;
    if (!withinReach || !this.isWalkableForMover(tx, ty)) {
      tx = corpse.tileX;
      ty = corpse.tileY;
    }
    this.placeLootBag(corpse, tx, ty);
  }

  private placeLootBag(corpse: Corpse, tx: number, ty: number) {
    corpse.tileX = tx;
    corpse.tileY = ty;
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    corpse.sprite.setPosition(cx, ty * TILE_SIZE + TILE_SIZE / 2).setDepth(depthForTileY(ty) - 1);
    corpse.label.setPosition(cx, ty * TILE_SIZE - 2).setDepth(LABEL_DEPTH + 1);
  }

  private removeCorpse(corpse: Corpse) {
    const idx = this.corpses.indexOf(corpse);
    if (idx >= 0) this.corpses.splice(idx, 1);
    this.lootContainerIds.delete(corpse.container.id);
    corpse.decayTimer.remove();
    this.closeContainer(corpse.container); // don't leave a window onto a vanished bag
    corpse.label.destroy();
    corpse.sprite.destroy();
  }

  /** Open the loot window, but only when the player is standing on or beside the bag. */
  private tryOpenCorpse(corpse: Corpse) {
    if (chebyshevDistance(this.player.tile, { x: corpse.tileX, y: corpse.tileY }) > 1) {
      this.log("info", "You are too far away.");
      return;
    }
    if (corpse.container.usedSlots === 0) {
      this.removeCorpse(corpse);
      return;
    }
    this.openContainer(corpse.container);
  }

  /** Close any loot window whose bag the player has stepped more than one tile away from. */
  private updateLootBagWindows() {
    for (const corpse of this.corpses) {
      if (!this.openContainers.includes(corpse.container)) continue;
      if (chebyshevDistance(this.player.tile, { x: corpse.tileX, y: corpse.tileY }) > 1) {
        this.closeContainer(corpse.container);
      }
    }
  }

  // --- Ground item piles ---------------------------------------------------

  private groundPileAt(tx: number, ty: number): GroundPile | undefined {
    return this.groundPiles.find((p) => p.tileX === tx && p.tileY === ty);
  }

  private spawnGroundPile(tx: number, ty: number): GroundPile {
    const sprite = this.add
      .sprite(tileAnchorX(tx), tileAnchorY(ty), "gold-coin")
      .setOrigin(1, 1)
      .setScale(0.55)
      .setDepth(depthForTileY(ty) - 1);
    const container = new Container("Ground", "gold-coin", GROUND_PILE_CAPACITY);
    const pile: GroundPile = {
      sprite,
      container,
      tileX: tx,
      tileY: ty,
      decayTimer: this.time.delayedCall(GROUND_PILE_DECAY_MS, () => this.removeGroundPile(pile)),
    };
    this.groundPiles.push(pile);
    return pile;
  }

  /** Re-arms the decay timer (a fresh drop shouldn't vanish because an earlier one on the same tile is about to) and updates the sprite to show whatever was just added. */
  private touchGroundPile(pile: GroundPile, latestItemId: string) {
    pile.decayTimer.remove();
    pile.decayTimer = this.time.delayedCall(GROUND_PILE_DECAY_MS, () => this.removeGroundPile(pile));
    pile.sprite.setTexture(ITEMS[latestItemId]?.textureKey ?? pile.sprite.texture.key);
  }

  private removeGroundPile(pile: GroundPile) {
    const idx = this.groundPiles.indexOf(pile);
    if (idx >= 0) this.groundPiles.splice(idx, 1);
    pile.decayTimer.remove();
    pile.sprite.destroy();
    if (this.pendingPickupPile === pile) {
      this.pendingPickupPile = null;
      bus.emit(EVENTS.CLOSE_PICKUP_PROMPT);
    }
  }

  /** Finds a slot to receive itemId in `container`: an existing stackable stack with room first, then the first empty slot. Mirrors Container.addItem's own merge-then-empty-slot order without losing a source stack's nested container the way addItem(itemId, count) would. */
  private findDropDestination(container: Container, itemId: string): number {
    if (ITEMS[itemId]?.stackable) {
      const merge = container.slots.findIndex((s) => s?.itemId === itemId && s.count < STACK_MAX);
      if (merge >= 0) return merge;
    }
    return container.firstEmptySlot();
  }

  private dropItem(from: SlotRef, screenX: number, screenY: number) {
    const stack = this.slotAccessor.get(from);
    if (!stack) return;

    const world = this.cameras.main.getWorldPoint(screenX, screenY);
    let tx = Math.floor(world.x / TILE_SIZE);
    let ty = Math.floor(world.y / TILE_SIZE);
    if (!this.isWalkableForMover(tx, ty)) {
      tx = this.player.tile.x;
      ty = this.player.tile.y;
    }

    const pile = this.groundPileAt(tx, ty) ?? this.spawnGroundPile(tx, ty);
    const index = this.findDropDestination(pile.container, stack.itemId);
    if (index < 0) {
      this.log("info", "There's no room to drop that here.");
      return;
    }

    if (!this.moveItem(from, { kind: "container", container: pile.container, index })) {
      if (pile.container.usedSlots === 0) this.removeGroundPile(pile); // don't leave a freshly-spawned empty pile behind
      return;
    }

    this.touchGroundPile(pile, stack.itemId);
    this.log("info", `You drop the ${ITEMS[stack.itemId]?.name ?? stack.itemId} on the ground.`);
  }

  /**
   * The menu itself opens from anywhere on screen (same as a drop), but
   * actually taking an item still requires melee range — tapping a row from
   * further away walks the character over first, then completes the same
   * pick-up automatically once they arrive, rather than requiring a second tap.
   */
  private pickupItem(index: number) {
    const pile = this.pendingPickupPile;
    if (!pile) return;

    if (chebyshevDistance(this.player.tile, { x: pile.tileX, y: pile.tileY }) <= MELEE_RANGE) {
      this.executePickup(pile, index);
      return;
    }

    this.pendingWalkToPile = pile;
    this.pendingPickupIndex = index;
    this.pickupChaseTimer = 0; // path toward it on the very next update tick
  }

  private executePickup(pile: GroundPile, index: number) {
    const stack = pile.container.slots[index];
    if (!stack) return;
    const backpack = this.player.backpack;
    if (!backpack) return;

    const destIndex = this.findDropDestination(backpack, stack.itemId);
    if (destIndex < 0) {
      this.log("info", "You cannot carry any more.");
      return;
    }

    const from: SlotRef = { kind: "container", container: pile.container, index };
    const to: SlotRef = { kind: "container", container: backpack, index: destIndex };
    if (!moveStack(this.slotAccessor, from, to)) {
      this.log("info", "You cannot carry any more.");
      return;
    }

    this.log("info", `You pick up the ${ITEMS[stack.itemId]?.name ?? stack.itemId}.`);
    this.emitInventory();
    this.emitInventoryState();

    if (pile.container.usedSlots === 0) {
      this.removeGroundPile(pile); // also clears pendingPickupPile and closes the menu
    } else if (this.pendingPickupPile === pile) {
      bus.emit(EVENTS.OPEN_PICKUP_PROMPT, { entries: this.pickupEntriesFor(pile) });
    }
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

  private moveItem(from: SlotRef, to: SlotRef): boolean {
    if (!moveStack(this.slotAccessor, from, to)) return false;

    // A container that just left the tree (swapped out of a slot, dropped in a
    // corpse) shouldn't keep a window open onto it.
    for (const container of [...this.openContainers]) {
      if (!this.isContainerReachable(container)) this.closeContainer(container);
    }

    this.emitInventory();
    this.emitInventoryState();
    this.emitSkills(); // weapon/armor swaps change the attack & defense readouts
    return true;
  }

  /** True if the container is the player's, nested in it, or an open corpse. */
  private isContainerReachable(container: Container): boolean {
    if (this.corpses.some((c) => c.container === container)) return true;
    const backpack = this.player.backpack;
    return backpack ? backpack.contains(container) : false;
  }

  /**
   * The full "monster attacks player" pipeline, matching the design doc's
   * staged architecture exactly: hit/miss roll (attacker's own accuracy,
   * entirely separate from damage) -> shield block (only if a shield is
   * actually equipped) -> armor mitigation -> physical resistance -> final
   * damage. Each stage is its own centralized function in skills.ts so nothing
   * here duplicates the armor/shield formulas a future spell or NPC attack
   * would also need.
   */
  private resolveMonsterAttack(attacker: MonsterDef) {
    const equipment = this.player.equipment;
    const px = this.spriteCenterX(this.player.sprite);
    const py = this.spriteTopY(this.player.sprite);

    const hit = rollMonsterHit(attacker.hitChance);
    this.lastMonsterAttackDebug = { name: attacker.name, hitChance: attacker.hitChance, result: hit ? "HIT" : "MISS" };
    if (!hit) {
      this.log("damage", `The ${attacker.name} misses you.`);
      this.floatText(px, py, "miss", "#a0a0a0");
      return;
    }

    // A landed attack is what shielding actually trains against — a whiffed
    // attacker never gave the defender anything to defend.
    this.trainSkill("shielding", 1);

    const blockChance = calculateShieldDefense({
      hasShieldEquipped: equipment.shieldBlockAvailable(),
      shieldDef: equipment.shieldDefense(),
      shieldingSkill: this.player.skills.level("shielding"),
      weaponDefBonus: equipment.weaponDefenseBonus(),
      defenseFactor: DEFENSE_FACTORS[this.player.combatStance],
    });
    if (Math.random() < blockChance) {
      this.lastMonsterAttackDebug.result = "BLOCK";
      this.log("damage", `You block the ${attacker.name}.`);
      this.floatText(px, py, "block", "#8fd0ff");
      return;
    }

    const rawDamage = rollDamage(attacker.minDamage, attacker.maxDamage);
    const afterArmor = calculateArmorMitigation(rawDamage, equipment.armorValue());
    const final = calculatePhysicalResistance(afterArmor, this.player.physicalResistance);

    if (final <= 0) {
      this.log("damage", `The ${attacker.name} hits you, but your armor holds.`);
      return;
    }

    this.player.takeDamage(final);
    this.log("damage", `The ${attacker.name} hits you for ${final}.`);
    const flashY = py + this.player.sprite.displayHeight / 2;
    this.flash(px, flashY, "fx-hit", 0xff8080);
    this.burst(px, flashY, "fx-blood", 3, 10);
    this.floatText(px, py, `-${final}`, "#ff5c5c");
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
    if (item.regenSeconds && item.regenPercentOfMaxHp) {
      const totalHeal = Math.round(this.player.maxHp * item.regenPercentOfMaxHp);
      this.player.addFoodRegen(totalHeal, item.regenSeconds * 1000);
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

  /**
   * A level-up/skill-up announcement, fixed at ~60% down the actual game
   * viewport (the main camera's own width/height already exclude the
   * sidebar, per applyUiLayout) rather than anchored to the player sprite —
   * unlike floatText, this should stay put and be readable regardless of
   * where the player or camera currently are.
   */
  private showLevelUpBanner(text: string) {
    const cam = this.cameras.main;
    // A single kill can grant an XP level-up and a skill level-up in the
    // same instant — stack banners under one another instead of letting a
    // second one land dead-center on top of the first, unreadable.
    const y = cam.height * 0.6 + this.activeLevelUpBanners.length * 24;
    const banner = this.add
      .text(cam.width / 2, y, text, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffe08a",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(500);
    this.activeLevelUpBanners.push(banner);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 1400,
      duration: 500,
      onComplete: () => {
        banner.destroy();
        const idx = this.activeLevelUpBanners.indexOf(banner);
        if (idx >= 0) this.activeLevelUpBanners.splice(idx, 1);
      },
    });
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
      combatStance: this.player.combatStance,
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
      lootContainerIds: [...this.lootContainerIds],
    });
  }

  private log(kind: LogKind, text: string) {
    bus.emit(EVENTS.LOG, { kind, text });
  }
}
