import { createGameState } from '@core/step-processor';
import { generateGameMapV2 } from '@core/terrain-generation';
import type { GameState } from '@core/types';

import type { BestStartConfig } from './types';

interface CreateBestStartResult {
  gameState: GameState;
  seed: number;
}

function createBestStartPuzzle(
  config: BestStartConfig,
  seed?: number,
): CreateBestStartResult {
  const { width, height } = config.mapSize;
  const actualSeed = seed ?? Date.now();

  const { grid } = generateGameMapV2({
    size: { width, height },
    numPlayers: 1,
    minGeneralDistance: 0,
    seed: actualSeed,
  });

  const board = { grid, size: { width, height } };
  const gameState = createGameState(board, 1);
  return { gameState, seed: actualSeed };
}

export type { CreateBestStartResult };
export { createBestStartPuzzle };
