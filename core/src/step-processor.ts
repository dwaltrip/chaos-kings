import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { applyMovement } from '@core/engine';
import type { BoardState } from '@core/types';
import type { MoveEvent, TimingConfig } from '@core/replay/types';
import { validateMove } from '@core/moves/validate-move';

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

export { processTick };
