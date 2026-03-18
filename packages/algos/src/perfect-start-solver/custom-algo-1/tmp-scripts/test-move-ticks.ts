import { getBurstInfos, getMoveTicksForBurstPattern } from '../get-burst-info';

function formatPattern(pattern: number[]): string {
  const bursts = getBurstInfos(pattern);
  const lastTick = bursts[bursts.length - 1].endTick;
  const tiles = pattern.reduce((a, b) => a + b, 0);
  const fits = lastTick <= 50 ? '✓' : '✗';

  const header = `${fits} ${JSON.stringify(pattern).padEnd(30)} tiles=${String(tiles).padEnd(4)} last=t${lastTick}`;
  const details = bursts.map((b, i) => {
    const label = `b${i + 1}`;
    const len = `(${b.burstLen})`;
    return `   - ${label} ${len.padStart(4)}: t=${b.startTick} -> t=${b.endTick}`;
  });

  return [header, ...details].join('\n');
}

// ── Tests ──

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function eq(a: number[], b: number[], label: string) {
  assert(
    a.length === b.length && a.every((v, i) => v === b[i]),
    `${label}: expected [${b}], got [${a}]`,
  );
  console.log(`  ✓ ${label}`);
}

console.log('Running tests...\n');

type TestCase = [string, { bursts: number[]; ticks: number[] }];

const testCases: TestCase[] = [
  ['single burst of 1', { bursts: [1], ticks: [3] }],
  ['single burst of 2', { bursts: [2], ticks: [5, 6] }],
  ['single burst of 3', { bursts: [3], ticks: [7, 8, 9] }],
  ['two bursts of 1', { bursts: [1, 1], ticks: [3, 5] }],
  ['burst 2 then 1', { bursts: [2, 1], ticks: [5, 6, 7] }],
  ['burst 1 then 2', { bursts: [1, 2], ticks: [3, 7, 8] }],
  ['burst 5 then 4', { bursts: [5, 4], ticks: [11, 12, 13, 14, 15, 19, 20, 21, 22] }],
];

for (let [description, { bursts, ticks }] of testCases) {
  eq(getMoveTicksForBurstPattern(bursts), ticks, description);
}

console.log('\nAll tests passed!\n');

// ── Sample output ──

console.log('Sample patterns:\n');

const samples: number[][] = [
  [16], // largest single burst that actually fits in 50 ticks
  [17], // doesn't fit in 50 ticks
  [16, 8],
  [16, 9],
  [5, 3],
  [5, 3, 2, 1],
  [3, 3, 3, 2],
  [1, 1, 1, 1, 1],
];

for (const pat of samples) {
  console.log(formatPattern(pat));
}
