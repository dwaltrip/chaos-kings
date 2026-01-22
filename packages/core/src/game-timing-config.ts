import type { TimingConfig } from '@core/timing/types';

function validateTimingConfig(config: TimingConfig): void {
  if (1000 % config.tickRateMs !== 0) {
    throw new Error(`tickRateMs (${config.tickRateMs}) must divide evenly into 1 second`);
  }
}

const DEFAULT_TIMING: TimingConfig = {
  tickRateMs: 500,
  generalProductionTicks: 2,
  landProductionTicks: 50,
};

validateTimingConfig(DEFAULT_TIMING);

export { DEFAULT_TIMING, validateTimingConfig };
