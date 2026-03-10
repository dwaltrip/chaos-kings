import { setQueuedMoves } from '@/domains/games/board-store';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';

function cancelQueuedMoves() {
  setQueuedMoves([]);
  gameplayWsEffects.sendCancelMoves();
}

export { cancelQueuedMoves };
