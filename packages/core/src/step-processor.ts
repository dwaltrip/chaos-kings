import { applyMovement } from '@core/engine';
import type { BoardState } from '@core/types';
import type { MoveEvent } from '@core/replay/types';
import type { TimingConfig } from '@core/timing/types';
import { validateMove } from '@core/moves/validate-move';

function getPlayersWithGenerals(board: BoardState): Set<number> {
  const players = new Set<number>();
  for (const row of board.grid) {
    for (const square of row) {
      if (square.type === 'GENERAL') {
        players.add(square.playerIndex);
      }
    }
  }
  return players;
}

function processStep(
  board: BoardState,
  step: number, // 1-based
  events: MoveEvent[],
  timing: TimingConfig,
): {
  appliedEvents: MoveEvent[];
  gameEnded: boolean;
  winnerPlayerIndex?: number;
  newlyDefeatedPlayers: number[];
} {
  const generalsBefore = getPlayersWithGenerals(board);

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

  const generalsAfter = getPlayersWithGenerals(board);
  const newlyDefeatedPlayers: number[] = [];
  for (const player of generalsBefore) {
    if (!generalsAfter.has(player)) {
      newlyDefeatedPlayers.push(player);
    }
  }

  const tickResult = stepWithTiming(board, step, timing, generalsAfter);
  return {
    appliedEvents: applied,
    gameEnded: tickResult.gameEnded,
    winnerPlayerIndex: tickResult.winnerPlayerIndex,
    newlyDefeatedPlayers,
  };
}

function stepWithTiming(
  board: BoardState,
  tickNumber: number,
  timing: TimingConfig,
  playersWithGenerals: Set<number>,
): { gameEnded: boolean; winnerPlayerIndex?: number } {
  if (tickNumber % timing.generalProductionTicks === 0) {
    applyCityProduction(board);
  }

  if (tickNumber % timing.armyProductionTicks === 0) {
    applyTroopProduction(board);
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

export { processStep };
