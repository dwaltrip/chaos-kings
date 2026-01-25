import type { Size2d } from '@core/types';
import type { TimingConfig } from '@core/timing/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';

interface SandboxConfig {
  mapSize: Size2d;
  timing: TimingConfig;
  seed?: number;
  checkpointInterval: number;
}

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  mapSize: { width: 10, height: 10 },
  timing: DEFAULT_TIMING,
  checkpointInterval: 25,
};

export type { SandboxConfig };
export { DEFAULT_SANDBOX_CONFIG };
