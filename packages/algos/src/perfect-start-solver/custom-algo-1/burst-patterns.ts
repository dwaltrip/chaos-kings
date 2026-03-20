import { simulateOneBurst, type TimingState } from './get-burst-info';

type BurstPattern = number[];

// Enumerate all descending-order burst patterns that sum to `total`,
// where each burst is at most `maxBurst`. Filters by timing (must fit
// within `maxTicks`).
function genValidBurstPatterns(
  total: number,
  maxBurst: number,
  maxTicks: number,
): BurstPattern[] {
  const all = genDescendingPartitions(total, maxBurst);
  return all.filter((pattern) => {
    let state: TimingState = { tick: 1, generalTroops: 1 };
    for (const captures of pattern) {
      const result = simulateOneBurst(captures, captures, state, maxTicks);
      if (!result) return false;
      state = result.nextState;
    }
    return true;
  });
}

// All descending-order sequences of positive integers that sum to `total`,
// where each element is at most `maxVal`.
function genDescendingPartitions(total: number, maxVal: number): BurstPattern[] {
  const results: BurstPattern[] = [];

  function recurse(remaining: number, maxNext: number, pattern: BurstPattern) {
    if (remaining === 0) {
      results.push(pattern);
      return;
    }

    const upper = Math.min(remaining, maxNext);
    for (let burst = upper; burst >= 1; burst--) {
      recurse(remaining - burst, burst, pattern.concat(burst));
    }
  }

  recurse(total, maxVal, []);
  return results;
}

export type { BurstPattern };
export { genValidBurstPatterns, genDescendingPartitions };
