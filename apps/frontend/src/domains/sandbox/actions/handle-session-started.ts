import type { BoardState } from '@core/types';

import type { SandboxConfig } from '@protocol/domains/sandbox/server-messages';

import { applyTick } from '@/domains/games/board-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';

function handleSessionStarted(board: BoardState, config: SandboxConfig): void {
  const { setStatus, setIsPaused, setConfig } = useSandboxMetaStore.getState().actions;

  applyTick(0, board, [], []);

  setStatus('active');
  setIsPaused(true);
  setConfig(config);
}

export { handleSessionStarted };
