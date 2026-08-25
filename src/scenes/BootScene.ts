import Phaser from "phaser";
import { PLAYER_SHEET, TROLL_SHEET } from "../game/constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    const base = "assets";
    this.load.image("grass", `${base}/tiles/grass.png`);
    this.load.image("cave-floor", `${base}/tiles/cave-floor.png`);
    this.load.image("dirt", `${base}/tiles/dirt.png`);
    this.load.image("stone-wall", `${base}/tiles/stone-wall.png`);
    this.load.image("water", `${base}/tiles/water.png`);
    this.load.image("void-wall", `${base}/tiles/void-wall.png`);
    this.load.image("temple-floor", `${base}/tiles/temple-floor.png`);
    this.load.image("rocky-ground", `${base}/tiles/rocky-ground.png`);
    this.load.image("mountain", `${base}/tiles/mountain.png`);
    this.load.image("road", `${base}/tiles/road.png`);

    this.load.image("tree", `${base}/props/tree.png`);
    this.load.image("bush", `${base}/props/bush.png`);
    this.load.image("boulder", `${base}/props/boulder.png`);
    this.load.image("signpost", `${base}/props/signpost.png`);
    this.load.image("barrel", `${base}/props/barrel.png`);
    this.load.image("crate", `${base}/props/crate.png`);
    this.load.image("well", `${base}/props/well.png`);
    this.load.image("building-weaponshop", `${base}/props/building-weaponshop.png`);
    this.load.image("building-cottage", `${base}/props/building-cottage.png`);
    this.load.image("building-house", `${base}/props/building-house.png`);

    this.load.spritesheet("player", `${base}/entities/player.png`, PLAYER_SHEET);
    this.load.spritesheet("rat", `${base}/entities/rat.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("cave-rat", `${base}/entities/cave-rat.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("slime", `${base}/entities/slime.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("troll", `${base}/entities/troll.png`, TROLL_SHEET);

    this.load.image("npc-borin", `${base}/npcs/borin.png`);
    this.load.image("npc-wren", `${base}/npcs/wren.png`);
    this.load.image("npc-elder-corwin", `${base}/npcs/elder-corwin.png`);

    this.load.image("sword", `${base}/items/sword.png`);
    this.load.image("health-potion", `${base}/items/health-potion.png`);
    this.load.image("mana-potion", `${base}/items/mana-potion.png`);
    this.load.image("gold-coin", `${base}/items/gold-coin.png`);
  }

  create() {
    this.scene.start("World");
    this.scene.launch("UI");
  }
}
