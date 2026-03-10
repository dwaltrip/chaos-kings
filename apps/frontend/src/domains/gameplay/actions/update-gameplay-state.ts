import type { BoardState, CorePlayerState } from '@core/types';
import type { PlayerQueuesMap } from '@platform/domains/gameplay/types';

import { applyTick } from '@/domains/games/board-store';
import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';

function updateGameplayState(
  tick: number,
  board: BoardState,
  playerQueues: PlayerQueuesMap = {},
  playerStats: CorePlayerState[] = [],
) {
  const state = useGameplayStoreV2.getState();

  // TODO: This guard can cause us to miss WS update messages.
  // Possible fix: request a snapshot or have server send one on join if needed.
  // Not a huge issue for MVP as we will get an update on next tick anyway.
  if (!state.gameplayReady || state.currentPlayerIndex === null) {
    return;
  }

  const moves = playerQueues[state.currentPlayerIndex] || [];
  applyTick(tick, board, moves, playerStats);
}

export { updateGameplayState };
