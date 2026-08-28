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

// With registerType: "autoUpdate" (vite.config.ts), the generated register
// script reloads the page automatically once a new service worker takes
// over — but Workbox only ever CHECKS for one on a fresh page navigation.
// An installed PWA that's opened once and left running (the normal way to
// play this) never triggers that check, so a pushed update could sit
// unnoticed indefinitely. Force the check ourselves: once on load, again
// whenever the app regains focus (reopening from the home screen/task
// switcher), and on a coarse timer as a backstop for a long play session
// that never backgrounds.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const checkForUpdate = () => registration.update().catch(() => {});
    checkForUpdate();
    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkForUpdate();
    });
  },
});

// Chrome only offers "Install app" in its own menu when it feels like it,
// and hides the entry entirely once it thinks an install already exists
// (even a stale/incomplete one) — so give the player an explicit button
// tied to the same underlying event, as a reliable fallback path.
let deferredInstallPrompt: Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const installBtn = document.getElementById("install-btn") as HTMLButtonElement | null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event as typeof deferredInstallPrompt;
  installBtn?.classList.add("visible");
});

installBtn?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  installBtn.classList.remove("visible");
  await deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
});

window.addEventListener("appinstalled", () => {
  installBtn?.classList.remove("visible");
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
