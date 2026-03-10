import { boardStore, initBoard } from '@/domains/games/board-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function startSandbox(): void {
  const { reset: resetMeta } = useSandboxMetaStore.getState().actions;

  boardStore.reset();
  resetMeta();
  initBoard([], 0);
  sandboxWsEffects.sendStartSession();
}

export { startSandbox };
