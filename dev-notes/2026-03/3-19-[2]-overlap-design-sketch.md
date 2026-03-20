# Overlap Re-traversal — Design Sketch

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

**Re-traversal is free in terms of army.** Moving through an owned tile
(1 troop garrison): your army merges (+1), then leaves 1 behind on the
next move. Net cost: zero. So `troopsNeeded = captures + 1` regardless
of how many owned tiles are traversed.

**Re-traversal costs ticks.** Each move (whether capturing or
re-traversing) consumes one tick. A burst with C captures and O overlap
tiles takes C+O ticks of movement.

**Net effect on timing:** Overlap doesn't change accumulation time
(same troop requirement), but adds movement ticks. Patterns that fit
with zero overlap are a lower bound — adding overlap can only push
endTick later. This means the existing timing pre-filter on burst
patterns is still valid: any pattern that fails without overlap will
also fail with overlap.

## Timing model changes

Current model in `get-burst-info.ts` takes `number[]` where each
element is both moves and captures. New model separates them:

```ts
type BurstSpec = { moves: number; captures: number };

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

### Outer loop (solver)

Unchanged — iterate captures high to low, generate patterns, call
findPaths:

```
for captures = 24 down to minCaptures:
  patterns = genValidBurstPatterns(captures, maxBurst, maxTicks)
  for each pattern:
    result = findPaths(entries, pattern, overlapConfig)
    if result: return result
```

### findPaths

Sets up initial state, delegates to recursive search:

```
findPaths(entriesByLen, capturePattern, config):
  initialState = { tick: 1, generalTroops: 1 }
  return search(0, 0n, initialState)
```

`capturePattern`, `entriesByLen`, and `config` are closed over.

### search (recursive backtracking)

```
search(burstIdx, coveredMask, timingState):
  if burstIdx === capturePattern.length: return success

  captures = capturePattern[burstIdx]

  for overlap = 0 to maxOverlapPerBurst:
    if burstIdx === 0 && overlap > 0: break  // nothing owned yet

    moves = captures + overlap
    timingResult = simulateOneBurst(captures, moves, timingState, maxTicks)
    if !timingResult: break  // more overlap only adds ticks

    candidates = entriesByLen.get(moves)
    if !candidates: continue

    for each candidate in candidates:
      prefixOverlap = countPrefixOverlap(candidate.tiles, coveredMask)
      if prefixOverlap !== overlap: continue
      if hasNonPrefixOverlap(candidate, coveredMask): continue

      newTilesMask = candidate.mask & ~coveredMask
      rest = search(burstIdx + 1, coveredMask | newTilesMask, timingResult.nextState)
      if rest: return [candidate, ...rest]

  return null
```

**Key properties:**
- Timing is computed once per (captures, overlap) pair, not per candidate
- `simulateOneBurst` returning null prunes all higher overlap values
- Overlap=0 is tried first, preferring non-overlapping paths
- First burst (burstIdx=0) skips overlap entirely

### countPrefixOverlap

```
countPrefixOverlap(tiles, coveredMask):
  count consecutive owned tiles from start of path
  then verify remaining tiles are NOT owned
  if any non-prefix tile is owned: return -1 (invalid)
  otherwise: return prefix length
```

This replaces the current check `(cand.mask & coveredMask) !== 0n`.
Returns the number of prefix overlap tiles, or -1 if overlap exists
but isn't a clean prefix.

## File changes

### `get-burst-info.ts`
- Add `BurstSpec` type
- Add `simulateOneBurst` function
- Add `getBurstInfosFromSpecs(specs: BurstSpec[])` for solution output
- Keep existing `getMoveTicksForBurstPattern` and `getBurstInfos`
  unchanged (used in tests, pattern generation)

### `path-search.ts`
- Add `countPrefixOverlap(tiles, coveredMask)` helper
- Modify `findPaths` to accept optional overlap config
- When overlap config present: overlap loop + timing threading +
  prefix checks
- When absent: current behavior exactly (zero-overlap fast path)

### `solver.ts`
- Pass overlap config to `findPaths`
- Update `Solution` type to include per-burst overlap and actual
  move counts
- Update display in `run.ts`

### `burst-patterns.ts`
- No changes. Existing timing pre-filter is still valid (overlap
  can only make timing worse).

### `gen-paths.ts`
- No changes. Paths are already generated up to maxBurst+1. With
  overlap, we look up paths at higher lengths (captures+overlap),
  which are already in the generated set as long as
  captures+maxOverlap <= maxBurst.

  Wait — this means maxBurst needs to account for overlap. If
  maxBurst=12 (max captures per burst) and maxOverlap=3, we need
  paths up to length 15. Currently genPathsDP is called with
  maxBurst+1=13. This needs to increase to maxBurst+maxOverlap+1.
  But length 15 on open-11x11 might OOM (length 14 already does).
  See open question 5.

## Open questions

### 1. maxOverlapPerBurst default

Data shows up to 17 total overlap is valid at 24 captures. Per-burst,
3 seems practical. Should this be a solver config parameter?

### 2. Interaction with maxBurst and path generation

If maxBurst=12 (capture cap) and maxOverlapPerBurst=3, we need paths
up to length 15. But path generation OOMs at length 14+ on open-11x11
(~370K paths). Options:
- Cap overlap so captures+overlap <= current maxBurst (limits overlap
  on large bursts, where it's least needed anyway)
- Only generate longer paths on boards where it's feasible
- Accept OOM risk for now, since overlap is most needed on constrained
  boards which have far fewer paths

### 3. Performance on failed patterns

findPaths currently takes 2.4s per failed pattern on open-7x7 (60K
paths at length 12). With overlap, each burst tries up to 4 path
lengths, multiplying the branching factor. On open boards the first
pattern succeeds (overlap=0) so this doesn't matter. On constrained
boards path counts are small. But worth monitoring.

### 4. Modify findPaths in place vs new function

Modifying in place: one backtracking implementation, overlap=0 stays
fast. But the function gets more complex.

New function: cleaner separation, but duplicates backtracking logic.

Leaning toward modifying in place with optional config.

### 5. countPrefixOverlap + overlap check — can we use bitmasks?

Current zero-overlap check is a single bitmask AND. The prefix check
requires walking the tiles array (O(pathLen) per candidate). Could
precompute prefix masks per path, but that adds memory. Probably fine
to do the linear scan — pathLen is small (3-15) and we only check
candidates where overlap exists.

### 6. Descending order constraint

Patterns are descending by capture count. With overlap, a later burst's
path length (captures+overlap) could exceed an earlier burst's capture
count. E.g., pattern [8, 5, 3] with overlaps [0, 3, 2] gives move
counts [8, 8, 5]. This is fine — the constraint is on captures, not
moves. First burst is still most constrained (most captures, no overlap).

### 7. Solution output

Need to report per-burst: captures, overlap, total moves, and actual
timing (which differs from the zero-overlap pattern timing). The
`BurstSpec` type captures this. `getBurstInfosFromSpecs` would compute
the actual tick schedule for display.

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
