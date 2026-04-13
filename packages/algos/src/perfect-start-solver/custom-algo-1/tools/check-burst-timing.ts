// Check timing for a burst pattern.
// Usage: tools/run-from-algos.sh check-burst-timing.ts "10,8,4,2"
//        tools/run-from-algos.sh check-burst-timing.ts "12,6,4,2" --overlap "0,1,0,0"

import { getBurstInfosFromSpecs, type BurstSpec } from '../get-burst-info';

const raw = process.argv[2];
if (!raw) {
  console.log('Usage: npx tsx check-burst-timing.ts "10,8,4,2" [--overlap "0,1,0,0"]');
  process.exit(1);
}

const captures = raw.split(',').map(Number);

const ovlIdx = process.argv.indexOf('--overlap');
const overlaps =
  ovlIdx >= 0 ? process.argv[ovlIdx + 1].split(',').map(Number) : captures.map(() => 0);

const specs: BurstSpec[] = captures.map((c, i) => ({
  captures: c,
  moves: c + (overlaps[i] ?? 0),
}));

const infos = getBurstInfosFromSpecs(specs, 50);
if (!infos) {
  console.log('✗ Does not fit in 50 ticks');
  process.exit(0);
}

const totalCaptures = captures.reduce((a, b) => a + b, 0);
const totalOverlap = overlaps.reduce((a, b) => a + b, 0);
const lastTick = infos[infos.length - 1].endTick;
const fits = lastTick <= 50 ? '✓' : '✗';

const overlapStr = totalOverlap > 0 ? ` overlap=[${overlaps}]` : '';
console.log(
  `${fits} captures=[${captures}]${overlapStr}  ${totalCaptures} tiles (+1 general = ${totalCaptures + 1} land)  last=t${lastTick}`,
);
for (const [i, b] of infos.entries()) {
  const spec = specs[i];
  const ovlStr =
    spec.moves > spec.captures
      ? ` (${spec.captures}cap+${spec.moves - spec.captures}ovlp)`
      : '';
  console.log(
    `   b${i + 1} (${String(spec.moves).padStart(2)}mv): t=${b.startTick} -> t=${b.endTick}${ovlStr}`,
  );
}
