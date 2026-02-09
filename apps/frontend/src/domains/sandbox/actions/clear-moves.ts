import { Board } from '@core/board';

import { useBoardSessionStore } from '@/domains/games/stores/board-session-store';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function clearMoves(): void {
  const { queuedMoves, lastExecutedMove, actions } = useBoardSessionStore.getState();

  if (queuedMoves.length > 0) {
    if (lastExecutedMove) {
      const dest = Board.applyDirection(
        lastExecutedMove.sourceCoord,
        lastExecutedMove.direction,
      );
      actions.setSelectedTile(dest);
    } else {
      actions.setSelectedTile(queuedMoves[0].sourceCoord);
    }
  }

  sandboxWsEffects.sendCancelMoves();
}

export { clearMoves };
