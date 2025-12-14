import type { BoardState, Movement } from '@core/types';
import { Board } from '@core/board';
import type { PlayerQueuesMap, PlayerStats } from '@platform/domains/gameplay/types';

import {
  gameplayActions,
  useGameplayStoreV2,
} from '@/domains/gameplay/stores/gameplay-store-v2';
import { getTileStore } from '@/domains/gameplay/stores/tile-store-registry';
import { tileOrchestrator } from '@/domains/gameplay/stores/tile-orchestrator';

function updateGameplayState(
  tick: number,
  board: BoardState,
  playerQueues: PlayerQueuesMap = {},
  playerStats: PlayerStats[],
) {
  const { setVisibleSquares, updateBoard, setTick, setPlayerStats } = gameplayActions();
  // Get currentPlayerIndex for both visible squares and queue updates
  const playerIndex = useGameplayStoreV2.getState().currentPlayerIndex();
  if (playerIndex === null) {
    throw new Error('[updateGameplayState] currentPlayerIndex is null');
  }

  setTick(tick);
  updateBoard(board);

  const visibleSquares = board
    ? Board.getVisibleSquares(board, playerIndex)
    : new Set<string>();
  setVisibleSquares(visibleSquares);

  // Handle queue updates
  const newMovesQueue = playerIndex !== null ? playerQueues[playerIndex] || [] : [];
  updateQueuedMoves(board, newMovesQueue);

  setPlayerStats(playerStats);
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
