import { cancelQueuedMoves as cancelQueuedMovesOnBoard } from '@/domains/games/board-store';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function cancelQueuedMoves(): void {
  cancelQueuedMovesOnBoard();
  // no-op if queue was empty, shouldn't cause issues
  // NOTE: we can add a check here later if we want
  puzzlesWsEffects.sendCancelMoves();
}

export { cancelQueuedMoves };
