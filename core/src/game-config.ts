import type { GameGrid, Size2d } from '@core/types';

interface GameConfig {
  size: Size2d;
  startingGrid: GameGrid;
  numPlayers: number;
}

export { type GameConfig};
