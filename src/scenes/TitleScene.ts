import Phaser from "phaser";
import { loadProfile, saveProfile, sanitizeName, MAX_NAME_LENGTH } from "../game/profile";

// The two art files that own this screen. Loaded here rather than in the main
// asset registry: they belong to a scene the player leaves and never returns
// to, and the registry is for gameplay pixel art (this splash is not).
const BG_KEY = "title-bg";
const BANNER_KEY = "title-banner";

// The banner PNG is huge; drawing it at native size dominates the screen.
// This is the on-screen width we want it to sit at, before responsive fit.
const BANNER_TARGET_WIDTH = 560;

/**
 * Front door of the game: banner over the forest illustration, tap to enter.
 * A first-time player also picks a character name here; a returning one goes
 * straight through with the name already saved.
 */
export class TitleScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;

  constructor() {
    super("Title");
  }

  preload() {
    this.load.image(BG_KEY, "assets/ui/title_background.png");
    this.load.image(BANNER_KEY, "assets/ui/title_banner.png");
  }

  create() {
    const { width, height } = this.scale;

    // Cover-fit the background: fill the viewport, keep aspect, let the sides
    // or top/bottom be cropped rather than letterboxed. The illustration has
    // enough headroom that a portrait crop still shows the girl.
    const bg = this.add.image(width / 2, height / 2, BG_KEY).setOrigin(0.5);
    const bgTex = this.textures.get(BG_KEY).getSourceImage();
    const bgScale = Math.max(width / bgTex.width, height / bgTex.height);
    bg.setScale(bgScale);

    // Banner sits in the upper third, over the sky area of the illustration.
    const banner = this.add.image(width / 2, height * 0.28, BANNER_KEY).setOrigin(0.5);
    const bannerTex = this.textures.get(BANNER_KEY).getSourceImage();
    const bannerScale = Math.min(1, BANNER_TARGET_WIDTH / bannerTex.width, (width * 0.9) / bannerTex.width);
    banner.setScale(bannerScale);

    const profile = loadProfile();
    if (profile) {
      this.showEnterPrompt(profile.name);
    } else {
      this.showNameForm();
    }

    // If the window is resized while the title is up (rotation, browser chrome
    // change) re-lay the whole thing out so nothing floats off-screen.
    this.scale.on("resize", this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.relayout, this);
      this.dismissOverlay();
    });
  }

  private relayout() {
    // Cheap approach: rebuild everything. The scene only holds a background,
    // banner and one HTML overlay — recreating is simpler than tracking each.
    this.dismissOverlay();
    this.children.removeAll(true);
    this.create();
  }

  private showEnterPrompt(name: string) {
    const { width, height } = this.scale;

    const label = this.add
      .text(width / 2, height * 0.72, `Welcome back, ${name}`, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f4e6c8",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const button = this.makeTapButton(width / 2, height * 0.82, "Enter Oakhollow", () => this.startGame());

    // Pulse the button so the tap target is obvious against the illustration.
    this.tweens.add({
      targets: [label, button.bg, button.text],
      alpha: { from: 0.75, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private showNameForm() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.62, "Name your character", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f4e6c8",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Native <input> for the text field: mobile keyboards behave correctly,
    // autocorrect/paste work, no per-platform virtual-keyboard code in Phaser.
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position: absolute",
      "left: 50%",
      `top: ${Math.round(height * 0.66)}px`,
      "transform: translateX(-50%)",
      "display: flex",
      "flex-direction: column",
      "align-items: center",
      "gap: 12px",
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
      "background: rgba(15, 15, 15, 0.85)",
      "color: #f4e6c8",
      "border: 2px solid #6b4a2a",
      "border-radius: 4px",
      "outline: none",
    ].join(";");

    overlay.appendChild(input);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Enter on the keyboard mirrors the on-canvas button.
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submit();
      }
    });

    const submit = () => {
      const name = sanitizeName(input.value);
      if (!name) {
        input.focus();
        input.style.borderColor = "#c9302f";
        return;
      }
      saveProfile({ name });
      this.startGame();
    };

    this.makeTapButton(width / 2, height * 0.82, "Begin", submit);

    // Focus the input after Phaser's first render tick, so the mobile keyboard
    // isn't summoned before the scene is visible.
    this.time.delayedCall(50, () => input.focus());
  }

  /** A small rectangle-with-text acting as a button on the canvas. */
  private makeTapButton(x: number, y: number, label: string, onTap: () => void) {
    const padX = 18;
    const padY = 10;
    const text = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f4e6c8",
      })
      .setOrigin(0.5);

    const bg = this.add
      .rectangle(x, y, text.width + padX * 2, text.height + padY * 2, 0x1a1a1a, 0.85)
      .setStrokeStyle(2, 0xe6c34a)
      .setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true });
    text.setDepth(1);

    bg.on("pointerdown", onTap);

    return { bg, text };
  }

  private dismissOverlay() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  private startGame() {
    this.dismissOverlay();
    this.scene.start("Boot");
  }
}
