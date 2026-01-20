import type { BoardState, Movement } from '@core/types';
import { Board } from '@core/board';

import { getTileStore } from '@/domains/games/stores/tile-store-registry';
import { tileOrchestrator } from '@/domains/games/stores/tile-orchestrator';
import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';

function handleStateUpdate(tick: number, board: BoardState, moveQueue: Movement[]): void {
  const { setStatus, setTick, setBoard, setMoveQueue, setVisibleSquares } =
    usePuzzleStore.getState().actions;

  // Update tile stores for per-tile subscriptions
  tileOrchestrator.updateTileSquares(board);

  // Sync queued directions to tile stores (clear all, then re-populate from server)
  tileOrchestrator.clearAllQueuedDirections(board);
  for (const move of moveQueue) {
    const store = getTileStore(move.sourceCoord);
    store.getState().addQueuedDirection(move.direction);
  }

  // Compute visibility (player 0 is the puzzle player)
  const visibleSquares = Board.getVisibleSquares(board, 0);

  setStatus('playing');
  setTick(tick);
  setBoard(board);
  setMoveQueue(moveQueue);
  setVisibleSquares(visibleSquares);
}

export { handleStateUpdate };
