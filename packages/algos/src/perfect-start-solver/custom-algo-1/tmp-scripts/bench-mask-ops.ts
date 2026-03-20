// Benchmark: BigInt masks vs number[] masks for core operations.
// Usage: npx tsx bench-mask-ops.ts

// ── BigInt ops (current) ──

function bigint_bit(tile: number): bigint {
  return 1n << BigInt(tile);
}

function bigint_hasOverlap(a: bigint, b: bigint): boolean {
  return (a & b) !== 0n;
}

function bigint_union(a: bigint, b: bigint): bigint {
  return a | b;
}

function bigint_hasBit(mask: bigint, tile: number): boolean {
  return (mask & (1n << BigInt(tile))) !== 0n;
}

// ── number[] ops (proposed) ──

type Mask = number[];

function createMaskOps(tileCount: number) {
  const width = Math.ceil(tileCount / 32);

  function empty(): Mask {
    return new Array(width).fill(0);
  }

  function bit(tile: number): Mask {
    const m = empty();
    m[tile >>> 5] = 1 << (tile & 31);
    return m;
  }

  function hasOverlap(a: Mask, b: Mask): boolean {
    for (let i = 0; i < width; i++) {
      if ((a[i] & b[i]) !== 0) return true;
    }
    return false;
  }

  function union(a: Mask, b: Mask): Mask {
    const m = new Array(width);
    for (let i = 0; i < width; i++) m[i] = a[i] | b[i];
    return m;
  }

  function hasBit(mask: Mask, tile: number): boolean {
    return (mask[tile >>> 5] & (1 << (tile & 31))) !== 0;
  }

  function popcount(mask: Mask): number {
    let count = 0;
    for (let i = 0; i < width; i++) {
      let v = mask[i];
      v = v - ((v >>> 1) & 0x55555555);
      v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
      count += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    }
    return count;
  }

  return { width, empty, bit, hasOverlap, union, hasBit, popcount };
}

// ── Benchmark harness ──

function bench(label: string, iters: number, fn: () => void): number {
  // warmup
  for (let i = 0; i < 1000; i++) fn();

  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const ms = performance.now() - t0;
  const nsPerOp = ((ms * 1_000_000) / iters).toFixed(1);
  console.log(`  ${label}: ${ms.toFixed(1)}ms total, ${nsPerOp}ns/op`);
  return ms;
}

// ── Run benchmarks ──

const ITERS = 5_000_000;

for (const tileCount of [49, 81, 121]) {
  console.log(`\n=== ${tileCount} tiles (width=${Math.ceil(tileCount / 32)}) ===`);
  const ops = createMaskOps(tileCount);

  // build some test masks (simulating typical covered + candidate masks)
  const tiles1 = [0, 3, 7, 12, 18, 24, 30, 35, 40, 44, 47, Math.min(48, tileCount - 1)];
  const tiles2 = [1, 5, 9, 14, 20, 26, 32, 37, 42, 46];
  const tiles3 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // overlaps with tiles1

  let bigA = 0n;
  let bigB = 0n;
  let bigC = 0n;
  for (const t of tiles1) bigA |= bigint_bit(t);
  for (const t of tiles2) bigB |= bigint_bit(t);
  for (const t of tiles3) bigC |= bigint_bit(t);

  let maskA = ops.empty();
  let maskB = ops.empty();
  let maskC = ops.empty();
  for (const t of tiles1) maskA = ops.union(maskA, ops.bit(t));
  for (const t of tiles2) maskB = ops.union(maskB, ops.bit(t));
  for (const t of tiles3) maskC = ops.union(maskC, ops.bit(t));

  // --- hasOverlap (no overlap) ---
  console.log('\nhasOverlap (no overlap):');
  const bigNoOvlp = bench('bigint', ITERS, () => bigint_hasOverlap(bigA, bigB));
  const maskNoOvlp = bench('number[]', ITERS, () => ops.hasOverlap(maskA, maskB));
  console.log(`  speedup: ${(bigNoOvlp / maskNoOvlp).toFixed(1)}x`);

  // --- hasOverlap (with overlap) ---
  console.log('\nhasOverlap (with overlap):');
  const bigOvlp = bench('bigint', ITERS, () => bigint_hasOverlap(bigA, bigC));
  const maskOvlp = bench('number[]', ITERS, () => ops.hasOverlap(maskA, maskC));
  console.log(`  speedup: ${(bigOvlp / maskOvlp).toFixed(1)}x`);

  // --- union ---
  console.log('\nunion:');
  const bigUnion = bench('bigint', ITERS, () => bigint_union(bigA, bigB));
  const maskUnion = bench('number[]', ITERS, () => ops.union(maskA, maskB));
  console.log(`  speedup: ${(bigUnion / maskUnion).toFixed(1)}x`);

  // --- hasBit ---
  console.log('\nhasBit (tile 35):');
  const bigHasBit = bench('bigint', ITERS, () => bigint_hasBit(bigA, 35));
  const maskHasBit = bench('number[]', ITERS, () => ops.hasBit(maskA, 35));
  console.log(`  speedup: ${(bigHasBit / maskHasBit).toFixed(1)}x`);

  // --- simulated search inner loop ---
  // This mimics what findPaths does: check N candidates against a covered mask
  const NUM_CANDIDATES = 200;
  const bigCandidates: bigint[] = [];
  const maskCandidates: Mask[] = [];
  for (let i = 0; i < NUM_CANDIDATES; i++) {
    let bg = 0n;
    let mk = ops.empty();
    // random-ish path of ~6 tiles
    for (let j = 0; j < 6; j++) {
      const tile = (i * 7 + j * 13) % tileCount;
      bg |= bigint_bit(tile);
      mk = ops.union(mk, ops.bit(tile));
    }
    bigCandidates.push(bg);
    maskCandidates.push(mk);
  }

  const LOOP_ITERS = 100_000;
  console.log(`\nscan ${NUM_CANDIDATES} candidates (×${LOOP_ITERS}):`);
  const bigScan = bench('bigint', LOOP_ITERS, () => {
    let count = 0;
    for (let i = 0; i < NUM_CANDIDATES; i++) {
      if (!bigint_hasOverlap(bigCandidates[i], bigA)) count++;
    }
    return count;
  });
  const maskScan = bench('number[]', LOOP_ITERS, () => {
    let count = 0;
    for (let i = 0; i < NUM_CANDIDATES; i++) {
      if (!ops.hasOverlap(maskCandidates[i], maskA)) count++;
    }
    return count;
  });
  console.log(`  speedup: ${(bigScan / maskScan).toFixed(1)}x`);
}
