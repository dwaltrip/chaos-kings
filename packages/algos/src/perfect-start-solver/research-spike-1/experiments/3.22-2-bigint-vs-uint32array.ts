// Thread 4: BigInt vs Uint32Array bitmask benchmark
// Benchmark core bitmask ops at realistic mask sizes (625, 900, 1600 bits).
// Measures the hot-path pattern from the solver's inner loop.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.22-2-bigint-vs-uint32array.ts

import { formatTable } from '../../format';

// ── Uint32Array bitmask implementation ──

function u32Words(bits: number): number {
  return Math.ceil(bits / 32);
}

function u32Create(bits: number): Uint32Array {
  return new Uint32Array(u32Words(bits));
}

function u32SetBit(mask: Uint32Array, bit: number): void {
  mask[bit >>> 5] |= 1 << (bit & 31);
}

function u32HasOverlap(a: Uint32Array, b: Uint32Array): boolean {
  for (let i = 0; i < a.length; i++) {
    if ((a[i] & b[i]) !== 0) return true;
  }
  return false;
}

function u32Popcount(mask: Uint32Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    let v = mask[i];
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    count += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  return count;
}

function u32And(a: Uint32Array, b: Uint32Array, out: Uint32Array): void {
  for (let i = 0; i < a.length; i++) out[i] = a[i] & b[i];
}

function u32Or(a: Uint32Array, b: Uint32Array, out: Uint32Array): void {
  for (let i = 0; i < a.length; i++) out[i] = a[i] | b[i];
}

function u32AndNot(a: Uint32Array, b: Uint32Array, out: Uint32Array): void {
  for (let i = 0; i < a.length; i++) out[i] = a[i] & ~b[i];
}

function u32PopcountAnd(a: Uint32Array, b: Uint32Array): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    let v = a[i] & b[i];
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    count += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  return count;
}

// ── BigInt helpers (matching solver) ──

function bigintPopcount(mask: bigint): number {
  let count = 0;
  let m = mask;
  while (m > 0n) {
    m &= m - 1n;
    count++;
  }
  return count;
}

// ── Test data generation ──

function randomBigintMask(totalBits: number, setBits: number): bigint {
  let mask = 0n;
  const positions = new Set<number>();
  while (positions.size < setBits) {
    positions.add(Math.floor(Math.random() * totalBits));
  }
  for (const p of positions) {
    mask |= 1n << BigInt(p);
  }
  return mask;
}

function bigintToU32(mask: bigint, totalBits: number): Uint32Array {
  const words = u32Words(totalBits);
  const arr = new Uint32Array(words);
  for (let i = 0; i < words; i++) {
    arr[i] = Number(mask & 0xffffffffn);
    mask >>= 32n;
  }
  return arr;
}

// ── Benchmark harness ──

interface BenchResult {
  name: string;
  opsPerSec: number;
  nsPerOp: number;
}

function bench(name: string, fn: () => void, iters: number): BenchResult {
  // Warmup
  for (let i = 0; i < Math.min(iters, 10000); i++) fn();

  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const elapsed = performance.now() - t0;

  const nsPerOp = (elapsed * 1e6) / iters;
  return { name, opsPerSec: (iters / elapsed) * 1000, nsPerOp };
}

// ── Benchmark suite ──

interface SuiteConfig {
  totalBits: number;
  label: string;
}

function runSuite(config: SuiteConfig) {
  const { totalBits, label } = config;
  const ITERS = 500_000;

  // Generate test data: simulate solver inner loop.
  // coveredMask: ~30% of tiles covered (mid-search state)
  // candMask: 12 tiles set (a path)
  const coveredBits = Math.floor(totalBits * 0.3);
  const pathBits = 12;

  const NUM_CANDS = 100;
  const coveredBigint = randomBigintMask(totalBits, coveredBits);
  const coveredU32 = bigintToU32(coveredBigint, totalBits);
  const candsBigint: bigint[] = [];
  const candsU32: Uint32Array[] = [];
  for (let i = 0; i < NUM_CANDS; i++) {
    const m = randomBigintMask(totalBits, pathBits);
    candsBigint.push(m);
    candsU32.push(bigintToU32(m, totalBits));
  }

  const tmpU32 = u32Create(totalBits);
  const results: BenchResult[] = [];

  // Sinks to prevent dead code elimination.
  // Accumulate into these; check after all benches to ensure they're used.
  let sinkInt = 0;
  let sinkBigint = 0n;

  // 1. Overlap check: (a & b) !== 0
  let ci = 0;
  results.push(
    bench(
      `${label} BigInt overlap`,
      () => {
        const c = candsBigint[ci++ % NUM_CANDS];
        if ((c & coveredBigint) !== 0n) sinkInt++;
      },
      ITERS,
    ),
  );
  ci = 0;
  results.push(
    bench(
      `${label} U32    overlap`,
      () => {
        const c = candsU32[ci++ % NUM_CANDS];
        if (u32HasOverlap(c, coveredU32)) sinkInt++;
      },
      ITERS,
    ),
  );

  // 2. Popcount of AND: popcount(a & b)
  ci = 0;
  results.push(
    bench(
      `${label} BigInt popcnt(a&b)`,
      () => {
        const c = candsBigint[ci++ % NUM_CANDS];
        sinkInt += bigintPopcount(c & coveredBigint);
      },
      ITERS,
    ),
  );
  ci = 0;
  results.push(
    bench(
      `${label} U32    popcnt(a&b)`,
      () => {
        const c = candsU32[ci++ % NUM_CANDS];
        sinkInt += u32PopcountAnd(c, coveredU32);
      },
      ITERS,
    ),
  );

  // 3. Union: a | b
  ci = 0;
  results.push(
    bench(
      `${label} BigInt union`,
      () => {
        const c = candsBigint[ci++ % NUM_CANDS];
        sinkBigint = coveredBigint | c;
      },
      ITERS,
    ),
  );
  ci = 0;
  results.push(
    bench(
      `${label} U32    union`,
      () => {
        const c = candsU32[ci++ % NUM_CANDS];
        u32Or(c, coveredU32, tmpU32);
        sinkInt += tmpU32[0];
      },
      ITERS,
    ),
  );

  // 4. AND-NOT: a & ~b
  ci = 0;
  results.push(
    bench(
      `${label} BigInt and-not`,
      () => {
        const c = candsBigint[ci++ % NUM_CANDS];
        sinkBigint = c & ~coveredBigint;
      },
      ITERS,
    ),
  );
  ci = 0;
  results.push(
    bench(
      `${label} U32    and-not`,
      () => {
        const c = candsU32[ci++ % NUM_CANDS];
        u32AndNot(c, coveredU32, tmpU32);
        sinkInt += tmpU32[0];
      },
      ITERS,
    ),
  );

  // 5. Hot-path combo: overlap check + branch + union (the actual solver pattern)
  ci = 0;
  results.push(
    bench(
      `${label} BigInt hot-path`,
      () => {
        const c = candsBigint[ci++ % NUM_CANDS];
        if ((c & coveredBigint) !== 0n) return;
        sinkBigint = coveredBigint | c;
      },
      ITERS,
    ),
  );
  ci = 0;
  results.push(
    bench(
      `${label} U32    hot-path`,
      () => {
        const c = candsU32[ci++ % NUM_CANDS];
        if (u32HasOverlap(c, coveredU32)) return;
        u32Or(c, coveredU32, tmpU32);
        sinkInt += tmpU32[0];
      },
      ITERS,
    ),
  );

  // Prevent global DCE of sinks
  if (sinkInt === -999 && sinkBigint === -999n) console.log('unreachable');

  return results;
}

// ── Main ──

function main() {
  const suites: SuiteConfig[] = [
    { totalBits: 49, label: ' 49b' }, // 7x7 (baseline, fits in ~2 words)
    { totalBits: 169, label: '169b' }, // 13x13
    { totalBits: 625, label: '625b' }, // 25x25
    { totalBits: 900, label: '900b' }, // 30x30
    { totalBits: 1600, label: '1.6k' }, // 40x40
    { totalBits: 2500, label: '2.5k' }, // 50x50 (stretch)
  ];

  console.log('# BigInt vs Uint32Array Bitmask Benchmark\n');
  console.log(`Platform: ${process.platform} ${process.arch}, Node ${process.version}`);
  console.log(`500K iterations per benchmark, 100 candidate masks per set\n`);

  const allResults: BenchResult[] = [];
  for (const suite of suites) {
    console.log(
      `Running ${suite.label} (${suite.totalBits} bits, ${u32Words(suite.totalBits)} u32 words)...`,
    );
    allResults.push(...runSuite(suite));
  }

  // Per-size results: side-by-side BigInt vs U32
  const ops = ['overlap', 'popcnt(a&b)', 'union', 'and-not', 'hot-path'];

  for (const suite of suites) {
    const label = suite.label.trim();
    console.log(
      `\n## ${label} (${suite.totalBits} bits, ${u32Words(suite.totalBits)} u32 words)\n`,
    );
    const headers = ['Operation', 'BigInt ns', 'U32 ns', 'U32 speedup'];
    const rows = ops.map((op) => {
      const bi = allResults.find(
        (r) =>
          r.name.includes(suite.label) &&
          r.name.includes('BigInt') &&
          r.name.includes(op),
      );
      const u3 = allResults.find(
        (r) =>
          r.name.includes(suite.label) && r.name.includes('U32') && r.name.includes(op),
      );
      if (!bi || !u3) return [op, '-', '-', '-'];
      const speedup = bi.nsPerOp / u3.nsPerOp;
      const arrow = speedup >= 1.1 ? ' <<' : speedup <= 0.9 ? ' >>' : '';
      return [
        op,
        bi.nsPerOp.toFixed(0),
        u3.nsPerOp.toFixed(0),
        speedup.toFixed(2) + 'x' + arrow,
      ];
    });
    console.log(formatTable(headers, rows));
  }

  // Cross-size comparison table
  console.log('\n## U32 Speedup Summary (across sizes)\n');
  const sizes = suites.map((s) => s.label.trim());
  const compHeaders = ['Operation', ...sizes];
  const compRows = ops.map((op) => {
    const cells = suites.map((s) => {
      const bigint = allResults.find(
        (r) =>
          r.name.includes(s.label) && r.name.includes('BigInt') && r.name.includes(op),
      );
      const u32 = allResults.find(
        (r) => r.name.includes(s.label) && r.name.includes('U32') && r.name.includes(op),
      );
      if (!bigint || !u32) return '-';
      return (bigint.nsPerOp / u32.nsPerOp).toFixed(2) + 'x';
    });
    return [op, ...cells];
  });
  console.log(formatTable(compHeaders, compRows));
}

main();
