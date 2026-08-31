// Day/night cycle.
//
// A flat translucent overlay would darken the world evenly and make everything
// equally hard to read, which is the failure the art direction calls out. So
// the darkness here is a render texture that light sources are *erased* out
// of: torches, campfires and the forge burn real holes in the night, and the
// player carries a small light of their own so they never become the least
// readable thing on screen.

import Phaser from "phaser";
import { TILE_SIZE } from "./constants";
import { SURFACE_HEIGHT } from "../data/tilemap";

/** Real seconds for one full dawn -> day -> dusk -> night cycle. */
export const DAY_LENGTH_SECONDS = 480;

/** Radius in pixels of the soft light texture, before per-light scaling. */
const LIGHT_TEXTURE_RADIUS = 64;

export interface LightSource {
  /** Tile coordinates of the light. */
  x: number;
  y: number;
  /** Radius in tiles. */
  radius: number;
  /** Fraction of radius the flame flickers by, 0 for a steady light. */
  flicker?: number;
}

interface Phase {
  /** Point in the cycle, 0..1. */
  at: number;
  color: number;
  alpha: number;
}

// Night is deep and blue; dusk and dawn pass through a warmer, weaker tint so
// the transition doesn't read as someone turning a dimmer switch.
const PHASES: Phase[] = [
  { at: 0.0, color: 0x1a2440, alpha: 0.32 }, // dawn
  { at: 0.12, color: 0x000000, alpha: 0.0 }, // morning
  { at: 0.5, color: 0x000000, alpha: 0.0 }, // afternoon
  { at: 0.62, color: 0x3a2440, alpha: 0.3 }, // dusk
  { at: 0.75, color: 0x0a1428, alpha: 0.66 }, // night
  { at: 0.92, color: 0x0a1428, alpha: 0.66 }, // late night
  { at: 1.0, color: 0x1a2440, alpha: 0.32 }, // back to dawn
];

// The sewer is windowless rock below the surface, so it never sees the sun —
// it stays at this damp, faintly green-black gloom regardless of the surface
// clock, dimmer than even full night, with torchlight doing all the work of
// carving out the safe pools (see update()'s inSewer branch).
const DUNGEON_AMBIENT: Phase = { at: 0, color: 0x0d1811, alpha: 0.62 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Blend two packed RGB colours. */
function blendColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t))
  );
}

export class DayNightCycle {
  private layer: Phaser.GameObjects.RenderTexture;
  private lightBrush: Phaser.GameObjects.Image;
  /** 0..1 through the cycle. Starts in the morning so a new game opens in daylight. */
  private clock = 0.2;
  private elapsedMs = 0;

  constructor(
    private scene: Phaser.Scene,
    private lights: LightSource[],
    private playerLightRadius = 4,
  ) {
    this.buildLightTexture();

    // Deliberately not setScrollFactor(0): this camera is zoomed, and a
    // scroll-factor-zero object is still scaled about the camera centre, which
    // throws it off the viewport. The layer is sized in screen pixels and then
    // pinned to the camera's world view and counter-scaled in update().
    this.layer = scene.add
      .renderTexture(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0)
      .setDepth(400);

    // Held off the display list; it exists only to be stamped into the layer.
    this.lightBrush = scene.make.image({ key: "night-light" }, false).setOrigin(0.5, 0.5);
  }

  /** A soft radial falloff, built by stacking translucent circles. */
  private buildLightTexture() {
    if (this.scene.textures.exists("night-light")) return;
    const size = LIGHT_TEXTURE_RADIUS * 2;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (let r = LIGHT_TEXTURE_RADIUS; r > 0; r--) {
      // Squared falloff concentrates the brightness in the middle, so a light
      // has a clear pool rather than a uniform disc with a hard rim.
      const t = 1 - r / LIGHT_TEXTURE_RADIUS;
      g.fillStyle(0xffffff, 0.05 * t * t + 0.004);
      g.fillCircle(LIGHT_TEXTURE_RADIUS, LIGHT_TEXTURE_RADIUS, r);
    }
    g.generateTexture("night-light", size, size);
    g.destroy();
  }

  /** Current point in the cycle, 0..1. */
  get timeOfDay(): number {
    return this.clock;
  }

  /** A readable label for the debug overlay. */
  get phaseName(): string {
    if (this.clock < 0.12) return "dawn";
    if (this.clock < 0.5) return "morning";
    if (this.clock < 0.62) return "afternoon";
    if (this.clock < 0.75) return "dusk";
    return "night";
  }

  private ambient(inSewer: boolean): { color: number; alpha: number } {
    if (inSewer) return { color: DUNGEON_AMBIENT.color, alpha: DUNGEON_AMBIENT.alpha };
    for (let i = 0; i < PHASES.length - 1; i++) {
      const from = PHASES[i];
      const to = PHASES[i + 1];
      if (this.clock >= from.at && this.clock <= to.at) {
        const t = to.at === from.at ? 0 : (this.clock - from.at) / (to.at - from.at);
        return { color: blendColor(from.color, to.color, t), alpha: lerp(from.alpha, to.alpha, t) };
      }
    }
    return { color: PHASES[0].color, alpha: PHASES[0].alpha };
  }

  resize() {
    this.layer.setSize(this.scene.scale.width, this.scene.scale.height);
  }

  update(deltaMs: number, playerTile: { x: number; y: number }) {
    this.elapsedMs += deltaMs;
    this.clock = (this.elapsedMs / (DAY_LENGTH_SECONDS * 1000)) % 1;

    const inSewer = playerTile.y >= SURFACE_HEIGHT;
    const { color, alpha } = this.ambient(inSewer);
    if (alpha <= 0.001) {
      // Broad daylight: skip the work entirely rather than compositing a
      // fully transparent layer every frame.
      this.layer.setVisible(false);
      return;
    }
    this.layer.setVisible(true);

    const camera = this.scene.cameras.main;

    // Cover exactly the viewport: the texture is screen-sized, so it's drawn
    // at the top-left of what the camera can see, scaled back down by the zoom.
    const inverseZoom = 1 / camera.zoom;
    this.layer.setPosition(camera.worldView.x, camera.worldView.y);
    this.layer.setScale(inverseZoom);

    this.layer.clear();
    this.layer.fill(color, alpha, 0, 0, camera.width, camera.height);

    // Lights are only worth stamping if they're on screen.
    const view = camera.worldView;
    const margin = 8 * TILE_SIZE;
    for (const light of this.lights) {
      const worldX = (light.x + 0.5) * TILE_SIZE;
      const worldY = (light.y + 0.5) * TILE_SIZE;
      if (
        worldX < view.x - margin ||
        worldX > view.right + margin ||
        worldY < view.y - margin ||
        worldY > view.bottom + margin
      ) {
        continue;
      }
      const flicker = light.flicker ? 1 + (Math.random() - 0.5) * light.flicker : 1;
      this.stampLight(worldX, worldY, light.radius * flicker);
    }
    this.stampLight((playerTile.x + 0.5) * TILE_SIZE, (playerTile.y + 0.5) * TILE_SIZE, this.playerLightRadius);
  }

  /** Erase one light-shaped hole in the darkness, in screen space. */
  private stampLight(worldX: number, worldY: number, radiusTiles: number) {
    const camera = this.scene.cameras.main;
    const screenX = (worldX - camera.worldView.x) * camera.zoom;
    const screenY = (worldY - camera.worldView.y) * camera.zoom;
    const radiusPx = radiusTiles * TILE_SIZE * camera.zoom;

    this.lightBrush.setPosition(screenX, screenY);
    this.lightBrush.setScale(radiusPx / LIGHT_TEXTURE_RADIUS);
    this.layer.erase(this.lightBrush);
  }
}
