import type { GameGrid, Size2d } from '@core/types';
import type { PlayerColor } from '@core/colors';

interface GameConfig {
  size: Size2d;
  startingGrid: GameGrid;
  players: {
    count: number;
    colors: PlayerColor[];
  };
  generation: {
    seed: number;
    minGeneralDistance: number;
    mountainDensity?: number;
    algoVersion?: string;
  };
  timing: {
    tickRateMs: number;
    generalProductionTicks: number;
    armyProductionTicks: number;
  };
  // TODO(engine-versioning): engineVersion?: string
}

export { type GameConfig };
