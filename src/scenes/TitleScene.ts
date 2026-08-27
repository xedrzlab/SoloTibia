import Phaser from "phaser";

// The two art files that own this screen. Loaded here rather than in the main
// asset registry: they belong to a scene the player leaves and never returns
// to, and the registry is for gameplay pixel art (this splash is not).
const BG_KEY = "title-bg";
const BANNER_KEY = "title-banner";

// The banner PNG is huge; drawing it at native size dominates the screen.
// This is the on-screen width we want it to sit at, before responsive fit.
const BANNER_TARGET_WIDTH = 560;

/**
 * Front door of the game: banner over the forest illustration, tap to enter
 * the character-select screen. The banner is the whole moment — the tap can
 * land anywhere, so a player never hunts for a small button.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  preload() {
    this.load.image(BG_KEY, "assets/ui/title_background.png");
    this.load.image(BANNER_KEY, "assets/ui/title_banner.png");
  }

  create() {
    this.layout();

    // The whole scene is a tap target — no small "Enter" hit-box to miss on
    // a phone. Any tap advances to character select.
    this.input.once("pointerdown", () => this.scene.start("Select"));

    this.scale.on("resize", this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.relayout, this));
  }

  private relayout() {
    this.children.removeAll(true);
    this.layout();
  }

  private layout() {
    const { width, height } = this.scale;

    // Cover-fit the background: fill the viewport, keep aspect, let the sides
    // or top/bottom be cropped rather than letterboxed. The illustration has
    // enough headroom that a portrait crop still shows the girl.
    const bg = this.add.image(width / 2, height / 2, BG_KEY).setOrigin(0.5);
    const bgTex = this.textures.get(BG_KEY).getSourceImage();
    bg.setScale(Math.max(width / bgTex.width, height / bgTex.height));

    // Banner sits in the upper third, over the sky area of the illustration.
    const banner = this.add.image(width / 2, height * 0.28, BANNER_KEY).setOrigin(0.5);
    const bannerTex = this.textures.get(BANNER_KEY).getSourceImage();
    const bannerScale = Math.min(1, BANNER_TARGET_WIDTH / bannerTex.width, (width * 0.9) / bannerTex.width);
    banner.setScale(bannerScale);

    // The game's name, carved into the signboard — sized off the same scale
    // factor as the banner art so it shrinks/grows with it instead of the
    // two drifting apart on an unusual aspect ratio.
    this.add
      .text(banner.x, banner.y, "VAELORN", {
        fontFamily: "monospace",
        fontStyle: "bold",
        fontSize: `${Math.round(46 * bannerScale)}px`,
        color: "#f4e6c8",
        stroke: "#2a1608",
        strokeThickness: Math.max(2, Math.round(6 * bannerScale)),
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 4, true, true)
      .setLetterSpacing(Math.round(6 * bannerScale));

    const prompt = this.add
      .text(width / 2, height * 0.82, "Tap anywhere to begin", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f4e6c8",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Slow pulse — the prompt is the only thing on screen that has to draw the
    // eye, and the illustration behind it is doing enough of its own work that
    // a static label reads as a caption on it rather than as a call to tap.
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0.55, to: 1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }
}
