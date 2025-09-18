import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import {
  BoardState,
  Coord,
  Direction,
  PlayerSquareType,
  SquareType,
} from '@core/types';
import { applyMovement } from '@core/engine';
import type { MoveEvent, TimingConfig } from '@core/replay/types';

type MoveValidationReason =
  | 'invalid_coord'
  | 'not_owner'
  | 'insufficient_units'
  | 'blocked_destination';

function validateMove(
  board: BoardState,
  playerIndex: number,
  sourceCoord: Coord,
  direction: Direction,
): { ok: true } | { ok: false; reason: MoveValidationReason } {
  if (!Board.isCoordValid(board, sourceCoord)) {
    return { ok: false, reason: 'invalid_coord' };
  }

  const source = Board.getSquare(board, sourceCoord);
  if (!isPlayerSquare(source) || source.playerIndex !== playerIndex) {
    return { ok: false, reason: 'not_owner' };
  }
  if (source.units <= 1) {
    return { ok: false, reason: 'insufficient_units' };
  }

  if (!Board.canMove(board, sourceCoord, direction)) {
    return { ok: false, reason: 'blocked_destination' };
  }

  return { ok: true };
}

function processTick(
  board: BoardState,
  step: number, // 1-based
  events: MoveEvent[],
  timing: TimingConfig,
): {
  appliedEvents: MoveEvent[];
  gameEnded: boolean;
  winnerPlayerIndex?: number;
  defeatedPlayers?: number[];
} {
  // Sort deterministically by playerIndex
  const sorted = [...events].sort((a, b) => a.playerIndex - b.playerIndex);
  const applied: MoveEvent[] = [];

  for (const e of sorted) {
    const v = validateMove(board, e.playerIndex, e.sourceCoord, e.direction);
    if (v.ok) {
      applyMovement(board, e.sourceCoord, e.direction);
      applied.push(e);
    }
  }

  const tickResult = tickWithTiming(board, step, timing);
  return {
    appliedEvents: applied,
    gameEnded: tickResult.gameEnded,
    winnerPlayerIndex: tickResult.winnerPlayerIndex,
  };
}

function tickWithTiming(
  board: BoardState,
  tickNumber: number,
  timing: TimingConfig,
): { gameEnded: boolean; winnerPlayerIndex?: number } {
  if (tickNumber % timing.generalProductionTicks === 0) {
    applyCityProduction(board);
  }

  if (tickNumber % timing.armyProductionTicks === 0) {
    applyTroopProduction(board);
  }

  // Victory: 1 general remaining
  const playersWithGenerals = new Set<number>();
  for (let row of board.grid) {
    for (let square of row) {
      if (square.type === 'GENERAL') {
        playersWithGenerals.add(square.playerIndex);
      }
    }
  }
  if (playersWithGenerals.size === 1) {
    const winnerPlayerIndex = Array.from(playersWithGenerals)[0];
    return { gameEnded: true, winnerPlayerIndex };
  }
  return { gameEnded: false };
}

function applyCityProduction(board: BoardState): void {
  for (let row of board.grid) {
    for (let square of row) {
      if (square.type === 'PLAYER_CITY' || square.type === 'GENERAL') {
        square.units += 1;
      }
    }
  }
}

function applyTroopProduction(board: BoardState): void {
  for (let row of board.grid) {
    for (let square of row) {
      if (square.type === 'ARMY') {
        square.units += 1;
      }
    }
  }
}

export { validateMove, processTick };
export type { MoveValidationReason };
