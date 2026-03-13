import type { GameState } from '@core/types';

import type { ScoringFn } from './types';

const landOnly: ScoringFn = (gameState: GameState): number => {
  return gameState.players[0].landCount;
};

export { landOnly };
