import type { BoardState } from '@core/types';
import type { PlayerIndex } from '@common/types/player';
import { GameStatus } from '@common/types/games';

import { gameMetadataStore } from '@/stores/game-metadata-store';
import { gameplayActions } from '@/game-ui/store/gameplay-store-v2';

const { updateGame } = gameMetadataStore.getState().actions;

function updateForGameEnded(finalBoardState: BoardState, winner: PlayerIndex) {
  const { updateBoard, setWinner, setVisibleSquares, clearSelectedTile } =
    gameplayActions();
  // -----------------------------------------------------------
  // TODO: Use data from server, dont manually set these values
  // -----------------------------------------------------------
  updateGame({
    status: GameStatus.COMPLETE,
    updated_at: new Date().toISOString(),
  });

  updateBoard(finalBoardState);
  setWinner(winner);

  // All squares visible at end of game, so we reset to empty set (slightly counterintuitive)
  // maybe there's a better way to do this.
  setVisibleSquares(new Set<string>());
  clearSelectedTile();
}

export { updateForGameEnded };
