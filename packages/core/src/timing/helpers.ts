import type { GameConfig } from '@core/game-config';

import { TURN_INTERVAL_MS } from '@core/game-timing-config';

function getTicksPerTurn(config: GameConfig): number {
  return TURN_INTERVAL_MS / config.timing.tickRateMs;
}

export { getTicksPerTurn };
