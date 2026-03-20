// Count the dimensions of the precomputed timing table.
// Usage: npx tsx count-timing-combos.ts

import { genDescendingPartitions } from '../burst-patterns';
import { simulateOneBurst, type TimingState } from '../get-burst-info';

const MAX_TICKS = 50;
const MAX_BURST = 12;
const MAX_BURSTS = 6;
const MAX_OVERLAP_PER_BURST = 3;
const MIN_CAPTURES = 15;
const MAX_CAPTURES = 24;

console.log('=== Dimensions ===\n');

let totalPatterns = 0;
let totalRawCombos = 0;
let totalValidCombos = 0;

const byCaptures: {
  captures: number;
  patterns: number;
  rawCombos: number;
  validCombos: number;
  byBurstCount: Map<number, { patterns: number; rawCombos: number; validCombos: number }>;
}[] = [];

for (let captures = MAX_CAPTURES; captures >= MIN_CAPTURES; captures--) {
  const patterns = genDescendingPartitions(captures, MAX_BURST, MAX_BURSTS);

  let captureRawCombos = 0;
  let captureValidCombos = 0;
  const byBurstCount = new Map<
    number,
    { patterns: number; rawCombos: number; validCombos: number }
  >();

  for (const pattern of patterns) {
    const k = pattern.length;
    if (!byBurstCount.has(k)) {
      byBurstCount.set(k, { patterns: 0, rawCombos: 0, validCombos: 0 });
    }
    const bc = byBurstCount.get(k)!;
    bc.patterns++;

    // overlap combos: burst 0 always 0, bursts 1..k-1 each 0..MAX_OVERLAP_PER_BURST
    const overlapLevels = MAX_OVERLAP_PER_BURST + 1; // 0,1,2,3 = 4
    const numCombos = Math.pow(overlapLevels, k - 1); // burst 0 is fixed

    captureRawCombos += numCombos;
    bc.rawCombos += numCombos;

    // enumerate all overlap combos and check timing
    function checkCombos(burstIdx: number, state: TimingState, overlaps: number[]) {
      if (burstIdx === k) {
        captureValidCombos++;
        bc.validCombos++;
        return;
      }

      const cap = pattern[burstIdx];
      const maxOvlp = burstIdx === 0 ? 0 : MAX_OVERLAP_PER_BURST;

      for (let ovlp = 0; ovlp <= maxOvlp; ovlp++) {
        const moves = cap + ovlp;
        const result = simulateOneBurst(cap, moves, state, MAX_TICKS);
        if (!result) break; // more overlap only makes timing worse
        checkCombos(burstIdx + 1, result.nextState, [...overlaps, ovlp]);
      }
    }

    checkCombos(0, { tick: 1, generalTroops: 1 }, []);
  }

  totalPatterns += patterns.length;
  totalRawCombos += captureRawCombos;
  totalValidCombos += captureValidCombos;

  byCaptures.push({
    captures,
    patterns: patterns.length,
    rawCombos: captureRawCombos,
    validCombos: captureValidCombos,
    byBurstCount,
  });
}

// ── Print results ──

console.log('captures | patterns | raw combos | valid combos | pruning');
console.log('-'.repeat(65));
for (const row of byCaptures) {
  const pruning =
    row.rawCombos > 0
      ? ((1 - row.validCombos / row.rawCombos) * 100).toFixed(0) + '%'
      : '-';
  console.log(
    `    ${String(row.captures).padStart(2)}   |` +
      `   ${String(row.patterns).padStart(5)}  |` +
      `    ${String(row.rawCombos).padStart(7)} |` +
      `       ${String(row.validCombos).padStart(6)} |` +
      `   ${pruning}`,
  );
}
console.log('-'.repeat(65));
console.log(
  `  TOTAL  |` +
    `   ${String(totalPatterns).padStart(5)}  |` +
    `    ${String(totalRawCombos).padStart(7)} |` +
    `       ${String(totalValidCombos).padStart(6)} |` +
    `   ${((1 - totalValidCombos / totalRawCombos) * 100).toFixed(0)}%`,
);

console.log('\n=== Breakdown by burst count ===\n');
console.log('captures | bursts | patterns | raw combos | valid combos');
console.log('-'.repeat(60));
for (const row of byCaptures) {
  const sorted = [...row.byBurstCount.entries()].sort((a, b) => a[0] - b[0]);
  for (const [burstCount, data] of sorted) {
    if (data.validCombos === 0 && data.rawCombos < 100) continue;
    console.log(
      `    ${String(row.captures).padStart(2)}   |` +
        `    ${burstCount}   |` +
        `   ${String(data.patterns).padStart(5)}  |` +
        `    ${String(data.rawCombos).padStart(7)} |` +
        `       ${String(data.validCombos).padStart(6)}`,
    );
  }
}
