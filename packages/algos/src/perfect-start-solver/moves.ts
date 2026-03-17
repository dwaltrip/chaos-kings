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

// Fast numeric board fingerprints for transposition dedup.
// Uses dual FNV-1a hashes combined into a 53-bit safe integer to avoid
// string allocation. Two independent 32-bit hashes (different seeds) are
// merged via: (h1 >>> 11) * 0x100000000 + h2. The >>> 11 drops 11 bits
// from h1 so the product fits in JS's 53-bit integer precision, giving
// 53 usable bits total. Collision probability ~9e-9 at 13k candidates,
// negligible even at 1M candidates per dedup set.

// Lossless fingerprint — used by exact solver where precision matters.
function fingerprintState(board: FlatBoard): number {
  let h1 = 2166136261; // FNV-1a offset basis
  let h2 = 389564586;
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    const val = board.owners[i] !== NO_OWNER ? board.units[i] : 0;
    h1 = Math.imul(h1 ^ (val & 0xff), 16777619); // FNV-1a prime
    h2 = Math.imul(h2 ^ (val & 0xff), 16777619);
  }
  return (h1 >>> 11) * 0x100000000 + (h2 >>> 0);
}

// Lossy fingerprint — clamps units to maxUnits so high-army tiles hash
// the same. Used by beam search for coarser dedup (see solver.ts comments).
function fingerprintStateClamped(board: FlatBoard, maxUnits: number): number {
  let h1 = 2166136261;
  let h2 = 389564586;
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    const raw = board.owners[i] !== NO_OWNER ? board.units[i] : 0;
    const val = raw > maxUnits ? maxUnits : raw;
    h1 = Math.imul(h1 ^ (val & 0xff), 16777619);
    h2 = Math.imul(h2 ^ (val & 0xff), 16777619);
  }
  return (h1 >>> 11) * 0x100000000 + (h2 >>> 0);
}

// Convert FlatMove → Move (coord-based) for output compatibility
function flatMoveToMove(flatMove: FlatMove, board: FlatBoard): Move {
  if (!flatMove) return null;
  const { x, y } = Board.toXY(board, flatMove.src);
  return { sourceCoord: { x, y }, direction: flatMove.dir };
}

export type { MoveGenState };
export { generateMoves, fingerprintState, fingerprintStateClamped, flatMoveToMove };
