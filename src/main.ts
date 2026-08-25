import Phaser from "phaser";
import { registerSW } from "virtual:pwa-register";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { UIScene } from "./scenes/UIScene";
import { TARGET_FPS } from "./game/constants";

registerSW({ immediate: true });

const game = new Phaser.Game({
  type: Phaser.AUTO,
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
  scene: [BootScene, WorldScene, UIScene],
});

// Battery: fully stop the render/update loop when the tab/app is backgrounded
// instead of continuing to tick offscreen.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.loop.sleep();
  } else {
    game.loop.wake();
  }
});
