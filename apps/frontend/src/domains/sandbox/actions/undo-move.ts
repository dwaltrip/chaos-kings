import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function undoMove(): void {
  sandboxWsEffects.sendUndoMove();
}

export { undoMove };
