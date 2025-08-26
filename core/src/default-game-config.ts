import type { GameGenerationConfig } from '@core/game-generation-config';

const DEFAULT_GAME_GENERATION_CONFIG: GameGenerationConfig = {
  // mapSize: { width: 15, height: 15 },
  mapSize: { width: 30, height: 25 },
  mountainDensity: 0.1,
  minGeneralDistance: 10,
};

export { DEFAULT_GAME_GENERATION_CONFIG };
