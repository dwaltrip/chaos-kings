import { processStep } from '@core/step-processor';
import { CorePlayerStatus } from '@core/types';
import type { GameState } from '@core/types';
import type { MoveEvent } from '@core/replay/types';
import { deepCloneBoard } from '@core/utils/clone-utils';

import { boardStore, applyTick } from '@/domains/games/board-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import { moveHistoryCache } from '@/domains/sandbox/move-history-cache';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function stepForward(): void {
  const { tick, board } = boardStore.state.game;
  const { maxTickReached, config } = useSandboxMetaStore.getState();

  if (!board || !config) return;
  if (tick >= maxTickReached) return;

  const nextTick = tick + 1;
  const cachedMove = moveHistoryCache.get(nextTick);

  // NOTE: We always send the WS message to keep the server in sync, even when
  // computing optimistically. Without this, the server's currentTick would fall
  // behind, and any future server interaction (play, queue moves, cache miss
  // fallback) would operate on the wrong tick.
  sandboxWsEffects.sendStepForward();

  // Cache miss — let the server response handle rendering via handleStateUpdate
  if (cachedMove === undefined) {
    return;
  }

  // TODO: use real players array when boardSessionStore tracks it
  const gameState: GameState = {
    board: deepCloneBoard(board),
    tick,
    players: [{ status: CorePlayerStatus.ACTIVE, armyCount: 0, landCount: 0 }],
  };

  const moveEvents: MoveEvent[] = cachedMove
    ? [
        {
          step: nextTick,
          playerIndex: 0,
          sourceCoord: cachedMove.sourceCoord,
          direction: cachedMove.direction,
        },
      ]
    : [];

  processStep(gameState, moveEvents, config.timing);

  applyTick(nextTick, gameState.board, [], []);
}

export { stepForward };
