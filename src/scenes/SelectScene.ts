import Phaser from "phaser";
import {
  CharacterSave,
  createCharacter,
  isNameTaken,
  listCharacters,
  MAX_CHARACTERS,
  MAX_NAME_LENGTH,
  sanitizeName,
  setActiveCharacter,
} from "../game/profile";
import { TILE_SIZE } from "../game/constants";
import { vocationDisplayName } from "../game/stats";

// The player sprite sheet, loaded here under a distinct key so the select
// screen can draw portraits before BootScene has staged any world assets.
const PORTRAIT_KEY = "select-portrait";
const PORTRAIT_URL = "assets/characters/player_base_sheet.png";
const PORTRAIT_FRAME = { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE };

// The title-screen illustration, reused here so the login flow reads as one
// continuous scene rather than a hard cut from art to black. Loaded under a
// distinct key so this scene owns it — TitleScene is stopped by the time we
// get here, but its texture may or may not still be in the cache.
const BG_KEY = "select-bg";
const BG_URL = "assets/ui/title_background.png";
// The player sheet is laid out down/left/right/up × (idle/walk1/walk2/attack);
// frame 0 is the idle-down pose, which is what a portrait wants.
const IDLE_DOWN_FRAME = 0;
// Portrait draws big so a card is legible at arm's length on a phone.
const PORTRAIT_SCALE = 3;

const CARD_W = 240;
const CARD_H = 96;
const CARD_GAP = 12;

const COLORS = {
  bg: 0x0d0d0d,
  cardBg: 0x1a1a1a,
  cardBorder: 0x3a3a3a,
  cardBorderHover: 0xe6c34a,
  newCardBg: 0x151515,
  newCardBorder: 0x6b4a2a,
  overlayBg: 0x000000,
  accent: 0xe6c34a,
} as const;

/**
 * The account's characters, laid out as tap cards. A new character starts
 * from a name-entry sheet and drops straight into the world; a returning
 * character taps their card and hydrates into the world where they left off
 * (level and vocation persisted; gear and position reset by design — see
 * WorldScene).
 */
export class SelectScene extends Phaser.Scene {
  private nameOverlay: HTMLDivElement | null = null;

  constructor() {
    super("Select");
  }

  preload() {
    this.load.spritesheet(PORTRAIT_KEY, PORTRAIT_URL, PORTRAIT_FRAME);
    this.load.image(BG_KEY, BG_URL);
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.layout();
    this.scale.on("resize", this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.relayout, this);
      this.dismissNameOverlay();
    });
  }

  private relayout() {
    this.dismissNameOverlay();
    this.children.removeAll(true);
    this.layout();
  }

  private layout() {
    const { width, height } = this.scale;

    // The same forest illustration used on the title screen, dimmed so the
    // cards and the header still read cleanly on top. Cover-fit rather than
    // stretched so the girl stays in frame at any aspect.
    const bg = this.add.image(width / 2, height / 2, BG_KEY).setOrigin(0.5);
    const bgTex = this.textures.get(BG_KEY).getSourceImage();
    bg.setScale(Math.max(width / bgTex.width, height / bgTex.height));
    // A dark scrim over the illustration. Without it, the cards' dark panels
    // fight the illustration's midtones and neither reads at a glance.
    this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0);

    this.add
      .text(width / 2, 34, "Choose Your Character", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#f4e6c8",
      })
      .setOrigin(0.5, 0);

    const characters = listCharacters();
    const cardCount = characters.length + (characters.length < MAX_CHARACTERS ? 1 : 0);
    // Two columns on any viewport wide enough to fit them side-by-side with
    // the same gap as vertical; otherwise one column, so a portrait phone
    // still gets a scrollable list rather than clipped cards.
    const cols = width >= CARD_W * 2 + CARD_GAP * 3 ? 2 : 1;
    const rows = Math.ceil(cardCount / cols);
    const gridW = cols * CARD_W + (cols - 1) * CARD_GAP;
    const gridH = rows * CARD_H + (rows - 1) * CARD_GAP;
    const startX = (width - gridW) / 2;
    const startY = Math.max(78, (height - gridH) / 2);

    characters.forEach((character, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (CARD_W + CARD_GAP);
      const y = startY + row * (CARD_H + CARD_GAP);
      this.buildCharacterCard(x, y, character);
    });

    if (characters.length < MAX_CHARACTERS) {
      const i = characters.length;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (CARD_W + CARD_GAP);
      const y = startY + row * (CARD_H + CARD_GAP);
      this.buildNewCard(x, y);
    }

    // Small footnote so the returning player is not surprised when their
    // level-20 knight comes back holding a fresh starter sword. Removed once
    // gear/position/skill persistence lands.
    this.add
      .text(
        width / 2,
        height - 12,
        "Level and vocation persist. Gear, position and per-skill progress reset for now.",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#6c6c6c",
        },
      )
      .setOrigin(0.5, 1);
  }

  private buildCharacterCard(x: number, y: number, character: CharacterSave) {
    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, COLORS.cardBg)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.cardBorder)
      .setInteractive({ useHandCursor: true });

    // Portrait sits in a small inset panel on the left of the card, so the
    // text has a fixed rectangle to line up against regardless of art size.
    const portraitPanelW = CARD_H;
    this.add
      .rectangle(x + 4, y + 4, portraitPanelW - 8, CARD_H - 8, 0x000000, 0.35)
      .setOrigin(0, 0);
    this.add
      .sprite(x + portraitPanelW / 2, y + CARD_H / 2, PORTRAIT_KEY, IDLE_DOWN_FRAME)
      .setOrigin(0.5)
      .setScale(PORTRAIT_SCALE);

    const textX = x + portraitPanelW + 8;
    this.add.text(textX, y + 10, character.name, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f4e6c8",
    });
    this.add.text(textX, y + 34, vocationDisplayName(character.vocation), {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#a3a3a3",
    });
    this.add.text(textX, y + 52, `Level ${character.level}`, {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#a3a3a3",
    });

    bg.on("pointerover", () => bg.setStrokeStyle(2, COLORS.cardBorderHover));
    bg.on("pointerout", () => bg.setStrokeStyle(2, COLORS.cardBorder));
    bg.on("pointerdown", () => this.enterAs(character));
  }

  private buildNewCard(x: number, y: number) {
    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, COLORS.newCardBg)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.newCardBorder)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x + CARD_W / 2, y + CARD_H / 2 - 8, "+", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#e6c34a",
      })
      .setOrigin(0.5);
    this.add
      .text(x + CARD_W / 2, y + CARD_H / 2 + 18, "New Character", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#a3a3a3",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setStrokeStyle(2, COLORS.cardBorderHover));
    bg.on("pointerout", () => bg.setStrokeStyle(2, COLORS.newCardBorder));
    bg.on("pointerdown", () => this.openNameSheet());
  }

  private enterAs(character: CharacterSave) {
    setActiveCharacter(character.id);
    this.scene.start("Boot");
  }

  private openNameSheet() {
    if (this.nameOverlay) return; // already open

    const { width, height } = this.scale;

    // Dim the character list so the sheet is unambiguously modal.
    const dim = this.add
      .rectangle(0, 0, width, height, COLORS.overlayBg, 0.6)
      .setOrigin(0, 0)
      .setInteractive();
    dim.on("pointerdown", () => {}); // swallow taps through to cards behind

    const title = this.add
      .text(width / 2, height * 0.4, "Name your new character", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f4e6c8",
      })
      .setOrigin(0.5);

    // Native <input> so mobile keyboards, paste and autocorrect behave the
    // way the OS wants them to, positioned over the canvas.
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position: absolute",
      "left: 50%",
      `top: ${Math.round(height * 0.44)}px`,
      "transform: translateX(-50%)",
      "display: flex",
      "flex-direction: column",
      "align-items: center",
      "gap: 8px",
      "pointer-events: auto",
      "z-index: 10",
    ].join(";");

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = MAX_NAME_LENGTH;
    input.placeholder = "Enter a name";
    input.autocapitalize = "words";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.style.cssText = [
      "font-family: monospace",
      "font-size: 20px",
      "padding: 10px 14px",
      "width: 240px",
      "text-align: center",
      "background: rgba(15, 15, 15, 0.95)",
      "color: #f4e6c8",
      "border: 2px solid #6b4a2a",
      "border-radius: 4px",
      "outline: none",
    ].join(";");

    const error = document.createElement("div");
    error.style.cssText = "font-family: monospace; font-size: 12px; color: #c9302f; min-height: 14px;";

    overlay.appendChild(input);
    overlay.appendChild(error);
    document.body.appendChild(overlay);
    this.nameOverlay = overlay;

    const teardown = () => {
      this.dismissNameOverlay();
      dim.destroy();
      title.destroy();
      begin.bg.destroy();
      begin.text.destroy();
      cancel.bg.destroy();
      cancel.text.destroy();
    };

    const submit = () => {
      const name = sanitizeName(input.value);
      if (!name) {
        error.textContent = "Name cannot be empty.";
        input.style.borderColor = "#c9302f";
        input.focus();
        return;
      }
      if (isNameTaken(name)) {
        error.textContent = "You already have a character with that name.";
        input.style.borderColor = "#c9302f";
        input.focus();
        return;
      }
      const created = createCharacter(name);
      if (!created) {
        error.textContent = "Could not create the character.";
        return;
      }
      teardown();
      this.enterAs(created);
    };

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submit();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        teardown();
      }
    });

    const begin = this.makeButton(width / 2 - 60, height * 0.6, "Begin", submit);
    const cancel = this.makeButton(width / 2 + 60, height * 0.6, "Cancel", teardown);

    this.time.delayedCall(50, () => input.focus());
  }

  private makeButton(x: number, y: number, label: string, onTap: () => void) {
    const padX = 18;
    const padY = 8;
    const text = this.add
      .text(x, y, label, { fontFamily: "monospace", fontSize: "16px", color: "#f4e6c8" })
      .setOrigin(0.5);
    const bg = this.add
      .rectangle(x, y, text.width + padX * 2, text.height + padY * 2, 0x1a1a1a, 0.95)
      .setStrokeStyle(2, COLORS.accent)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    text.setDepth(1);
    bg.on("pointerdown", onTap);
    return { bg, text };
  }

  private dismissNameOverlay() {
    if (this.nameOverlay && this.nameOverlay.parentNode) {
      this.nameOverlay.parentNode.removeChild(this.nameOverlay);
    }
    this.nameOverlay = null;
  }
}
