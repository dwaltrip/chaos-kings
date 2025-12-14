import { loadGame as apiLoadGame } from '@/domains/games/games-api';
import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
import { gameplayActions } from '@/domains/gameplay/stores/gameplay-store-v2';
import { userStore } from '@/domains/users/user-store';

async function loadGame(gameId: string): Promise<void> {
  const { setGame, setCountdownActive } = gameMetadataStore.getState().actions;
  const { setPlayerData } = gameplayActions();
  const currentUser = userStore.getState().user;

  const game = await apiLoadGame(gameId);

  // Set game in metadata store
  setGame(game);

  // Process and store player identity data
  setPlayerData(game.players, currentUser?.id ?? null);

  // Initialize countdown if needed
  if (game.status === 'not_started') {
    setCountdownActive(true);
  }
}

export { loadGame };
