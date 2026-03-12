import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';
import { undoLastQueuedMove } from '@/domains/games/board-store';

function undoMove(): void {
  undoLastQueuedMove();
  sandboxWsEffects.sendUndoMove();
}

export { undoMove };
