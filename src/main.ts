import Phaser from "phaser";
import { registerSW } from "virtual:pwa-register";
import { TitleScene } from "./scenes/TitleScene";
import { SelectScene } from "./scenes/SelectScene";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { InteriorScene } from "./scenes/InteriorScene";
import { UIScene } from "./scenes/UIScene";
import { TARGET_FPS } from "./game/constants";
import { initOrientationLock } from "./game/orientationLock";

// Take a fresh service worker as soon as it's ready and reload, so a new
// build (Title screen, character select, whatever else changed) is picked up
// on next open of the PWA rather than hanging on the previous cached bundle
// until the user manually clears storage.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
});

const game = new Phaser.Game({
  // Real users always get Phaser.AUTO (WebGL where available — better perf).
  // A `?renderer=canvas` override exists purely so this can be visually
  // verified in headless test environments where WebGL readback can hang.
  type: new URLSearchParams(location.search).get("renderer") === "canvas" ? Phaser.CANVAS : Phaser.AUTO,
  parent: "app",
  backgroundColor: "#0b0b0b",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: TARGET_FPS,
    forceSetTimeOut: false,
  },
  render: {
    pixelArt: true,
    antialias: false,
    powerPreference: "low-power",
  },
  // Title runs first (Phaser auto-starts the first scene in this list). Flow:
  // Title -> Select (pick or create a character) -> Boot -> World + UI.
  scene: [TitleScene, SelectScene, BootScene, WorldScene, InteriorScene, UIScene],
});

// Dev-only handle so the running game can be inspected from a test harness.
// Vite strips this branch from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}

// Battery + landscape-only: fully stop the render/update loop whenever the
// tab is backgrounded OR the device is in portrait — two independent
// conditions, combined here so neither one's "wake" can undo the other's
// "sleep".
let tabHidden = document.hidden;
let inPortrait = false;
function syncLoopState() {
  if (tabHidden || inPortrait) game.loop.sleep();
  else game.loop.wake();
}

document.addEventListener("visibilitychange", () => {
  tabHidden = document.hidden;
  syncLoopState();
});

initOrientationLock((portrait) => {
  inPortrait = portrait;
  syncLoopState();
});
