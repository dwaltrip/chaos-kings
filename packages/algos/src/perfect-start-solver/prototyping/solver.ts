import type { BoardState, Coord } from '@core/types';
import { Direction } from '@core/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { TimingConfig } from '@core/timing/types';

import { TileType, NO_OWNER, Board, cloneBoard } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import type { FlatMove } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import { beamSearch } from './beam-search';
import { ALL_DIRECTIONS } from './helpers';
import type { Move, SolverConfig, SolverResult } from './types';

interface SolverState {
  board: FlatBoard;
  tick: number;
  moves: FlatMove[];
}

function generateMoves(state: SolverState): FlatMove[] {
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

function cloneState(state: SolverState): SolverState {
  return {
    board: cloneBoard(state.board),
    tick: state.tick,
    moves: [...state.moves],
  };
}

function stepState(state: SolverState, move: FlatMove, timing: TimingConfig): void {
  state.tick++;
  processStep(state.board, move, 0, state.tick, timing);
  state.moves.push(move);
}

// Board state fingerprint for beam deduplication.
// One byte per tile: 0 if unowned, army count (capped at 15) if owned by player 0.
// Assumes all tile army counts are <= 15, which holds for the first 25 turns
// (~50 ticks). The general accumulates at most ~3 units between sends, and
// captured tiles sit at 1.
//
// Dedup fixes a real bug: without it, frontier scorers regress on maze at high
// beam widths because the beam fills with hundreds of duplicate states and the
// "winner" is determined by arbitrary sort tiebreaking, not scorer quality.
//
// Trade-off: dedup changes candidate ordering, which can shift tiebreaking for
// scorers with low resolution (e.g. land-only, where score gaps are 0-1). This
// causes minor regressions on some boards (sparse, corridor) at certain beam
// widths — same root cause (score plateaus), different trigger. The real fix is
// better scorer resolution so ties are rarer.
function fingerprintState(state: SolverState): string {
  const { board } = state;
  const n = board.width * board.height;
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== NO_OWNER) {
      buf[i] = Math.min(board.units[i], 15);
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

function solve(
  boardState: BoardState,
  generalCoord: Coord,
  config: SolverConfig,
): SolverResult {
  const timing = DEFAULT_TIMING;
  const board = fromBoardState(structuredClone(boardState), 1);

  const initial: SolverState = {
    board,
    tick: 0,
    moves: [],
  };

  const result = beamSearch<SolverState, FlatMove>(initial, {
    generateMoves,
    clone: cloneState,
    step: (state, move) => stepState(state, move, timing),
    score: (state) => config.scoringFn(state.board),
    fingerprint: fingerprintState, // pre-score dedup; see comment on fingerprintState for trade-offs
    beamWidth: config.beamWidth,
    numSteps: config.maxTicks,
  });

  const bestState = result.best;

  return {
    finalLand: bestState.board.stats.landCounts[0],
    landCurve: result.scorePerStep,
    moves: bestState.moves.map((m) => flatMoveToMove(m, bestState.board)),
    perf: result.perf,
  };
}

export { solve };
