# Solver Perf Handoff

## Context

Read these for background:
- `dev-notes/2026-03/3-17-[2]-ad-hoc-solver-perf-notes.md` — initial perf observations
- `dev-notes/2026-03/3-17-[3]-sa-board-pool-design.md` — scratch buffer design doc
- `dev-notes/2026-03/3-17-[4]-scratch-buffer-session-notes.md` — session results

## Current state

Branch `solver-n-core-next-perf`. The scratch buffer is implemented and gives 12-14% speedup. Profile breakdown at 100k iters on open-7x7:

- **processStep: ~70-77%** — the main bottleneck
- **cloneBoard: ~14-20%** — reduced by scratch buffer, but still significant
- **generateMoves: ~2%**
- **arrayBuild: ~1%**

## What to explore

### processStep internals
- Profile *within* processStep — is it move validation, army transfer, or the production loop that dominates?
- `applyProduction` iterates all N tiles every production tick. Could maintain a list of production tiles (generals/cities) instead of scanning. More impactful on larger boards.
- Note: fusing the two production loops into one was a 47% regression (V8 JIT issue). Keep the two separate loops.

### Partial board cloning
- The SA state cache clones the entire board at every tick, but often only a few tiles change between ticks (1 move + possibly production). Could we do structural sharing or delta-based snapshots?
- Trade-off: reading from a delta chain is slower than reading from a flat array. Would need to measure whether the clone savings outweigh the read overhead given how often boards are read (generateMoves reads neighbors of every owned tile).

### SA-specific ideas
- **Smarter stateCache invalidation** — when a neighbor changes tick t, ticks 0..t are shared. Could we share even more if the new move produces the same board state as the old one at some tick t+k?

### Beam search solver
- Uses `cloneState` (wraps `cloneBoard`) as a callback to the generic beam search engine. Same clone-per-branch pattern as exact solver.
- The beam search clones per-move at each tick level, then scores and prunes to beam width. Boards outside the beam are discarded — similar GC pattern to SA's rejected neighbors.
- Could benefit from scratch buffer pooling too, but the pool size varies per level (= beam width × legal moves per state). Would need a dynamically-sized pool or a freelist.
- Scoring functions (`prototyping/scoring-functions.ts`) run on every candidate board. If scoring is expensive, reducing candidates before scoring could help.

### Cross-solver ideas
- **Incremental move generation** — `generateMoves` scans all tiles to find owned ones with >1 army. Could maintain a "movable tiles" set that's updated incrementally by processStep. Benefits all solvers.
- **Board fingerprint caching** — the exact solver uses `fingerprintState` for dedup. Could fingerprints be updated incrementally?
- **Partial board cloning** — see above section.

### Key files
- `packages/algos/src/core-next/process-step.ts` — processStep, applyMove, applyProduction
- `packages/algos/src/core-next/flat-board.ts` — FlatBoard, cloneBoard, copyInto
- `packages/algos/src/perfect-start-solver/sim-anneal/sim-anneal.ts` — SA loop
- `packages/algos/src/perfect-start-solver/exact-solver.ts` — exact BFS solver
- `packages/algos/src/perfect-start-solver/prototyping/solver.ts` — beam search solver (wraps generic beam-search.ts)
- `packages/algos/src/perfect-start-solver/prototyping/beam-search.ts` — generic beam search engine
- `packages/algos/src/perfect-start-solver/prototyping/scoring-functions.ts` — scorer implementations
- `packages/algos/src/perfect-start-solver/moves.ts` — generateMoves, fingerprintState
- `packages/algos/src/perfect-start-solver/sim-anneal/tmp-scripts/profile-sa.ts` — SA profiler script

### How to benchmark
```bash
# From packages/algos/
npx tsx src/perfect-start-solver/sim-anneal/tmp-scripts/profile-sa.ts  # SA profiled runs
npx tsx src/perfect-start-solver/sim-anneal/run-sa.ts --iterations 50000 --t0 3.0 --seeds 5  # SA wall clock
npx tsx src/perfect-start-solver/sim-anneal/run-sa.ts --board open-11x11 --iterations 50000 --t0 3.0 --seeds 5  # SA larger board
npx tsx src/perfect-start-solver/prototyping/run-comparison.ts  # beam search comparison runner
```
