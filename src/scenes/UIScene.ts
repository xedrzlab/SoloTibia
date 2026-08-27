import Phaser from "phaser";
import {
  BattleListPayload,
  bus,
  EVENTS,
  InteriorStatePayload,
  InventoryPayload,
  InventoryStatePayload,
  LogPayload,
  OpenDialoguePayload,
  PlayerStatsPayload,
  SkillsPayload,
  TargetPayload,
} from "../game/events";
import { EquipSlot, ITEMS } from "../data/items";
import { SHOPS } from "../data/shops";
import { SPELLS, SPELL_BAR } from "../data/spells";
import { Container, ItemStack, SlotRef } from "../game/containers";
import { Equipment, EQUIP_SLOT_NAMES } from "../game/equipment";
import { VOCATION_DESCRIPTIONS, VOCATION_NAMES, ChosenVocation } from "../game/stats";

// --- UI scale: one factor derived from the actual viewport, so a phone's
// small landscape screen gets proportionally smaller chrome instead of the
// same fixed pixel sizes tuned on a full-size desktop test window. Clamped
// so it never shrinks tap targets below a comfortable size or grows text
// oversized on a tablet. Recomputed on scene create + on resize.
const UI_SCALE_MIN = 0.7;
const UI_SCALE_MAX = 1.1;
// Baseline viewport this UI was designed at (~900x420 desktop test window).
const UI_SCALE_BASE_W = 900;
const UI_SCALE_BASE_H = 420;
function computeUiScale(): number {
  if (typeof window === "undefined") return 1;
  return Phaser.Math.Clamp(
    Math.min(window.innerWidth / UI_SCALE_BASE_W, window.innerHeight / UI_SCALE_BASE_H),
    UI_SCALE_MIN,
    UI_SCALE_MAX,
  );
}
let UI_SCALE = computeUiScale();

/** Rounds a design-time px value by the current UI scale for a Phaser text style. */
function fs(px: number): string {
  return `${Math.round(px * UI_SCALE)}px`;
}

// --- Sidebar geometry, modelled on the 176px-wide classic Tibia client panel.
// Scaled by UI_SCALE, but also hard-capped as a fraction of the actual
// screen width so the sidebar + Battle panel together can never eat an
// outsized share of a narrow phone screen (the previous version scaled off
// viewport height alone, which let a wide-but-short phone screen keep a
// full-width sidebar).
const SIDEBAR_WIDTH_MAX = 176;
const SIDEBAR_WIDTH_MIN = 112;
function computeSidebarWidth(): number {
  const w = typeof window !== "undefined" ? window.innerWidth : SIDEBAR_WIDTH_MAX;
  const scaled = Math.round(SIDEBAR_WIDTH_MAX * UI_SCALE);
  // The sidebar and the Battle panel next to it are BOTH this width, so this
  // fraction is really half of what the two columns cost the player — keep
  // it tight enough that a phone still gets most of its width back for the
  // actual game view.
  const capByWidth = Math.round(w * 0.17);
  return Phaser.Math.Clamp(Math.min(scaled, capByWidth), SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
}
let SIDEBAR_WIDTH = computeSidebarWidth();
let PAD = Math.round(6 * UI_SCALE);
let BAR_H = Math.round(14 * UI_SCALE);
/** Equipment/backpack slots are drag targets, so they get their own floor rather than following UI_SCALE all the way down. */
let SLOT = Math.max(26, Math.round(32 * UI_SCALE));
let SLOT_GAP = Math.max(1, Math.round(2 * UI_SCALE));
let WINDOW_TITLE_H = Math.max(16, Math.round(20 * UI_SCALE));
let TOGGLE_W = Math.round(18 * UI_SCALE);
let BATTLE_ROW_H = Math.round(24 * UI_SCALE);
/** Action bar slots are the primary combat tap targets — floored well above the scale-down of decorative chrome. */
let ACTION_SLOT_SIZE = Math.max(36, Math.round(40 * UI_SCALE));
let ACTION_SLOT_GAP = Math.round(6 * UI_SCALE);

/** Recomputes every scaled layout constant from the current viewport. Call on create() and on resize. */
function applyUiScale() {
  UI_SCALE = computeUiScale();
  SIDEBAR_WIDTH = computeSidebarWidth();
  PAD = Math.round(6 * UI_SCALE);
  BAR_H = Math.round(14 * UI_SCALE);
  SLOT = Math.max(26, Math.round(32 * UI_SCALE));
  SLOT_GAP = Math.max(1, Math.round(2 * UI_SCALE));
  WINDOW_TITLE_H = Math.max(16, Math.round(20 * UI_SCALE));
  TOGGLE_W = Math.round(18 * UI_SCALE);
  BATTLE_ROW_H = Math.round(24 * UI_SCALE);
  ACTION_SLOT_SIZE = Math.max(36, Math.round(40 * UI_SCALE));
  ACTION_SLOT_GAP = Math.round(6 * UI_SCALE);
}

/** How close a dragged panel's edge has to land near another panel's edge to snap flush against it. */
const SNAP_THRESHOLD = 14;
const PANEL_POS_STORAGE_KEY = "solotibia:ui:panelPositions";

interface PanelPos {
  x: number;
  y: number;
}

interface PanelRect extends PanelPos {
  w: number;
  h: number;
}

const COLORS = {
  panelBg: 0x151515,
  sidebarBg: 0x0d0d0d,
  windowBg: 0x1c1c1c,
  titleBg: 0x2b2b2b,
  slotBg: 0x000000,
  border: 0x3a3a3a,
  hp: 0xc9302f,
  mana: 0x2f6fa8,
  xp: 0xe6c34a,
  barBg: 0x000000,
  accent: 0xe6c34a,
};

const TEXT = { fontFamily: "monospace" } as const;

/** The paper-doll grid, matching the classic client's 3-wide arrangement. */
const EQUIP_LAYOUT: { slot: EquipSlot; col: number; row: number }[] = [
  { slot: "neck", col: 0, row: 0 },
  { slot: "head", col: 1, row: 0 },
  { slot: "back", col: 2, row: 0 },
  { slot: "left", col: 0, row: 1 },
  { slot: "armor", col: 1, row: 1 },
  { slot: "right", col: 2, row: 1 },
  { slot: "ring", col: 0, row: 2 },
  { slot: "legs", col: 1, row: 2 },
  { slot: "ammo", col: 2, row: 2 },
  { slot: "feet", col: 1, row: 3 },
];

const EQUIP_ROWS = 4;
function equipGridHeight(): number {
  return EQUIP_ROWS * SLOT + (EQUIP_ROWS - 1) * SLOT_GAP;
}

interface DropTarget {
  rect: Phaser.Geom.Rectangle;
  ref: SlotRef;
}

interface ActionSlot {
  kind: "item" | "spell";
  id: string;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

const LOG_COLORS: Record<string, string> = {
  damage: "#e2e2e2",
  loot: "#e6c34a",
  xp: "#8fd0ff",
  levelup: "#7cff7c",
  info: "#a0a0a0",
};

export class UIScene extends Phaser.Scene {
  // --- Live model state, pushed over the bus by WorldScene ------------------
  private stats: PlayerStatsPayload | null = null;
  private skills: SkillsPayload | null = null;
  private equipment: Equipment | null = null;
  private openContainers: Container[] = [];
  private capacityUsed = 0;
  private maxCapacity = 0;
  private battleEntries: BattleListPayload["entries"] = [];
  private inventory: Record<string, number> = {};

  // --- Sidebar view state ---------------------------------------------------
  private sidebarLayer!: Phaser.GameObjects.Layer;
  private sidebarOpen = true;
  /**
   * When true, the equipment paperdoll + derived stats block collapses away,
   * leaving just the health/mana bars on top of the sidebar body. Toggle via
   * the ▾/▸ button next to the HP bar; state persists across sidebar
   * refreshes.
   */
  private equipmentOpen = true;
  // (interior state is only used to drive action-bar visibility inside onInteriorState)
  private collapsed = new Set<string>();
  private dropTargets: DropTarget[] = [];
  private sidebarDirty = true;

  // --- Panel positions --------------------------------------------------------
  // Every window (Character, Battle, Skills, each open backpack) is an
  // independently draggable panel. Position is keyed by a stable panel id
  // ("character" | "battle" | "skills" | `c:${container.id}`), assigned a
  // default the first time the panel appears and persisted to localStorage
  // once the player drags it, so a custom layout survives a reload.
  private panelPos = new Map<string, PanelPos>();
  /** Last-rendered bounding box per panel id — used for hit-testing and snap targets. */
  private panelRects = new Map<string, PanelRect>();
  private draggingPanelId: string | null = null;
  private panelDragAnchor = { x: 0, y: 0 };
  private battleScrollY = 0;
  private battleScrollDragAnchor = 0;

  // --- Item drag ------------------------------------------------------------
  private dragGhost: Phaser.GameObjects.Image | null = null;
  private dragFrom: SlotRef | null = null;

  // --- Floating (over-world) UI --------------------------------------------
  private targetPanel!: Phaser.GameObjects.Container;
  private targetLabel!: Phaser.GameObjects.Text;
  private targetBarBg!: Phaser.GameObjects.Rectangle;
  private targetBarFill!: Phaser.GameObjects.Rectangle;
  private actionSlots: ActionSlot[] = [];
  private logLines: Phaser.GameObjects.Text[] = [];
  private logMessages: { text: string; color: string }[] = [];
  private toggleBg!: Phaser.GameObjects.Rectangle;
  private toggleText!: Phaser.GameObjects.Text;

  // --- Modal panels ---------------------------------------------------------
  private shopPanel!: Phaser.GameObjects.Container;
  private shopOpen = false;
  private currentShop: { npcId: string; npcName: string } | null = null;
  private vocationPanel!: Phaser.GameObjects.Container;
  private vocationOpen = false;
  private dialoguePanel!: Phaser.GameObjects.Container;
  private dialogueOpen = false;
  private currentDialogue: OpenDialoguePayload | null = null;

  private readonly DIALOGUE_WIDTH = 280;
  private readonly DIALOGUE_HEIGHT = 190;

  constructor() {
    super({ key: "UI", active: false });
  }

  create() {
    // Compute real sizes for this viewport before anything is built — the
    // action bar in particular sizes its slots once at construction time.
    applyUiScale();

    this.sidebarLayer = this.add.layer().setDepth(120);
    this.loadPanelPositions();

    this.buildTargetPanel();
    this.buildActionBar();
    this.buildLog();
    this.buildSidebarToggle();
    this.buildShopPanel();
    this.buildVocationPanel();
    this.buildDialoguePanel();
    this.setupDragAndDrop();

    bus.on(EVENTS.PLAYER_STATS, (p: PlayerStatsPayload) => {
      this.stats = p;
      this.sidebarDirty = true;
    });
    bus.on(EVENTS.SKILLS, (p: SkillsPayload) => {
      this.skills = p;
      this.sidebarDirty = true;
    });
    bus.on(EVENTS.INVENTORY_STATE, (p: InventoryStatePayload) => {
      this.equipment = p.equipment;
      this.openContainers = p.openContainers;
      this.capacityUsed = p.capacityUsed;
      this.maxCapacity = p.maxCapacity;
      this.sidebarDirty = true;
    });
    bus.on(EVENTS.BATTLE_LIST, (p: BattleListPayload) => {
      this.battleEntries = p.entries;
      this.sidebarDirty = true;
    });
    bus.on(EVENTS.TARGET, (t: TargetPayload | null) => this.onTarget(t));
    bus.on(EVENTS.LOG, (l: LogPayload) => this.pushLog(l));
    bus.on(EVENTS.INVENTORY, (inv: InventoryPayload) => this.onInventory(inv));
    bus.on(EVENTS.OPEN_VOCATION_CHOICE, () => this.openVocationPanel());
    bus.on(EVENTS.OPEN_DIALOGUE, (p: OpenDialoguePayload) => this.openDialogue(p));
    bus.on(EVENTS.INTERIOR_STATE, (p: InteriorStatePayload) => this.onInteriorState(p.active));

    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const rect = this.panelRects.get("battle");
      if (!rect || !this.pointInRect(pointer.x, pointer.y, rect)) return;
      this.battleScrollY = Phaser.Math.Clamp(this.battleScrollY + dy * 0.5, 0, this.battleScrollBounds());
      this.sidebarDirty = true;
    });

    this.scale.on("resize", () => {
      applyUiScale();
      this.layout();
    });
    this.layout();
  }

  update() {
    // Re-rendering mid-drag would destroy the icon Phaser is dragging, so the
    // refresh waits until the drop lands (which sets the flag again anyway).
    if (this.sidebarDirty && !this.dragFrom) this.renderSidebar();
  }

  /** The Battle window's own panel, immediately left of the main sidebar. */
  private get battlePanelWidth(): number {
    return this.sidebarOpen ? SIDEBAR_WIDTH : 0;
  }

  /** Width the world view must leave free on the right — both panels combined. */
  private get sidebarWidth(): number {
    return (this.sidebarOpen ? SIDEBAR_WIDTH : 0) + this.battlePanelWidth;
  }

  private get gameWidth(): number {
    return this.scale.width - this.sidebarWidth;
  }

  private layout() {
    const h = this.scale.height;
    const gw = this.gameWidth;

    this.targetPanel.setPosition(gw / 2, 8);

    const slotSize = ACTION_SLOT_SIZE;
    const slotGap = ACTION_SLOT_GAP;
    const total = this.actionSlots.length * slotSize + (this.actionSlots.length - 1) * slotGap;
    let x = gw / 2 - total / 2 + slotSize / 2;
    const y = h - slotSize / 2 - 8;
    for (const slot of this.actionSlots) {
      slot.bg.setPosition(x, y);
      slot.icon.setPosition(x, y);
      slot.label.setPosition(x + slotSize / 2 - 3, y + slotSize / 2 - 3);
      x += slotSize + slotGap;
    }

    for (let i = 0; i < this.logLines.length; i++) {
      this.logLines[i].setPosition(10, h - 66 - (this.logLines.length - 1 - i) * 13);
    }

    this.toggleBg.setPosition(this.scale.width - this.sidebarWidth - TOGGLE_W / 2, h / 2);
    this.toggleText.setPosition(this.toggleBg.x, h / 2);
    this.toggleText.setText(this.sidebarOpen ? "›" : "‹");

    this.shopPanel.setPosition(gw / 2 - 120, h / 2 - 150);
    this.vocationPanel.setPosition(gw / 2 - 130, h / 2 - 150);
    this.dialoguePanel.setPosition(gw / 2 - this.DIALOGUE_WIDTH / 2, h / 2 - this.DIALOGUE_HEIGHT / 2 - 20);

    // The collapse tab sits outside the sidebar proper: the world view may
    // extend under it, but taps there must not also walk the player.
    bus.emit(EVENTS.UI_LAYOUT, {
      sidebarWidth: this.sidebarWidth,
      reservedWidth: this.sidebarWidth + TOGGLE_W,
    });
    this.sidebarDirty = true;
  }

  // =========================================================================
  // Sidebar
  // =========================================================================

  private buildSidebarToggle() {
    this.toggleBg = this.add
      .rectangle(0, 0, TOGGLE_W, 54, COLORS.titleBg, 0.9)
      .setStrokeStyle(1, COLORS.border)
      .setScrollFactor(0)
      .setDepth(130)
      .setInteractive({ useHandCursor: true });
    this.toggleText = this.add
      .text(0, 0, "›", { ...TEXT, fontSize: fs(16), color: "#f0f0f0" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(131);
    this.toggleBg.on("pointerdown", () => {
      this.sidebarOpen = !this.sidebarOpen;
      this.layout();
    });
  }

  // -------------------------------------------------------------------------
  // Panel positions — every window is independently draggable. A panel gets a
  // default slot the first time it appears; once the player drags it, its
  // position is remembered (and persisted) under its own id.
  // -------------------------------------------------------------------------

  private loadPanelPositions() {
    try {
      const raw = localStorage.getItem(PANEL_POS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { sidebarWidth?: number; positions?: Record<string, PanelPos> };
      // Positions are saved as absolute pixel coordinates within the two-column
      // strip, so they're only meaningful for the SIDEBAR_WIDTH they were
      // saved under. If the sizing formula (or the viewport) has changed
      // since, stale coordinates can clamp into nonsensical spots — e.g. the
      // Battle panel landing on top of/under Character instead of in its own
      // column. Discarding on a mismatch is cheap: panels just fall back to
      // their normal default positions and re-lay-out cleanly.
      if (parsed.sidebarWidth !== SIDEBAR_WIDTH || !parsed.positions) return;
      for (const [id, pos] of Object.entries(parsed.positions)) {
        if (typeof pos?.x === "number" && typeof pos?.y === "number") this.panelPos.set(id, pos);
      }
    } catch {
      // Corrupt or outdated save data — fall back to default positions.
    }
  }

  private savePanelPositions() {
    try {
      const positions: Record<string, PanelPos> = {};
      for (const [id, pos] of this.panelPos) positions[id] = pos;
      localStorage.setItem(PANEL_POS_STORAGE_KEY, JSON.stringify({ sidebarWidth: SIDEBAR_WIDTH, positions }));
    } catch {
      // Storage unavailable/full — the layout just won't survive a reload.
    }
  }

  private ensurePanelPos(id: string, fallback: () => PanelPos): PanelPos {
    let pos = this.panelPos.get(id);
    if (!pos) {
      pos = fallback();
      this.panelPos.set(id, pos);
    }
    return pos;
  }

  /** A panel's current on-screen height, used both to render it and to lay out defaults. */
  private panelHeightFor(id: string): number {
    if (id === "character") return this.characterPanelHeight();
    if (id === "battle") return this.battlePanelHeight();
    if (id === "skills") return this.skillsPanelHeight();
    if (id.startsWith("c:")) {
      const container = this.openContainers.find((c) => `c:${c.id}` === id);
      return container ? this.containerPanelHeight(container) : WINDOW_TITLE_H;
    }
    return WINDOW_TITLE_H;
  }

  /** Where a panel lands the first time it appears — stacked under whatever else already defaulted into this column. */
  private nextDefaultY(columnX: number): number {
    let bottom = 0;
    for (const [id, pos] of this.panelPos) {
      if (Math.abs(pos.x - columnX) > 1) continue;
      bottom = Math.max(bottom, pos.y + this.panelHeightFor(id));
    }
    return bottom;
  }

  /** Keeps every panel within the reserved two-column UI strip and on-screen after a resize. */
  private clampAllPanels() {
    const minX = this.scale.width - SIDEBAR_WIDTH * 2;
    const maxX = this.scale.width - SIDEBAR_WIDTH;
    for (const [id, pos] of this.panelPos) {
      const h = this.panelHeightFor(id);
      pos.x = Phaser.Math.Clamp(pos.x, minX, maxX);
      pos.y = Phaser.Math.Clamp(pos.y, 0, Math.max(0, this.scale.height - h));
    }
  }

  private pointInRect(x: number, y: number, r: PanelRect): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /**
   * On drop, pull the panel flush against the nearest edge of any other panel
   * within SNAP_THRESHOLD — aligning left/right/top/bottom, or butting up
   * against an adjacent side — so two panels dragged near each other line up
   * perfectly instead of sitting a few stray pixels apart.
   */
  private snapPanel(id: string) {
    const pos = this.panelPos.get(id);
    const rect = this.panelRects.get(id);
    if (!pos || !rect) return;
    const { w, h } = rect;

    let bestX: number | null = null;
    let bestXDist = SNAP_THRESHOLD;
    let bestY: number | null = null;
    let bestYDist = SNAP_THRESHOLD;

    for (const [otherId, other] of this.panelRects) {
      if (otherId === id) continue;
      const verticalNear = pos.y < other.y + other.h + SNAP_THRESHOLD * 4 && pos.y + h > other.y - SNAP_THRESHOLD * 4;
      const horizontalNear = pos.x < other.x + other.w + SNAP_THRESHOLD * 4 && pos.x + w > other.x - SNAP_THRESHOLD * 4;

      if (verticalNear) {
        for (const cx of [other.x, other.x + other.w - w, other.x + other.w, other.x - w]) {
          const d = Math.abs(cx - pos.x);
          if (d < bestXDist) {
            bestXDist = d;
            bestX = cx;
          }
        }
      }
      if (horizontalNear) {
        for (const cy of [other.y, other.y + other.h - h, other.y + other.h, other.y - h]) {
          const d = Math.abs(cy - pos.y);
          if (d < bestYDist) {
            bestYDist = d;
            bestY = cy;
          }
        }
      }
    }

    if (bestX !== null) pos.x = bestX;
    if (bestY !== null) pos.y = bestY;

    const minX = this.scale.width - SIDEBAR_WIDTH * 2;
    const maxX = this.scale.width - SIDEBAR_WIDTH;
    pos.x = Phaser.Math.Clamp(pos.x, minX, maxX);
    pos.y = Phaser.Math.Clamp(pos.y, 0, Math.max(0, this.scale.height - h));
  }

  private battleScrollBounds(): number {
    const contentH = this.battlePanelHeight() - WINDOW_TITLE_H;
    const natural = Math.max(BATTLE_ROW_H, this.battleEntries.length * BATTLE_ROW_H) + 4;
    return Math.max(0, natural - contentH);
  }

  private characterPanelHeight(): number {
    if (this.collapsed.has("character")) return WINDOW_TITLE_H;
    // 12px is the "▾ Equipment" toggle strip, always drawn even when the
    // paperdoll below it is collapsed.
    const equip = this.equipmentOpen ? equipGridHeight() + PAD : 0;
    return WINDOW_TITLE_H + PAD + BAR_H * 2 + 2 + PAD + 12 + equip;
  }

  /** Fixed to match the Character panel's height (with its own internal scroll), per the classic layout. */
  private battlePanelHeight(): number {
    if (this.collapsed.has("battle")) return WINDOW_TITLE_H;
    return this.characterPanelHeight();
  }

  private skillsPanelHeight(): number {
    if (this.collapsed.has("skills")) return WINDOW_TITLE_H;
    const skills = this.skills;
    if (!skills) return WINDOW_TITLE_H;
    const rowH = 14;
    const barH = 4;
    return WINDOW_TITLE_H + rowH * 3 + barH + 6 + skills.skills.length * (rowH + barH + 2) + 4;
  }

  private containerPanelHeight(container: Container): number {
    if (this.collapsed.has(`c:${container.id}`)) return WINDOW_TITLE_H;
    const perRow = 4;
    const rows = Math.ceil(container.capacity / perRow);
    return WINDOW_TITLE_H + rows * (SLOT + SLOT_GAP) + 4;
  }

  private renderSidebar() {
    this.sidebarDirty = false;
    this.sidebarLayer.removeAll(true);
    this.dropTargets = [];
    this.panelRects.clear();
    if (!this.sidebarOpen) return;

    this.clampAllPanels();

    // Normal draw order back-to-front; whichever panel is actively being
    // dragged renders last so it visually sits on top while it's moving.
    const renderers: { id: string; run: () => void }[] = [
      { id: "character", run: () => this.renderCharacterPanel() },
      { id: "battle", run: () => this.renderBattlePanel() },
      { id: "skills", run: () => this.renderSkillsPanel() },
      ...this.openContainers.map((c) => ({ id: `c:${c.id}`, run: () => this.renderContainerPanel(c) })),
    ];
    renderers.sort((a, b) => Number(a.id === this.draggingPanelId) - Number(b.id === this.draggingPanelId));
    for (const r of renderers) r.run();
  }

  /** Shared window chrome: background, draggable/collapsible title bar. Returns the content origin. */
  private renderPanelChrome(
    id: string,
    title: string,
    pos: PanelPos,
    height: number,
    extras?: { onClose?: () => void; onLootAll?: () => void },
  ): { x: number; y: number; w: number } {
    const w = SIDEBAR_WIDTH;
    this.panelRects.set(id, { x: pos.x, y: pos.y, w, h: height });

    this.addToLayer(
      this.add
        .rectangle(pos.x, pos.y, w, height, COLORS.sidebarBg, 0.97)
        .setOrigin(0, 0)
        .setStrokeStyle(1, COLORS.border)
        .setScrollFactor(0),
    );

    const bar = this.add
      .rectangle(pos.x, pos.y, w, WINDOW_TITLE_H, COLORS.titleBg, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.border)
      .setScrollFactor(0)
      .setInteractive({ draggable: true, useHandCursor: true });
    bar.setData("kind", "panel");
    bar.setData("panelId", id);
    bar.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      // A real drag never lands here as a tap; guard on distance anyway for slow, twitchy touches.
      if (pointer.getDistance() > 8) return;
      if (this.collapsed.has(id)) this.collapsed.delete(id);
      else this.collapsed.add(id);
      this.sidebarDirty = true;
    });
    this.addToLayer(bar);

    const isCollapsed = this.collapsed.has(id);
    this.addToLayer(
      this.add
        .text(pos.x + 8, pos.y + WINDOW_TITLE_H / 2, `${isCollapsed ? "▸" : "▾"} ${title}`, {
          ...TEXT,
          fontSize: fs(10),
          color: "#e6c34a",
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0),
    );

    let btnX = pos.x + w - 10;
    if (extras?.onClose) {
      this.addToLayer(this.drawTinyButton(btnX, pos.y + WINDOW_TITLE_H / 2, "×", extras.onClose));
      btnX -= 16;
    }
    if (extras?.onLootAll) {
      this.addToLayer(this.drawTinyButton(btnX, pos.y + WINDOW_TITLE_H / 2, "⤓", extras.onLootAll));
    }

    return { x: pos.x, y: pos.y + WINDOW_TITLE_H, w };
  }

  /** HP/mana bars + the equipment paperdoll — its own panel, draggable like every other window. */
  private renderCharacterPanel() {
    const height = this.characterPanelHeight();
    const pos = this.ensurePanelPos("character", () => ({ x: this.scale.width - SIDEBAR_WIDTH, y: 0 }));
    const { x: left, y: top, w } = this.renderPanelChrome("character", "Character", pos, height);
    if (this.collapsed.has("character")) return;

    const stats = this.stats;
    let y = top + PAD;

    this.drawBar(
      left + PAD,
      y,
      w - PAD * 2,
      BAR_H,
      stats ? stats.hp / Math.max(1, stats.maxHp) : 0,
      COLORS.hp,
      stats ? `${stats.hp} / ${stats.maxHp}` : "",
    );
    y += BAR_H + 2;
    this.drawBar(
      left + PAD,
      y,
      w - PAD * 2,
      BAR_H,
      stats && stats.maxMana > 0 ? stats.mana / stats.maxMana : 0,
      COLORS.mana,
      stats ? `${stats.mana} / ${stats.maxMana}` : "",
    );
    y += BAR_H + PAD;

    // Small ▾/▸ toggle in the top-right of the equipment area, so a player
    // who wants the map view can hide the paperdoll without collapsing the
    // whole panel. Sits over the top-left cell rather than on its own row —
    // a dedicated title bar would eat back the space we're trying to save.
    const toggleLabel = this.equipmentOpen ? "▾" : "▸";
    const toggle = this.add
      .text(left + w - PAD, y, `${toggleLabel} Equipment`, {
        ...TEXT,
        fontSize: fs(10),
        color: "#e6c34a",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    toggle.on("pointerdown", () => {
      this.equipmentOpen = !this.equipmentOpen;
      this.sidebarDirty = true;
    });
    this.addToLayer(toggle);
    y += 12;

    if (this.equipmentOpen) {
      this.renderEquipmentGrid(left, y);
    }
  }

  private renderEquipmentGrid(left: number, top: number) {
    const gridW = SLOT * 3 + SLOT_GAP * 2;
    const gridLeft = left + (SIDEBAR_WIDTH - gridW) / 2;

    for (const { slot, col, row } of EQUIP_LAYOUT) {
      const x = gridLeft + col * (SLOT + SLOT_GAP);
      const y = top + row * (SLOT + SLOT_GAP);
      this.drawItemSlot(x, y, SLOT, this.equipment?.get(slot) ?? null, { kind: "equip", slot }, EQUIP_SLOT_NAMES[slot]);
    }

    // The last row has two free cells either side of the boots — the classic
    // client puts the capacity readout there, so the derived stats go there too.
    const bottomY = top + 3 * (SLOT + SLOT_GAP);
    const free = Math.max(0, this.maxCapacity - this.capacityUsed);
    this.addToLayer(
      this.add
        .text(gridLeft + SLOT / 2, bottomY + 6, `Cap:\n${Math.floor(free)}`, {
          ...TEXT,
          fontSize: fs(9),
          color: "#cccccc",
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0),
    );

    const skills = this.skills;
    this.addToLayer(
      this.add
        .text(
          gridLeft + 2 * (SLOT + SLOT_GAP) + SLOT / 2,
          bottomY + 2,
          skills ? `Atk ${skills.attack}\nDef ${skills.defense}\nArm ${skills.armor}` : "",
          { ...TEXT, fontSize: fs(9), color: "#cccccc", align: "center" },
        )
        .setOrigin(0.5, 0)
        .setScrollFactor(0),
    );
  }

  private drawTinyButton(x: number, y: number, glyph: string, onTap: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, glyph, { ...TEXT, fontSize: fs(13), color: "#e2e2e2" })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    t.on("pointerdown", (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); // don't also collapse the window behind the button
      onTap();
    });
    return t;
  }

  private renderSkillsPanel() {
    const height = this.skillsPanelHeight();
    const pos = this.ensurePanelPos("skills", () => ({
      x: this.scale.width - SIDEBAR_WIDTH,
      y: this.nextDefaultY(this.scale.width - SIDEBAR_WIDTH),
    }));
    const { x: left, y: top, w } = this.renderPanelChrome("skills", "Skills", pos, height);
    if (this.collapsed.has("skills")) return;

    const skills = this.skills;
    if (!skills) return;

    const rowH = 14;
    const barH = 4;
    const contentLeft = left + PAD;
    const contentW = w - PAD * 2;
    let y = top;

    const lines: [string, string][] = [
      ["Vocation", skills.vocationName],
      ["Experience", skills.exp.toLocaleString()],
      ["Level", String(skills.level)],
    ];
    for (const [label, value] of lines) {
      this.addToLayer(
        this.add
          .text(contentLeft, y + 1, label, { ...TEXT, fontSize: fs(10), color: "#b0b0b0" })
          .setOrigin(0, 0)
          .setScrollFactor(0),
      );
      this.addToLayer(
        this.add
          .text(contentLeft + contentW, y + 1, value, { ...TEXT, fontSize: fs(10), color: "#f0f0f0" })
          .setOrigin(1, 0)
          .setScrollFactor(0),
      );
      y += rowH;
    }

    // Progress toward the next character level.
    this.drawBar(
      contentLeft,
      y,
      contentW,
      barH,
      skills.expForLevel > 0 ? skills.expIntoLevel / skills.expForLevel : 0,
      COLORS.xp,
      "",
    );
    y += barH + 6;

    for (const skill of skills.skills) {
      this.addToLayer(
        this.add
          .text(contentLeft, y, skill.name, { ...TEXT, fontSize: fs(10), color: "#b0b0b0" })
          .setOrigin(0, 0)
          .setScrollFactor(0),
      );
      this.addToLayer(
        this.add
          .text(contentLeft + contentW, y, String(skill.level), { ...TEXT, fontSize: fs(10), color: "#f0f0f0" })
          .setOrigin(1, 0)
          .setScrollFactor(0),
      );
      this.drawBar(contentLeft, y + rowH - 2, contentW, barH, skill.progress, COLORS.accent, "");
      y += rowH + barH + 2;
    }
  }

  /**
   * The Battle window: a standalone panel fixed to the Character panel's
   * height, with its own scrollable, masked entry list so an overflowing
   * monster count scrolls instead of spilling past the panel.
   */
  private renderBattlePanel() {
    const height = this.battlePanelHeight();
    const pos = this.ensurePanelPos("battle", () => ({ x: this.scale.width - SIDEBAR_WIDTH * 2, y: 0 }));
    const { x: left, y: top, w } = this.renderPanelChrome("battle", "Battle", pos, height);
    if (this.collapsed.has("battle")) return;

    const contentH = height - WINDOW_TITLE_H;
    this.battleScrollY = Phaser.Math.Clamp(this.battleScrollY, 0, this.battleScrollBounds());

    // Clip the entry list to the fixed panel height so overflow scrolls
    // instead of spilling out past the bottom edge.
    const maskShape = this.add.graphics().fillStyle(0xffffff).fillRect(left, top, w, contentH).setVisible(false);
    this.addToLayer(maskShape);
    const mask = maskShape.createGeometryMask();

    const catcher = this.add
      .rectangle(left, top, w, contentH, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ draggable: true });
    catcher.setData("kind", "battleScroll");
    this.addToLayer(catcher);

    const contentLeft = left + PAD;
    const rowW = w - PAD * 2;
    let y = top - this.battleScrollY;

    if (this.battleEntries.length === 0) {
      this.addToLayer(
        this.add
          .text(contentLeft, y + 4, "(nothing nearby)", { ...TEXT, fontSize: fs(10), color: "#777777" })
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setMask(mask),
      );
      return;
    }

    for (const entry of this.battleEntries) {
      if (y + BATTLE_ROW_H > top && y < top + contentH) {
        const row = this.add
          .rectangle(
            contentLeft,
            y,
            rowW,
            BATTLE_ROW_H - 2,
            entry.targeted ? 0x3a2a12 : 0x000000,
            entry.targeted ? 1 : 0.3,
          )
          .setOrigin(0, 0)
          .setStrokeStyle(1, entry.targeted ? COLORS.accent : COLORS.border)
          .setScrollFactor(0)
          // Draggable (as a scroll surface) so a swipe that starts on a row still
          // scrolls the list; pointerup with a distance check tells a tap from a drag.
          .setInteractive({ useHandCursor: true, draggable: true })
          .setMask(mask);
        row.setData("kind", "battleScroll");
        row.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (pointer.getDistance() > 8) return;
          bus.emit(EVENTS.SELECT_TARGET, { id: entry.id });
        });
        this.addToLayer(row);
        this.addToLayer(
          this.add
            .text(contentLeft + 4, y + 3, entry.name, { ...TEXT, fontSize: fs(10), color: "#f0f0f0" })
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setMask(mask),
        );
        this.drawBar(contentLeft + 4, y + 15, rowW - 8, 4, entry.hp / Math.max(1, entry.maxHp), COLORS.hp, "", mask);
      }
      y += BATTLE_ROW_H;
    }
  }

  private renderContainerPanel(container: Container) {
    const key = `c:${container.id}`;
    const height = this.containerPanelHeight(container);
    const pos = this.ensurePanelPos(key, () => ({
      x: this.scale.width - SIDEBAR_WIDTH,
      y: this.nextDefaultY(this.scale.width - SIDEBAR_WIDTH),
    }));
    const { x: left, y: top, w } = this.renderPanelChrome(key, container.name, pos, height, {
      onClose: () => bus.emit(EVENTS.CLOSE_CONTAINER, { container }),
      onLootAll: () => bus.emit(EVENTS.LOOT_ALL, { container }),
    });
    if (this.collapsed.has(key)) return;

    const perRow = 4;
    const gridW = perRow * SLOT + (perRow - 1) * SLOT_GAP;
    const gridLeft = left + (w - gridW) / 2;
    const rows = Math.ceil(container.capacity / perRow);

    for (let row = 0; row < rows; row++) {
      const rowY = top + row * (SLOT + SLOT_GAP);
      for (let col = 0; col < perRow; col++) {
        const index = row * perRow + col;
        if (index >= container.capacity) break;
        this.drawItemSlot(gridLeft + col * (SLOT + SLOT_GAP), rowY, SLOT, container.slots[index], {
          kind: "container",
          container,
          index,
        });
      }
    }
  }

  // =========================================================================
  // Slots, bars, drag & drop
  // =========================================================================

  private drawItemSlot(x: number, y: number, size: number, stack: ItemStack | null, ref: SlotRef, hint?: string) {
    const bg = this.add
      .rectangle(x, y, size, size, COLORS.slotBg, 0.55)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.border)
      .setScrollFactor(0);
    this.addToLayer(bg);

    this.dropTargets.push({ rect: new Phaser.Geom.Rectangle(x, y, size, size), ref });

    if (!stack) {
      if (hint) {
        this.addToLayer(
          this.add
            .text(x + size / 2, y + size / 2, hint.slice(0, 4), { ...TEXT, fontSize: fs(8), color: "#4a4a4a" })
            .setOrigin(0.5)
            .setScrollFactor(0),
        );
      }
      return;
    }

    const def = ITEMS[stack.itemId];
    const icon = this.add
      .image(x + size / 2, y + size / 2, def?.textureKey ?? "gold-coin")
      .setScrollFactor(0)
      .setInteractive({ draggable: true, useHandCursor: true });
    icon.setData("kind", "item");
    icon.setData("ref", ref);
    icon.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      // Phaser clears dragState after dragend, so a real drag never reaches
      // here as a tap; guard on distance anyway for slow, twitchy touches.
      if (pointer.getDistance() > 8) return;
      this.activateStack(stack);
    });
    this.addToLayer(icon);

    if (stack.count > 1) {
      this.addToLayer(
        this.add
          .text(x + size - 2, y + size - 2, String(stack.count), {
            ...TEXT,
            fontSize: fs(9),
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(1, 1)
          .setScrollFactor(0),
      );
    }
  }

  /** Tapping an item: open it if it's a bag, drink it if it's a potion. */
  private activateStack(stack: ItemStack) {
    if (stack.container) {
      const isOpen = this.openContainers.includes(stack.container);
      bus.emit(isOpen ? EVENTS.CLOSE_CONTAINER : EVENTS.OPEN_CONTAINER, { container: stack.container });
      return;
    }
    if (ITEMS[stack.itemId]?.kind === "consumable") bus.emit(EVENTS.USE_ITEM, { itemId: stack.itemId });
  }

  private setupDragAndDrop() {
    this.input.dragDistanceThreshold = 8;

    this.input.on("dragstart", (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      const kind = obj.getData("kind");
      if (kind === "battleScroll") {
        this.battleScrollDragAnchor = this.battleScrollY + pointer.y;
        return;
      }
      if (kind === "panel") {
        const id = obj.getData("panelId") as string;
        const pos = this.panelPos.get(id);
        if (pos) {
          this.panelDragAnchor = { x: pointer.x - pos.x, y: pointer.y - pos.y };
          this.draggingPanelId = id;
        }
        return;
      }
      if (kind !== "item") return;
      this.dragFrom = obj.getData("ref") as SlotRef;
      const image = obj as Phaser.GameObjects.Image;
      image.setAlpha(0.35);
      this.dragGhost = this.add
        .image(pointer.x, pointer.y, image.texture.key)
        .setScrollFactor(0)
        .setDepth(200)
        .setAlpha(0.9);
    });

    this.input.on("drag", (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      const kind = obj.getData("kind");
      if (kind === "battleScroll") {
        this.battleScrollY = Phaser.Math.Clamp(this.battleScrollDragAnchor - pointer.y, 0, this.battleScrollBounds());
        this.sidebarDirty = true;
        return;
      }
      if (kind === "panel") {
        const id = obj.getData("panelId") as string;
        const pos = this.panelPos.get(id);
        if (pos) {
          const rect = this.panelRects.get(id);
          const w = rect?.w ?? SIDEBAR_WIDTH;
          const h = rect?.h ?? WINDOW_TITLE_H;
          const minX = this.scale.width - SIDEBAR_WIDTH * 2;
          const maxX = this.scale.width - w;
          pos.x = Phaser.Math.Clamp(pointer.x - this.panelDragAnchor.x, minX, maxX);
          pos.y = Phaser.Math.Clamp(pointer.y - this.panelDragAnchor.y, 0, Math.max(0, this.scale.height - h));
          this.sidebarDirty = true;
        }
        return;
      }
      this.dragGhost?.setPosition(pointer.x, pointer.y);
    });

    this.input.on("dragend", (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      const kind = obj.getData("kind");
      if (kind === "battleScroll") return;
      if (kind === "panel") {
        const id = obj.getData("panelId") as string;
        this.snapPanel(id);
        this.savePanelPositions();
        this.draggingPanelId = null;
        this.sidebarDirty = true;
        return;
      }
      this.dragGhost?.destroy();
      this.dragGhost = null;

      const from = this.dragFrom;
      this.dragFrom = null;
      if (!from) return;

      const target = this.dropTargets.find((t) => t.rect.contains(pointer.x, pointer.y));
      if (target) bus.emit(EVENTS.MOVE_ITEM, { from, to: target.ref });
      // Either way the sidebar redraws, which restores the dimmed icon.
      this.sidebarDirty = true;
    });
  }

  private drawBar(
    x: number,
    y: number,
    width: number,
    height: number,
    pct: number,
    color: number,
    label: string,
    mask?: Phaser.Display.Masks.GeometryMask,
  ) {
    const bg = this.add.rectangle(x, y, width, height, COLORS.barBg, 0.7).setOrigin(0, 0).setScrollFactor(0);
    if (mask) bg.setMask(mask);
    this.addToLayer(bg);
    const filled = Math.max(0, Math.min(1, pct)) * (width - 2);
    if (filled > 0) {
      const fill = this.add.rectangle(x + 1, y + 1, filled, height - 2, color, 1).setOrigin(0, 0).setScrollFactor(0);
      if (mask) fill.setMask(mask);
      this.addToLayer(fill);
    }
    if (label) {
      const text = this.add
        .text(x + width / 2, y + height / 2, label, {
          ...TEXT,
          fontSize: fs(10),
          color: "#f0f0f0",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
      if (mask) text.setMask(mask);
      this.addToLayer(text);
    }
  }

  private addToLayer(obj: Phaser.GameObjects.GameObject) {
    this.sidebarLayer.add(obj);
    return obj;
  }

  // =========================================================================
  // Floating over-world UI
  // =========================================================================

  private buildTargetPanel() {
    this.targetPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
    const bg = this.add.rectangle(0, 0, 180, 32, COLORS.panelBg, 0.75).setOrigin(0.5, 0);
    this.targetLabel = this.add
      .text(0, 3, "", { ...TEXT, fontSize: fs(12), color: "#f0f0f0" })
      .setOrigin(0.5, 0);
    this.targetBarBg = this.add.rectangle(-80, 19, 160, 8, COLORS.barBg, 0.8).setOrigin(0, 0);
    this.targetBarFill = this.add.rectangle(-79, 20, 158, 6, COLORS.hp, 1).setOrigin(0, 0);
    this.targetPanel.add([bg, this.targetLabel, this.targetBarBg, this.targetBarFill]);
  }

  private onTarget(t: TargetPayload | null) {
    if (!t) {
      this.targetPanel.setVisible(false);
      return;
    }
    this.targetPanel.setVisible(true);
    this.targetLabel.setText(t.name);
    this.targetBarFill.width = 158 * Phaser.Math.Clamp(t.hp / Math.max(1, t.maxHp), 0, 1);
  }

  private buildActionBar() {
    const entries: { kind: "item" | "spell"; id: string; textureKey: string }[] = [
      { kind: "item", id: "health_potion", textureKey: ITEMS.health_potion.textureKey },
      { kind: "item", id: "mana_potion", textureKey: ITEMS.mana_potion.textureKey },
      ...SPELL_BAR.map((id) => ({ kind: "spell" as const, id, textureKey: SPELLS[id].textureKey })),
    ];

    for (const entry of entries) {
      const bg = this.add
        .rectangle(0, 0, ACTION_SLOT_SIZE, ACTION_SLOT_SIZE, COLORS.panelBg, 0.8)
        .setStrokeStyle(1, COLORS.border)
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });
      const icon = this.add
        .image(0, 0, entry.textureKey)
        .setDisplaySize(ACTION_SLOT_SIZE * 0.8, ACTION_SLOT_SIZE * 0.8)
        .setScrollFactor(0)
        .setDepth(101);
      const label = this.add
        .text(0, 0, "", { ...TEXT, fontSize: fs(10), color: "#f0f0f0", stroke: "#000000", strokeThickness: 3 })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(102);

      if (entry.kind === "item") {
        bg.on("pointerdown", () => bus.emit(EVENTS.USE_ITEM, { itemId: entry.id }));
      } else {
        bg.on("pointerdown", () => bus.emit(EVENTS.CAST_SPELL, { spellId: entry.id }));
        label.setText(String(SPELLS[entry.id].manaCost));
        label.setColor("#7cc8ff");
      }
      this.actionSlots.push({ kind: entry.kind, id: entry.id, bg, icon, label });
    }
  }

  /**
   * Interior/exterior toggle: hide the action bar while indoors so it can't
   * cover the exit door tile of a small shop room. Every action slot is a
   * plain rectangle/image/text, so a visibility flip is enough.
   */
  private onInteriorState(active: boolean) {
    for (const slot of this.actionSlots) {
      slot.bg.setVisible(!active);
      slot.icon.setVisible(!active);
      slot.label.setVisible(!active);
    }
  }

  private onInventory(inv: InventoryPayload) {
    this.inventory = inv.items;
    for (const slot of this.actionSlots) {
      if (slot.kind !== "item") continue;
      const count = this.inventory[slot.id] ?? 0;
      slot.label.setText(String(count));
      slot.icon.setAlpha(count > 0 ? 1 : 0.35);
    }
    if (this.shopOpen) this.renderShopPanel();
  }

  private buildLog() {
    for (let i = 0; i < 5; i++) {
      this.logLines.push(
        this.add
          .text(0, 0, "", { ...TEXT, fontSize: fs(11), color: "#cccccc", stroke: "#000000", strokeThickness: 3 })
          .setScrollFactor(0)
          .setDepth(100),
      );
    }
  }

  private pushLog(entry: LogPayload) {
    this.logMessages.push({ text: entry.text, color: LOG_COLORS[entry.kind] ?? "#cccccc" });
    if (this.logMessages.length > 5) this.logMessages.shift();
    const recent = this.logMessages.slice(-5);
    for (let i = 0; i < this.logLines.length; i++) {
      const message = recent[i];
      const line = this.logLines[i];
      if (message) {
        line.setText(message.text).setColor(message.color).setVisible(true);
      } else {
        line.setVisible(false);
      }
    }
  }

  // =========================================================================
  // Modal panels (shop / vocation / dialogue)
  // =========================================================================

  private syncModalState() {
    bus.emit(EVENTS.MODAL_STATE, { open: this.shopOpen || this.vocationOpen || this.dialogueOpen });
  }

  private buildShopPanel() {
    this.shopPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(150).setVisible(false);
  }

  private openShop(npcId: string, npcName: string) {
    this.currentShop = { npcId, npcName };
    this.shopOpen = true;
    this.shopPanel.setVisible(true);
    this.renderShopPanel();
    this.syncModalState();
  }

  private closeShop() {
    this.shopOpen = false;
    this.shopPanel.setVisible(false);
    this.syncModalState();
  }

  private renderShopPanel() {
    this.shopPanel.removeAll(true);
    if (!this.currentShop) return;
    const shop = SHOPS[this.currentShop.npcId];
    if (!shop) return;

    const gold = this.inventory["gold_coin"] ?? 0;
    const sellRows = shop.sells;
    const buyRows = shop.buys.filter((o) => (this.inventory[o.itemId] ?? 0) > 0);

    const width = 240;
    const rowHeight = 26;
    const headerHeight = 56;
    // The blacksmith's list is long, so the panel caps its height and the
    // rows beyond the cap are simply not drawn.
    const maxRows = Math.max(4, Math.floor((this.scale.height - headerHeight - 40) / rowHeight));
    const rows = [
      ...sellRows.map((o) => ({ ...o, mode: "buy" as const })),
      ...buyRows.map((o) => ({ ...o, mode: "sell" as const })),
    ].slice(0, maxRows);
    const height = headerHeight + rows.length * rowHeight + 10;

    const bg = this.add
      .rectangle(0, 0, width, height, COLORS.panelBg, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.border);
    const title = this.add
      .text(10, 8, this.currentShop.npcName, { ...TEXT, fontSize: "13px", color: "#f0f0f0" })
      .setOrigin(0, 0);
    const goldText = this.add
      .text(10, 26, `Gold: ${gold}`, { ...TEXT, fontSize: "11px", color: "#e6c34a" })
      .setOrigin(0, 0);
    const closeBtn = this.add
      .text(width - 10, 8, "X", { ...TEXT, fontSize: "13px", color: "#e2e2e2" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeShop());
    this.shopPanel.add([bg, title, goldText, closeBtn]);

    let y = headerHeight;
    for (const offer of rows) {
      const item = ITEMS[offer.itemId];
      const row = this.add
        .rectangle(6, y, width - 12, rowHeight - 3, 0x000000, 0.25)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.image(20, y + (rowHeight - 3) / 2, item.textureKey).setScale(0.8);
      const owned = this.inventory[offer.itemId] ?? 0;
      const text =
        offer.mode === "buy"
          ? `Buy ${item.name} — ${offer.price}g`
          : `Sell ${item.name} (x${owned}) — ${offer.price}g`;
      const label = this.add
        .text(36, y + (rowHeight - 3) / 2, text, { ...TEXT, fontSize: "10px", color: "#f0f0f0" })
        .setOrigin(0, 0.5);
      row.on("pointerdown", () =>
        bus.emit(offer.mode === "buy" ? EVENTS.BUY_ITEM : EVENTS.SELL_ITEM, {
          npcId: this.currentShop!.npcId,
          itemId: offer.itemId,
        }),
      );
      this.shopPanel.add([row, icon, label]);
      y += rowHeight;
    }

    this.shopPanel.setSize(width, height);
  }

  private buildVocationPanel() {
    this.vocationPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(150).setVisible(false);
    const width = 260;
    const vocations: ChosenVocation[] = ["knight", "paladin", "sorcerer", "druid"];
    const rowHeight = 46;
    const height = 40 + vocations.length * rowHeight + 10;

    const bg = this.add
      .rectangle(0, 0, width, height, COLORS.panelBg, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.border);
    const title = this.add
      .text(10, 8, "Choose your path", { ...TEXT, fontSize: "13px", color: "#f0f0f0" })
      .setOrigin(0, 0);
    const closeBtn = this.add
      .text(width - 10, 8, "X", { ...TEXT, fontSize: "13px", color: "#e2e2e2" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeVocationPanel());
    this.vocationPanel.add([bg, title, closeBtn]);

    let y = 32;
    for (const vocation of vocations) {
      const row = this.add
        .rectangle(6, y, width - 12, rowHeight - 4, 0x000000, 0.25)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const name = this.add
        .text(12, y + 4, VOCATION_NAMES[vocation], { ...TEXT, fontSize: "12px", color: "#e6c34a" })
        .setOrigin(0, 0);
      const desc = this.add
        .text(12, y + 20, VOCATION_DESCRIPTIONS[vocation], {
          ...TEXT,
          fontSize: "9px",
          color: "#cccccc",
          wordWrap: { width: width - 24 },
        })
        .setOrigin(0, 0);
      row.on("pointerdown", () => {
        bus.emit(EVENTS.CHOOSE_VOCATION, { vocation });
        this.closeVocationPanel();
      });
      this.vocationPanel.add([row, name, desc]);
      y += rowHeight;
    }
    this.vocationPanel.setSize(width, height);
  }

  private openVocationPanel() {
    this.vocationOpen = true;
    this.vocationPanel.setVisible(true);
    this.syncModalState();
  }

  private closeVocationPanel() {
    this.vocationOpen = false;
    this.vocationPanel.setVisible(false);
    this.syncModalState();
  }

  private buildDialoguePanel() {
    this.dialoguePanel = this.add.container(0, 0).setScrollFactor(0).setDepth(150).setVisible(false);
  }

  private openDialogue(payload: OpenDialoguePayload) {
    this.currentDialogue = payload;
    this.dialogueOpen = true;
    this.dialoguePanel.setVisible(true);
    this.renderDialoguePanel(payload.greeting);
    this.syncModalState();
  }

  private closeDialogue() {
    this.dialogueOpen = false;
    this.dialoguePanel.setVisible(false);
    this.currentDialogue = null;
    this.syncModalState();
  }

  private renderDialoguePanel(bodyText: string) {
    this.dialoguePanel.removeAll(true);
    const npc = this.currentDialogue;
    if (!npc) return;
    const width = this.DIALOGUE_WIDTH;
    const height = this.DIALOGUE_HEIGHT;

    const bg = this.add
      .rectangle(0, 0, width, height, COLORS.panelBg, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.border);
    const portraitBg = this.add.rectangle(10, 10, 48, 48, 0x000000, 0.3).setOrigin(0, 0);
    const portrait = this.add.image(34, 34, npc.textureKey).setScale(1.3);
    const name = this.add
      .text(66, 14, npc.npcName, { ...TEXT, fontSize: "13px", color: "#e6c34a" })
      .setOrigin(0, 0);
    const body = this.add
      .text(66, 34, bodyText, { ...TEXT, fontSize: "10px", color: "#e2e2e2", wordWrap: { width: width - 76 } })
      .setOrigin(0, 0);
    const closeBtn = this.add
      .text(width - 10, 8, "X", { ...TEXT, fontSize: "13px", color: "#e2e2e2" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeDialogue());
    this.dialoguePanel.add([bg, portraitBg, portrait, name, body, closeBtn]);

    const buttonY = height - 34;
    const buttons: { label: string; onTap: () => void }[] = [];
    if (npc.role === "shop") {
      buttons.push({
        label: "Trade",
        onTap: () => {
          this.closeDialogue();
          this.openShop(npc.npcId, npc.npcName);
        },
      });
    } else {
      buttons.push({ label: "My Path", onTap: () => bus.emit(EVENTS.REQUEST_VOCATION_TALK, { npcId: npc.npcId }) });
    }
    buttons.push({ label: "Job", onTap: () => this.renderDialoguePanel(npc.about) });
    buttons.push({ label: "Bye", onTap: () => this.closeDialogue() });

    const btnWidth = (width - 20 - (buttons.length - 1) * 8) / buttons.length;
    let btnX = 10;
    for (const button of buttons) {
      const btnBg = this.add
        .rectangle(btnX, buttonY, btnWidth, 26, 0x000000, 0.35)
        .setOrigin(0, 0)
        .setStrokeStyle(1, COLORS.border)
        .setInteractive({ useHandCursor: true });
      const btnLabel = this.add
        .text(btnX + btnWidth / 2, buttonY + 13, button.label, { ...TEXT, fontSize: "11px", color: "#f0f0f0" })
        .setOrigin(0.5, 0.5);
      btnBg.on("pointerdown", button.onTap);
      this.dialoguePanel.add([btnBg, btnLabel]);
      btnX += btnWidth + 8;
    }

    this.dialoguePanel.setSize(width, height);
  }
}
