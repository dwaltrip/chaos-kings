import type { GameGenerationConfig } from '@core/game-generation-config';

const DEFAULT_GAME_GENERATION_CONFIG: GameGenerationConfig = {
  mapSize: { width: 10, height: 10 },
  mountainDensity: 0.1,
};

export { DEFAULT_GAME_GENERATION_CONFIG };
