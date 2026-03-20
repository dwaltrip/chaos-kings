# Custom Algo Session — 2026-03-19

## Background

See dev-notes/2026-03/3-18-[1]-notes-for-custom-algo-burst-path-search.md
for the algorithm design and open questions that motivated this session.

## What we did

### 1. Built the burst-path combinatorial search POC

Implemented the core algorithm from the notes doc. Given a burst pattern
like `[10, 8, 4, 2]`, finds non-overlapping paths from the general that
match each burst length.

Key files created:
- `bitmask.ts` — BigInt bitmask helpers (tilesToMask, maskToTiles, hasOverlap, popcount)
- `path-search.ts` — `buildPathEntries` (strips general, builds masks) + `findPaths` (recursive backtracking search)
- `tools/check-burst-timing.ts` — CLI: `npx tsx check-burst-timing.ts "10,8,4,2"`
- `tmp-scripts/test-path-search.ts` — multi-board POC runner

First result: finds a valid 24-capture assignment on open-11×11 in **0.2ms**
with only 4 nodes visited. The bitmask overlap check makes the inner loop
extremely fast.

### 2. Fixed mountain handling bug

`genPathsDP` wasn't checking tile types — paths went straight through
mountains. Added `TileType.MOUNTAIN` check. Path counts dropped
significantly on walled boards (e.g., sparse-mtns-11×11: 32K → 4.3K at
length 10).

### 3. Rewrote burst pattern generator

Original `genBurstLengthPatterns` hard-coded the first burst as maxLen
(always 16), missing most valid patterns. Rewrote as `genDescendingPartitions`
— enumerates all descending-order partitions of a target sum, filtered by
tick timing via `getBurstInfos`.

Key finding: **zero** valid patterns sum to 25 captures within 50 ticks.
Max capturable is 24 (the 25th tile is the general itself). 807 valid
patterns for total=24.

### 4. Built the full solver

`solver.ts` ties everything together:
- Iterates capture counts from highest (24) down to minimum (15)
- For each, generates valid burst patterns and runs path search
- Returns first valid solution (optimal by construction)

Results on all 8 test boards (maxBurst=12):
- Open boards (7×7, 9×9, 11×11): 24 captures, pattern [12,7,3,2], <1s
- Sparse-mtns boards: 24 captures, <100ms
- Corridor-7×7: 23 captures, checked 807 patterns, ~1.5s
- Maze-7×7: 23 captures, checked 807 patterns, ~8ms

### 5. Optimized genPathsDP memory usage

Original version stored all `PathWS` objects (with `Set`s) across all
levels — OOMed on open-11×11 at length 14. Refactored:
- Replaced `Set` membership checks with bitmask (`bigint`)
- Only keep previous level's working objects (drop earlier levels)
- Keep masks in output (avoid recomputing in `buildPathEntries`)
- Eliminated `.flat()` and `.concat()` intermediate allocations

Still OOMs at length 14+ on open-11×11 due to sheer path count (~370K).
Capped `maxBurst` at 12 for now. Further optimization deferred.

### 6. Added tests

48 Jest tests across 7 files covering bitmask, burst-info, burst-patterns,
gen-paths, path-search, and solver. All passing.

## Key observations

- **Bitmask approach is extremely effective.** Single BigInt AND for overlap
  checks, no allocation in the hot loop. The search is essentially free
  on open boards.
- **Path generation is the bottleneck**, not the combinatorial search.
  Generating paths grows ~2.5× per length. Length 12 on open-11×11 is
  ~60K paths (fine); length 14 is ~370K (OOM).
- **The solver finds solutions on the very first pattern tried** for all
  open/sparse boards. Only constrained boards (corridor, maze) require
  searching through hundreds of patterns.

## Open questions / next steps

- **Overlap re-traversal**: Later bursts may need to cross already-owned
  tiles to reach uncaptured territory. Not yet implemented. Key for
  constrained boards like corridor-7×7 where paths must go through the
  wall gap.
- **Path count scaling**: Need a strategy for maxBurst > 12 on large open
  boards. Options: cap max burst, generate paths lazily, prune paths
  during generation.
- **Solver could try patterns with shorter max bursts first** to avoid
  expensive path generation for patterns that are unlikely to work.
- **Corridor-7×7 currently gets 23** — may reach 24 with re-traversal.

## File inventory

```
custom-algo-1/
  bitmask.ts              — BigInt bitmask helpers
  burst-patterns.ts       — Descending partition generator + timing filter
  gen-paths.ts            — DP path enumeration from general
  get-burst-info.ts       — Burst timing model (unchanged this session)
  path-search.ts          — buildPathEntries + findPaths (backtracking search)
  solver.ts               — Full solver (iterates patterns × path search)
  run.ts                  — CLI runner (typed-command)
  __tests__/              — Jest tests (48 tests, 7 files)
  tools/                  — Reusable CLI tools (check-burst-timing, profile-search-detail)
  tmp-scripts/            — Ad-hoc scripts (test-*)
```
