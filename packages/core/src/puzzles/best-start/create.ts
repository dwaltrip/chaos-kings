import { makeBlankMap } from '@core/map/make-blank-map';
import { makeGeneralSquare } from '@core/map/make-squares';
import type { GameState } from '@core/types';
import type { BestStartConfig } from './types';

function createBestStartPuzzle(config: BestStartConfig): GameState {
  const { width, height } = config.mapSize;
  const grid = makeBlankMap(height, width);

  // Place general at center
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  grid[centerY][centerX] = makeGeneralSquare({ x: centerX, y: centerY }, 0);

  return {
    tick: 0,
    board: {
      grid,
      size: { width, height },
    },
  };
}

export { createBestStartPuzzle };
