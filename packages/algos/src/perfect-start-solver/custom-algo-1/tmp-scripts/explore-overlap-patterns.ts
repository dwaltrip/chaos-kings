import { genDescendingPartitions } from '../burst-patterns';

const MAX_TICKS = 50;
const MAX_BURST_CAPTURES = 12;
const MAX_OVERLAP_PER_BURST = 3;
const MAX_BURSTS = 10;

// Simulate one burst starting from the given timing state.
// Returns the state after the burst completes, or null if it exceeds maxTicks.
interface TimingState {
  tick: number;
  generalTroops: number;
}

function simulateOneBurst(
  captures: number,
  moves: number,
  state: TimingState,
  maxTicks: number,
): { endTick: number; nextState: TimingState } | null {
  let { tick, generalTroops } = state;
  let movesRemaining = moves;

  // wait for enough troops, then execute moves
  while (movesRemaining > 0) {
    if (tick > maxTicks) return null;

    if (movesRemaining === moves) {
      // haven't started yet — check if we can
      const troopsNeeded = captures + 1;
      if (generalTroops >= troopsNeeded) {
        generalTroops = 1;
        movesRemaining--;
      }
    } else {
      movesRemaining--;
    }

    if (tick % 2 === 0) {
      generalTroops++;
    }

    tick++;
  }

  return {
    endTick: tick - 1,
    nextState: { tick, generalTroops },
  };
}

// Stats
interface Stats {
  validCount: number;
  byTotalOverlap: Map<number, number>;
  bestEndTick: number;
  bestPattern: number[] | null;
  bestOverlaps: number[] | null;
  combosChecked: number;
}

function makeStats(): Stats {
  return {
    validCount: 0,
    byTotalOverlap: new Map(),
    bestEndTick: Infinity,
    bestPattern: null,
    bestOverlaps: null,
    combosChecked: 0,
  };
}

function exploreOverlaps(
  pattern: number[],
  stats: Stats,
  overlaps: number[],
  burstIdx: number,
  state: TimingState,
): void {
  if (burstIdx === pattern.length) {
    stats.combosChecked++;
    // endTick is the tick of the last move of the previous burst
    // we need to get it from the caller — use a trick: the state.tick
    // is one past the last move, so endTick = state.tick - 1
    // But we actually tracked it via the recursive calls. Let's compute:
    const endTick = state.tick - 1;

    stats.validCount++;
    const totalOverlap = overlaps.reduce((a, b) => a + b, 0);
    stats.byTotalOverlap.set(
      totalOverlap,
      (stats.byTotalOverlap.get(totalOverlap) ?? 0) + 1,
    );

    if (endTick < stats.bestEndTick) {
      stats.bestEndTick = endTick;
      stats.bestPattern = [...pattern];
      stats.bestOverlaps = [...overlaps];
    }
    return;
  }

  const maxOverlap = burstIdx === 0 ? 0 : MAX_OVERLAP_PER_BURST;
  for (let o = 0; o <= maxOverlap; o++) {
    overlaps[burstIdx] = o;
    const moves = pattern[burstIdx] + o;
    const result = simulateOneBurst(pattern[burstIdx], moves, state, MAX_TICKS);
    if (!result) break; // more overlap only makes it worse
    exploreOverlaps(pattern, stats, overlaps, burstIdx + 1, result.nextState);
  }
}

for (let totalCaptures = 20; totalCaptures <= 24; totalCaptures++) {
  const t0 = performance.now();
  const capturePatterns = genDescendingPartitions(
    totalCaptures,
    MAX_BURST_CAPTURES,
  ).filter((p) => p.length <= MAX_BURSTS);
  const stats = makeStats();

  const initialState: TimingState = { tick: 1, generalTroops: 1 };
  for (const pattern of capturePatterns) {
    const overlaps = new Array(pattern.length).fill(0);
    exploreOverlaps(pattern, stats, overlaps, 0, initialState);
  }

  const elapsed = performance.now() - t0;

  console.log(`\n=== ${totalCaptures} captures ===`);
  console.log(`  Capture patterns: ${capturePatterns.length}`);
  console.log(`  Combos checked: ${stats.combosChecked}`);
  console.log(`  Valid: ${stats.validCount}`);
  console.log(`  Best endTick: ${stats.bestEndTick}`);
  if (stats.bestPattern && stats.bestOverlaps) {
    const desc = stats.bestPattern
      .map((c, i) => `${c}+${stats.bestOverlaps![i]}`)
      .join(', ');
    console.log(`  Best spec: [${desc}]`);
  }

  const sortedOverlaps = [...stats.byTotalOverlap.entries()].sort((a, b) => a[0] - b[0]);
  console.log(`  By total overlap:`);
  for (const [overlap, count] of sortedOverlaps) {
    console.log(`    overlap=${overlap}: ${count}`);
  }
  console.log(`  Time: ${elapsed.toFixed(0)}ms`);
}
