# Status

Last updated: 2026-03-21 (session 3.21-2)

## Current state

The solver handles realistic 25x25 boards well — all 6 test boards solve in <500ms. Path generation is a significant fixed cost (20-60ms on 25x25). On easy boards (interior/edge generals), the solver finds a solution on the first burst-1 candidate and path gen dominates. On hard boards (degree-2 corners with constrained territory), search dominates but the waste is at the capture-target level — exhausting impossible targets (e.g., captures=24 and 23 on a board where max is 22) before finding a solution.

Symmetry breaking was analyzed thoroughly and deprioritized (low value on realistic boards). Group ordering was tested and produced a negative result (fewest-candidates-first is 3-8x slower; longest-first is already good).

The neighbor partitioning line of work (L1/L2/L3) and the ordering/symmetry line of work are both complete. Next session is a research reflection — revisiting the survey docs and brainstorming new directions.

Start with `INTRO.md` for problem/model context.

## Completed threads

- **Symmetry breaking analysis** — see `findings/3.21-symmetry-breaking-analysis.md`. BFS territory comparison under reflection is the correct approach, but local symmetry is rare on realistic boards. Contains 5 claims requiring independent verification. Deprioritized.
- **Group ordering experiment** — negative result (session 3.21-2). Fewest-candidates-first ordering is 3-8x slower than longest-first on most hard boards. Short burst-1 groups have fewer candidates but trigger deeper, more expensive recursion. Longest-first is already a good heuristic.
- **Realistic board profiling** — 6 boards at 25x25 with generated terrain. 4 solve in 20-53ms (path gen dominates). 2 tight-corner boards: 260ms and 412ms, 22 captures. Per-feasibility-check profiling shows neighbor check (N) kills 96%+ of entries.
- **L3 per-neighbor pruning** — see `findings/3.21-l3-per-neighbor-pruning.md`. Zero additional prunes on all 29 boards. Correct implementation, but the geometry that triggers it (asymmetric neighbor territories) isn't in the test suite. Kept in solver as cheap insurance. Produced useful infrastructure: `board-bfs.ts`, `NeighborInfo.blankMasks`.
- **L1 integration into solver-v3** — done in session 3.21-1. SearchContext, NeighborInfo struct, buildSolution helper, BucketKey namespace. 50% candidate reduction on corner boards confirmed. 68 tests passing.
- **3.2 Neighbor partitioning — Level 2** — see `findings/3.2-neighbor-partitioning-level-2.md`. Negative result: L2-without-grouping is slower than L1 on all boards. Revised pipeline documented. L2-with-grouping collapses to L1 on degree-2 boards (all our hard boards).
- **3.2 Neighbor partitioning — Level 1** — see `findings/3.2-neighbor-partitioning-level-1.md`. 1.28–1.41x speedup on corner boards, 50% candidate reduction. Confirms candidate scanning is the bottleneck on hard boards.
- **1.3 Path mask redundancy** — see `findings/1.3-path-mask-redundancy.md`. Compression ratio ~1.2x across all boards. Zero dominated masks. Dedup (4.1), inverted-index search, and cheap arc consistency are ruled out.

## Key decisions / learnings

- **Realistic 25x25 boards are not a scaling challenge** — all 6 solve in <500ms. The toy board performance was misleading about what needs optimizing.
- **Path generation is a significant fixed cost** — 20-60ms on 25x25 boards, dominates on easy boards. Search optimizations are irrelevant when path gen is the bottleneck.
- **Capture-target iteration may be a source of waste** — tight-corner boards get 22 captures, meaning the solver exhausts all timing groups at captures=24 and 23 before finding anything. Per-target timing hasn't been measured yet — worth profiling to see how much time is spent on infeasible targets and whether we can skip to the next target more quickly.
- **Longest-first group ordering is already good** — fewest-candidates-first was 3-8x worse. Long burst-1 captures the most tiles upfront, leaving less work for subsequent bursts.
- **Symmetry breaking has narrow applicability** — only helps on symmetric degree-2 boards, which are rare on realistic boards with random mountains.
- **The bottleneck is combinatorial, not spatial** — L3's zero-prune result combined with L2's negative result shows that per-neighbor spatial feasibility is not the binding constraint. Too many compatible candidates, not too few reachable tiles.
- **Candidate scanning is the bottleneck on hard boards** — Level 1 partitioning gave 1.28–1.41x from filtering alone, confirming that the inner candidate loop is where time goes on corner-general boards.
- **L1 is already optimal on degree-2 boards** — after burst-1 claims one neighbor, exactly one partition remains. No variant of L2 can improve on this.
- **Dropping grouping is never worth it** — timing-entry grouping amortizes candidate scanning. Any optimization that breaks grouping must compensate with large per-search savings.
- **Path masks are nearly unique** — non-backtracking paths on a grid are ~1:1 with their bitmasks. Dedup is not a lever.
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
- `findings/3.2-neighbor-partitioning-level-2.md` — Level 2 result + revised pipeline
- `findings/3.21-l3-per-neighbor-pruning.md` — L3 result + broader analysis
- `findings/3.21-symmetry-breaking-analysis.md` — symmetry breaking analysis + claims to verify
- `sessions/3.21-2-LOG.md` — session log (symmetry, group ordering, realistic profiling)
- `sessions/3.21-1-LOG.md` — session log (L1 integration, L3 pruning)
- `sessions/3.21-1-l1-integration-sketch.md` — L1 integration plan
- `sessions/3.20-2-solver-architecture-reference.md` — solver internals reference

## What's next

Next session is a **research reflection** — revisiting the survey and review docs with fresh eyes, informed by everything learned so far. Open-ended brainstorm about directions.

Candidate areas to explore (not prioritized — the reflection session will set priorities):

- **Capture-target pre-check** — skip impossible capture targets before entering the group loop. Could range from cheap (total reachable blanks) to expensive (path packing feasibility).
- **Phase timing instrumentation** — precise measurement of path gen vs timing table vs search breakdown. Partially answered (path gen is 20-60ms on 25x25) but not instrumented.
- **CSP / constraint propagation** — forced-move propagation (must-capture tiles with few covering paths). Most promising structural idea from the critical review, heaviest to implement.
- **Harder test boards** — larger boards (30x30+), tighter geometries that actually stress the solver. Terrain generator is in place.
- **Symmetry breaking implementation** — analysis complete, deprioritized unless realistic boards surface where it fires.
