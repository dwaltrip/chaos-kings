import type { BoardState, PlayerIndex } from '@core/types';
import { GameStatus } from '@core/game/types';

import {
  applyTick,
  boardStore,
  setStatus,
  setSelectedTile,
} from '@/domains/games/board-store';
import { gameplayPageStore } from '@/domains/gameplay/stores/gameplay-page-store';

function updateForGameEnded(finalBoardState: BoardState, winner: PlayerIndex) {
  const { updateGame } = gameplayPageStore.getState().actions;
  const { tick, playerStats } = boardStore.state.game;

  // -----------------------------------------------------------
  // TODO: Use data from server, dont manually set these values
  // -----------------------------------------------------------
  updateGame({
    status: GameStatus.COMPLETE,
    updated_at: new Date(),
  });

  applyTick(tick, finalBoardState, [], playerStats, winner);
  setStatus('ended');
  setSelectedTile(null);
}

export { updateForGameEnded };
