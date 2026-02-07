import type { BoardState, Movement } from '@core/types';
import { Board } from '@core/board';

import { getTileStore } from '@/domains/games/stores/tile-store-registry';
import { tileOrchestrator } from '@/domains/games/stores/tile-orchestrator';
import { useBoardSessionStore } from '@/domains/games/stores/board-session-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';

function handleStateUpdate(
  tick: number,
  board: BoardState,
  moveQueue: Movement[],
  isPaused: boolean,
  maxTickReached: number,
): void {
  const { setBoard, setTick, setVisibleSquares, setQueuedMoves } =
    useBoardSessionStore.getState().actions;
  const { setIsPaused, updateMaxTick } = useSandboxMetaStore.getState().actions;

  tileOrchestrator.updateTileSquares(board);

  tileOrchestrator.clearAllQueuedDirections(board);
  for (const move of moveQueue) {
    const store = getTileStore(move.sourceCoord);
    store.getState().addQueuedDirection(move.direction);
  }

  const visibleSquares = Board.getVisibleSquares(board, 0);

  setTick(tick);
  setBoard(board);
  setQueuedMoves(moveQueue);
  setVisibleSquares(visibleSquares);
  setIsPaused(isPaused);
  updateMaxTick(maxTickReached);
}

export { handleStateUpdate };
