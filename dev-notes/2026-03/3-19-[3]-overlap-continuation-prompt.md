# Custom Algo — Overlap Re-traversal Implementation

## Context

Read these for full background:
- dev-notes/2026-03/3-19-[2]-overlap-design-sketch.md (the design)
- dev-notes/2026-03/3-19-[1]-custom-algo-session-notes.md (prior session)
- dev-notes/2026-03/3-18-[1]-notes-for-custom-algo-burst-path-search.md (algorithm idea)

Code is in packages/algos/src/perfect-start-solver/custom-algo-1/

## Where we are

The solver works end-to-end. It enumerates burst patterns (sequences
of capture counts that fit within 50 ticks), generates all
non-backtracking paths from the general via DP, and uses bitmask
backtracking to find non-overlapping path assignments. Gets 24
captures (25 land) on open/sparse boards, 23 on corridor/maze.
48 tests passing.

Currently bursts cannot re-traverse already-owned tiles, which is
why constrained boards (corridor, maze) fall short. The design for
overlap re-traversal is complete — prefix-only overlap, updated
timing model (BurstSpec with separate moves/captures), modified
findPaths with overlap loop and timing threading. See the design
sketch for full pseudocode and resolved decisions.

Exploration scripts in tmp-scripts/ validate the timing model and
pattern space. Run them to get oriented:

- `explore-overlap-patterns.ts` — overlap pattern space analysis
- `bench-core-ops.ts` — per-operation timing benchmarks
- `measure-pattern-gen.ts` — pattern generation costs

## What to implement

The design sketch (3-19-[2]) has the full plan. In summary:

1. `get-burst-info.ts` — add BurstSpec/TimingState/simulateOneBurst,
   replace old functions, update all callers
2. `path-search.ts` — add countPrefixOverlap, modify findPaths with
   overlap support (in place, don't duplicate backtracking)
3. `solver.ts` — add maxOverlapPerBurst to SolverConfig, pass to
   findPaths, update Solution type
4. `burst-patterns.ts` — use new timing interface
5. Update tests
6. Run on all boards, check corridor-7x7 improvement

## Workflow

1. Get up to speed: read code, key docs, run exploratory scripts
2. Write implementation plan as dev-note, commit
3. Opus sub-agent reviews plan; discuss feedback with Daniel
4. Align, update plan, commit
5. Implement in blocks, committing after each
6. Opus sub-agent reviews implementation; discuss with Daniel
7. Fix issues, commit
8. Try out new code, run experiments if context allows
9. Session notes writeup to close out
