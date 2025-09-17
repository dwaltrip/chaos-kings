import type { BoardState } from '@core/types';
import { Board } from '@core/board';
import type { Movement, PlayerQueuesMap } from '@common/types/gameplay';

import { useGameplayStoreV2 } from '@/game-ui/store/gameplay-store-v2';
import { getTileStore } from '@/game-ui/store/tile-store-registry';

const { setVisibleSquares, updateBoard, setTick, setQueuedMoves } =
  useGameplayStoreV2.getState().actions;

function updateGameplayState(
  tick: number,
  board: BoardState,
  playerQueues: PlayerQueuesMap,
) {
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
  const grid = board.grid;

  // TODO: resetting the state should happen all in one place
  // Clear all existing moves in tile store
  // TODO: use helper for iterating over all coords
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      getTileStore({ x, y }).getState().updateQueuedMoves(new Set());
    }
  }

  for (const move of moves) {
    const store = getTileStore(move.sourceCoord);
    store.getState().addQueuedMove(move.direction);
  }
  setQueuedMoves(moves);
}

export { updateGameplayState };
