// Nested container model: the player's backpack holds item stacks, and any
// bag/backpack sitting in a slot is itself a container that can be opened and
// filled. Corpses reuse the same type, so looting is just "drag between two
// containers".

import { ITEMS } from "../data/items";

/** How many of a stackable item fit in one slot, as in Tibia. */
export const STACK_MAX = 100;

export interface ItemStack {
  itemId: string;
  count: number;
  /** Present when the item is itself a container (bag, backpack). */
  container?: Container;
}

let nextContainerId = 1;

export class Container {
  readonly id: string;
  slots: (ItemStack | null)[];

  constructor(
    public name: string,
    public textureKey: string,
    public capacity: number,
  ) {
    this.id = `c${nextContainerId++}`;
    this.slots = new Array(capacity).fill(null);
  }

  get usedSlots(): number {
    return this.slots.reduce<number>((n, slot) => n + (slot ? 1 : 0), 0);
  }

  firstEmptySlot(): number {
    return this.slots.findIndex((slot) => slot === null);
  }

  /**
   * Put `count` of an item in, merging into existing stacks first.
   * Returns however many could not fit.
   */
  addItem(itemId: string, count: number): number {
    const def = ITEMS[itemId];
    if (!def) return count;
    let remaining = count;

    if (def.stackable) {
      for (const slot of this.slots) {
        if (remaining <= 0) break;
        if (slot?.itemId !== itemId) continue;
        const room = STACK_MAX - slot.count;
        const moved = Math.min(room, remaining);
        slot.count += moved;
        remaining -= moved;
      }
    }

    while (remaining > 0) {
      const index = this.firstEmptySlot();
      if (index < 0) break;
      const amount = def.stackable ? Math.min(STACK_MAX, remaining) : 1;
      this.slots[index] = createStack(itemId, amount);
      remaining -= amount;
    }

    return remaining;
  }

  /** Remove `count` of an item from this container and any nested ones. */
  removeItem(itemId: string, count: number): number {
    let remaining = count;
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (!slot) continue;
      if (slot.itemId === itemId) {
        const taken = Math.min(slot.count, remaining);
        slot.count -= taken;
        remaining -= taken;
        if (slot.count <= 0) this.slots[i] = null;
      } else if (slot.container) {
        remaining = slot.container.removeItem(itemId, remaining);
      }
    }
    return remaining;
  }

  /** Total count of an item across this container and everything nested in it. */
  countItem(itemId: string): number {
    let total = 0;
    for (const slot of this.slots) {
      if (!slot) continue;
      if (slot.itemId === itemId) total += slot.count;
      if (slot.container) total += slot.container.countItem(itemId);
    }
    return total;
  }

  /** Flattened item totals, for the shop and action-bar views. */
  totals(into: Record<string, number> = {}): Record<string, number> {
    for (const slot of this.slots) {
      if (!slot) continue;
      into[slot.itemId] = (into[slot.itemId] ?? 0) + slot.count;
      if (slot.container) slot.container.totals(into);
    }
    return into;
  }

  weight(): number {
    let total = 0;
    for (const slot of this.slots) {
      if (!slot) continue;
      total += (ITEMS[slot.itemId]?.weight ?? 0) * slot.count;
      if (slot.container) total += slot.container.weight();
    }
    return total;
  }

  /** True if `other` is this container or nested anywhere inside it. */
  contains(other: Container): boolean {
    if (other === this) return true;
    for (const slot of this.slots) {
      if (slot?.container?.contains(other)) return true;
    }
    return false;
  }

  /** Whether there is room for `count` of an item (used by shop purchases). */
  hasRoomFor(itemId: string, count: number): boolean {
    // Probe a shallow copy so the real container is never mutated on a
    // failed check — nested containers aren't copied, but addItem only ever
    // fills top-level slots anyway.
    const probe = new Container(this.name, this.textureKey, this.capacity);
    probe.slots = this.slots.map((slot) => (slot ? { ...slot } : null));
    return probe.addItem(itemId, count) === 0;
  }
}

/** Build a stack, giving container items their own backing Container. */
export function createStack(itemId: string, count: number): ItemStack {
  const def = ITEMS[itemId];
  const stack: ItemStack = { itemId, count };
  if (def?.containerCapacity) {
    stack.container = new Container(def.name, def.textureKey, def.containerCapacity);
  }
  return stack;
}

/** Where a drag can start from or land — a container slot or an equipment slot. */
export type SlotRef =
  | { kind: "container"; container: Container; index: number }
  | { kind: "equip"; slot: string };

export interface SlotAccessor {
  get(ref: SlotRef): ItemStack | null;
  /** Whether this slot would accept the stack (equipment slots are picky). */
  canSet(ref: SlotRef, stack: ItemStack | null): boolean;
  set(ref: SlotRef, stack: ItemStack | null): void;
}

/**
 * Move a stack between two slots: merge onto a matching stackable, drop into
 * an empty slot, otherwise swap. Refuses moves that would put a container
 * inside itself (which would orphan everything in it).
 *
 * Both sides are validated before either is written, so a half-legal move
 * (a swap whose return leg is rejected) can't duplicate or destroy an item.
 */
export function moveStack(accessor: SlotAccessor, from: SlotRef, to: SlotRef): boolean {
  if (sameSlot(from, to)) return false;

  const source = accessor.get(from);
  if (!source) return false;

  // Dropping a bag into itself (or into a bag it already holds) would make the
  // contents unreachable, so block it outright.
  if (source.container && to.kind === "container" && source.container.contains(to.container)) {
    return false;
  }

  const target = accessor.get(to);

  if (target && target.itemId === source.itemId && ITEMS[source.itemId]?.stackable) {
    const room = STACK_MAX - target.count;
    if (room <= 0) return false;
    const moved = Math.min(room, source.count);
    const merged: ItemStack = { ...target, count: target.count + moved };
    const leftover: ItemStack | null = source.count - moved > 0 ? { ...source, count: source.count - moved } : null;
    if (!accessor.canSet(to, merged) || !accessor.canSet(from, leftover)) return false;
    accessor.set(to, merged);
    accessor.set(from, leftover);
    return true;
  }

  // Plain move, or a swap when the destination is occupied.
  if (!accessor.canSet(to, source) || !accessor.canSet(from, target)) return false;
  accessor.set(to, source);
  accessor.set(from, target);
  return true;
}

function sameSlot(a: SlotRef, b: SlotRef): boolean {
  if (a.kind === "container" && b.kind === "container") {
    return a.container === b.container && a.index === b.index;
  }
  if (a.kind === "equip" && b.kind === "equip") return a.slot === b.slot;
  return false;
}
