import type { BoardState, Coord } from '@core/types';
import { Direction } from '@core/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { TimingConfig } from '@core/timing/types';

import { TileType, Board, cloneBoard } from '@/core-next/flat-board';
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
