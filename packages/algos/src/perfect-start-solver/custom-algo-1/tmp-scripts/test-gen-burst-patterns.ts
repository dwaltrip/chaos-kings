import { invariant } from '@utils/assertions/invariant';
import { genBurstLengthPatterns } from '../burst-patterns';

// Total army after 50 ticks
const MAX_ARMY = 50 / 2 + 1;
// Leaving 1 on the general, you can move at most this many troops
const MAX_MOVABLE_ARMY = MAX_ARMY - 1;
// Can capture at most 1 tile per max movable army
const MAX_POSSIBLE_CAPTURES = MAX_MOVABLE_ARMY;

// b = max burst length that fits within the tick limit.
// Generals accumulate +1 army every even tick, starting with 1 amry at t=1.
// To get x troops total on general, you need t ticks `t = 2*(x - 1)`.
// A burst of length b requires b+1 troops on the general.
// With x = b + 1, this occurs at tick t = 2*(b + 1 - 1) = 2*b
// The burst then moves through b tiles, taking b ticks.
// So the last move of the burst is at tick = 2*b + b = 3*b
// For a valid burst, this must be less than max_tick.
// We have: `3*b <= maxTicks = 50` ->  `b <= 50 / 3` -> `b <= 16.66` -> `b = 16`
const MAX_TICKS = 50;
const MAX_POSSIBLE_BURST = 16;
invariant(MAX_POSSIBLE_BURST == Math.floor(MAX_TICKS / 3));

const patterns = genBurstLengthPatterns(MAX_POSSIBLE_CAPTURES, MAX_POSSIBLE_BURST);

console.log('patterns.length:', patterns.length);

for (let pat of patterns.slice(0, 20)) {
  console.log(pat);
}
