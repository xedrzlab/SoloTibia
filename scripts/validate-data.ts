// Cross-checks every content data table (items, monsters, spells) against
// itself and against the asset catalogue. Run via `npm run validate:data`
// (also wired into `npm run build`), so a new weapon/monster/spell with a
// missing field, a bad cross-reference (a loot entry naming an item that
// doesn't exist, a texture key nothing loads) or a combat-formula invariant
// violation (min > max, a two-handed weapon in the wrong slot) fails fast
// instead of quietly producing wrong numbers or a blank sprite in-game.

import { ITEMS, FIST_ATTACK } from "../src/data/items";
import { MONSTERS } from "../src/data/monsters";
import { SPELLS, SPELL_BAR } from "../src/data/spells";
import { IMAGE_ASSETS, SHEET_ASSETS, paperDollKey } from "../src/data/assets";

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

const imageKeys = new Set(IMAGE_ASSETS.map((a) => a.key));
const sheetKeys = new Set(SHEET_ASSETS.map((a) => a.key));

// --- Items ------------------------------------------------------------
for (const [id, item] of Object.entries(ITEMS)) {
  const tag = `item "${id}"`;
  if (item.id !== id) fail(`${tag}: id field "${item.id}" doesn't match its key`);
  if (item.weight < 0) fail(`${tag}: negative weight`);
  if (item.attack !== undefined && item.attack < 0) fail(`${tag}: negative attack`);
  if (item.defense !== undefined && item.defense < 0) fail(`${tag}: negative defense`);
  if (item.armor !== undefined && item.armor < 0) fail(`${tag}: negative armor`);
  if (item.range !== undefined && item.range < 1) fail(`${tag}: range must be >= 1`);
  if (item.containerCapacity !== undefined && item.kind !== "container") {
    fail(`${tag}: containerCapacity set but kind is "${item.kind}", not "container"`);
  }
  if (item.weaponType !== undefined && item.equipSlot !== "left") {
    fail(`${tag}: weaponType set but equipSlot is "${item.equipSlot}", weapons must equip to "left"`);
  }
  if (item.twoHanded && item.equipSlot !== "left") {
    fail(`${tag}: twoHanded set but equipSlot is "${item.equipSlot}", not "left"`);
  }
  if (item.kind === "equipment" && !item.equipSlot) {
    fail(`${tag}: kind is "equipment" but has no equipSlot`);
  }
  if (!imageKeys.has(item.textureKey)) {
    fail(`${tag}: textureKey "${item.textureKey}" is not registered in IMAGE_ASSETS`);
  }
  if (item.paperDoll && !sheetKeys.has(paperDollKey(item.paperDoll))) {
    fail(`${tag}: paperDoll "${item.paperDoll}" has no matching "${paperDollKey(item.paperDoll)}" in SHEET_ASSETS`);
  }
}
if (FIST_ATTACK < 0) fail("FIST_ATTACK must not be negative");

// --- Monsters -----------------------------------------------------------
for (const [id, monster] of Object.entries(MONSTERS)) {
  const tag = `monster "${id}"`;
  if (monster.id !== id) fail(`${tag}: id field "${monster.id}" doesn't match its key`);
  if (monster.hp <= 0) fail(`${tag}: hp must be positive`);
  if (monster.xp < 0) fail(`${tag}: negative xp`);
  if (monster.minDamage < 0) fail(`${tag}: negative minDamage`);
  if (monster.maxDamage < monster.minDamage) fail(`${tag}: maxDamage < minDamage`);
  if (monster.attackIntervalMs <= 0) fail(`${tag}: attackIntervalMs must be positive`);
  if (monster.hitChance < 0 || monster.hitChance > 100) fail(`${tag}: hitChance must be 0-100`);
  if (monster.armor < 0) fail(`${tag}: negative armor`);
  if (monster.fleeAtHpPct < 0 || monster.fleeAtHpPct > 1) fail(`${tag}: fleeAtHpPct must be 0-1`);
  if (!sheetKeys.has(monster.textureKey)) {
    fail(`${tag}: textureKey "${monster.textureKey}" is not registered in SHEET_ASSETS`);
  }
  for (const [i, entry] of monster.loot.entries()) {
    const lootTag = `${tag} loot[${i}] (${entry.itemId})`;
    if (!ITEMS[entry.itemId]) fail(`${lootTag}: references an item id that doesn't exist`);
    if (entry.chance <= 0 || entry.chance > 1) fail(`${lootTag}: chance must be in (0, 1]`);
    if (entry.min < 0) fail(`${lootTag}: negative min`);
    if (entry.max < entry.min) fail(`${lootTag}: max < min`);
  }
}

// --- Spells ---------------------------------------------------------------
for (const [id, spell] of Object.entries(SPELLS)) {
  const tag = `spell "${id}"`;
  if (spell.id !== id) fail(`${tag}: id field "${spell.id}" doesn't match its key`);
  if (spell.manaCost < 0) fail(`${tag}: negative manaCost`);
  if (spell.minCoefficient < 0) fail(`${tag}: negative minCoefficient`);
  if (spell.maxCoefficient < spell.minCoefficient) fail(`${tag}: maxCoefficient < minCoefficient`);
  if (!imageKeys.has(spell.textureKey)) {
    fail(`${tag}: textureKey "${spell.textureKey}" is not registered in IMAGE_ASSETS`);
  }
}
for (const id of SPELL_BAR) {
  if (!SPELLS[id]) fail(`SPELL_BAR: references spell id "${id}" that doesn't exist`);
}

if (errors.length > 0) {
  console.error(`validate-data: ${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`validate-data: OK (${Object.keys(ITEMS).length} items, ${Object.keys(MONSTERS).length} monsters, ${Object.keys(SPELLS).length} spells)`);
