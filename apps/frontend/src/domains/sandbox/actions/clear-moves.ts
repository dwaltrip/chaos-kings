import { Board } from '@core/board';

import { boardStore, setSelectedTile } from '@/domains/games/board-store';
import { getLastExecutedMove } from '@/domains/sandbox/move-history-cache';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function clearMoves(): void {
  const { queuedMoves } = boardStore.state.game;
  const lastExecutedMove = getLastExecutedMove();

  if (queuedMoves.length > 0) {
    if (lastExecutedMove) {
      const dest = Board.applyDirection(
        lastExecutedMove.sourceCoord,
        lastExecutedMove.direction,
      );
      setSelectedTile(dest);
    } else {
      setSelectedTile(queuedMoves[0].sourceCoord);
    }
  }

  sandboxWsEffects.sendCancelMoves();
}

export { clearMoves };
