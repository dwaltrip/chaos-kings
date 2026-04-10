import { Board, type FlatBoard } from '@core-next/flat-board';

// Returns the 4-neighbor frontier of a tile set: walkable (non-mountain)
// tiles adjacent to the set but not themselves in the set. Deterministic
// (sorted ascending). Intentionally general — accepts any tile set, not
// specifically a blob.
function getFrontier(board: FlatBoard, tiles: Iterable<number>): number[] {
  const tileSet = tiles instanceof Set ? (tiles as Set<number>) : new Set(tiles);
  const frontier = new Set<number>();
  for (const idx of tileSet) {
    const neighbors = [
      Board.neighborUp(board, idx),
      Board.neighborDown(board, idx),
      Board.neighborLeft(board, idx),
      Board.neighborRight(board, idx),
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      if (tileSet.has(n)) continue;
      if (!Board.isPassable(board, n)) continue;
      frontier.add(n);
    }
  }
  return Array.from(frontier).sort((a, b) => a - b);
}

export { getFrontier };
