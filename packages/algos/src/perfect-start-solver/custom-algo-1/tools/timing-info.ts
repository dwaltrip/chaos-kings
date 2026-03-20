import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { buildTimingEntries, type TimingEntry } from './timing-table';

interface Options {
  captures: string;
  maxBurst: string;
  maxBursts: string;
  maxOverlap: string;
  groups: boolean;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('timing-info')
    .description('Timing table stats: entry counts, grouping, overlap distribution')
    .option('--captures <range>', 'Capture target(s), e.g. "24" or "20-24"', '24')
    .option('--max-burst <n>', 'Max burst length', '12')
    .option('--max-bursts <n>', 'Max number of bursts', '6')
    .option('--max-overlap <n>', 'Max overlap per burst', '3')
    .option('--groups', 'Show burst-1 group breakdown', false),
);

const maxBurst = Number(opts.maxBurst);
const maxBursts = Number(opts.maxBursts);
const maxOverlap = Number(opts.maxOverlap);

const [lo, hi] = opts.captures.includes('-')
  ? opts.captures.split('-').map(Number)
  : [Number(opts.captures), Number(opts.captures)];

const cfg = { maxTicks: 50, maxBurst, maxBursts, maxOverlapPerBurst: maxOverlap };

function totalOverlap(e: TimingEntry): number {
  let s = 0;
  for (const o of e.overlaps) s += o;
  return s;
}

for (let captures = hi; captures >= lo; captures--) {
  const t0 = performance.now();
  const entries = buildTimingEntries(captures, cfg);
  const buildMs = performance.now() - t0;

  const zeroOvl = entries.filter((e) => e.overlaps.every((o) => o === 0)).length;
  const patterns = new Set(entries.map((e) => e.captures.join(','))).size;

  // overlap distribution
  const ovlDist = new Map<number, number>();
  for (const e of entries) {
    const tot = totalOverlap(e);
    ovlDist.set(tot, (ovlDist.get(tot) ?? 0) + 1);
  }

  // burst count distribution
  const burstDist = new Map<number, number>();
  for (const e of entries) {
    const k = e.captures.length;
    burstDist.set(k, (burstDist.get(k) ?? 0) + 1);
  }

  console.log(`=== ${captures} captures ===`);
  console.log(
    `  ${entries.length} entries, ${patterns} base patterns, ` +
      `${zeroOvl} zero-overlap (built in ${buildMs.toFixed(0)}ms)`,
  );

  const burstKeys = [...burstDist.keys()].sort((a, b) => a - b);
  console.log(
    `  By burst count: ${burstKeys.map((k) => `${k}b=${burstDist.get(k)}`).join(', ')}`,
  );

  const ovlKeys = [...ovlDist.keys()].sort((a, b) => a - b);
  const ovlStr = ovlKeys.map((k) => `${k}=${ovlDist.get(k)}`).join(', ');
  console.log(`  By total overlap: ${ovlStr}`);

  if (opts.groups) {
    console.log(`  Burst-1 groups:`);

    const byB1 = new Map<number, TimingEntry[]>();
    for (const e of entries) {
      const b1 = e.captures[0];
      if (!byB1.has(b1)) byB1.set(b1, []);
      byB1.get(b1)!.push(e);
    }

    for (const [b1, group] of [...byB1.entries()].sort((a, b) => b[0] - a[0])) {
      const gPatterns = new Set(group.map((e) => e.captures.join(','))).size;
      const gZeroOvl = group.filter((e) => e.overlaps.every((o) => o === 0)).length;

      // distinct burst-2+ move lengths needed
      const b2Lens = new Set<number>();
      for (const e of group) {
        for (let i = 1; i < e.captures.length; i++) {
          b2Lens.add(e.captures[i] + e.overlaps[i]);
        }
      }
      const b2Str = [...b2Lens].sort((a, b) => b - a).join(',');

      console.log(
        `    b1=${b1}: ${group.length} entries, ${gPatterns} patterns, ` +
          `${gZeroOvl} zero-ovl, b2+ lens=[${b2Str}]`,
      );
    }
  }

  console.log();
}
