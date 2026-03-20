import { simulateOneBurst, type TimingState } from './get-burst-info';
import { genDescendingPartitions } from './burst-patterns';

// moves per burst = captures[i] + overlaps[i]
interface TimingEntry {
  captures: number[];
  overlaps: number[];
  endTick: number;
}

interface TimingTableConfig {
  maxTicks: number;
  maxBurst: number;
  maxBursts: number;
  maxOverlapPerBurst: number;
}

// Build all valid timing entries for a given capture target.
// Sorted: fewer total overlap tiles first (zero-overlap combos come first).
function buildTimingEntries(
  totalCaptures: number,
  config: TimingTableConfig,
): TimingEntry[] {
  const patterns = genDescendingPartitions(
    totalCaptures,
    config.maxBurst,
    config.maxBursts,
  );
  const entries: TimingEntry[] = [];

  for (const pattern of patterns) {
    expandOverlapCombos(pattern, 0, { tick: 1, generalTroops: 1 }, [], config, entries);
  }

  entries.sort((a, b) => arraySum(a.overlaps) - arraySum(b.overlaps));

  return entries;
}

// Recursively expand overlap choices for each burst in the pattern.
// Burst 0 always has overlap=0. Subsequent bursts try 0..maxOverlapPerBurst.
function expandOverlapCombos(
  pattern: number[],
  burstIdx: number,
  state: TimingState,
  overlaps: number[],
  config: TimingTableConfig,
  out: TimingEntry[],
): void {
  if (burstIdx === pattern.length) {
    out.push({
      captures: pattern,
      overlaps: [...overlaps],
      endTick: state.tick - 1,
    });
    return;
  }

  const maxOvl = burstIdx === 0 ? 0 : config.maxOverlapPerBurst;

  for (let ovl = 0; ovl <= maxOvl; ovl++) {
    const captures = pattern[burstIdx];
    const moves = captures + ovl;

    const result = simulateOneBurst(captures, moves, state, config.maxTicks);
    if (!result) break;

    overlaps.push(ovl);
    expandOverlapCombos(pattern, burstIdx + 1, result.nextState, overlaps, config, out);
    overlaps.pop();
  }
}

function arraySum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

export type { TimingEntry, TimingTableConfig };
export { buildTimingEntries };
