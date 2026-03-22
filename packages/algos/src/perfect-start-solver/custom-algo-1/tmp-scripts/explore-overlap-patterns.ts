// @ts-nocheck
import { genDescendingPartitions } from '../burst-patterns';
import { getBurstInfos } from '../get-burst-info';

const MAX_TICKS = 50;
const MAX_BURST_CAPTURES = 12;
const MAX_OVERLAP_PER_BURST = 3;
const MAX_BURSTS = 10;

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

  while (movesRemaining > 0) {
    if (tick > maxTicks) return null;

    if (movesRemaining === moves) {
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

  return { endTick: tick - 1, nextState: { tick, generalTroops } };
}

interface Stats {
  validCount: number;
  prunedCount: number;
  theoreticalMax: number;
  byTotalOverlap: Map<number, number>;
  endTickDistribution: Map<number, number>;
  maxOverlapExamples: { pattern: number[]; overlaps: number[]; endTick: number }[];
}

function makeStats(): Stats {
  return {
    validCount: 0,
    prunedCount: 0,
    theoreticalMax: 0,
    byTotalOverlap: new Map(),
    endTickDistribution: new Map(),
    maxOverlapExamples: [],
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
    stats.validCount++;
    const endTick = state.tick - 1;

    const totalOverlap = overlaps.reduce((a, b) => a + b, 0);
    stats.byTotalOverlap.set(
      totalOverlap,
      (stats.byTotalOverlap.get(totalOverlap) ?? 0) + 1,
    );
    stats.endTickDistribution.set(
      endTick,
      (stats.endTickDistribution.get(endTick) ?? 0) + 1,
    );

    // track examples at high overlap
    if (totalOverlap >= 10 && stats.maxOverlapExamples.length < 5) {
      stats.maxOverlapExamples.push({
        pattern: [...pattern],
        overlaps: [...overlaps],
        endTick,
      });
    }
    return;
  }

  const maxOverlap = burstIdx === 0 ? 0 : MAX_OVERLAP_PER_BURST;
  for (let o = 0; o <= maxOverlap; o++) {
    overlaps[burstIdx] = o;
    const moves = pattern[burstIdx] + o;
    const result = simulateOneBurst(pattern[burstIdx], moves, state, MAX_TICKS);
    if (!result) {
      // this and all higher overlap values pruned
      stats.prunedCount += countRemainingCombos(pattern, burstIdx, o, maxOverlap);
      break;
    }
    exploreOverlaps(pattern, stats, overlaps, burstIdx + 1, result.nextState);
  }
}

// count how many leaf combos are pruned when we break at burstIdx with overlap=o
function countRemainingCombos(
  pattern: number[],
  burstIdx: number,
  startOverlap: number,
  maxOverlap: number,
): number {
  const remainingAtThisBurst = maxOverlap - startOverlap + 1;
  let combosPerRemainingBurst = 1;
  for (let i = burstIdx + 1; i < pattern.length; i++) {
    combosPerRemainingBurst *= MAX_OVERLAP_PER_BURST + 1; // 0..MAX
  }
  return remainingAtThisBurst * combosPerRemainingBurst;
}

// verify: for overlap=0 patterns, does simulateOneBurst match original model?
function verifyAgainstOriginal(capturePatterns: number[][]): void {
  let checked = 0;
  let mismatches = 0;

  for (const pattern of capturePatterns) {
    // original model
    const burstInfos = getBurstInfos(pattern);
    const originalEndTick = burstInfos[burstInfos.length - 1].endTick;

    // new model (overlap=0)
    let state: TimingState = { tick: 1, generalTroops: 1 };
    let newEndTick = 0;
    let valid = true;
    for (const captures of pattern) {
      const result = simulateOneBurst(captures, captures, state, MAX_TICKS);
      if (!result) {
        valid = false;
        break;
      }
      newEndTick = result.endTick;
      state = result.nextState;
    }

    if (valid && originalEndTick !== newEndTick) {
      mismatches++;
      if (mismatches <= 3) {
        console.log(
          `  MISMATCH: pattern=${JSON.stringify(pattern)} original=${originalEndTick} new=${newEndTick}`,
        );
      }
    }
    checked++;
  }

  console.log(`  Verification: ${checked} patterns, ${mismatches} mismatches`);
}

for (let totalCaptures = 20; totalCaptures <= 24; totalCaptures++) {
  const t0 = performance.now();
  const capturePatterns = genDescendingPartitions(
    totalCaptures,
    MAX_BURST_CAPTURES,
  ).filter((p) => p.length <= MAX_BURSTS);

  // compute theoretical max combos (no pruning)
  let theoreticalMax = 0;
  for (const p of capturePatterns) {
    let combos = 1;
    for (let i = 1; i < p.length; i++) combos *= MAX_OVERLAP_PER_BURST + 1;
    theoreticalMax += combos;
  }

  const stats = makeStats();
  stats.theoreticalMax = theoreticalMax;

  const initialState: TimingState = { tick: 1, generalTroops: 1 };
  for (const pattern of capturePatterns) {
    const overlaps = new Array(pattern.length).fill(0);
    exploreOverlaps(pattern, stats, overlaps, 0, initialState);
  }

  const elapsed = performance.now() - t0;

  console.log(`\n=== ${totalCaptures} captures ===`);

  // verify new model matches original for overlap=0
  verifyAgainstOriginal(capturePatterns);

  console.log(`  Capture patterns (≤${MAX_BURSTS} bursts): ${capturePatterns.length}`);
  console.log(`  Theoretical combos (no pruning): ${theoreticalMax.toLocaleString()}`);
  console.log(`  Valid combos: ${stats.validCount.toLocaleString()}`);
  console.log(`  Pruned combos: ${stats.prunedCount.toLocaleString()}`);
  console.log(
    `  Pruning rate: ${((stats.prunedCount / theoreticalMax) * 100).toFixed(1)}%`,
  );

  // overlap distribution
  const sortedOverlaps = [...stats.byTotalOverlap.entries()].sort((a, b) => a[0] - b[0]);
  console.log(`  Total overlap distribution:`);
  for (const [overlap, count] of sortedOverlaps) {
    const bar = '#'.repeat(Math.ceil((count / stats.validCount) * 40));
    console.log(
      `    ${String(overlap).padStart(2)}: ${String(count).padStart(8)} ${bar}`,
    );
  }

  // endTick distribution
  const sortedTicks = [...stats.endTickDistribution.entries()].sort(
    (a, b) => a[0] - b[0],
  );
  console.log(`  EndTick distribution:`);
  for (const [tick, count] of sortedTicks) {
    const bar = '#'.repeat(Math.ceil((count / stats.validCount) * 40));
    console.log(`    t=${tick}: ${String(count).padStart(8)} ${bar}`);
  }

  // high-overlap examples
  if (stats.maxOverlapExamples.length > 0) {
    console.log(`  High-overlap examples:`);
    for (const ex of stats.maxOverlapExamples) {
      const desc = ex.pattern.map((c, i) => `${c}+${ex.overlaps[i]}`).join(', ');
      console.log(`    [${desc}] endTick=${ex.endTick}`);
    }
  }

  console.log(`  Time: ${elapsed.toFixed(0)}ms`);
}
