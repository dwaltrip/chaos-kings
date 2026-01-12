import type { TimingConfig } from '@core/timing/types';

interface BestStartConfig {
  timing: TimingConfig;
  mapSize: { width: number; height: number };
}

interface BestStartResult {
  landCount: number;
  armyCount: number;
}

export type { BestStartConfig, BestStartResult };
