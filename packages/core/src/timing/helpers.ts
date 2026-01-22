import type { GameConfig } from '@core/game-config';

function getTicksPerTurn(config: GameConfig): number {
  return config.timing.generalProductionTicks;
}

export { getTicksPerTurn };
