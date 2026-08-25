export function rollDamage(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function rollLoot(
  loot: { itemId: string; chance: number; min: number; max: number }[],
): { itemId: string; amount: number }[] {
  const results: { itemId: string; amount: number }[] = [];
  for (const entry of loot) {
    if (Math.random() < entry.chance) {
      results.push({ itemId: entry.itemId, amount: rollDamage(entry.min, entry.max) });
    }
  }
  return results;
}
