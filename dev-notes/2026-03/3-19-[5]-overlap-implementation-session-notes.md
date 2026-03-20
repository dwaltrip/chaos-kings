# Overlap Implementation Session — 2026-03-19

## What we did

Implemented prefix-only overlap re-traversal for custom-algo-1,
following the design in 3-19-[2]-overlap-design-sketch.md.

### Changes

**`get-burst-info.ts`** — New timing model:
- `BurstSpec` type (separate `moves`/`captures`)
- `TimingState` type (tick + generalTroops)
- `simulateOneBurst()` — simulates one burst, returns endTick + next state
- `getBurstInfosFromSpecs()` — simulates a full sequence of BurstSpecs
- Removed old `getMoveTicksForBurstPattern` and `getBurstInfos`

**`burst-patterns.ts`** — Uses `simulateOneBurst` instead of
`getBurstInfos` for timing validation. Pure refactor.

**`path-search.ts`** — Core overlap support:
- `countPrefixOverlap()` — validates prefix-only overlap pattern
- `findPaths()` takes optional `OverlapConfig`
- `search()` returns `SearchHit[]` (path + overlap count)
- Overlap loop tries 0, 1, 2, ... up to maxOverlapPerBurst
- Timing check prunes: if simulateOneBurst fails, higher overlap
  values are skipped
- `SearchResult` includes `burstSpecs` with actual moves/captures

**`solver.ts`** — Wired up:
- `maxOverlapPerBurst` added to SolverConfig (default 3)
- Passes OverlapConfig to findPaths
- Solution includes burstSpecs

**`run.ts`** — Shows overlap info per burst (e.g., `6cap+1ovlp`).

### Results

All 8 test boards now reach 24 captures (25 land):

| Board            | Pattern      | Overlap used | Time   |
|------------------|-------------|-------------|--------|
| open-7x7         | [12,7,3,2]  | none        | 45ms   |
| sparse-mtns-7x7  | [12,7,3,2]  | none        | 6ms    |
| corridor-7x7     | [12,6,4,2]  | b2: 1 tile  | 2853ms |
| maze-7x7         | [12,6,4,2]  | b2: 2 tiles | 1ms    |
| open-9x9         | [12,7,3,2]  | none        | 108ms  |
| sparse-mtns-9x9  | [12,7,3,2]  | none        | 7ms    |
| open-11x11       | [12,7,3,2]  | none        | 170ms  |
| sparse-mtns-11x11| [12,7,3,2]  | none        | 21ms   |

Key win: corridor-7x7 and maze-7x7 went from 23 → 24 captures.

### Test status

60 tests passing across 6 test files.

### Design decisions resolved during implementation

1. **burstSpecs population:** `search` returns `SearchHit[]`
   (path + overlap count), captured at source inside the overlap loop.
   `findPaths` maps hits → burstSpecs + paths.

2. **Existing zero-overlap tests:** Pass `maxOverlapPerBurst: 0` to
   solver tests that assert non-overlapping / pattern-length matching.

3. **Path length cap:** Implicit — `entriesByLen.get()` returns
   undefined for too-long paths, `continue` handles it.

### TODOs left for Daniel

- Verify hand-calculated timing values in get-burst-info.test.ts
  (marked with TODO comments). Especially the overlap>0 cases:
  - `2 captures + 1 overlap` → endTick=7
  - `3 captures + 2 overlap` → endTick=11
  - `getBurstInfosFromSpecs` overlap test (exact startTick/endTick)

### Open questions

- Corridor-7x7 takes 2.8s (checks 2 patterns). Could profile to
  see if countPrefixOverlap is a bottleneck, or if it's just the
  pattern space search.
- Should we add more constrained test boards to stress-test overlap?
