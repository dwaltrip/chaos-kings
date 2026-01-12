import type { BestStartConfig } from './types';

function isBestStartComplete(tick: number, config: BestStartConfig): boolean {
  return tick >= config.timing.armyProductionTicks;
}

export { isBestStartComplete };
