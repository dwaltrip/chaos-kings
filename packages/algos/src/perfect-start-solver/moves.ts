import { TileType, NO_OWNER, Board } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import type { FlatMove } from '@/core-next/process-step';

import { ALL_DIRECTIONS } from './helpers';
import type { Move } from './types';

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

// Lossless board fingerprint for transposition dedup.
// One byte per tile: 0 if unowned, raw army count if owned by player 0.
// Max possible units on any tile is bounded by total production (~26 for
// open-7x7 at 50 ticks), well within a single byte (0-255).
function fingerprintState(board: FlatBoard): string {
  const n = board.width * board.height;
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== NO_OWNER) {
      buf[i] = board.units[i];
    }
  }
  return String.fromCharCode(...buf);
}

// Convert FlatMove → Move (coord-based) for output compatibility
function flatMoveToMove(flatMove: FlatMove, board: FlatBoard): Move {
  if (!flatMove) return null;
  const { x, y } = Board.toXY(board, flatMove.src);
  return { sourceCoord: { x, y }, direction: flatMove.dir };
}

export type { MoveGenState };
export { generateMoves, fingerprintState, flatMoveToMove };
