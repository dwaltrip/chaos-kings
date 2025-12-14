import type { BoardState } from '@core/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
import { gameplayActions } from '@/domains/gameplay/stores/gameplay-store-v2';

function updateForGameStart(game: GameWithPlayers, boardState: BoardState) {
  const { setCountdownActive, setGame } = gameMetadataStore.getState().actions;
  const { updateBoard } = gameplayActions();

  setCountdownActive(false);
  setGame(game);
  updateBoard(boardState);
}

export { updateForGameStart };
