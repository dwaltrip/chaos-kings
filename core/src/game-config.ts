import type { GameGrid, Size2d } from '@core/types';
import { PlayerColor } from '@core/colors';

interface GameConfig {
  size: Size2d;
  startingGrid: GameGrid;
  numPlayers: number;
  playerIndexToColor: Record<string, PlayerColor>;
}

export { type GameConfig};
