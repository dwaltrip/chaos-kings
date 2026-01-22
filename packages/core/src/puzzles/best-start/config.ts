import { DEFAULT_TIMING } from '@core/game-timing-config';

import type { BestStartConfig } from './types';

const DEFAULT_BEST_START_CONFIG: BestStartConfig = {
  timing: DEFAULT_TIMING,
  mapSize: { width: 15, height: 15 },
};

export { DEFAULT_BEST_START_CONFIG };
