import type { BoardState, PlayerIndex } from '@core/types';
import { GameStatus } from '@common/types/games';

import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
import { gameplayActions } from '@/domains/gameplay/stores/gameplay-store-v2';

function updateForGameEnded(finalBoardState: BoardState, winner: PlayerIndex) {
  const { updateGame } = gameMetadataStore.getState().actions;
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
