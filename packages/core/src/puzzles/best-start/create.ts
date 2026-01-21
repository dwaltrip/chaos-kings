import { createGameState } from '@core/step-processor';
import { generateGameMapV2 } from '@core/terrain-generation';
import type { GameState } from '@core/types';

import type { BestStartConfig } from './types';

function createBestStartPuzzle(config: BestStartConfig): GameState {
  const { width, height } = config.mapSize;

  const { grid } = generateGameMapV2({
    size: { width, height },
    numPlayers: 1,
    minGeneralDistance: 0,
    seed: Date.now(),
  });

  const board = { grid, size: { width, height } };
  return createGameState(board, 1);
}

export { createBestStartPuzzle };
