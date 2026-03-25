import { MAX_TICK } from './constants';
import { numStr, tickForGeneralArmy } from './helpers';

function maxSingleBurst(verbose: boolean = false) {
  // Leave 1 army behind -> size + 1
  // Each move takes 1 tick. We are doing `size` moves -> add `size` ticks.
  const burstEndTick = (size: number) => tickForGeneralArmy(size + 1) + size;
  let bestSize = -1;
  let bestEndTick = -1;

  // candidate burst size
  for (let size = 1; size < 25; size++) {
    const endTick = burstEndTick(size);
    if (verbose) {
      console.log(`-- burst: ${numStr(size, 2)}, end_tick: ${numStr(endTick, 2)}`);
    }
    if (endTick <= MAX_TICK) {
      bestSize = size;
      bestEndTick = endTick;
    }
  }
  return { size: bestSize, endTick: bestEndTick };
}

export { maxSingleBurst };
