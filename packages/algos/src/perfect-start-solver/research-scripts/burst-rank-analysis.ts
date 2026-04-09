// Analyze burst lengths by rank across all valid timing entries.
// Two views:
// 1. Total path length from general (captures + overlap) by burst rank — counts and percents
// 2. Fraction of entries that extend beyond prefix depth D, by burst rank

import { buildTimingEntries } from '../custom-algo-1/timing-table';
import { formatTable } from '@/utils/format';

const config = {
  maxTicks: 50,
  maxBurst: 12,
  maxBursts: 6,
  maxOverlapPerBurst: 3,
};

const targetCaptures = 24;
const entries = buildTimingEntries(targetCaptures, config);

const maxBurstCount = Math.max(...entries.map((e) => e.captures.length));

// Collect moves (total path length from general) per burst rank
const movesByRank: number[][] = [];
for (let rank = 0; rank < maxBurstCount; rank++) {
  movesByRank[rank] = [];
  for (const entry of entries) {
    if (rank >= entry.captures.length) continue;
    movesByRank[rank].push(entry.captures[rank] + entry.overlaps[rank]);
  }
}

// Build count maps per rank
const countMaps: Map<number, number>[] = movesByRank.map((moves) => {
  const m = new Map<number, number>();
  for (const d of moves) m.set(d, (m.get(d) ?? 0) + 1);
  return m;
});

const maxPathLen = Math.max(...movesByRank.flat());
const burstLabels = movesByRank.map((_, i) => `B${i + 1}`);

// --- Table 1a: Total path length by burst rank (counts) ---

console.log(
  `=== Total path length from general by burst rank (${targetCaptures} captures, ${entries.length} entries) ===`,
);
console.log(`(path length = captures + overlap)\n`);

console.log('Counts:');
{
  const headers = ['Path len', ...burstLabels];
  const rows: string[][] = [];
  for (let d = maxPathLen; d >= 1; d--) {
    const hasAny = countMaps.some((m) => (m.get(d) ?? 0) > 0);
    if (!hasAny) continue;
    rows.push([
      String(d),
      ...countMaps.map((m) => {
        const count = m.get(d) ?? 0;
        return count > 0 ? String(count) : '-';
      }),
    ]);
  }
  rows.push(['Total', ...movesByRank.map((moves) => String(moves.length))]);
  console.log(formatTable(headers, rows));
}

console.log('\nPercents:');
{
  const headers = ['Path len', ...burstLabels];
  const rows: string[][] = [];
  for (let d = maxPathLen; d >= 1; d--) {
    const hasAny = countMaps.some((m) => (m.get(d) ?? 0) > 0);
    if (!hasAny) continue;
    rows.push([
      String(d),
      ...countMaps.map((m, rank) => {
        const count = m.get(d) ?? 0;
        if (count === 0) return '-';
        const pct = (count / movesByRank[rank].length) * 100;
        return `${pct.toFixed(1)}%`;
      }),
    ]);
  }
  console.log(formatTable(headers, rows));
}

// --- Table 2: Fraction extending beyond prefix depth D ---

console.log(`\n=== Fraction of entries extending beyond prefix depth D ===`);
console.log(`(% of entries for that burst rank where path length > D)\n`);

{
  const prefixDepths = [2, 3, 4, 5];
  const headers = ['Depth', ...burstLabels];
  const rows: string[][] = prefixDepths.map((D) => [
    `D=${D}`,
    ...movesByRank.map((moves) => {
      if (moves.length === 0) return '-';
      const beyondCount = moves.filter((m) => m > D).length;
      const pct = (beyondCount / moves.length) * 100;
      return `${pct.toFixed(1)}%`;
    }),
  ]);
  console.log(formatTable(headers, rows));
}

// --- Table 3: Fraction extending beyond D, sliced by total overlap ---

console.log(
  `\n=== Fraction extending beyond prefix depth D, by total overlap budget ===`,
);
console.log(`(each sub-table filters to entries with total overlap ≤ threshold)\n`);

{
  const prefixDepths = [2, 3, 4, 5];
  const maxTotalOverlap = Math.max(
    ...entries.map((e) => e.overlaps.reduce((a, b) => a + b, 0)),
  );

  // Show each overlap threshold
  const overlapThresholds = [0];
  for (let t = 2; t <= maxTotalOverlap; t += 2) overlapThresholds.push(t);
  if (overlapThresholds[overlapThresholds.length - 1] !== maxTotalOverlap) {
    overlapThresholds.push(maxTotalOverlap);
  }

  for (const maxOvl of overlapThresholds) {
    const filtered = entries.filter(
      (e) => e.overlaps.reduce((a, b) => a + b, 0) <= maxOvl,
    );
    if (filtered.length === 0) continue;

    // Collect moves per rank for filtered entries
    const filteredMovesByRank: number[][] = [];
    for (let rank = 0; rank < maxBurstCount; rank++) {
      filteredMovesByRank[rank] = [];
      for (const entry of filtered) {
        if (rank >= entry.captures.length) continue;
        filteredMovesByRank[rank].push(entry.captures[rank] + entry.overlaps[rank]);
      }
    }

    console.log(
      `Total overlap ≤ ${maxOvl} (${filtered.length} entries, ${((filtered.length / entries.length) * 100).toFixed(1)}%):`,
    );
    const headers = ['Depth', ...burstLabels];
    const rows: string[][] = prefixDepths.map((D) => [
      `D=${D}`,
      ...filteredMovesByRank.map((moves) => {
        if (moves.length === 0) return '-';
        const beyondCount = moves.filter((m) => m > D).length;
        const pct = (beyondCount / moves.length) * 100;
        return `${pct.toFixed(1)}%`;
      }),
    ]);
    console.log(formatTable(headers, rows));
    console.log();
  }
}

// --- Burst count distribution ---

console.log('=== Burst count distribution ===');
const burstCountDist = new Map<number, number>();
for (const e of entries) {
  const n = e.captures.length;
  burstCountDist.set(n, (burstCountDist.get(n) ?? 0) + 1);
}
for (const [n, count] of [...burstCountDist.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(
    `  ${n} bursts: ${count} entries (${((count / entries.length) * 100).toFixed(1)}%)`,
  );
}
