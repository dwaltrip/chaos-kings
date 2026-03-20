# custom-algo-1: Burst-Path Combinatorial Solver

Finds the optimal opening expansion for a generals.io-style game: which tiles to capture, in what order, to maximize territory within 50 ticks.

## Core idea

Optimal openings decompose into a small number of **bursts** (4-6). Each burst is a non-backtracking path from the general that captures a contiguous sequence of tiles. This decomposition splits the problem into two independent subproblems:

1. **Timing (board-independent):** What sequences of burst sizes fit within 50 ticks, given troop production rates?
2. **Spatial (board-specific):** For a given burst sequence, can we find compatible paths from the general that don't fight over tiles?

## Algorithm pipeline

```
Board
  │
  ▼
genPathsDP ─────────► paths by length (Map<len, PathEntry[]>)
  │                         │
  │                         ▼
  │                   buildPathEntries ──► path entries by move count
  │                                              │
  │   buildTimingEntries ──► timing entries       │
  │     (burst patterns ×    (captures[], overlaps[], endTick)
  │      overlap combos ×                         │
  │      timing sim)                              │
  │         │                                     │
  ▼         ▼                                     ▼
precomputeBlankTileDistMasks      buildTimingGroups
  │                                (bucket by burst-1 length)
  │                                       │
  ▼                                       ▼
              searchGrouped
              (grouped backtracking with feasibility pruning)
                      │
                      ▼
                  Solution
                  { pattern, paths, burstInfos, coveredMask }
```

### Stage 1: Path generation (`gen-paths.ts`)

Level-by-level DP from the general. For each length k, extend every (k-1)-length path in all 4 directions, skipping mountains and revisits. Each path stored as both a tile array and a bigint bitmask.

Path counts on an open 11×11 board: length 12 produces ~60K paths. Mountains reduce counts significantly — constrained boards are actually cheaper to search.

### Stage 2: Timing table (`timing-table.ts`, `burst-patterns.ts`)

Generate all valid burst patterns by:
1. Enumerating descending partitions of the target capture count (e.g., 24 = [12,7,3,2])
2. For each partition, expanding all overlap combinations (burst 0 always has 0 overlap; others 0..maxOverlapPerBurst)
3. Simulating timing for each combo; discarding any that exceed maxTicks

Results sorted by total overlap ascending — zero-overlap solutions tried first.

### Stage 3: Timing simulation (`get-burst-info.ts`)

Models the game's discrete timing:
- General starts with 1 troop, produces +1 every 2 ticks
- A burst needs `captures + 1` troops before departing (capture each tile + 1 remains at general)
- Each move takes 1 tick
- Overlap moves cost ticks but not troops (traversing owned territory)

### Stage 4: Grouped backtracking search (`solver-v3.ts`)

The search iterates from `maxCaptures` (24) down to `minCaptures` (15), trying to find the highest-scoring solution first.

Within each capture target:
1. Timing entries are grouped by burst-1 move length
2. Groups processed longest-first (most constrained)
3. For each burst-1 candidate path, `searchGrouped` recurses through remaining bursts
4. At each depth, entries are bucketed by `(moveLen, overlap)` — candidates scanned once per bucket, not once per entry

**Feasibility pruning** (three checks at each depth):
- **Per-burst:** Each remaining burst must have enough blank tiles within its reach distance
- **Neighbor bottleneck:** Zero-overlap bursts each need a distinct blank neighbor of the general
- **Aggregate:** Total remaining captures must fit within reachable blank tiles

### Stage 5: Bitmask operations (`bitmask.ts`)

BigInt bitmasks make the inner loop fast:
- Overlap check: `path1 & path2 !== 0n`
- Union: `covered |= newPath`
- Filtering: `(cand.mask & coveredMask) === 0n`
- Popcount: Brian Kernighan's algorithm

## Key types

```
Solution {
  pattern: number[]         // burst capture counts, e.g. [10, 8, 4, 2]
  burstSpecs: BurstSpec[]   // { captures, moves } per burst
  burstInfos: BurstInfo[]   // { startTick, endTick } per burst
  paths: PathEntry[]        // { tiles: number[], mask: bigint } per burst
  coveredMask: bigint       // union of all path masks
  totalCaptured: number     // popcount(coveredMask)
}
```

## Overlap re-traversal

Later bursts may need to walk through already-owned tiles to reach uncaptured territory (common on boards with walls/corridors). This is modeled as a prefix overlap: the first N tiles of a path traverse owned territory, then the rest capture new tiles. Overlap costs ticks but not troops.

## Files

| File | Purpose |
|------|---------|
| `solver-v3.ts` | Main solver — orchestration, grouped search, feasibility pruning |
| `gen-paths.ts` | DP path enumeration from general |
| `path-search.ts` | Path entry abstraction, prefix overlap validation |
| `get-burst-info.ts` | Burst timing simulation |
| `timing-table.ts` | Pre-generate all valid (captures, overlaps) combos |
| `burst-patterns.ts` | Descending partition generation |
| `bitmask.ts` | BigInt bitmask utilities |
| `run.ts` | CLI runner |
| `tools/` | Board info, timing info, profiling CLIs |
| `__tests__/` | Jest tests (60+) |

## Performance

Solver finds 24 captures on most boards in under 200ms. Hard cases (e.g., general in corner of 9×9) can take longer due to exhausting longer burst-1 groups before finding the solution in shorter ones.

### Known performance characteristics

- Open/sparse boards: solution found on first or second timing entry, <100ms
- Corridor/wall boards: overlap needed, still fast (<50ms typically)
- Corner/edge generals: more groups to exhaust, seconds to minutes
- 13×13 boards: path generation scales but search remains tractable

### Optimization history

| Optimization | Effect (corner-9×9) |
|---|---|
| v3 baseline (grouped search) | 237s → 106s |
| + feasibility pruning | → 25s |
| + neighbor bottleneck pruning | → 1.5s |
| + cumulative distance masks | minor cleanup |
| Removed flex score (didn't help) | — |

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
