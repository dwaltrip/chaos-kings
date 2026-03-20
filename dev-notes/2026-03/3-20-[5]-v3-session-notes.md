# Solver v3 Session Notes — 2026-03-20

## What we did

### 1. Built profiling tools

- `tools/profile-solve.ts` — per-capture-level profiling with timeout,
  shows entries searched/skipped/total per level. Reusable CLI tool.
- `tmp-scripts/find-max-score.ts` — throwaway wrapper to find highest
  achievable score per board.
- Added `--max-bursts` flag to `run.ts`.

### 2. Ran experiments

**maxBursts=6 vs 8:** Same scores on all boards tested (corridor-7x7,
maze-7x7, dense-mtns-9x9). maxBursts=8 just searches more entries.
Confirmed maxBursts=6 is safe.

**profile-solve on hard boards:**

```
=== corner-9x9 ===
  60,146 paths (generated in 50ms)
  24 cap: timeout (5000ms) — 140/5425 searched (3%), 0 skipped, 5369ms
  23 cap: timeout (5000ms) — 47/34724 searched (0%), 0 skipped, 5074ms
  22 cap: timeout (5000ms) — 54/75609 searched (0%), 0 skipped, 5088ms
  21 cap: timeout (5000ms) — 85/96613 searched (0%), 0 skipped, 5012ms
  20 cap: FOUND — 1/98420 searched (0%), 0 skipped, 31ms

=== edge-9x9 ===
  115,674 paths (generated in 69ms)
  24 cap: timeout (5000ms) — 1/5425 searched (0%), 0 skipped, 6031ms
  23 cap: FOUND — 1/34724 searched (0%), 0 skipped, 11ms

=== double-corridor-9x9 ===
  7,013 paths (generated in 4ms)
  24 cap: FOUND — 140/5425 searched (3%), 0 skipped, 3668ms
```

Note: corner-9x9 finding 20 at entry #1 just means that capture level
has enough slack that the first entry works. It does NOT mean 20 is
the max — v2 timed out at 21-24 without exhausting the search space.

### 3. Built solver-v3

Grouped iteration with forward checking, following the design sketch
in 3-20-[3]. Groups timing entries by burst-1 move length, shares
burst-1 path picks across entries within a group.

Key components:
- `buildTimingGroups` — groups entries by burst-1 length, sorts
  groups longest-first, entries sorted by total overlap within group
- `hasViableBurst2` — forward check: does burst-2 have at least one
  compatible candidate given this burst-1 path?
- `searchRemaining` — same backtracking as v2's findPathsFixed,
  starting at burstIdx=1

### 4. Bug fixes

- **OOM bug in run.ts:** `--max-bursts` defaulted to empty string,
  became `undefined`, clobbered `DEFAULT_CONFIG.maxBursts` via spread.
  Caused `genDescendingPartitions` to use unlimited parts → OOM.
  Fixed by conditionally spreading. Also added default `maxParts=8`
  to `genDescendingPartitions` as a safety net.
- Made `--board` and `--solver` required flags in run.ts (no defaults).

## Results — v2 vs v3

| Board              | v2      | v3    | Speedup |
|--------------------|---------|-------|---------|
| open-7x7           | 76ms    | 44ms  | 1.7x    |
| sparse-mtns-7x7    | 9ms     | 8ms   | ~same   |
| corridor-7x7       | 1099ms  | 10ms  | 110x    |
| maze-7x7           | 5ms     | 4ms   | ~same   |
| open-9x9           | 125ms   | 120ms | ~same   |
| sparse-mtns-9x9    | 10ms    | 9ms   | ~same   |
| dense-mtns-9x9     | 8ms     | 5ms   | 1.6x    |
| maze-9x9           | 4ms     | 5ms   | ~same   |
| pinch-9x9          | 27ms    | 32ms  | ~same   |
| corridor-11x11     | 71ms    | 63ms  | ~same   |
| double-corridor-9x9| 3669ms  | 8ms   | 460x    |
| open-11x11         | 198ms   | 188ms | ~same   |
| sparse-mtns-11x11  | 22ms    | 20ms  | ~same   |
| edge-9x9           | >60s    | 197ms | solved  |
| corner-9x9         | >60s    | 237s  | finishes|

## corner-9x9 v3 profile

```
=== corner-9x9 ===
  60,146 total paths
    len 12: 36,048
    len 11: 14,496
    len 10: 5,778
    len  9: 2,300
    len  8: 912
    len  7: 366
    len  6: 146
    len  5: 60
    len  4: 24
    len  3: 10
    len  2: 4
    len  1: 2

--- 24 captures: 5425 entries, 8 groups ---
  b1=12: miss — 36048 cands (1% fully pruned), 23 viable entries,
    679404 entries searched, 30440ms
    fwd checks: 829104, pruned: 149700, search calls: 26188316
  b1=11: miss — 14496 cands (0% fully pruned), 217 viable entries,
    2643016 entries searched, 241204ms
    fwd checks: 3145632, pruned: 502616, search calls: 133497740
  b1=10: FOUND at cand 1/5778, 471 entries searched, 197ms
    fwd checks: 471, pruned: 0, search calls: 163386
  → FOUND in 271854ms, 3322891 entries checked total

Search calls by depth: 3322891, 66060923, 77114812, 13350678, 138
```

Highlights:
- Solution is in b1=10 group, found at candidate 1 in 197ms
- b1=12 and b1=11 are exhausted first, wasting 271s (99.9% of time)
- Forward checking prunes ~0-1% of candidates — nearly useless here
- b1=11 dominates: 14.5K cands × 217 entries = 133M search calls, 241s
- b1=12 is expensive too: 36K cands × 23 entries = 26M search calls, 30s
- ~160M total search calls, overwhelmingly at depths 1-2 (66M + 77M)

## File inventory

### New files
- `solver-v3.ts` — grouped iteration solver
- `tools/profile-solve.ts` — per-capture-level profiling tool
- `tmp-scripts/find-max-score.ts` — throwaway score finder
- `tmp-scripts/profile-v3.ts` — v3-specific profiling script

### Modified files
- `run.ts` — added v3 support, `--max-bursts` flag, required flags
- `burst-patterns.ts` — default `maxParts=8` on `genDescendingPartitions`
