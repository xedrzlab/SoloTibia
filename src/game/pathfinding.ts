export interface TileCoord {
  x: number;
  y: number;
}

const DIRECTIONS: TileCoord[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

/**
 * Breadth-first search over a walkable grid, 8-directional (Tibia allows
 * diagonal steps). Returns the path as a list of tiles *excluding* the start
 * tile, or an empty array if no path exists / start === goal.
 */
export function findPath(
  isWalkable: (x: number, y: number) => boolean,
  start: TileCoord,
  goal: TileCoord,
  maxSteps = 400,
): TileCoord[] {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!isWalkable(goal.x, goal.y)) return [];

  const key = (t: TileCoord) => `${t.x},${t.y}`;
  const cameFrom = new Map<string, TileCoord>();
  const visited = new Set<string>([key(start)]);
  const queue: TileCoord[] = [start];
  let head = 0;
  let found = false;

  while (head < queue.length && queue.length < maxSteps) {
    const current = queue[head++];
    if (current.x === goal.x && current.y === goal.y) {
      found = true;
      break;
    }
    for (const dir of DIRECTIONS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      const k = key(next);
      if (visited.has(k)) continue;
      if (!isWalkable(next.x, next.y)) continue;
      // Prevent cutting across a blocked diagonal corner.
      if (dir.x !== 0 && dir.y !== 0) {
        if (!isWalkable(current.x + dir.x, current.y) || !isWalkable(current.x, current.y + dir.y)) {
          continue;
        }
      }
      visited.add(k);
      cameFrom.set(k, current);
      queue.push(next);
    }
  }

  if (!found) return [];

  const path: TileCoord[] = [];
  let cursor = goal;
  while (!(cursor.x === start.x && cursor.y === start.y)) {
    path.push(cursor);
    const prev = cameFrom.get(key(cursor));
    if (!prev) return []; // shouldn't happen if `found`, but stay safe
    cursor = prev;
  }
  return path.reverse();
}

export function chebyshevDistance(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Distance to whichever of a multi-tile creature's occupied tiles is nearest — so being next to a bear's trailing back legs counts the same as being next to its head. */
export function closestChebyshevDistance(a: TileCoord, tiles: TileCoord[]): number {
  return Math.min(...tiles.map((t) => chebyshevDistance(a, t)));
}
