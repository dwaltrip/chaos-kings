import type { BoardState, Movement, PlayerIndex } from '@core/types';
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
  playerStats: PlayerStats[] = [],
) {
  const state = useGameplayStoreV2.getState();

  // TODO: This may guard can cause us to miss WS update messages.
  // Possible fix: request a snapshot or have server send one on join if needed.
  // Not a huge issue for MPV as we will get an update on next tick anyway.
  if (!state.gameplayReady || state.currentPlayerIndex === null) {
    // TODO: If messages arrive before join/setup, request a snapshot or buffer updates.
    return;
  }

  applyGameplayStateUpdate(
    tick,
    board,
    playerQueues,
    playerStats,
    state.currentPlayerIndex,
  );
}

function applyGameplayStateUpdate(
  tick: number,
  board: BoardState,
  playerQueues: PlayerQueuesMap = {},
  playerStats: PlayerStats[],
  playerIndex: PlayerIndex,
) {
  const { setVisibleSquares, updateBoard, setTick, setPlayerStats } = gameplayActions();

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
