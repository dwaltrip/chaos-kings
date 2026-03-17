# Scratch Buffer Session Notes

Implemented the scratch buffer design from `3-17-[3]-sa-board-pool-design.md`.

## What was built

- **`copyInto(target, source)`** in `core-next/flat-board.ts` — copies board data into existing typed arrays via `.set()`, avoiding allocation.
- **`allocateScratchBoards`** + **`simulateIntoScratch`** in `sim-anneal.ts` — pre-allocates `totalTicks` boards at SA init. Forward simulation writes into scratch boards. On acceptance, scratch boards are cloned into durable stateCache entries. On rejection, nothing is allocated.
- **Timing accumulator refactor** — replaced the duplicated profiled/non-profiled code paths in `runSA` with a single path using optional `TimingAccum`. `generateNeighbor` and `simulateForward` accept an optional `ta` param; `if (ta)` guards around `performance.now()` calls. Profiling still works via `profile: true` in SAConfig.

## Results

| Board | Before | After | Speedup |
|-------|--------|-------|---------|
| open-7x7 (50k iters) | 1.00s | 0.88s | 12% |
| open-11x11 (50k iters) | 2.15s | 1.84s | 14% |

Scores are equivalent across both versions.

## Design doc vs. implementation

The implementation followed the design closely. One deviation: the design doc suggested the refactor of profiled/non-profiled duplication as pre-work, and we did that — but the optional `TimingAccum` approach ended up being simpler than expected (just `if (ta)` guards, no separate code paths needed).

The design doc's "Considered and Deferred" items (skip stateCache on rejection, scratch moves array) remain deferred — the 0.65% savings from skipping stateCache construction isn't worth the complexity.

## Detour: applyProduction loop fusion regression

We also tried fusing `applyProduction`'s two separate loops (general production + land production) into a single loop with computed `bonus`. This caused a ~47% regression — V8 optimizes the simple separate loops much better. Reverted. The early-exit on non-production ticks (which was part of the same change) is fine on its own, but the current code doesn't include it since we reverted the whole thing.
