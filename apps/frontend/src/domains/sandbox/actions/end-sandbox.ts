import {
  useBoardSessionStore,
  moveHistoryCache,
} from '@/domains/games/stores/board-session-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

// Reset local stores only — backend cleanup happens via disconnect handler
// and via startSession replacing any existing session.
function endSandboxLocal(): void {
  const { reset: resetSession } = useBoardSessionStore.getState().actions;
  const { reset: resetMeta } = useSandboxMetaStore.getState().actions;

  resetSession();
  resetMeta();
  moveHistoryCache.clear();
}

function endSandbox(): void {
  sandboxWsEffects.sendEndSession();
  endSandboxLocal();
}

export { endSandbox, endSandboxLocal };
