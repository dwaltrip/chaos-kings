import { getBurstInfos } from '../get-burst-info';

const raw = process.argv[2];
if (!raw) {
  console.log('Usage: npx tsx check-burst-timing.ts "10,8,4,2"');
  process.exit(1);
}

const pattern = raw.split(',').map(Number);
const bursts = getBurstInfos(pattern);
const lastTick = bursts[bursts.length - 1].endTick;
const tiles = pattern.reduce((a, b) => a + b, 0);
const fits = lastTick <= 50 ? '✓' : '✗';

console.log(
  `${fits} ${JSON.stringify(pattern).padEnd(30)} tiles=${tiles} (+1 general = ${tiles + 1} land)  last=t${lastTick}`,
);
for (const [i, b] of bursts.entries()) {
  console.log(
    `   b${i + 1} (${String(b.burstLen).padStart(2)}): t=${b.startTick} -> t=${b.endTick}`,
  );
}
