import Phaser from "phaser";
import {
  bus,
  EVENTS,
  InventoryPayload,
  LogPayload,
  OpenDialoguePayload,
  OpenShopPayload,
  PlayerStatsPayload,
  TargetPayload,
} from "../game/events";
import { ITEMS } from "../data/items";
import { SHOPS } from "../data/shops";
import { VOCATION_DESCRIPTIONS, VOCATION_NAMES, ChosenVocation } from "../game/stats";

const COLORS = {
  panelBg: 0x151515,
  hp: 0xc9302f,
  mana: 0x2f6fa8,
  xp: 0xe6c34a,
  barBg: 0x000000,
};

/** A small reusable value bar: background + fill + label, screen-space. */
class StatBar {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private width: number,
    private height: number,
    fillColor: number,
  ) {
    this.bg = scene.add
      .rectangle(x, y, width, height, COLORS.barBg, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.fill = scene.add
      .rectangle(x + 1, y + 1, width - 2, height - 2, fillColor, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);
    this.label = scene.add
      .text(x + width / 2, y + height / 2, "", {
        fontFamily: "monospace",
        fontSize: `${Math.max(10, height - 4)}px`,
        color: "#f0f0f0",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(102);
  }

  setValue(current: number, max: number, text: string) {
    const pct = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    this.fill.width = (this.width - 2) * pct;
    this.label.setText(text);
  }

  setPosition(x: number, y: number) {
    this.bg.setPosition(x, y);
    this.fill.setPosition(x + 1, y + 1);
    this.label.setPosition(x + this.width / 2, y + this.height / 2);
  }

  setVisible(visible: boolean) {
    this.bg.setVisible(visible);
    this.fill.setVisible(visible);
    this.label.setVisible(visible);
  }
}

interface ActionSlot {
  itemId: string;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
}

const LOG_COLORS: Record<string, string> = {
  damage: "#e2e2e2",
  loot: "#e6c34a",
  xp: "#8fd0ff",
  levelup: "#7cff7c",
  info: "#a0a0a0",
};

export class UIScene extends Phaser.Scene {
  private hpBar!: StatBar;
  private manaBar!: StatBar;
  private xpBar!: StatBar;

  private targetPanel!: Phaser.GameObjects.Container;
  private targetBar!: StatBar;
  private targetLabel!: Phaser.GameObjects.Text;

  private logLines: Phaser.GameObjects.Text[] = [];
  private logMessages: { text: string; color: string }[] = [];

  private actionSlots: ActionSlot[] = [];
  private inventory: Record<string, number> = {};

  private inventoryPanel!: Phaser.GameObjects.Container;
  private inventoryOpen = false;

  private shopPanel!: Phaser.GameObjects.Container;
  private shopOpen = false;
  private currentShop: { npcId: string; npcName: string } | null = null;

  private vocationPanel!: Phaser.GameObjects.Container;
  private vocationOpen = false;

  private dialoguePanel!: Phaser.GameObjects.Container;
  private dialogueOpen = false;
  private currentDialogue: OpenDialoguePayload | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create() {
    this.hpBar = new StatBar(this, 12, 12, 160, 16, COLORS.hp);
    this.manaBar = new StatBar(this, 12, 32, 160, 16, COLORS.mana);
    this.xpBar = new StatBar(this, 12, 52, 160, 10, COLORS.xp);

    this.buildTargetPanel();
    this.buildActionBar();
    this.buildInventoryToggle();
    this.buildInventoryPanel();
    this.buildLog();
    this.buildShopPanel();
    this.buildVocationPanel();
    this.buildDialoguePanel();

    bus.on(EVENTS.PLAYER_STATS, (p: PlayerStatsPayload) => this.onPlayerStats(p));
    bus.on(EVENTS.TARGET, (t: TargetPayload | null) => this.onTarget(t));
    bus.on(EVENTS.LOG, (l: LogPayload) => this.pushLog(l));
    bus.on(EVENTS.INVENTORY, (inv: InventoryPayload) => this.onInventory(inv));
    bus.on(EVENTS.OPEN_SHOP, (p: OpenShopPayload) => this.openShop(p.npcId, p.npcName));
    bus.on(EVENTS.OPEN_VOCATION_CHOICE, () => this.openVocationPanel());
    bus.on(EVENTS.OPEN_DIALOGUE, (p: OpenDialoguePayload) => this.openDialogue(p));

    this.scale.on("resize", () => this.layout());
    this.layout();
  }

  /** A UI panel is up — tell WorldScene to stop treating taps as world movement. */
  private syncModalState() {
    bus.emit(EVENTS.MODAL_STATE, {
      open: this.inventoryOpen || this.shopOpen || this.vocationOpen || this.dialogueOpen,
    });
  }

  private buildTargetPanel() {
    this.targetPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
    const bg = this.add.rectangle(0, 0, 180, 34, COLORS.panelBg, 0.7).setOrigin(0.5, 0);
    this.targetLabel = this.add
      .text(0, 4, "", { fontFamily: "monospace", fontSize: "12px", color: "#f0f0f0" })
      .setOrigin(0.5, 0);
    this.targetPanel.add([bg, this.targetLabel]);
    this.targetBar = new StatBar(this, -80, 20, 160, 10, COLORS.hp);
    this.targetBar.setVisible(false);
  }

  private buildActionBar() {
    const slotDefs = ["health_potion", "mana_potion"];
    for (const itemId of slotDefs) {
      const item = ITEMS[itemId];
      const bg = this.add
        .rectangle(0, 0, 44, 44, COLORS.panelBg, 0.75)
        .setStrokeStyle(1, 0x3a3a3a)
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.image(0, 0, item.textureKey).setScrollFactor(0).setDepth(101).setScale(1.1);
      const count = this.add
        .text(0, 0, "0", { fontFamily: "monospace", fontSize: "11px", color: "#f0f0f0" })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(102);

      bg.on("pointerdown", () => bus.emit(EVENTS.USE_ITEM, { itemId }));
      this.actionSlots.push({ itemId, bg, icon, count });
    }
  }

  private buildInventoryToggle() {
    const bg = this.add
      .rectangle(0, 0, 60, 28, COLORS.panelBg, 0.75)
      .setStrokeStyle(1, 0x3a3a3a)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(0, 0, "Items", { fontFamily: "monospace", fontSize: "12px", color: "#f0f0f0" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);
    bg.on("pointerdown", () => {
      this.inventoryOpen = !this.inventoryOpen;
      this.inventoryPanel.setVisible(this.inventoryOpen);
      this.syncModalState();
    });
    this.inventoryToggle = { bg, text };
  }

  private inventoryToggle!: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };

  private buildInventoryPanel() {
    this.inventoryPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(150).setVisible(false);
  }

  private renderInventoryPanel() {
    this.inventoryPanel.removeAll(true);
    const entries = Object.entries(this.inventory).filter(([, count]) => count > 0);
    const width = 220;
    const rowHeight = 28;
    const height = 36 + Math.max(1, entries.length) * rowHeight;

    const bg = this.add.rectangle(0, 0, width, height, COLORS.panelBg, 0.92).setOrigin(0, 0);
    const title = this.add
      .text(10, 8, "Backpack", { fontFamily: "monospace", fontSize: "13px", color: "#f0f0f0" })
      .setOrigin(0, 0);
    this.inventoryPanel.add([bg, title]);

    if (entries.length === 0) {
      const empty = this.add
        .text(10, 36, "(empty)", { fontFamily: "monospace", fontSize: "12px", color: "#888" })
        .setOrigin(0, 0);
      this.inventoryPanel.add(empty);
    } else {
      entries.forEach(([itemId, count], i) => {
        const item = ITEMS[itemId];
        const y = 34 + i * rowHeight;
        const icon = this.add.image(20, y + rowHeight / 2, item.textureKey).setScale(0.9);
        const label = this.add
          .text(38, y + rowHeight / 2, `${item.name}  x${count}`, {
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#f0f0f0",
          })
          .setOrigin(0, 0.5);
        this.inventoryPanel.add([icon, label]);
      });
    }

    this.inventoryPanel.setSize(width, height);
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
    const rowHeight = 30;
    const headerHeight = 60;
    const sectionGap = sellRows.length > 0 && buyRows.length > 0 ? 20 : 0;
    const height = headerHeight + sellRows.length * rowHeight + buyRows.length * rowHeight + sectionGap + 16;

    const bg = this.add.rectangle(0, 0, width, height, COLORS.panelBg, 0.95).setOrigin(0, 0).setStrokeStyle(1, 0x3a3a3a);
    const title = this.add
      .text(10, 8, `${this.currentShop.npcName}`, { fontFamily: "monospace", fontSize: "13px", color: "#f0f0f0" })
      .setOrigin(0, 0);
    const goldText = this.add
      .text(10, 26, `Gold: ${gold}`, { fontFamily: "monospace", fontSize: "11px", color: "#e6c34a" })
      .setOrigin(0, 0);
    const closeBtn = this.add
      .text(width - 10, 8, "X", { fontFamily: "monospace", fontSize: "13px", color: "#e2e2e2" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeShop());
    this.shopPanel.add([bg, title, goldText, closeBtn]);

    let y = headerHeight;
    for (const offer of sellRows) {
      const item = ITEMS[offer.itemId];
      const row = this.add
        .rectangle(6, y, width - 12, rowHeight - 4, 0x000000, 0.25)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.image(20, y + (rowHeight - 4) / 2, item.textureKey).setScale(0.85);
      const label = this.add
        .text(36, y + (rowHeight - 4) / 2, `Buy ${item.name} — ${offer.price}g`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#f0f0f0",
        })
        .setOrigin(0, 0.5);
      row.on("pointerdown", () => bus.emit(EVENTS.BUY_ITEM, { npcId: this.currentShop!.npcId, itemId: offer.itemId }));
      this.shopPanel.add([row, icon, label]);
      y += rowHeight;
    }

    y += sectionGap;
    for (const offer of buyRows) {
      const item = ITEMS[offer.itemId];
      const owned = this.inventory[offer.itemId] ?? 0;
      const row = this.add
        .rectangle(6, y, width - 12, rowHeight - 4, 0x000000, 0.25)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.image(20, y + (rowHeight - 4) / 2, item.textureKey).setScale(0.85);
      const label = this.add
        .text(36, y + (rowHeight - 4) / 2, `Sell ${item.name} (x${owned}) — ${offer.price}g`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#f0f0f0",
        })
        .setOrigin(0, 0.5);
      row.on("pointerdown", () => bus.emit(EVENTS.SELL_ITEM, { npcId: this.currentShop!.npcId, itemId: offer.itemId }));
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

    const bg = this.add.rectangle(0, 0, width, height, COLORS.panelBg, 0.96).setOrigin(0, 0).setStrokeStyle(1, 0x3a3a3a);
    const title = this.add
      .text(10, 8, "Choose your path", { fontFamily: "monospace", fontSize: "13px", color: "#f0f0f0" })
      .setOrigin(0, 0);
    const closeBtn = this.add
      .text(width - 10, 8, "X", { fontFamily: "monospace", fontSize: "13px", color: "#e2e2e2" })
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
        .text(12, y + 4, VOCATION_NAMES[vocation], { fontFamily: "monospace", fontSize: "12px", color: "#e6c34a" })
        .setOrigin(0, 0);
      const desc = this.add
        .text(12, y + 20, VOCATION_DESCRIPTIONS[vocation], {
          fontFamily: "monospace",
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

  private readonly DIALOGUE_WIDTH = 280;
  private readonly DIALOGUE_HEIGHT = 190;

  private renderDialoguePanel(bodyText: string) {
    this.dialoguePanel.removeAll(true);
    const npc = this.currentDialogue;
    if (!npc) return;
    const width = this.DIALOGUE_WIDTH;
    const height = this.DIALOGUE_HEIGHT;

    const bg = this.add.rectangle(0, 0, width, height, COLORS.panelBg, 0.96).setOrigin(0, 0).setStrokeStyle(1, 0x3a3a3a);
    const portraitBg = this.add.rectangle(10, 10, 48, 48, 0x000000, 0.3).setOrigin(0, 0);
    const portrait = this.add.image(34, 34, npc.textureKey).setScale(1.3);
    const name = this.add
      .text(66, 14, npc.npcName, { fontFamily: "monospace", fontSize: "13px", color: "#e6c34a" })
      .setOrigin(0, 0);
    const body = this.add
      .text(66, 34, bodyText, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e2e2e2",
        wordWrap: { width: width - 76 },
      })
      .setOrigin(0, 0);
    const closeBtn = this.add
      .text(width - 10, 8, "X", { fontFamily: "monospace", fontSize: "13px", color: "#e2e2e2" })
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
        .setStrokeStyle(1, 0x3a3a3a)
        .setInteractive({ useHandCursor: true });
      const btnLabel = this.add
        .text(btnX + btnWidth / 2, buttonY + 13, button.label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#f0f0f0",
        })
        .setOrigin(0.5, 0.5);
      btnBg.on("pointerdown", button.onTap);
      this.dialoguePanel.add([btnBg, btnLabel]);
      btnX += btnWidth + 8;
    }

    this.dialoguePanel.setSize(width, height);
  }

  private buildLog() {
    for (let i = 0; i < 5; i++) {
      const text = this.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#cccccc" })
        .setScrollFactor(0)
        .setDepth(100);
      this.logLines.push(text);
    }
  }

  private pushLog(entry: LogPayload) {
    const color = LOG_COLORS[entry.kind] ?? "#cccccc";
    this.logMessages.push({ text: entry.text, color });
    if (this.logMessages.length > 5) this.logMessages.shift();
    this.renderLog();
  }

  private renderLog() {
    const recent = this.logMessages.slice(-5);
    for (let i = 0; i < this.logLines.length; i++) {
      const entry = recent[i];
      const line = this.logLines[i];
      if (entry) {
        line.setText(entry.text);
        line.setColor(entry.color);
        line.setVisible(true);
      } else {
        line.setVisible(false);
      }
    }
  }

  private onPlayerStats(p: PlayerStatsPayload) {
    this.hpBar.setValue(p.hp, p.maxHp, `HP ${p.hp}/${p.maxHp}`);
    this.manaBar.setValue(p.mana, p.maxMana, `MP ${p.mana}/${p.maxMana}`);
    this.xpBar.setValue(p.expIntoLevel, p.expForLevel, `Lv ${p.level}`);
  }

  private onTarget(t: TargetPayload | null) {
    if (!t) {
      this.targetPanel.setVisible(false);
      this.targetBar.setVisible(false);
      return;
    }
    this.targetPanel.setVisible(true);
    this.targetBar.setVisible(true);
    this.targetLabel.setText(t.name);
    this.targetBar.setValue(t.hp, t.maxHp, "");
  }

  private onInventory(inv: InventoryPayload) {
    this.inventory = inv.items;
    for (const slot of this.actionSlots) {
      const count = this.inventory[slot.itemId] ?? 0;
      slot.count.setText(String(count));
      slot.icon.setAlpha(count > 0 ? 1 : 0.35);
    }
    this.renderInventoryPanel(); // keep panel content fresh even while hidden
    if (this.shopOpen) this.renderShopPanel();
  }

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.targetPanel.setPosition(w / 2, 8);
    this.targetBar.setPosition(w / 2 - 80, 28);

    const slotSize = 44;
    const slotGap = 8;
    const totalWidth = this.actionSlots.length * slotSize + (this.actionSlots.length - 1) * slotGap;
    let startX = w / 2 - totalWidth / 2 + slotSize / 2;
    const y = h - slotSize / 2 - 10;
    for (const slot of this.actionSlots) {
      slot.bg.setPosition(startX, y);
      slot.icon.setPosition(startX, y);
      slot.count.setPosition(startX + slotSize / 2 - 3, y + slotSize / 2 - 3);
      startX += slotSize + slotGap;
    }

    this.inventoryToggle.bg.setPosition(w - 40, 20);
    this.inventoryToggle.text.setPosition(w - 40, 20);
    this.inventoryPanel.setPosition(w - 232, 56);

    this.shopPanel.setPosition(w / 2 - 120, h / 2 - 150);
    this.vocationPanel.setPosition(w / 2 - 130, h / 2 - 150);
    this.dialoguePanel.setPosition(w / 2 - this.DIALOGUE_WIDTH / 2, h / 2 - this.DIALOGUE_HEIGHT / 2 - 20);

    for (let i = 0; i < this.logLines.length; i++) {
      this.logLines[i].setPosition(12, h - 30 - (this.logLines.length - 1 - i) * 14);
    }
  }
}
