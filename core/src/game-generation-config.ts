import type { Size2d } from '@core/types';

interface GameGenerationConfig {
  mapSize: Size2d;
  mountainDensity?: number;
  minGeneralDistance: number;
}

export { type GameGenerationConfig };
