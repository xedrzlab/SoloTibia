import Phaser from "phaser";
import { IMAGE_ASSETS, SHEET_ASSETS, WATER_FRAME_COUNT, WATER_FRAME_MS } from "../data/assets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    // Everything the game draws is listed in src/data/assets.ts, so adding art
    // is a data change rather than an edit to this scene.
    const base = "assets";
    for (const asset of IMAGE_ASSETS) {
      this.load.image(asset.key, `${base}/${asset.path}`);
    }
    for (const sheet of SHEET_ASSETS) {
      this.load.spritesheet(sheet.key, `${base}/${sheet.path}`, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }

    // A missing file would otherwise show up as a blank sprite somewhere far
    // from the cause; say so plainly instead.
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.error(`Missing asset "${file.key}" at ${file.url} — check src/data/assets.ts.`);
    });
  }

  create() {
    // Water is the one terrain that moves. Registering it here keeps the
    // animation definition next to the sheet it belongs to.
    this.anims.create({
      key: "water-flow",
      frames: this.anims.generateFrameNumbers("water", { start: 0, end: WATER_FRAME_COUNT - 1 }),
      frameRate: 1000 / WATER_FRAME_MS,
      repeat: -1,
    });

    this.scene.start("World");
    this.scene.launch("UI");
  }
}
