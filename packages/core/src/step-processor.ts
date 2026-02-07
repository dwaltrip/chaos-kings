import { applyMovement } from '@core/engine';
import { Board } from '@core/board';
import { CorePlayerStatus } from '@core/types';
import type { GameState, GameEvent } from '@core/types';
import type { MoveEvent } from '@core/replay/types';
import type { TimingConfig } from '@core/timing/types';
import { validateMove } from '@core/moves/validate-move';

interface ProcessStepResult {
  appliedEvents: MoveEvent[];
  gameEvents: GameEvent[];
  gameEnded: boolean;
  winnerPlayerIndex?: number;
}

function processStep(
  gameState: GameState,
  events: MoveEvent[],
  timing: TimingConfig,
): ProcessStepResult {
  const step = gameState.tick + 1;
  const board = gameState.board;
  const gameEvents: GameEvent[] = [];

  // Sort deterministically by playerIndex
  const sorted = [...events].sort((a, b) => a.playerIndex - b.playerIndex);
  const applied: MoveEvent[] = [];

  for (const e of sorted) {
    const v = validateMove(board, e.playerIndex, e.sourceCoord, e.direction);
    if (v.ok) {
      const result = applyMovement(board, e.sourceCoord, e.direction);
      applied.push(e);

      if (result.capture) {
        gameState.players[result.capture.defeated].status = CorePlayerStatus.DEFEATED;
        gameEvents.push({
          type: 'player_defeated',
          tick: step,
          defeated: result.capture.defeated,
          capturedBy: result.capture.capturedBy,
        });
      }
    }
    // TODO(sandbox/gameplay): When a queued movement chain loses forward momentum
    // (e.g. collision leaves <=1 unit), drop only subsequent moves in that chain while
    // preserving independent queued moves from other sources.
  }

  // Apply production
  applyProduction(board, step, timing);

  // Update tick
  gameState.tick = step;

  // Update player stats
  updatePlayerStats(gameState);

  // Check for game end (only 1 active player remaining)
  const activePlayers = gameState.players
    .map((p, i) => ({ index: i, status: p.status }))
    .filter((p) => p.status === CorePlayerStatus.ACTIVE);

  if (activePlayers.length === 1) {
    return {
      appliedEvents: applied,
      gameEvents,
      gameEnded: true,
      winnerPlayerIndex: activePlayers[0].index,
    };
  }

  return {
    appliedEvents: applied,
    gameEvents,
    gameEnded: false,
  };
}

function applyProduction(
  board: GameState['board'],
  tickNumber: number,
  timing: TimingConfig,
): void {
  if (tickNumber % timing.generalProductionTicks === 0) {
    for (const row of board.grid) {
      for (const square of row) {
        if (square.type === 'PLAYER_CITY' || square.type === 'GENERAL') {
          square.units += 1;
        }
      }
    }
  }

  // All-land production: +1 to ALL player squares
  if (tickNumber % timing.landProductionTicks === 0) {
    for (const row of board.grid) {
      for (const square of row) {
        if (
          square.type === 'ARMY' ||
          square.type === 'GENERAL' ||
          square.type === 'PLAYER_CITY'
        ) {
          square.units += 1;
        }
      }
    }
  }
}

function updatePlayerStats(gameState: GameState): void {
  const boardStats = Board.getPlayerStats(gameState.board);

  for (let i = 0; i < gameState.players.length; i++) {
    const stats = boardStats.get(i);
    gameState.players[i].armyCount = stats?.armyCount ?? 0;
    gameState.players[i].landCount = stats?.landCount ?? 0;
  }
}

function createGameState(board: GameState['board'], playerCount: number): GameState {
  const players = Array.from(
    { length: playerCount },
    (): GameState['players'][number] => ({
      status: CorePlayerStatus.ACTIVE,
      armyCount: 0,
      landCount: 0,
    }),
  );

  const gameState: GameState = { board, tick: 0, players };
  updatePlayerStats(gameState);
  return gameState;
}

export type { ProcessStepResult };
export { processStep, createGameState };
