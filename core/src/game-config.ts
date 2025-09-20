import type { GameGrid } from '@core/types';
import type { PlayerColor } from '@core/colors';
import type { TimingConfig } from '@core/timing/types';
import type { MapGenerationParams } from '@core/terrain-generation';

// TODO: num players is duplicated between `players.count` and `map.numPlayers`...
interface GameConfig {
  startingGrid: GameGrid;
  players: {
    count: number;
    colors: PlayerColor[];
  };
  map: MapGenerationParams;
  timing: TimingConfig;
  // TODO(engine-versioning): engineVersion?: string
}

export { type GameConfig };
