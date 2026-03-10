import type { BoardState, Movement } from '@core/types';

import { applyTick } from '@/domains/games/board-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import {
  moveHistoryCache,
  setLastExecutedMove,
} from '@/domains/sandbox/move-history-cache';

function handleStateUpdate(
  tick: number,
  board: BoardState,
  moveQueue: Movement[],
  isPaused: boolean,
  maxTickReached: number,
  lastExecutedMove: Movement | null,
): void {
  const { setIsPaused, updateMaxTick } = useSandboxMetaStore.getState().actions;

  applyTick(tick, board, moveQueue, []);

  setLastExecutedMove(lastExecutedMove);
  if (lastExecutedMove) {
    moveHistoryCache.set(tick, lastExecutedMove);
  }
  setIsPaused(isPaused);
  updateMaxTick(maxTickReached);
}

export { handleStateUpdate };
