import { useBoardSessionStore } from '@/domains/games/stores/board-session-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function startSandbox(): void {
  const { reset: resetSession } = useBoardSessionStore.getState().actions;
  const { reset: resetMeta } = useSandboxMetaStore.getState().actions;

  resetSession();
  resetMeta();
  sandboxWsEffects.sendStartSession();
}

export { startSandbox };
