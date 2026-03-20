# custom-algo-1: Burst-Path Combinatorial Solver

Finds the optimal opening expansion for a generals.io-style game: which tiles to capture, in what order, to maximize territory within 50 ticks.

## Core idea

Brute-force search over individual moves is intractable at 50 ticks. But optimal openings decompose into a small number of **bursts** (4-6), where each burst is a non-backtracking path from the general that captures a run of adjacent tiles. This decomposition splits the problem into two independent subproblems:

1. **Timing (board-independent):** What sequences of burst sizes fit within 50 ticks, given troop production rates?
2. **Spatial (board-specific):** For a given burst sequence, can we find compatible paths from the general that don't fight over tiles?

### Overlap re-traversal

Later bursts may need to walk through already-owned tiles to reach uncaptured territory (common on boards with walls/corridors). This is modeled as a **prefix overlap**: the first N tiles of a path traverse owned territory, then the rest capture new tiles. Overlap costs ticks but not troops.

## Algorithm pipeline

The solver has four stages. Each stage feeds the next:

1. **Path generation** (`gen-paths.ts`) — Enumerate all valid paths from the general
2. **Timing table** (`timing-table.ts`, `burst-patterns.ts`) — Pre-generate all valid burst sequences
3. **Precompute spatial data** (`solver-v3.ts`) — BFS distance masks for feasibility pruning
4. **Grouped backtracking search** (`solver-v3.ts`) — Find compatible path combinations

BigInt bitmasks (`bitmask.ts`) are used throughout for fast spatial operations — overlap checks, unions, and popcount are all bitwise ops on bigints.

### Path generation (`gen-paths.ts`)

Level-by-level DP from the general: extend (k-1)-paths in all 4 directions, skipping mountains and revisits. Each path stored as a tile array and a bigint bitmask. Path counts on an open 11×11: ~60K paths at length 12. Mountains reduce counts significantly.

### Timing table (`timing-table.ts`, `burst-patterns.ts`)

Generate all valid burst patterns by:
1. Enumerating descending partitions of the target capture count — sequences where each burst is no larger than the previous (e.g., 24 = [12,7,3,2])
2. For each partition, expanding all overlap combinations (burst 0 always has 0 overlap; others 0..maxOverlapPerBurst)
3. Simulating timing for each combo; discarding any that exceed maxTicks

Results sorted by total overlap ascending — zero-overlap solutions tried first.

**Timing model** (`get-burst-info.ts`): General starts with 1 troop, produces +1 every 2 ticks. A burst needs `captures + 1` troops before departing (1 per capture + 1 left behind at the general). Each move takes 1 tick. Overlap moves cost ticks but not troops.

### Grouped backtracking search (`solver-v3.ts`)

The search iterates from `maxCaptures` (24) down to `minCaptures` (15), trying to find the highest-scoring solution first.

Within each capture target, timing entries are grouped by burst-1 move length, processed longest-first. For each burst-1 candidate path, `searchGrouped` recurses through remaining bursts. At each depth, entries are bucketed by `(moveLen, overlap)` — candidates scanned once per bucket, not once per entry. This amortizes candidate evaluation when many timing entries share the same burst signature.

The **covered mask** (a bigint tracking all tiles claimed so far) is passed down through recursion, enabling fast overlap/compatibility checks at each depth.

**Feasibility pruning** (three checks at each depth):
- **Per-burst:** Each remaining burst must have enough blank tiles within its reach distance (BFS distance masks, capped at distance 4 with a linear approximation beyond)
- **Neighbor bottleneck:** The number of remaining zero-overlap bursts must not exceed the number of blank neighbors of the general (count-based bound)
- **Aggregate:** Total remaining captures must fit within reachable blank tiles

## Key types

```
Solution {
  pattern: number[]         // burst capture counts, e.g. [10, 8, 4, 2]
  burstSpecs: BurstSpec[]   // { captures, moves } per burst
  burstInfos: BurstInfo[]   // { burstLen, startTick, endTick } per burst
  paths: PathEntry[]        // { tiles: number[], mask: bigint } per burst
  coveredMask: bigint       // union of all path masks
  totalCaptured: number     // popcount(coveredMask)
}
```

## Files

| File | Purpose |
|------|---------|
| `solver-v3.ts` | Main solver — orchestration, grouped search, feasibility pruning |
| `gen-paths.ts` | DP path enumeration from general |
| `path-search.ts` | Path entry abstraction, prefix overlap validation |
| `get-burst-info.ts` | Burst timing simulation |
| `timing-table.ts` | Pre-generate all valid (captures, overlaps) combos |
| `burst-patterns.ts` | Descending partition generation |
| `bitmask.ts` | BigInt bitmask utilities (popcount, overlap check, mask↔tiles) |
| `run.ts` | CLI runner |
| `tools/` | Board info, timing info, profiling CLIs |
| `__tests__/` | Jest tests |

## Performance

Solver finds 24 captures on most boards in under 200ms. Hard cases (e.g., general in corner of 9×9) can take longer due to exhausting longer burst-1 groups before finding the solution in shorter ones.

### Known performance characteristics

- Open/sparse boards: solution found on first or second timing entry, <100ms
- Corridor/wall boards: overlap needed, still fast (<50ms typically)
- Corner/edge generals: more groups to exhaust, seconds to minutes
- 13×13 boards: path generation scales but search remains tractable

### Optimization history (corner-9×9)

| Optimization | Time |
|---|---|
| v2 (precomputed timing tables) | >60s |
| v3 grouped search | 237s (finds solution, but exhausts long groups first) |
| + feasibility pruning | 25s |
| + neighbor bottleneck pruning | 1.5s |

A "flex score" candidate ordering heuristic and a "distance-band packing" feasibility check were both tried and reverted — neither improved performance on real boards.

## CLI usage

```bash
npx tsx run.ts --board open-11x11
npx tsx run.ts --board all
npx tsx run.ts --board corner-9x9 --ticks 50 --max-bursts 4
```

## Open directions

1. **Group ordering** — try shorter burst-1 lengths before longer ones on constrained boards (biggest remaining win for corner cases)
2. **Stronger pruning** — multi-burst feasibility accounting for tile competition across bursts
3. **Candidate ordering at depth** — re-sort by remaining open space per recursive level
