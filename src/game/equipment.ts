// The paper-doll: ten worn slots whose contents feed the character's attack,
// defense and armor totals. The "back" slot is special — the backpack sitting
// in it is the root of the player's whole inventory tree.

import { EquipSlot, FIST_ATTACK, ITEMS, WeaponType } from "../data/items";
import { Container, ItemStack } from "./containers";

export const EQUIP_SLOTS: EquipSlot[] = [
  "head",
  "neck",
  "back",
  "armor",
  "left",
  "right",
  "legs",
  "feet",
  "ring",
  "ammo",
];

export const EQUIP_SLOT_NAMES: Record<EquipSlot, string> = {
  head: "Helmet",
  neck: "Amulet",
  back: "Backpack",
  armor: "Armor",
  left: "Weapon",
  right: "Shield",
  legs: "Legs",
  feet: "Boots",
  ring: "Ring",
  ammo: "Ammo",
};

export class Equipment {
  readonly slots: Record<EquipSlot, ItemStack | null> = {
    head: null,
    neck: null,
    back: null,
    armor: null,
    left: null,
    right: null,
    legs: null,
    feet: null,
    ring: null,
    ammo: null,
  };

  get(slot: EquipSlot): ItemStack | null {
    return this.slots[slot];
  }

  /** An item may only go in the slot its definition names. */
  canEquip(slot: EquipSlot, stack: ItemStack | null): boolean {
    if (!stack) return true;
    return ITEMS[stack.itemId]?.equipSlot === slot;
  }

  set(slot: EquipSlot, stack: ItemStack | null): boolean {
    if (!this.canEquip(slot, stack)) return false;
    this.slots[slot] = stack;
    return true;
  }

  /** The backpack worn on the back — the root of the inventory tree. */
  get backpack(): Container | null {
    return this.slots.back?.container ?? null;
  }

  get weapon(): ItemStack | null {
    return this.slots.left;
  }

  weaponType(): WeaponType {
    const weapon = this.weapon;
    if (!weapon) return "melee";
    return ITEMS[weapon.itemId]?.weaponType ?? "melee";
  }

  /**
   * Attack rating driving the damage roll. A bow contributes nothing on its
   * own — its damage comes from the ammunition in the ammo slot.
   */
  attackValue(): number {
    const weapon = this.weapon;
    if (!weapon) return FIST_ATTACK;
    const def = ITEMS[weapon.itemId];
    let attack = def?.attack ?? FIST_ATTACK;
    if (def?.weaponType === "distance") {
      attack += ITEMS[this.slots.ammo?.itemId ?? ""]?.attack ?? 0;
    }
    return attack;
  }

  /** How far the equipped weapon reaches, in tiles. */
  attackRange(): number {
    const weapon = this.weapon;
    if (!weapon) return 1;
    return ITEMS[weapon.itemId]?.range ?? 1;
  }

  /** Weapon parry plus shield block, feeding the shielding roll. */
  defenseValue(): number {
    return (ITEMS[this.slots.left?.itemId ?? ""]?.defense ?? 0) + (ITEMS[this.slots.right?.itemId ?? ""]?.defense ?? 0);
  }

  /** Total armor across every worn piece. */
  armorValue(): number {
    let total = 0;
    for (const slot of EQUIP_SLOTS) {
      const stack = this.slots[slot];
      if (stack) total += ITEMS[stack.itemId]?.armor ?? 0;
    }
    return total;
  }

  /** Weight of everything worn, including the backpack's whole contents. */
  weight(): number {
    let total = 0;
    for (const slot of EQUIP_SLOTS) {
      const stack = this.slots[slot];
      if (!stack) continue;
      total += (ITEMS[stack.itemId]?.weight ?? 0) * stack.count;
      if (stack.container) total += stack.container.weight();
    }
    return total;
  }
}
