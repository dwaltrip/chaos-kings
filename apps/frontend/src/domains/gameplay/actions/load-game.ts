import { GameStatus } from '@core/game/types';

import { loadGame as apiLoadGame, GameNotFoundError } from '@/domains/games/games-api';
import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
import { gameplayActions } from '@/domains/gameplay/stores/gameplay-store-v2';
import { userStore } from '@/domains/users/user-store';

async function loadGame(gameId: string): Promise<void> {
  const store = gameMetadataStore.getState();
  const { setGame, setCountdownActive, setLoading, setError } = store.actions;
  const { setPlayerData } = gameplayActions();

  // Prevent duplicate loads
  if (store.loading || (store.game && String(store.game.id) === gameId) || store.error) {
    return;
  }

  try {
    setLoading(true);
    setError(null);

    const game = await apiLoadGame(gameId);

    // Set game in metadata store
    setGame(game);

    // TODO: Should pass userId as parameter instead of fetching from store
    // Long-term: only call loadGame in context of a user, pass userId directly
    const currentUser = userStore.getState().user;
    setPlayerData(game.players, currentUser?.id ?? null);

    // -------------------------------------------------------------
    // TODO: This isn't how the countdown should be setup
    // Should happen somewhere more obvious and a distinct action
    // -------------------------------------------------------------
    // Initialize countdown if game hasn't started yet
    if (game.status === GameStatus.NOT_STARTED) {
      setCountdownActive(true);
    }

    setLoading(false);
  } catch (err) {
    let errorMessage = 'Failed to load game';
    if (err instanceof GameNotFoundError) {
      errorMessage = 'Game not found';
    }
    console.error(`Error loading game (id=${gameId}):`, err);
    setError(errorMessage);
    setLoading(false);
  }
}

export { loadGame };
