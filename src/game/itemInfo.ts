// Data-driven item inspection text. Reads an existing ItemDef (src/data/items.ts)
// and produces the lines an inspect panel should show — no per-item hardcoding,
// no duplicated item data, so every current and future item is covered by the
// field rules below rather than a bespoke case.

import { EquipSlot, ItemDef } from "../data/items";

/** Human-readable equip-slot labels for the inspect panel (distinct from the paperdoll's own labels). */
const SLOT_LABELS: Record<EquipSlot, string> = {
  head: "Head",
  neck: "Neck",
  back: "Back",
  armor: "Armor",
  left: "Left Hand",
  right: "Right Hand",
  legs: "Legs",
  feet: "Feet",
  ring: "Ring",
  ammo: "Ammo",
};

function slotLabel(def: ItemDef): string | null {
  // A distance weapon is held in the hand but also needs loaded ammo.
  if (def.weaponType === "distance") return "Left Hand + Ammo";
  return def.equipSlot ? SLOT_LABELS[def.equipSlot] : null;
}

/**
 * Build the inspect text for an item purely from its existing definition.
 * Only fields that actually carry meaning for this item are shown — a zero
 * Attack/Defense/Armor/Range is omitted unless it's meaningful (a weapon's
 * own Attack, e.g. a bow whose damage comes from ammo, still shows Attack 0).
 */
export function itemInfoLines(def: ItemDef): { title: string; lines: string[] } {
  const lines: string[] = [];

  // Combat stats first, in the order the panel reads top-to-bottom.
  if (def.attack !== undefined && (def.attack > 0 || def.weaponType !== undefined)) {
    lines.push(`Attack: ${def.attack}`);
  }
  if (def.defense !== undefined && def.defense > 0) {
    lines.push(`Defense: ${def.defense}`);
  }
  if (def.armor !== undefined && def.armor > 0) {
    lines.push(`Armor: ${def.armor}`);
  }
  if (def.range !== undefined && def.range > 0) {
    lines.push(`Range: ${def.range}`);
  }

  // Weight is on every item.
  lines.push(`Weight: ${def.weight} oz`);

  const slot = slotLabel(def);
  if (slot) lines.push(`Slot: ${slot}`);

  if (def.containerCapacity !== undefined) {
    lines.push(`Holds ${def.containerCapacity} items`);
  }

  // Consumable effects sit below the stats, after a blank separator line.
  const effects: string[] = [];
  if (def.healAmount !== undefined) effects.push(`Heals ${def.healAmount} HP`);
  if (def.manaAmount !== undefined) effects.push(`Restores ${def.manaAmount} Mana`);
  if (def.regenPercentOfMaxHp !== undefined) effects.push("Restores health when eaten");
  if (effects.length > 0) lines.push("", ...effects);

  return { title: def.name, lines };
}
