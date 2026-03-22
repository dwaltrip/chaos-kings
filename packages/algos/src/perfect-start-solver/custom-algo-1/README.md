# custom-algo-1: Burst-Path Combinatorial Solver

Finds the optimal opening expansion for a generals.io-style game: which tiles to capture, in what order, to maximize territory within 50 ticks.

## Core idea

Brute-force search over individual moves is intractable at 50 ticks. But optimal openings decompose into a small number of **bursts** (4-6), where each burst is a non-backtracking path from the general that captures a run of adjacent tiles. This decomposition splits the problem into two independent subproblems:

1. **Timing (board-independent):** What sequences of burst sizes fit within 50 ticks, given troop production rates?
2. **Spatial (board-specific):** For a given burst sequence, can we find compatible paths from the general that don't fight over tiles?

### Overlap re-traversal

Later bursts may need to walk through already-owned tiles to reach uncaptured territory (common on boards with walls/corridors). This is modeled as a **prefix overlap**: the first N tiles of a path traverse owned territory, then the rest capture new tiles. Overlap costs ticks but not troops.

## Algorithm pipeline

```
solveV3(board, generalPos, config)
  │
  ├─ 1. Path generation ─────── genPathsDP → buildPathEntries
  │                              All non-backtracking paths from general, by length.
  │
  ├─ 2. Precomputation ──────── getNeighborInfos (per-neighbor BFS masks)
  │                              buildPartitionedEntries (L1: candidates by neighbor)
  │                              precomputeBlankTileDistMasks (global BFS masks)
  │
  └─ 3. Search ──────────────── for each capture target (24 down to 15):
                                   buildTimingGroups (timing entries grouped by burst-1 len)
                                   for each burst-1 candidate:
                                     searchGrouped (recursive grouped backtracking)
```

### Path generation (`gen-paths.ts`)

Level-by-level DP from the general: extend (k-1)-paths in all 4 directions, skipping mountains and revisits. Each path stored as a tile array and a bigint bitmask. Path counts on an open 11×11: ~60K paths at length 12. Mountains reduce counts significantly.

`buildPathEntries` (`path-search.ts`) strips the start tile (general) and re-indexes by move length. Result: `PathEntriesByLen` = `Map<length, PathEntry[]>`.

### Precomputation (`solver-v3.ts`)

**Neighbor info** (`getNeighborInfos`): For each walkable neighbor of the general, BFS outward (excluding the general) to compute cumulative reachable-tile masks by distance. Stored as `NeighborInfo.blankMasks`.

**L1 partitioning** (`buildPartitionedEntries`): Groups `PathEntry`s by starting neighbor (`tiles[0]`). Structure: `PartitionedEntries` = `Map<moveLen, PathEntry[][]>` where the inner array is indexed by neighbor. Enables skipping irrelevant partitions based on `coveredMask` during search.

**Global distance masks** (`precomputeBlankTileDistMasks`): BFS from the general, cumulative masks of reachable non-mountain tiles within each distance (up to 4). Used by feasibility checks.

### Timing table (`timing-table.ts`, `burst-patterns.ts`)

Generate all valid burst patterns by:
1. Enumerating descending partitions of the target capture count — sequences where each burst is no larger than the previous (e.g., 24 = [12,7,3,2])
2. For each partition, expanding all overlap combinations (burst 0 always has 0 overlap; others 0..maxOverlapPerBurst)
3. Simulating timing for each combo; discarding any that exceed maxTicks

Results sorted by total overlap ascending — zero-overlap solutions tried first.

**Timing model** (`get-burst-info.ts`): General starts with 1 troop, produces +1 every 2 ticks. A burst needs `captures + 1` troops before departing (1 per capture + 1 left behind at the general). Each move takes 1 tick. Overlap moves cost ticks but not troops.

### Grouped backtracking search (`solver-v3.ts`)

The outer loop iterates from `maxCaptures` (24) down to `minCaptures` (15), trying the highest-scoring solution first.

Within each capture target, timing entries are grouped by burst-1 move length (`TimingGroup`), processed longest-first. For each burst-1 candidate path, `searchGrouped` recurses through remaining bursts.

**`searchGrouped`** at each depth:

1. **Base case**: any entry fully assigned → return solution.

2. **Feasibility pruning** (three checks, all entries must pass at least one or the branch is pruned):
   - `entryIsFeasibleNeighbors` — zero-overlap bursts remaining ≤ blank neighbors
   - `entryIsFeasiblePerBurst` — each burst has enough blank tiles within reach
   - `entryIsFeasibleAggregate` — total remaining captures fit within reachable blanks

3. **Bucketing**: group feasible entries by `(moveLen, overlap)` at current depth. Candidates scanned once per bucket, not once per entry (amortization).

4. **L1 neighbor filtering**: for each bucket, iterate only relevant neighbor partitions:
   - Zero-overlap: skip covered neighbors (path must start on a fresh neighbor)
   - Overlap > 0: skip uncovered neighbors (path prefix must re-traverse covered tiles)

5. **L3 per-neighbor pruning**: for zero-overlap bursts, check that the specific neighbor's reachable territory has enough blank tiles. Cheap (one bigint AND + popcount). Zero fires on current boards but kept as insurance.

6. **Inner-loop candidate scan**: for each candidate in the partition, check overlap compatibility via bitmask operations:
   - Zero-overlap: `(cand.mask & coveredMask) === 0n`
   - Overlap > 0: `popcount(cand.mask & coveredMask) === overlap` AND `countPrefixOverlap` validates contiguous prefix
   - On pass: recurse with `newCovered = coveredMask | newMask`

### Profiling infrastructure

The solver has built-in profiling gated behind `config.profile`:

**Always-on counters** (`SearchStats`): `candidatesChecked`, `candidatesPassed`, `searchCalls`, `feasibilityChecks`, `feasibilityPrunes`, `feasibilityEntriesKilled`. Negligible cost (integer increments).

**Profile-only** (`ProfileData`, populated when `profile: true`):
- `pathGenMs` — time in path generation + precomputation
- Per capture target: `timingTableMs`, `searchMs`, `groupCount`, `burst1Entries`, per-target candidate check/pass counts
- `feasProfile` — breakdown of feasibility check outcomes by (N, P, A) pass/fail combos

## Key types

```
PathEntry { tiles: number[], mask: bigint }       // a candidate path (excl. general)
TimingEntry { captures: number[], overlaps: number[], endTick: number }
NeighborInfo { tile: number, bit: bigint, blankMasks: bigint[] }
SearchContext { partitioned, neighborInfos, blankTileMasks, stats, profile }
TimingGroup { burst1Moves: number, entries: EntryWithMoves[] }
EntryWithMoves { entry: TimingEntry, moves: number[] }

SolverResult { solution, entriesChecked, elapsedMs, stats, profileData }
ProfileData { pathGenMs: number, targets: TargetProfile[] }
TargetProfile { captures, timingTableMs, searchMs, groupCount, burst1Entries,
                candidatesChecked, candidatesPassed }
```

## Files

| File | Purpose |
|------|---------|
| `solver-v3.ts` | Main solver — orchestration, grouped search, feasibility, profiling |
| `gen-paths.ts` | DP path enumeration from general |
| `path-search.ts` | PathEntry abstraction, prefix overlap validation (`countPrefixOverlap`) |
| `get-burst-info.ts` | Burst timing simulation |
| `timing-table.ts` | Pre-generate all valid (captures, overlaps) combos |
| `burst-patterns.ts` | Descending partition generation |
| `bitmask.ts` | BigInt bitmask utilities (popcount, overlap check, mask↔tiles) |
| `board-bfs.ts` | BFS cumulative mask computation (used by NeighborInfo + global masks) |
| `run.ts` | CLI runner (`--board`, `--ticks`, `--max-bursts`, `--profile`) |
| `__tests__/` | Jest tests (68 tests) |

## Performance

Realistic 25×25 boards: 4 of 6 solve in 11-52ms (path gen dominates). Two tight-corner boards: 1.1s and 6.9s (search dominates, 95-99% of time on infeasible capture targets).

Synthetic corner boards (7×7 to 13×13) solve at 24 captures in 1.9-6.2s; search dominates with ~90% inner-loop scan waste.

### Optimization history (corner-9×9)

| Optimization | Time |
|---|---|
| v2 (precomputed timing tables) | >60s |
| v3 grouped search | 237s |
| + feasibility pruning | 25s |
| + neighbor bottleneck pruning | 1.5s |
| + L1 neighbor partitioning | ~1.1s (1.3-1.4x speedup) |

## CLI usage

```bash
npx tsx run.ts --board open-11x11
npx tsx run.ts --board all
npx tsx run.ts --board corner-9x9 --ticks 50 --max-bursts 4
npx tsx run.ts --board realistic --profile
```

## Open directions

See `research-spike-1/docs/ROADMAP.md` for the full thread catalog (13 threads).
