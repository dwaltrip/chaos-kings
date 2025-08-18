import type { GameGenerationConfig } from '@core/game-generation-config';

const DEFAULT_GAME_GENERATION_CONFIG: GameGenerationConfig = {
  // mapSize: { width: 10, height: 10 },
  mapSize: { width: 25, height: 25 },
  mountainDensity: 0.1,
  minGeneralDistance: 10,
};

export { DEFAULT_GAME_GENERATION_CONFIG };
