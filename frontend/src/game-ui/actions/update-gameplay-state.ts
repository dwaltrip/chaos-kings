import type { BoardState } from '@core/types';
import { Board } from '@core/board';
import type { Movement, PlayerQueuesMap } from '@common/types/gameplay';

import {
  gameplayActions,
  useGameplayStoreV2,
} from '@/game-ui/store/gameplay-store-v2';
import { getTileStore } from '@/game-ui/store/tile-store-registry';
import { tileOrchestrator } from '@/game-ui/store/tile-orchestrator';

function updateGameplayState(
  tick: number,
  board: BoardState,
  playerQueues: PlayerQueuesMap,
) {
  const { setVisibleSquares, updateBoard, setTick } = gameplayActions();
  // Get currentPlayerIndex for both visible squares and queue updates
  const playerIndex = useGameplayStoreV2.getState().currentPlayerIndex();
  if (playerIndex === null) {
    throw new Error('[updateGameplayState] currentPlayerIndex is null');
  }

  setTick(tick);
  updateBoard(board);

  let visibleSquares = new Set<string>();
  if (board && playerIndex !== null && playerIndex !== undefined) {
    visibleSquares = Board.getVisibleSquares(board, playerIndex);
  }
  setVisibleSquares(visibleSquares);

  // Handle queue updates
  if (playerQueues) {
    const newMovesQueue =
      playerIndex !== null ? playerQueues[playerIndex] || [] : [];
    updateQueuedMoves(board, newMovesQueue);
  }
}

function updateQueuedMoves(board: BoardState, moves: Movement[]) {
  // Clear all existing directions before applying state from server
  tileOrchestrator.clearAllQueuedDirections(board);

  for (const move of moves) {
    const store = getTileStore(move.sourceCoord);
    store.getState().addQueuedDirection(move.direction);
  }
  const { setQueuedMoves } = gameplayActions();
  setQueuedMoves(moves);
}

export { updateGameplayState };
