# Solver v2 Performance Analysis — 2026-03-20

## Background

Built solver-v2 with precomputed timing tables (see 3-20-[1]). Added 7
new test boards: corner-9x9, edge-9x9, double-corridor-9x9,
dense-mtns-9x9, maze-9x9, pinch-9x9, corridor-11x11. Ran both solvers
to compare. This doc is the analysis of what we found.

## Results

| Board              | v1     | v2     | Entries | Notes                       |
|--------------------|--------|--------|---------|-----------------------------|
| open-7x7           | 54ms   | 42ms   | 1       | Same paths                  |
| sparse-mtns-7x7    | 4ms    | 10ms   | 1       | Same paths                  |
| corridor-7x7       | 1527ms | 1096ms | 140     | Same paths, v2 28% faster   |
| maze-7x7           | 1ms    | 5ms    | 2/148   | Different pattern, same score |
| open-9x9           | 119ms  | 125ms  | 1       | Same paths                  |
| sparse-mtns-9x9    | 7ms    | 10ms   | 1       | Same paths                  |
| dense-mtns-9x9     | —      | 13ms   | 18      |                             |
| maze-9x9           | —      | 7ms    | 1       |                             |
| pinch-9x9          | —      | 52ms   | 1       |                             |
| corridor-11x11     | —      | 60ms   | 1       |                             |
| double-corridor-9x9| —      | 3939ms | 140     | Slow — forced overlap       |
| open-11x11         | 191ms  | 219ms  | 1       | Same paths                  |
| sparse-mtns-11x11  | 16ms   | 19ms   | 1       | Same paths                  |
| corner-9x9         | —      | >60s   | ?       | Never finished              |
| edge-9x9           | —      | >60s   | ?       | Never finished              |

## Two completely different bottlenecks

| Board type              | Bottleneck       | Where time goes                     |
|-------------------------|------------------|-------------------------------------|
| Open, center general    | Path generation  | genPathsDP + buildPathEntries       |
| Chokepoint/off-center   | Search space     | Backtracking in findPaths/Fixed     |

Open/center boards solve on entry #1 in <1ms. All their time is path
generation, which neither v1 nor v2 addresses. But they're already fast
enough (100-200ms).

The hard boards are chokepoint or off-center boards where the search
grinds through many entries and many candidates.

## Path counts by board

| Board              | Len 7  | Len 12  | Total   |
|--------------------|--------|---------|---------|
| dense-mtns-9x9     | 33     | 17      | 293     |
| maze-9x9           | 29     | 46      | 270     |
| corridor-7x7       | 223    | 1,758   | 5,125   |
| double-corridor-9x9| 288    | 2,444   | 7,013   |
| pinch-9x9          | 808    | 15,764  | 36,652  |
| corner-9x9         | 366    | 36,048  | 60,146  |
| edge-9x9           | 809    | 67,606  | 115,674 |
| open-9x9           | 1,816  | 95,680  | 176,752 |

Constrained boards (dense, maze) have tiny path sets — search is
trivially fast regardless of approach. The problem boards are open
boards with many paths AND overlap needed.

## What v2's timing table actually buys

Eliminates `simulateOneBurst` calls in the hot loop. The 3/20 profiling
showed 1.6M calls with ~85 distinct inputs on corridor-7x7.

Result: **28% speedup on corridor** (1527→1096ms).

That means **72% of corridor's time is pure spatial backtracking**, not
timing. Eliminating timing is good but not the dominant cost.

## v2's critical weakness: redundant burst-1 work

At 24 captures there are 5,425 timing entries but only **8 distinct
burst-1 move lengths**:

| burst-1 moves | Entries sharing this |
|---------------|---------------------|
| 12            | 23                  |
| 11            | 217                 |
| 10            | 497                 |
| 9             | 1,073               |
| 8             | 1,234               |
| 7             | 1,237               |
| 6             | 904                 |
| 5             | 240                 |

v2 re-searches the burst-1 candidate set for each entry independently.
That's **5,417 redundant burst-1 searches**.

On corridor-7x7 (1,758 paths at len 12) this is tolerable. On
corner-9x9 (36K paths at len 12) or edge-9x9 (67K at len 12), it's
catastrophic: 5,425 entries × 36-67K burst-1 candidates.

v1 avoids this: `findPaths` picks a burst-1 path, then explores all
overlap combos for bursts 2+ before backtracking. But v1 only shares
within a single base pattern — pattern [12,7,3,2] and [12,6,4,2] both
search burst-1 at len 12 independently.

## v1's overlap loop ordering vs v2's flat sort

v2 sorts all entries by total overlap. All 139 zero-overlap entries at
24 captures are tried before any overlap entry. For boards that need
overlap, this front-loads 139 guaranteed failures.

v1's DFS order is better here: for pattern [12,6,4,2], it tries
burst-2 overlap=0, then overlap=1, overlap=2 — reusing the same
burst-1 path. Finds the overlap=1 solution without re-searching
burst-1.

## Timing table size at lower capture targets

| Captures | Entries | Zero-overlap |
|----------|---------|--------------|
| 24       | 5,425   | 139          |
| 23       | 34,724  | 262          |
| 22       | 75,609  | 285          |
| 21       | 96,613  | 266          |
| 20       | 98,420  | 240          |

If a board can't solve at 24 (corner-9x9 likely), v2 grinds through
5,425 + 34,724 + 75,609 + ... entries. Each entry triggers a full
backtracking search. This is why corner/edge never finish.

## Assumptions verified

**"simulateOneBurst is the main bottleneck"** — Partially true. It was
the plurality cost on corridor-7x7, but only ~28% of total runtime.
The spatial backtracking is the larger cost. A simple memoization of
simulateOneBurst (Map on ~85 distinct inputs) would capture most of
v2's timing benefit with zero structural change.

**"Zero-overlap first is optimal ordering"** — True for finding any
solution fast, but the flat-table approach tries ALL zero-overlap
entries before ANY overlap entries across ALL patterns. v1's per-pattern
DFS finds overlap solutions faster when they're needed.

**"Timing table is small enough"** — True at 24 captures (5,425). At
23 it's 34K, at 22 it's 75K. Impractical for exhaustive flat iteration
on boards with large path sets.

**"maxBursts=6 covers optimal solutions"** — True for all current test
boards (all use 4 bursts). Not yet verified on corner/edge since they
didn't finish.

**"Overlap is prefix-only in optimal solutions"** — Assumed, not
proven. Non-prefix overlap (owned→new→owned→new) is rejected by
`countPrefixOverlap`. If optimal solutions require it, the solver
misses them. Hard to verify without a reference solver.

## Proposed: grouped iteration (v3)

Best of both v1 and v2. Precompute timing table, then group entries by
burst-1 move length and share burst-1 path picks across the group:

```
for each burst-1 move length (8 groups at 24 captures):
  for each burst-1 candidate path:
    for each timing entry in this group:
      search bursts 2..n with fixed burst-1 path
```

What this gives:
- **v2's benefit**: no timing in the hot loop (precomputed)
- **v1's benefit**: burst-1 shared across overlap combos
- **Better than v1**: burst-1 shared across different base patterns
  that use the same burst-1 length. v1 iterates patterns sequentially:
  [12,7,3,2] then [12,6,4,2] — each re-searches burst-1 at len 12.
  The grouped approach searches len-12 burst-1 candidates once.

At 24 captures: 8 groups instead of 5,425 independent searches.

### Additional optimizations to consider

**Forward checking**: After placing burst k, verify each remaining burst
has at least one compatible candidate before recursing. Cheap (scan
candidate list against coveredMask) and catches doomed branches early.
Biggest impact on corner/edge where deep search into dead branches is
the dominant cost.

**Memoize simulateOneBurst as a quick win**: Even without restructuring,
a Map cache in v1 would close most of the v2 gap on corridor. Could do
this immediately while designing v3.
