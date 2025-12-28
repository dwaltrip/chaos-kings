import type { GameId } from '@kernel/ids';

import { loadGame } from '@/domains/gameplay/actions/load-game';
import { setupGameState } from '@/domains/gameplay/actions/setup-game-state';
import { gameplayPageStore } from '@/domains/gameplay/stores/gameplay-page-store';

async function loadGameplayPage(gameId: GameId): Promise<void> {
  const state = gameplayPageStore.getState();

  // Skip if already loading
  if (state.isLoading()) {
    return;
  }

  // Always reset before loading a new game to avoid stale state
  state.actions.resetAll();

  const game = await state.load(() => loadGame(gameId));
  setupGameState(game);
}

function resetGameplayPage(): void {
  gameplayPageStore.getState().actions.resetAll();
}

export { loadGameplayPage, resetGameplayPage };
