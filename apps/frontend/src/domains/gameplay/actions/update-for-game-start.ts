import type { BoardState } from '@core/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { applyTick, initBoard } from '@/domains/games/board-store';
import { gameplayPageStore } from '@/domains/gameplay/stores/gameplay-page-store';
import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';

function updateForGameStart(game: GameWithPlayers, boardState: BoardState) {
  const { setCountdownActive, setGame } = gameplayPageStore.getState().actions;
  const { currentPlayerIndex } = useGameplayStoreV2.getState();

  setCountdownActive(false);
  setGame(game);

  initBoard(game.players, currentPlayerIndex, boardState);
  applyTick(0, boardState, [], []);
}

export { updateForGameStart };
