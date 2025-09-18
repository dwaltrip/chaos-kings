import type { GameGrid, Size2d } from '@core/types';
import type { PlayerColor } from '@core/colors';
import type { TimingConfig } from '@core/timing/types';

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
  timing: TimingConfig;
  // TODO(engine-versioning): engineVersion?: string
}

export { type GameConfig };
