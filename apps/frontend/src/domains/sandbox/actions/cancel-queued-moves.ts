import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';
import { cancelQueuedMoves as cancelQueuedMovesOnBoard } from '@/domains/games/board-store';

function cancelQueuedMoves(): void {
  cancelQueuedMovesOnBoard();
  // no-op if queue was empty, shouldn't cause issues
  // NOTE: we can add a check here later if we want
  sandboxWsEffects.sendCancelMoves();
}

export { cancelQueuedMoves };
