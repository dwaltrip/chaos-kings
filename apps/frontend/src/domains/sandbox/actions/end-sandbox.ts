import { boardStore } from '@/domains/games/board-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import { resetMoveHistory } from '@/domains/sandbox/move-history-cache';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

// Reset local stores only — backend cleanup happens via disconnect handler
// and via startSession replacing any existing session.
function endSandboxLocal(): void {
  const { reset: resetMeta } = useSandboxMetaStore.getState().actions;

  boardStore.reset();
  resetMeta();
  resetMoveHistory();
}

function endSandbox(): void {
  sandboxWsEffects.sendEndSession();
  endSandboxLocal();
}

export { endSandbox, endSandboxLocal };
