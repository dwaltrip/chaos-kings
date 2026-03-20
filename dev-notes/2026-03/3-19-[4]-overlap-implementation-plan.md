# Overlap Re-traversal — Implementation Plan

Reference: design sketch in 3-19-[2]-overlap-design-sketch.md

## Implementation blocks

Six blocks, each committed independently. Blocks 1-2 are pure
refactors (no behavior change). Block 3 is the core feature.
Block 4 wires it up. Block 5 adds tests. Block 6 validates.

---

### Block 1: New timing model in `get-burst-info.ts`

Add the new types and functions alongside the old ones, then
replace callers in subsequent blocks.

**Add:**

```ts
type BurstSpec = { moves: number; captures: number };

interface TimingState {
  tick: number;
  generalTroops: number;
}

function simulateOneBurst(
  captures: number,
  moves: number,
  state: TimingState,
  maxTicks: number,
): { endTick: number; nextState: TimingState } | null;
```

`simulateOneBurst` is the same tick-by-tick loop as
`getMoveTicksForBurstPattern`, but processes one burst at a time
and uses separate `captures`/`moves` params. When moves=captures,
behavior is identical to the old model (verified with 0 mismatches
in explore-overlap-patterns.ts).

Implementation: port from `explore-overlap-patterns.ts` lines 14-44,
which already has a working version. Two key differences from the
old loop:
- `troopsNeeded = captures + 1` (not `moves + 1`)
- `burstMovesRemaining = moves - 1` (not `captures - 1`)

**Add `getBurstInfosFromSpecs`:**

```ts
function getBurstInfosFromSpecs(
  specs: BurstSpec[],
  maxTicks: number,
): BurstInfo[] | null;
```

Calls `simulateOneBurst` for each spec in sequence, threading
`TimingState` through. Returns null if any burst exceeds maxTicks.
Used by solver to build solution output (where we know the actual
moves/captures per burst).

**Keep old functions for now.** `getMoveTicksForBurstPattern` and
`getBurstInfos` stay until blocks 2+4 update their callers, then
get removed.

**Exports:** `BurstSpec`, `TimingState`, `simulateOneBurst`,
`getBurstInfosFromSpecs`, plus existing exports.

---

### Block 2: Update `burst-patterns.ts` to use new timing

Replace `getBurstInfos` call in `genValidBurstPatterns` with
`simulateOneBurst`. The filter becomes:

```ts
// For each pattern, simulate all bursts with moves=captures
// (no overlap). Keep if the last burst fits within maxTicks.
return all.filter((pattern) => {
  let state: TimingState = { tick: 1, generalTroops: 1 };
  for (const captures of pattern) {
    const result = simulateOneBurst(captures, captures, state, maxTicks);
    if (!result) return false;
    state = result.nextState;
  }
  return true;
});
```

This is a pure refactor — same results as `getBurstInfos` filter.
Existing `burst-patterns.test.ts` tests validate this.

After this block, `burst-patterns.ts` no longer imports
`getBurstInfos`.

---

### Block 3: Overlap support in `path-search.ts`

This is the core change. Modify `findPaths` in place.

**Add `countPrefixOverlap`:**

```ts
function countPrefixOverlap(tiles: number[], coveredMask: bigint): number {
  let prefixLen = 0;
  while (prefixLen < tiles.length) {
    if (!(coveredMask & (1n << BigInt(tiles[prefixLen])))) break;
    prefixLen++;
  }
  for (let i = prefixLen; i < tiles.length; i++) {
    if (coveredMask & (1n << BigInt(tiles[i]))) return -1;
  }
  return prefixLen;
}
```

Returns prefix overlap count, or -1 if non-prefix overlap exists.

**New config type:**

```ts
interface OverlapConfig {
  maxOverlapPerBurst: number;
  maxTicks: number;
}
```

**Modify `findPaths` signature:**

```ts
function findPaths(
  entriesByLen: PathEntriesByLen,
  burstPattern: number[],
  overlapConfig?: OverlapConfig,
): SearchResult | null;
```

Optional param — when absent, current zero-overlap behavior exactly.

**Modify `search` inner function:**

When `overlapConfig` is provided, the recursive `search` function
gains a `TimingState` parameter and an overlap loop:

```ts
function search(
  burstIdx: number,
  coveredMask: bigint,
  timingState?: TimingState,
): PathEntry[] | null {
  if (burstIdx === burstPattern.length) return [];

  const captures = burstPattern[burstIdx];
  const maxOverlap = overlapConfig
    ? (burstIdx === 0 ? 0 : overlapConfig.maxOverlapPerBurst)
    : 0;

  for (let overlap = 0; overlap <= maxOverlap; overlap++) {
    const moves = captures + overlap;

    // timing check (only when overlap config present)
    let nextTimingState: TimingState | undefined;
    if (overlapConfig && timingState) {
      const result = simulateOneBurst(
        captures, moves, timingState, overlapConfig.maxTicks,
      );
      if (!result) break;  // prune: more overlap only adds ticks
      nextTimingState = result.nextState;
    }

    const candidates = entriesByLen.get(moves);
    if (!candidates) continue;

    for (const cand of candidates) {
      // overlap=0: fast bitmask check (current behavior)
      if (overlap === 0) {
        if ((cand.mask & coveredMask) !== 0n) {
          burstStats.overlapSkips++;
          continue;
        }
      } else {
        const prefixLen = countPrefixOverlap(cand.tiles, coveredMask);
        if (prefixLen !== overlap) continue;
      }

      burstStats.tried++;
      const newTilesMask = overlap > 0
        ? (cand.mask & ~coveredMask)
        : cand.mask;
      const rest = search(
        burstIdx + 1,
        coveredMask | newTilesMask,
        nextTimingState,
      );
      if (rest) {
        rest.unshift(cand);
        return rest;
      }
    }
  }

  return null;
}
```

Key design points:
- `overlap=0` preserves the existing fast bitmask-AND check
- Timing is computed once per (captures, overlap) pair, not per candidate
- `simulateOneBurst` returning null prunes all higher overlap values
- `newTilesMask` strips already-owned tiles from the candidate mask
  when overlap > 0, so `coveredMask` only accumulates new tiles
- Stats tracking extends naturally (overlapSkips for prefix mismatches)

**Update `SearchResult`:**

Add per-burst overlap info:

```ts
interface BurstAssignment {
  path: PathEntry;
  overlap: number;   // number of prefix overlap tiles
  captures: number;  // burstPattern[i]
  moves: number;     // captures + overlap
}

interface SearchResult {
  assignments: BurstAssignment[];
  coveredMask: bigint;
  stats: SearchStats;
  // keep `paths` as convenience accessor for backward compat
  paths: PathEntry[];
}
```

Wait — this changes the return type which ripples into solver.ts
and tests. Let me think about ordering...

Actually, simpler approach: keep the existing `paths` field on
SearchResult. Add a parallel `burstSpecs: BurstSpec[]` field that
records the actual (captures, moves) for each burst. This is enough
for the solver to build BurstInfos and the change is minimal.

```ts
interface SearchResult {
  paths: PathEntry[];
  burstSpecs: BurstSpec[];  // NEW: actual (captures, moves) per burst
  coveredMask: bigint;
  stats: SearchStats;
}
```

When overlap=0 (no config), `burstSpecs` entries have
moves=captures=burstPattern[i]. When overlap is used, moves
includes the overlap.

---

### Block 4: Wire up in `solver.ts` and `run.ts`

**`solver.ts`:**

Add `maxOverlapPerBurst` to `SolverConfig` (default 3).

Pass `OverlapConfig` to `findPaths`:

```ts
const overlapConfig: OverlapConfig = {
  maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  maxTicks: cfg.maxTicks,
};
const result = findPaths(entries, pattern, overlapConfig);
```

Update solution building to use `getBurstInfosFromSpecs`:

```ts
burstInfos: getBurstInfosFromSpecs(result.burstSpecs, cfg.maxTicks)!,
```

Update `Solution` type:

```ts
interface Solution {
  pattern: BurstPattern;
  burstSpecs: BurstSpec[];   // NEW
  burstInfos: BurstInfo[];
  paths: PathEntry[];
  coveredMask: bigint;
  totalCaptured: number;
}
```

**`run.ts`:**

Update display to show overlap per burst:

```ts
const spec = s.burstSpecs[i];
const overlapStr = spec.moves > spec.captures
  ? ` (${spec.captures}cap+${spec.moves - spec.captures}ovlp)`
  : '';
console.log(
  `    b${i + 1} (${spec.moves}mv) t=${bi.startTick}-${bi.endTick}${overlapStr}: ${coords.join(' ')}`,
);
```

**Remove old functions from `get-burst-info.ts`:**

After this block, `getMoveTicksForBurstPattern` and `getBurstInfos`
are no longer called by any production code. Remove them. Update
test imports.

---

### Block 5: Update tests

**`get-burst-info.test.ts`:**
- Add tests for `simulateOneBurst`:
  - Single burst, moves=captures: matches old model
  - Single burst, moves>captures: extra ticks consumed
  - Returns null when exceeds maxTicks
  - Verify threading: sequential bursts produce correct cumulative state
- Add tests for `getBurstInfosFromSpecs`:
  - Specs with moves=captures match old `getBurstInfos` output
  - Specs with overlap produce correct timing
  - Returns null for invalid (exceeds maxTicks)
- Update existing tests: replace `getMoveTicksForBurstPattern`
  references. The old parameterized test cases can be converted to
  test `simulateOneBurst` with moves=captures.

**`path-search.test.ts`:**
- Add tests for `countPrefixOverlap`:
  - All tiles new (no overlap): returns 0
  - Clean prefix overlap: returns correct count
  - Non-prefix overlap (gap): returns -1
  - Full overlap (all tiles owned): returns tiles.length
- Add tests for `findPaths` with overlap:
  - Open board, pattern that works without overlap: still works,
    overlap=0 in burstSpecs
  - Corridor board: pattern that fails without overlap succeeds
    with overlap config
- Keep existing tests unchanged (they call findPaths without
  overlapConfig, should still pass)

**`solver.test.ts`:**
- Update existing assertions that reference `solution.pattern`
  vs `solution.burstSpecs`
- Add: corridor-7x7 with overlap enabled gets >= 24 captures
  (this is the main validation — currently stuck at 23)
- Add: solution burstSpecs captures match pattern, moves >= captures

**`burst-patterns.test.ts`:**
- Existing tests should pass without changes (interface unchanged)

---

### Block 6: Validation

Run solver on all boards, compare with/without overlap:

```
npx tsx packages/algos/src/perfect-start-solver/custom-algo-1/run.ts
```

Expected results:
- Open/sparse boards: still 24 captures, same or similar patterns
  (overlap not needed, solver finds zero-overlap solution first)
- Corridor-7x7: 24 captures (up from 23) — the main win
- Maze-7x7: possibly 24 (depends on topology), at least 23

If corridor doesn't reach 24, check:
1. Is maxOverlapPerBurst=3 sufficient? Try higher.
2. Are the needed paths being generated? (path length = captures +
   overlap must be <= maxBurst)
3. Is prefix-only overlap too restrictive for this board?

---

## Implementation order summary

1. `get-burst-info.ts` — add new types/functions (additive)
2. `burst-patterns.ts` — use new timing (pure refactor)
3. `path-search.ts` — overlap support (core feature)
4. `solver.ts` + `run.ts` — wire up + remove old functions
5. Tests — update and add
6. Validate on all boards

Each block: implement, run tests, commit.
