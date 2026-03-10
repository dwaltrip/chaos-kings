import { GameStatus } from '@core/game/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { initBoard } from '@/domains/games/board-store';
import { gameplayPageStore } from '@/domains/gameplay/stores/gameplay-page-store';
import {
  gameplayActions,
  useGameplayStoreV2,
} from '@/domains/gameplay/stores/gameplay-store-v2';
import { userStore } from '@/domains/users/user-store';
import { updateGameplayState } from './update-gameplay-state';

function setupGameState(game: GameWithPlayers): void {
  const { setGame, setCountdownActive } = gameplayPageStore.getState().actions;
  const { setPlayerData, setGameplayReady } = gameplayActions();

  setGame(game);

  // TODO: Should pass userId as parameter instead of fetching from store
  const currentUser = userStore.getState().data;
  setPlayerData(game.players, currentUser?.id ?? null);

  // Read currentPlayerIndex after setPlayerData populates it
  const { currentPlayerIndex } = useGameplayStoreV2.getState();
  initBoard(game.players, currentPlayerIndex);

  setGameplayReady(true);

  // TODO: better way to check this?
  if ('board' in game.game_state) {
    const { tick, board } = game.game_state;
    updateGameplayState(tick, board);
  }

  // TODO: Think about if this logic should go here.
  if (game.status === GameStatus.NOT_STARTED) {
    setCountdownActive(true);
  }
}

export { setupGameState };
