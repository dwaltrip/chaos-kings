import type { Size2d } from '@core/types';

// TODO: get rid of this and replace w/ MapGenerationParams where needed
interface GameGenerationConfig {
  mapSize: Size2d;
  mountainDensity?: number;
  minGeneralDistance: number;
}

export { type GameGenerationConfig };
