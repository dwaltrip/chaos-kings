// Quick survey: how many unique overlap patterns exist across capture targets?
//
// Usage: npx tsx .../3.23-4-overlap-pattern-survey.ts

import { buildTimingEntries } from '../../custom-algo-1/timing-table';
import type { TimingTableConfig } from '../../custom-algo-1/timing-table';

const config: TimingTableConfig = {
  maxTicks: 50,
  maxBurst: 12,
  maxBursts: 6,
  maxOverlapPerBurst: 3,
};

for (let cap = 15; cap <= 24; cap++) {
  const entries = buildTimingEntries(cap, config);

  // Group by (N, overlap pattern)
  const byN = new Map<number, Map<string, number>>(); // N → (patternKey → count)

  for (const entry of entries) {
    const N = entry.overlaps.length;
    const key = entry.overlaps.join(',');

    if (!byN.has(N)) byN.set(N, new Map());
    const patterns = byN.get(N)!;
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }

  console.log(`\n## cap=${cap}  (${entries.length} total entries)`);

  const sortedNs = [...byN.keys()].sort((a, b) => a - b);
  for (const N of sortedNs) {
    const patterns = byN.get(N)!;
    const entryCount = [...patterns.values()].reduce((s, c) => s + c, 0);
    console.log(`  N=${N}: ${patterns.size} unique patterns (${entryCount} entries)`);
  }
}
