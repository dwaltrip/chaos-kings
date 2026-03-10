import {
  boardStore,
  undoLastQueuedMove as boardUndoLastQueuedMove,
} from '@/domains/games/board-store';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';

function undoLastQueuedMove() {
  const { queuedMoves } = boardStore.state.game;
  if (queuedMoves.length === 0) return;

  boardUndoLastQueuedMove();
  gameplayWsEffects.sendUndoMove();
}

export { undoLastQueuedMove };
