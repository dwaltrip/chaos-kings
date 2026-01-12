import { UserId } from '@kernel/ids';
import {
  TICK_RATE_MS,
  GENERAL_PRODUCTION_TICKS,
  ARMY_PRODUCTION_TICKS,
} from '@core/game-timing-config';
import type { Coord, Direction } from '@core/types';
import type { BestStartConfig } from '@core/puzzles/best-start';

import type { ConnectionId } from '@/ws-lib';
import { systemActions } from '@/domains/system/actions';
import { buildPuzzleRoomId } from '@/domains/puzzles/utils';
import { PuzzleManager } from '@/domains/puzzles/puzzle-manager';

// Maps userId → active PuzzleManager instance
// TODO: re-evaluate for multi-tab - currently one puzzle per user
// TODO: wire cleanupPuzzle to disconnect handler (currently puzzles run until natural completion)
const activePuzzles = new Map<UserId, PuzzleManager>();

const DEFAULT_BEST_START_CONFIG: BestStartConfig = {
  timing: {
    tickRateMs: TICK_RATE_MS,
    generalProductionTicks: GENERAL_PRODUCTION_TICKS,
    armyProductionTicks: ARMY_PRODUCTION_TICKS,
  },
  mapSize: { width: 21, height: 21 },
};

function startPuzzle(userId: UserId, connectionId: ConnectionId): void {
  // Clean up any existing puzzle for this user
  const existingPuzzle = activePuzzles.get(userId);
  if (existingPuzzle) {
    existingPuzzle.stop();
    activePuzzles.delete(userId);
  }

  // Join user to puzzle room
  const roomId = buildPuzzleRoomId(userId);
  systemActions.joinRoom({ roomId, userId, connectionId });

  // Create and start new puzzle
  const manager = new PuzzleManager(userId, DEFAULT_BEST_START_CONFIG);
  activePuzzles.set(userId, manager);
  manager.start();
}

function queueMove(userId: UserId, source: Coord, direction: Direction): void {
  const manager = activePuzzles.get(userId);
  if (!manager) return;
  manager.queueMove(source, direction);
}

function clearMoves(userId: UserId): void {
  const manager = activePuzzles.get(userId);
  if (!manager) return;
  manager.clearMoves();
}

function undoMove(userId: UserId): void {
  const manager = activePuzzles.get(userId);
  if (!manager) return;
  manager.undoMove();
}

function cleanupPuzzle(userId: UserId): void {
  const manager = activePuzzles.get(userId);
  if (!manager) return;
  manager.stop();
  activePuzzles.delete(userId);
}

const puzzleActions = {
  startPuzzle,
  queueMove,
  clearMoves,
  undoMove,
  cleanupPuzzle,
};

export { puzzleActions };
