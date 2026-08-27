// Optional development overlay, toggled with the `debug` URL parameter
// (?debug=1) or by pressing D. It draws the things that are otherwise
// invisible and expensive to reason about: where the grid actually is, which
// squares block movement, and where each sprite is anchored.
//
// Off by default and never drawn for a normal player, so it costs nothing at
// runtime beyond one boolean check.

import Phaser from "phaser";
import { TILE_SIZE } from "./constants";

const COLORS = {
  grid: 0x9aa0a8,
  blocked: 0xc9302f,
  anchor: 0x6fb2ff,
  bounds: 0xe6c34a,
};

export interface DebugTarget {
  /** Sprites whose anchor point and bounds should be marked. */
  sprites(): Phaser.GameObjects.Sprite[] | Phaser.GameObjects.Image[];
  /** Whether a tile blocks movement. */
  isWalkable(x: number, y: number): boolean;
}

export class DebugOverlay {
  private graphics: Phaser.GameObjects.Graphics;
  private readout: Phaser.GameObjects.Text;
  private enabled: boolean;

  isEnabled(): boolean {
    return this.enabled;
  }

  constructor(
    private scene: Phaser.Scene,
    private target: DebugTarget,
  ) {
    this.enabled = new URLSearchParams(location.search).get("debug") !== null;

    this.graphics = scene.add.graphics().setDepth(500);
    // Deliberately not setScrollFactor(0): this scene's camera is zoomed, and
    // a scroll-factor-zero object is still scaled about the camera centre,
    // which throws it off screen. The readout is pinned to the camera's world
    // view in update() and counter-scaled instead.
    this.readout = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#7cff7c",
        backgroundColor: "#000000c0",
      })
      .setDepth(501);

    scene.input.keyboard?.on("keydown-D", () => {
      this.enabled = !this.enabled;
      if (!this.enabled) this.clear();
    });

    this.setVisible(this.enabled);
  }

  private setVisible(visible: boolean) {
    this.graphics.setVisible(visible);
    this.readout.setVisible(visible);
  }

  private clear() {
    this.graphics.clear();
    this.readout.setText("");
    this.setVisible(false);
  }

  /** Redraw for the current camera view. Cheap: only visible tiles are walked. */
  update(playerTile: { x: number; y: number }, extra: Record<string, string | number> = {}) {
    if (!this.enabled) return;
    this.setVisible(true);

    const camera = this.scene.cameras.main;
    const g = this.graphics;
    g.clear();

    // Only the tiles actually on screen — drawing the whole 70x50 map every
    // frame would swamp the very thing being measured.
    const left = Math.max(0, Math.floor(camera.worldView.x / TILE_SIZE));
    const top = Math.max(0, Math.floor(camera.worldView.y / TILE_SIZE));
    const right = Math.ceil(camera.worldView.right / TILE_SIZE);
    const bottom = Math.ceil(camera.worldView.bottom / TILE_SIZE);

    g.lineStyle(1, COLORS.grid, 0.28);
    for (let x = left; x <= right; x++) {
      g.lineBetween(x * TILE_SIZE, top * TILE_SIZE, x * TILE_SIZE, bottom * TILE_SIZE);
    }
    for (let y = top; y <= bottom; y++) {
      g.lineBetween(left * TILE_SIZE, y * TILE_SIZE, right * TILE_SIZE, y * TILE_SIZE);
    }

    g.fillStyle(COLORS.blocked, 0.22);
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (!this.target.isWalkable(x, y)) g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Sprite bounds plus a cross on the ground anchor. Sprites here use a
    // bottom-right origin, so the anchor is nowhere near the image centre —
    // seeing both at once is the fastest way to catch a mis-anchored asset.
    for (const sprite of this.target.sprites()) {
      const bounds = sprite.getBounds();
      g.lineStyle(1, COLORS.bounds, 0.5);
      g.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      g.lineStyle(1, COLORS.anchor, 0.9);
      g.lineBetween(sprite.x - 3, sprite.y, sprite.x + 3, sprite.y);
      g.lineBetween(sprite.x, sprite.y - 3, sprite.x, sprite.y + 3);
    }

    const lines = [
      `fps    ${Math.round(this.scene.game.loop.actualFps)}`,
      `tile   ${playerTile.x}, ${playerTile.y}`,
      `zoom   ${camera.zoom.toFixed(3)}`,
      `view   ${Math.round(camera.width)}x${Math.round(camera.height)}`,
      ...Object.entries(extra).map(([k, v]) => `${k.padEnd(6)} ${v}`),
      "",
      "D toggles",
    ];
    this.readout.setText(lines.join("\n"));

    // Pin to the top-left of what the camera can see, at a constant on-screen
    // size whatever the zoom is.
    const inverseZoom = 1 / camera.zoom;
    this.readout.setScale(inverseZoom);
    this.readout.setPosition(camera.worldView.x + 6 * inverseZoom, camera.worldView.y + 6 * inverseZoom);
  }
}
