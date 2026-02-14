import type { BoardState, Movement } from '@core/types';

import {
  useBoardSessionStore,
  moveHistoryCache,
} from '@/domains/games/stores/board-session-store';
import { applyBoardState } from '@/domains/games/board-session/actions/apply-state';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';

function handleStateUpdate(
  tick: number,
  board: BoardState,
  moveQueue: Movement[],
  isPaused: boolean,
  maxTickReached: number,
  lastExecutedMove: Movement | null,
): void {
  const { setLastExecutedMove } = useBoardSessionStore.getState().actions;
  const { setIsPaused, updateMaxTick } = useSandboxMetaStore.getState().actions;

  applyBoardState(board, tick, moveQueue);

  setLastExecutedMove(lastExecutedMove);
  if (lastExecutedMove) {
    moveHistoryCache.set(tick, lastExecutedMove);
  }
  setIsPaused(isPaused);
  updateMaxTick(maxTickReached);
}

export { handleStateUpdate };
