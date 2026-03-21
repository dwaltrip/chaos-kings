# Status

Last updated: 2026-03-21 (session 3.21-1)

## Current state

L1 neighbor partitioning is integrated into solver-v3 with reduced overhead. L3 per-neighbor pruning is implemented but produced zero additional prunes on all test boards — per-neighbor spatial feasibility is not the binding constraint on current boards. The bottleneck on hard boards is combinatorial (too many compatible candidates), not spatial.

The neighbor partitioning branch of work (L1/L2/L3) is complete. The research spike is pivoting to ordering and early-termination approaches.

Start with `INTRO.md` for problem/model context.

## Completed threads

- **L3 per-neighbor pruning** — see `findings/3.21-l3-per-neighbor-pruning.md`. Zero additional prunes on all 29 boards. Correct implementation, but the geometry that triggers it (asymmetric neighbor territories) isn't in the test suite. Kept in solver as cheap insurance. Produced useful infrastructure: `board-bfs.ts`, `NeighborInfo.blankMasks`.
- **L1 integration into solver-v3** — done in session 3.21-1. SearchContext, NeighborInfo struct, buildSolution helper, BucketKey namespace. 50% candidate reduction on corner boards confirmed. 68 tests passing.
- **3.2 Neighbor partitioning — Level 2** — see `findings/3.2-neighbor-partitioning-level-2.md`. Negative result: L2-without-grouping is slower than L1 on all boards. Revised pipeline documented. L2-with-grouping collapses to L1 on degree-2 boards (all our hard boards).
- **3.2 Neighbor partitioning — Level 1** — see `findings/3.2-neighbor-partitioning-level-1.md`. 1.28–1.41x speedup on corner boards, 50% candidate reduction. Confirms candidate scanning is the bottleneck on hard boards.
- **1.3 Path mask redundancy** — see `findings/1.3-path-mask-redundancy.md`. Compression ratio ~1.2x across all boards. Zero dominated masks. Dedup (4.1), inverted-index search, and cheap arc consistency are ruled out.

## Key decisions / learnings

- **The bottleneck is combinatorial, not spatial** — L3's zero-prune result combined with L2's negative result shows that per-neighbor spatial feasibility is not the binding constraint. Too many compatible candidates, not too few reachable tiles.
- **Candidate scanning is the bottleneck on hard boards** — Level 1 partitioning gave 1.28–1.41x from filtering alone, confirming that the inner candidate loop is where time goes on corner-general boards.
- **Easy boards have a different bottleneck** — they solve in <100ms with few candidates checked. Optimizations targeting the scan loop don't help here.
- **L1 is already optimal on degree-2 boards** — after burst-1 claims one neighbor, exactly one partition remains. No variant of L2 can improve on this.
- **Dropping grouping is never worth it** — timing-entry grouping amortizes candidate scanning. Any optimization that breaks grouping must compensate with large per-search savings. L2-without-grouping failed this test.
- **Path masks are nearly unique** — non-backtracking paths on a grid are ~1:1 with their bitmasks. Dedup is not a lever.
- **Test suite may not be hard enough** — worst case is ~1.5s (corner-9x9). Symmetry breaking + group ordering could bring everything under 200ms. Need harder boards (asymmetric neighbors, larger boards, more mountains) and clarity on whether the goal is optimizing current boards or handling intractable ones.
- **Phase timing is a gap** — search vs path-gen breakdown was never measured. The assumption that search dominates is untested.
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
- `sessions/3.21-1-LOG.md` — session log with reviewer feedback
- `sessions/3.21-1-l1-integration-sketch.md` — L1 integration plan
- `sessions/3.20-2-solver-architecture-reference.md` — solver internals reference

## What's next

The neighbor partitioning line of work is complete. Next directions, in priority order:

1. **Symmetry breaking** — fix burst-1 direction on symmetric boards. One `continue` statement, instant ~2x on symmetric degree-2 corners. Independent, stacks with everything. Overdue.
2. **Group ordering** — reorder timing groups by feasibility heuristic. Solver currently exhausts all longer-burst-1 groups before trying shorter ones. ~10 lines, significant practical win.
3. **Add harder test boards** — boards with asymmetric neighbor territories (general at mouth of corridor), larger constrained boards, higher capture targets. Needed to validate future optimizations and exercise L3.
4. **Phase timing** — measure search vs path-gen breakdown. Validate the assumption that search dominates.
5. **CSP / constraint propagation** — forced-move propagation (must-capture tiles with few covering paths). Most promising structural idea, heaviest to implement.
