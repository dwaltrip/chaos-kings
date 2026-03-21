# Status

Last updated: 2026-03-20 (session 3.20-2)

## Current state

Two experiments complete. 3.2 Level 1 (neighbor partitioning) confirmed that candidate scanning is a real bottleneck on hard boards — 1.28–1.41x speedup on corner-general boards by partitioning candidates by starting neighbor and skipping irrelevant partitions. Easy boards unaffected (scanning isn't their bottleneck). The three-level pipeline progression is well understood and documented.

Start with `INTRO.md` for problem/model context.

## Completed threads

- **3.2 Neighbor partitioning — Level 1** — see `findings/3.2-neighbor-partitioning-level-1.md`. 1.28–1.41x speedup on corner boards, 50% candidate reduction. Confirms candidate scanning is the bottleneck on hard boards. Mild overhead on easy boards.
- **1.3 Path mask redundancy** — see `findings/1.3-path-mask-redundancy.md`. Compression ratio ~1.2x across all boards. Zero dominated masks. Dedup (4.1), inverted-index search, and cheap arc consistency are ruled out.

## Key decisions / learnings

- **Candidate scanning is the bottleneck on hard boards** — Level 1 partitioning gave 1.28–1.41x from filtering alone, confirming that the inner candidate loop is where time goes on corner-general boards.
- **Easy boards have a different bottleneck** — they solve in <100ms with few candidates checked. The bottleneck is elsewhere (likely path generation or feasibility pruning overhead). Optimizations targeting the scan loop don't help here.
- **The partition filter works for both zero-overlap and prefix-overlap bursts** — zero-overlap skips covered neighbors, prefix-overlap skips uncovered neighbors. Same mechanism, opposite filter.
- **Corner generals (degree-2) see exactly 50% reduction** — after burst-1 claims one of two neighbors, exactly one partition remains.
- **Path masks are nearly unique** — non-backtracking paths on a grid are ~1:1 with their bitmasks. Dedup is not a lever.
- Spatial/structural awareness is the main research direction — making the solver see what humans see (sectors, directional structure, bottlenecks)
- Constraint propagation (CSP framing) surfaced as a major missing angle in the critical review
- Tree packing (3.3) is likely a dead end per the review

## Key docs

- `INTRO.md` — problem, model, and what the research is about
- `EXPLORATION-SURVEY.md` — full idea catalog (4 themes, execution order)
- `SURVEY-DOC-CRITICAL-REVIEW.md` — critical review (missing techniques, contrarian takes)
- `README.md` — docs workflow guide
- `custom-algo-1/README.md` — solver implementation details
- `findings/1.3-path-mask-redundancy.md` — path mask redundancy result
- `findings/3.2-neighbor-partitioning-level-1.md` — Level 1 partitioning result
- `sessions/3.20-2-neighbor-partitioning-levels.md` — theory doc explaining all three levels
- `sessions/3.20-2-solver-architecture-reference.md` — solver internals reference

## What's next

The pipeline progression is clear: Level 1 (done) → Level 2 → Level 3. Each builds on the same `PartitionedEntries` data structure.

Concrete candidates for next session:

1. **Level 2: explicit neighbor assignment** — enumerate burst→neighbor assignments, search within single partitions per depth. Adds upfront pruning (skip assignments where a neighbor lacks candidates at the required length) and per-neighbor feasibility. Small implementation on top of existing infrastructure.
2. **Symmetry breaking** — fix burst-1 direction on symmetric boards. Independent of the pipeline, stacks with everything. On degree-2 corners this is a free 2x. ~10 lines.
3. **Group ordering** — reorder timing groups by feasibility heuristic instead of burst-1 length descending. Attacks the known corner-9x9 bottleneck (exhausting long burst-1 groups before finding solutions in shorter ones). ~10 lines.
4. **1.2 Phase timing** — less urgent now. Level 1 results already confirmed scanning is the bottleneck on hard boards. Still useful for understanding easy-board bottlenecks if we want to optimize those.
