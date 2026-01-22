import {
  TICK_RATE_MS,
  GENERAL_PRODUCTION_TICKS,
  ARMY_PRODUCTION_TICKS,
} from '@core/game-timing-config';

import type { BestStartConfig } from './types';

const DEFAULT_BEST_START_CONFIG: BestStartConfig = {
  timing: {
    tickRateMs: TICK_RATE_MS,
    generalProductionTicks: GENERAL_PRODUCTION_TICKS,
    armyProductionTicks: ARMY_PRODUCTION_TICKS,
  },
  mapSize: { width: 15, height: 15 },
};

export { DEFAULT_BEST_START_CONFIG };
