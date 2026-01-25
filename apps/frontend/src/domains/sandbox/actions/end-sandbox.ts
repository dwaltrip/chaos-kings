import { useBoardSessionStore } from '@/domains/games/stores/board-session-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function endSandbox(): void {
  const { reset: resetSession } = useBoardSessionStore.getState().actions;
  const { reset: resetMeta } = useSandboxMetaStore.getState().actions;

  sandboxWsEffects.sendEndSession();
  resetSession();
  resetMeta();
}

export { endSandbox };
