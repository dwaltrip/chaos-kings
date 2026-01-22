import type { BestStartConfig } from './types';

function isBestStartComplete(tick: number, config: BestStartConfig): boolean {
  return tick >= config.timing.landProductionTicks;
}

export { isBestStartComplete };
