# Session: SA swap optimization + numeric fingerprint

Branch: `solver-n-core-next-perf`

## What we did

### 1. SA acceptance swap (commit 6c61fff)

Replaced cloneBoard on SA acceptance path with a reference swap between scratch and stateCache arrays. Added `recycleAndSwap` helper with null-out safety.

Also switched to in-place mutation of `current.moves[t]` (restored on rejection) to eliminate the `[...current.moves]` spread every iteration.

**SA results (avg time, 3 seeds):**

| Board | Iters | Before | After | Speedup |
|-------|-------|--------|-------|---------|
| open-7x7 | 50k | 0.41s | 0.26s | 1.58x |
| open-7x7 | 500k | 3.84s | 2.58s | 1.49x |
| open-11x11 | 50k | 0.57s | 0.31s | 1.84x |
| open-11x11 | 500k | 5.66s | 3.07s | 1.84x |
| sparse-mtns-7x7 | 50k | 0.38s | 0.26s | 1.46x |
| sparse-mtns-7x7 | 500k | 3.91s | 2.58s | 1.52x |
| sparse-mtns-11x11 | 50k | 0.55s | 0.31s | 1.77x |
| sparse-mtns-11x11 | 500k | 5.60s | 3.07s | 1.82x |

Larger boards benefit more — clone cost scales with board size, swap is constant-time.

### 2. Numeric FNV-1a fingerprint (commit d559278)

Replaced string-based `fingerprintState` (Uint8Array alloc + `String.fromCharCode` spread + `Set<string>`) with dual FNV-1a hash producing a 53-bit safe integer + `Set<number>`.

Consolidated three duplicate implementations into shared `fingerprintState` (lossless) and `fingerprintStateClamped` (lossy, for beam search) in `moves.ts`.

**Beam search results (beam=50):**

| Board | Scorer | Before | After | Speedup |
|-------|--------|--------|-------|---------|
| open-7x7 | land-only | 51ms | 36ms | 1.42x |
| sparse-mtns-7x7 | land-only | 39ms | 26ms | 1.50x |
| open-11x11 | land-only | 86ms | 48ms | 1.79x |
| sparse-mtns-11x11 | frontier-5 | 109ms | 76ms | 1.43x |

Biggest wins on land-only where dedup was 69-86% of runtime.

## Current SA profile (100k iters, open-7x7)

| Bucket | % |
|--------|---|
| processStep | 38.5% |
| cloneBoard (copyInto) | 33.1% |
| unaccounted | 21.3% |
| genMoves | 6.7% |

## Remaining ideas from handoff

- **Dirty-slot copyInto** — only copy changed tiles instead of full `.set()` (targets 33% copyInto)
- **Profile within processStep** — split move logic vs production
- **Incremental move generation** — maintain movable tiles set (targets 6.7% genMoves, benefits all solvers)
- **SA stateCache sharing** — avoid redundant simulation when boards converge
