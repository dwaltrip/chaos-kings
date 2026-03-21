import { Direction } from '@core/types';

import { type FlatBoard, Board, TileType } from '@/core-next/flat-board';

const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

// BFS on a FlatBoard, returning cumulative bitmasks of reachable
// non-mountain tiles at each distance.
//
// result[d] = all reachable tiles within distances 0..d from the frontier.
// The initial frontier tiles are included in result[0].
//
// `excludeTiles` are pre-added to the visited set (never expanded or included).
function bfsCumulativeMasks(
  board: FlatBoard,
  frontier: number[],
  maxDist: number,
  excludeTiles: number[] = [],
): bigint[] {
  const masks: bigint[] = new Array(maxDist + 1).fill(0n);
  const visited = new Set<number>(excludeTiles);

  // Include frontier in visited and in distance-0 mask
  for (const tile of frontier) {
    visited.add(tile);
    masks[0] |= 1n << BigInt(tile);
  }

  let current = frontier;
  for (let d = 1; d <= maxDist; d++) {
    const next: number[] = [];
    for (const pos of current) {
      for (const dir of DIRECTIONS) {
        const neighbor = Board.neighbor(board, pos, dir);
        if (!Board.isValidIndex(board, neighbor)) continue;
        if (board.types[neighbor] === TileType.MOUNTAIN) continue;
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        next.push(neighbor);
      }
    }
    masks[d] = masks[d - 1];
    for (const pos of next) {
      masks[d] |= 1n << BigInt(pos);
    }
    current = next;
  }

  return masks;
}

export { bfsCumulativeMasks };
