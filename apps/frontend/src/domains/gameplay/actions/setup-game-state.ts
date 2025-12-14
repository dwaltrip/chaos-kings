import { GameStatus } from '@core/game/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
import { gameplayActions } from '@/domains/gameplay/stores/gameplay-store-v2';
import { userStore } from '@/domains/users/user-store';

function setupGameState(game: GameWithPlayers): void {
  const { setGame, setCountdownActive } = gameMetadataStore.getState().actions;
  const { setPlayerData } = gameplayActions();

  // Set game in metadata store
  setGame(game);

  // TODO: Should pass userId as parameter instead of fetching from store
  // Long-term: only call setupGameState in context of a user, pass userId directly
  const currentUser = userStore.getState().user;
  setPlayerData(game.players, currentUser?.id ?? null);

  // TODO: Think about if this logic should go here.
  // Now that we have `setupGameState` action, it's much better than before.
  // But still feels a bit like a side-effect / confusing flow.
  if (game.status === GameStatus.NOT_STARTED) {
    setCountdownActive(true);
  }
}

export { setupGameState };
