import { Board } from '@core/board';
import type { BoardState } from '@core/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { gameplayPageStore } from '@/domains/gameplay/stores/gameplay-page-store';
import {
  gameplayActions,
  useGameplayStoreV2,
} from '@/domains/gameplay/stores/gameplay-store-v2';

function updateForGameStart(game: GameWithPlayers, boardState: BoardState) {
  const { setCountdownActive, setGame } = gameplayPageStore.getState().actions;
  const { updateBoard, setVisibleSquares } = gameplayActions();

  setCountdownActive(false);
  setGame(game);
  updateBoard(boardState);

  // Initialize visible squares for the current player
  const currentPlayerIndex = useGameplayStoreV2.getState().currentPlayerIndex;
  if (currentPlayerIndex !== null) {
    const visibleSquares = Board.getVisibleSquares(boardState, currentPlayerIndex);
    setVisibleSquares(visibleSquares);
  }
}

export { updateForGameStart };
