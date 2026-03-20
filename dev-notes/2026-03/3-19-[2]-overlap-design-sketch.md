# Overlap Re-traversal — Design Sketch

## Background

Custom-algo-1 is a burst-path combinatorial search solver for optimal
openings in generals.io. It decomposes the problem into:
1. **Timing** (board-independent): what sequences of burst lengths fit
   within 50 ticks?
2. **Spatial** (board-specific): for a given burst pattern, can we find
   non-overlapping paths from the general that match?

The solver works end-to-end: 24 captures (25 land) on open/sparse
boards, 23 on corridor/maze. Tests are in place (48 tests passing).
Code lives in `packages/algos/src/perfect-start-solver/custom-algo-1/`.

## Problem

Later bursts may need to cross already-owned tiles to reach uncaptured
territory. On corridor-7x7, any burst going south must pass through the
gap at (4,3), which an earlier burst already captured. Currently
`findPaths` requires zero overlap — corridor-7x7 is stuck at 23 captures.

## Key mechanics

**Prefix-only overlap.** A burst path looks like:
`[owned, owned, ..., new, new, new, ...]` — walk through your territory
to reach the frontier, then burst into uncaptured tiles. The overlap is
always a contiguous prefix of the path.

There may be rare cases where an optimal solution involves mid-path
re-traversals (owned→new→owned→new). This would require unusual
geometry — e.g., the path circling around a finger of owned territory.
We expect prefix-only covers the vast majority of cases, and that
boards with mid-path optimal solutions also have prefix-only optimal
solutions. Starting with prefix-only to keep things simple.

**Re-traversal is free in terms of army.** Moving through an owned tile
(1 troop garrison): your army merges (+1), then leaves 1 behind on the
next move. Net cost: zero. So `troopsNeeded = captures + 1` regardless
of how many owned tiles are traversed. (The +1 is to leave 1 troop on
the general when the army departs.)

**Re-traversal costs ticks.** Each move (whether capturing or
re-traversing) consumes one tick. A burst with C captures and O overlap
tiles takes C+O ticks of movement.

**Net effect on timing — two framings:**

*Adding overlap moves* (fixed capture count, more moves): A burst of
7 captures + 2 overlap = 9 moves. Same troop requirement (8), 2 extra
movement ticks. Timing gets worse.

*Converting a capture to a traversal* (fixed move count, fewer captures):
A burst of 7 moves where 1 is a traversal = 6 captures + 1 overlap.
Troop requirement drops from 8 to 7, saving ~2 ticks of accumulation.
Same movement ticks. Timing gets better.

In our solver, burst patterns specify capture counts. Adding overlap
moves to a fixed capture pattern always makes timing worse. But the
solver iterates capture targets from high to low — a 23-capture solution
has faster base timing than 24, providing headroom for overlap moves.
The existing timing pre-filter on burst patterns remains valid: any
pattern that fails without overlap will also fail with overlap.

## Timing model changes

Current model in `get-burst-info.ts` takes `number[]` where each
element is both moves and captures. New model separates them:

```ts
interface TimingState {
  tick: number;
  generalTroops: number;
}

type BurstSpec = { moves: number; captures: number };

// Simulates one burst from the given timing state.
// Returns endTick and state after burst, or null if exceeds maxTicks.
function simulateOneBurst(
  captures: number,
  moves: number,
  state: TimingState,
  maxTicks: number,
): { endTick: number; nextState: TimingState } | null;
```

Two lines change from the current simulation:
- `troopsNeeded = captures + 1` (was `pattern[burstIdx] + 1`)
- `burstMovesRemaining = moves - 1` (was `pattern[burstIdx] - 1`)

When `moves === captures` (no overlap), this is identical to the current
model. Verified with 0 mismatches across all test patterns.

## Search structure

### Outer loop — `solve(board, generalPos, config)`

Unchanged — iterate captures high to low, generate patterns, call
findPaths:

```ts
// board: FlatBoard — the game board
// generalPos: number — tile index of the general
// config: SolverConfig — maxTicks, maxBurst, maxOverlapPerBurst, etc.

for (let captures = maxCaptures; captures >= minCaptures; captures--) {
  const patterns: number[][] = genValidBurstPatterns(captures, maxBurst, maxTicks);

  for (const pattern of patterns) {
    // pattern is a descending array of capture counts, e.g. [12, 7, 3, 2]
    const result = findPaths(entriesByLen, pattern, overlapConfig);
    if (result) return result;
  }
}
```

### `findPaths(entriesByLen, capturePattern, config)` → `SearchResult | null`

Top-level search entry point. Sets up initial timing state and
delegates to recursive backtracking.

```ts
// entriesByLen: Map<number, PathEntry[]> — precomputed paths grouped by length
// capturePattern: number[] — captures per burst, e.g. [12, 7, 3, 2]
// config: { maxOverlapPerBurst: number; maxTicks: number }

function findPaths(entriesByLen, capturePattern, config): SearchResult | null {
  const initialState: TimingState = { tick: 1, generalTroops: 1 };
  // capturePattern, entriesByLen, and config are closed over by search()
  const paths = search(0, 0n, initialState);
  if (!paths) return null;
  // ... build SearchResult from paths
}
```

### `search(burstIdx, coveredMask, timingState)` — recursive backtracking

Assigns a path to each burst. For each burst, tries increasing
overlap (0 first, then 1, 2, ...) to find paths that may need to
re-traverse owned territory.

```ts
// burstIdx: number — which burst we're assigning (0, 1, 2, ...)
// coveredMask: bigint — bitmask of all tiles owned by previous bursts
// timingState: TimingState — { tick, generalTroops } after previous burst

function search(burstIdx: number, coveredMask: bigint, timingState: TimingState) {
  if (burstIdx === capturePattern.length) return [];  // all bursts assigned

  const captures = capturePattern[burstIdx];

  for (let overlap = 0; overlap <= config.maxOverlapPerBurst; overlap++) {
    if (burstIdx === 0 && overlap > 0) break;  // first burst: nothing owned yet

    const moves = captures + overlap;

    // timing depends on (captures, overlap), not on which specific path
    const timingResult = simulateOneBurst(captures, moves, timingState, config.maxTicks);
    if (!timingResult) break;  // more overlap only adds ticks, prune

    const candidates = entriesByLen.get(moves);
    if (!candidates) continue;  // no paths of this length

    for (const cand of candidates) {
      const prefixLen = countPrefixOverlap(cand.tiles, coveredMask);
      if (prefixLen < 0) continue;    // has non-prefix overlap, invalid
      if (prefixLen !== overlap) continue;  // wrong overlap count

      const newTilesMask = cand.mask & ~coveredMask;
      const rest = search(burstIdx + 1, coveredMask | newTilesMask, timingResult.nextState);
      if (rest) {
        rest.unshift(cand);
        return rest;
      }
    }
  }

  return null;  // no valid assignment found
}
```

**Key properties:**
- Timing is computed once per (captures, overlap) pair, not per candidate
- `simulateOneBurst` returning null prunes all higher overlap values
- Overlap=0 is tried first, preferring non-overlapping solutions
- First burst (burstIdx=0) skips overlap entirely (nothing owned yet)

### `countPrefixOverlap(tiles, coveredMask)` → `number`

Checks whether a path's overlap with owned territory is a clean prefix.

```ts
// tiles: number[] — ordered tile indices of the path (first = adjacent to general)
// coveredMask: bigint — bitmask of owned tiles
// Returns: number of prefix overlap tiles, or -1 if overlap is non-prefix

function countPrefixOverlap(tiles: number[], coveredMask: bigint): number {
  let prefixLen = 0;

  // count consecutive owned tiles from start
  while (prefixLen < tiles.length) {
    const bit = 1n << BigInt(tiles[prefixLen]);
    if (!(bit & coveredMask)) break;
    prefixLen++;
  }

  // verify remaining tiles are NOT owned
  for (let i = prefixLen; i < tiles.length; i++) {
    const bit = 1n << BigInt(tiles[i]);
    if (bit & coveredMask) return -1;  // non-prefix overlap
  }

  return prefixLen;
}
```

NOTE/TODO: This is O(pathLen) per candidate vs the current single
bitmask AND. Should profile after implementation to see if this
becomes a bottleneck. Could precompute prefix masks if needed.

## File changes

### `get-burst-info.ts`
- Add `BurstSpec` type, `TimingState` type, `simulateOneBurst` function
- Add `getBurstInfosFromSpecs(specs: BurstSpec[])` for solution output
- Replace `getMoveTicksForBurstPattern` and `getBurstInfos` — the old
  functions are the moves=captures special case. Update all callers
  (burst-patterns.ts, solver.ts, tests) to use the new interface,
  then remove the old functions.

### `path-search.ts`
- Add `countPrefixOverlap(tiles, coveredMask)` helper
- Modify `findPaths` in place to accept optional overlap config
  (don't duplicate backtracking logic)
- When overlap config present: overlap loop + timing threading +
  prefix checks
- When absent: current behavior exactly (zero-overlap fast path)
- TODO: refactoring pass to clean up complexity after overlap is working

### `solver.ts`
- Add `maxOverlapPerBurst` to `SolverConfig` (configurable, default 3)
- Pass overlap config to `findPaths`
- Update `Solution` type to include per-burst overlap and actual
  move counts
- Update display in `run.ts`

### `burst-patterns.ts`
- Update `genValidBurstPatterns` to use `getBurstInfosFromSpecs`
  (constructing BurstSpecs with moves=captures). No logic changes.

### `gen-paths.ts`
- For now: cap `captures + overlap <= maxBurst` so we don't need
  longer paths than currently generated. This limits overlap on the
  largest bursts (where it's least needed — large bursts go outward
  into open territory).
- Longer term: revisit path generation scaling (lazy generation, etc.)
  and potentially increase max path length. Constrained boards where
  overlap matters most already have far fewer paths, so OOM is less
  of a concern there.
- Daniel's note: optimal solutions likely never need 10+ bursts (probably
  fewer). Tightening the max burst count further would dramatically
  reduce the search space and may relax path generation constraints.

## Resolved questions

**maxOverlapPerBurst:** Configurable via SolverConfig, default 3.

**Modify findPaths in place vs new function:** Modify in place. One
backtracking implementation, overlap=0 stays fast. Add TODO for
refactoring cleanup pass.

**Descending order constraint:** Still valid. Constraint is on capture
counts, not move counts. First burst is most constrained (most captures,
no overlap allowed). Later bursts with overlap may have higher move
counts than earlier bursts' capture counts — that's fine.

**countPrefixOverlap bitmask optimization:** Defer. Linear scan over
path tiles (3-15 elements) is likely fine. Add NOTE/TODO to profile
and optimize later if needed.

## Data from exploration

(MAX_OVERLAP_PER_BURST=3, MAX_BURSTS=10, MAX_TICKS=50)

### Valid overlap specs by capture target

| Captures | Patterns | Valid combos | Pruning rate | Max total overlap |
|----------|----------|-------------|--------------|-------------------|
| 20       | 485      | 11.6M       | 28%          | 24                |
| 21       | 586      | 11.1M       | 48%          | 22                |
| 22       | 710      | 8.5M        | 70%          | 20                |
| 23       | 846      | 4.3M        | 88%          | 18                |
| 24       | 1,012    | 1.0M        | 98%          | 17                |

### EndTick distribution at 24 captures

Only ticks 49 and 50 — every valid pattern is right at the wire.
At lower capture targets there's more slack (20 captures spans
ticks 41-50).

### Core operation performance

| Operation           | open-7x7 | corridor-7x7 | maze-7x7 | open-9x9 |
|---------------------|----------|---------------|----------|----------|
| genPathsDP          | 41ms     | 1.3ms         | 0.1ms    | 67ms     |
| buildPathEntries    | 13ms     | 1.0ms         | 0.0ms    | 36ms     |
| findPaths (success) | 0.15ms   | —             | —        | 0.04ms   |
| findPaths (fail)    | 2.4s     | 5-9ms         | <0.01ms  | 55s      |
| solver (24 cap)     | 0.1ms    | 1.2s          | 4ms      | 0.1ms    |
