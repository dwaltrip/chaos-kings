import type { FlatMove } from '@/core-next/process-step';
import { type FlatBoard, TileType, Board } from '@/core-next/flat-board';

import { ALL_DIRECTIONS } from '../helpers';

interface MoveGenState {
  board: FlatBoard;
}

function generateMoves(state: MoveGenState): FlatMove[] {
  const { board } = state;
  const moves: FlatMove[] = [null];
  const n = board.width * board.height;

  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0 || board.units[i] <= 1) continue;
    for (const dir of ALL_DIRECTIONS) {
      const dest = Board.neighbor(board, i, dir);
      if (dest !== -1 && board.types[dest] !== TileType.MOUNTAIN) {
        moves.push({ src: i, dir });
      }
    }
  }

  return moves;
}

export { generateMoves };
