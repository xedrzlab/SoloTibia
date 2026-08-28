import Phaser from "phaser";
import { IMAGE_ASSETS, SHEET_ASSETS, WATER_FRAME_COUNT, WATER_FRAME_MS } from "../data/assets";
import { MONSTERS } from "../data/monsters";
import { DIRECTION_ORDER, walkAnimKey } from "../game/directionalSprite";

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
    // The renderer's global pixelArt setting (main.ts) makes every texture
    // nearest-neighbor filtered, which is right for hard-edged pixel art but
    // turns a smooth/shaded sheet into a muddy blob once it's downscaled to
    // a small on-screen size (confirmed: looked fine at a desktop test zoom,
    // wrong on an actual phone where the same texture renders smaller).
    // Switch just those images/sheets to linear filtering.
    for (const asset of [...IMAGE_ASSETS, ...SHEET_ASSETS]) {
      if (asset.smooth) this.textures.get(asset.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    // Water is the one terrain that moves. Registering it here keeps the
    // animation definition next to the sheet it belongs to.
    this.anims.create({
      key: "water-flow",
      frames: this.anims.generateFrameNumbers("water", { start: 0, end: WATER_FRAME_COUNT - 1 }),
      frameRate: 1000 / WATER_FRAME_MS,
      repeat: -1,
    });

    // A monster whose directional sheet has no dedicated stepA/stepB/attack
    // art (e.g. cave_rat's idle+move, goblin's 6-frame walk cycle) gets a
    // real looping walk animation per direction instead of a frame flipped
    // once per tile-step — it plays continuously while moving and only
    // restarts if the direction changes, rather than resetting (or
    // freezing) on every step boundary.
    const continuousWalkTextures = new Map(
      Object.values(MONSTERS)
        .filter((m) => m.continuousWalk && m.framesPerDirection)
        .map((m) => [m.textureKey, m.framesPerDirection!]),
    );
    for (const [textureKey, perDir] of continuousWalkTextures) {
      DIRECTION_ORDER.forEach((direction, i) => {
        this.anims.create({
          key: walkAnimKey(textureKey, direction),
          frames: this.anims.generateFrameNumbers(textureKey, { start: i * perDir, end: i * perDir + perDir - 1 }),
          frameRate: 5,
          repeat: -1,
        });
      });
    }

    // The player's own walk cycle — same "real looping animation instead of
    // a frame held for the whole tile-step" fix as the continuousWalk
    // monsters above (see Player.ts's applyFrame). Frame 0 is reserved for
    // the idle pose, so unlike the monsters' loop above, the player's loop
    // starts at frame 1 and excludes it.
    const PLAYER_FRAMES_PER_DIRECTION = 4;
    DIRECTION_ORDER.forEach((direction, i) => {
      this.anims.create({
        key: walkAnimKey("player", direction),
        frames: this.anims.generateFrameNumbers("player", {
          start: i * PLAYER_FRAMES_PER_DIRECTION + 1,
          end: i * PLAYER_FRAMES_PER_DIRECTION + PLAYER_FRAMES_PER_DIRECTION - 1,
        }),
        frameRate: 5,
        repeat: -1,
      });
    });

    this.scene.start("World");
    this.scene.launch("UI");
  }
}
