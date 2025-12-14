import type { GameId } from '@kernel/ids';

import { loadGame } from '@/domains/gameplay/actions/load-game';
import { setupGameState } from '@/domains/gameplay/actions/setup-game-state';
import { gameplayPageStore } from '@/domains/gameplay/stores/gameplay-page-store';

async function loadGameplayPage(gameId: GameId): Promise<void> {
  const { loader, actions } = gameplayPageStore.getState();
  const { reset, setGame, loader: loaderActions } = actions;

  // Skip if already loading the same game
  if (loader.loading && loader.loadedId === gameId) {
    return;
  }

  // Always reset before loading a new game to avoid stale state
  reset();

  const game = await loaderActions.run(gameId, () => loadGame(gameId));
  setGame(game);
  setupGameState(game);
}

function resetGameplayPage(): void {
  gameplayPageStore.getState().actions.reset();
}

export { loadGameplayPage, resetGameplayPage };
