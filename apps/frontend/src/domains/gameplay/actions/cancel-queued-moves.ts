import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';
import { tileOrchestrator } from '@/domains/games/stores/tile-orchestrator';
import { gameplayActions } from '@/domains/gameplay/stores/gameplay-store-v2';

function cancelQueuedMoves() {
  const { setQueuedMoves } = gameplayActions();

  // Optimistically clear FE state
  tileOrchestrator.updateQueuedDirections(new Map());
  setQueuedMoves([]);

  gameplayWsEffects.sendCancelMoves();
}

export { cancelQueuedMoves };
