import { Direction } from '@core/types';

import { type FlatBoard, Board, TileType } from '@/core-next/flat-board';
import { tilesToMask } from './bitmask';

interface GenPath {
  tiles: number[];
  mask: bigint;
}

type GenPathsByLen = Map<number, GenPath[]>;

const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

function genPathsDP(board: FlatBoard, start: number, maxLen: number): GenPathsByLen {
  if (!Board.isValidIndex(board, start)) {
    throw new Error(`Invalid index: ${start}`);
  }

  const result: GenPathsByLen = new Map();
  const startMask = 1n << BigInt(start);

  let prevLevel: GenPath[] = [{ tiles: [start], mask: startMask }];
  result.set(1, prevLevel);

  for (let k = 2; k <= maxLen; k++) {
    const nextLevel: GenPath[] = [];

    for (const path of prevLevel) {
      const tip = path.tiles[path.tiles.length - 1];

      for (const dir of DIRECTIONS) {
        const next = Board.neighbor(board, tip, dir);

        if (!Board.isValidIndex(board, next)) continue;
        if (board.types[next] === TileType.MOUNTAIN) continue;

        const bit = 1n << BigInt(next);
        if (path.mask & bit) continue;

        const newTiles = path.tiles.slice();
        newTiles.push(next);
        nextLevel.push({ tiles: newTiles, mask: path.mask | bit });
      }
    }

    result.set(k, nextLevel);
    prevLevel = nextLevel;
  }

  return result;
}

export type { GenPath, GenPathsByLen };
export { genPathsDP };
