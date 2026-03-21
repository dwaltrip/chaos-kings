# Status

Last updated: 2026-03-21 (session 3.20-3)

## Current state

Three experiments complete. L1 neighbor partitioning is proven (1.28–1.41x on hard boards). L2 explicit assignment without grouping was a negative result — per-entry overhead from dropped grouping outweighed assignment benefits. The original L1→L2→L3 pipeline has been revised: L1 is the foundation, L3's spatial pruning can be applied directly to L1 without L2 as an intermediate step.

The research spike is transitioning from experimentation to integration: L1 is ready to go into the main solver.

Start with `INTRO.md` for problem/model context.

## Completed threads

- **3.2 Neighbor partitioning — Level 2** — see `findings/3.2-neighbor-partitioning-level-2.md`. Negative result: L2-without-grouping is slower than L1 on all boards. Revised pipeline documented. L2-with-grouping collapses to L1 on degree-2 boards (all our hard boards).
- **3.2 Neighbor partitioning — Level 1** — see `findings/3.2-neighbor-partitioning-level-1.md`. 1.28–1.41x speedup on corner boards, 50% candidate reduction. Confirms candidate scanning is the bottleneck on hard boards. Mild overhead on easy boards.
- **1.3 Path mask redundancy** — see `findings/1.3-path-mask-redundancy.md`. Compression ratio ~1.2x across all boards. Zero dominated masks. Dedup (4.1), inverted-index search, and cheap arc consistency are ruled out.

## Key decisions / learnings

- **Candidate scanning is the bottleneck on hard boards** — Level 1 partitioning gave 1.28–1.41x from filtering alone, confirming that the inner candidate loop is where time goes on corner-general boards.
- **Easy boards have a different bottleneck** — they solve in <100ms with few candidates checked. Optimizations targeting the scan loop don't help here.
- **L1 is already optimal on degree-2 boards** — after burst-1 claims one neighbor, exactly one partition remains. No variant of L2 can improve on this.
- **Dropping grouping is never worth it** — timing-entry grouping amortizes candidate scanning. Any optimization that breaks grouping must compensate with large per-search savings. L2-without-grouping failed this test.
- **L3's spatial ideas don't require L2** — per-neighbor feasibility and partition ordering can be applied directly to L1's partition loop. The pipeline is L1 + L3, not L1→L2→L3.
- **L1 overhead can be reduced** — precompute neighbor bits (avoid BigInt allocation per depth), use arrays instead of Maps. Would make L1 closer to pure win on easy boards.
- **Degree-3 boards show higher candidate reduction** — hard-degree3-9x9 showed 53% reduction (vs 50% on degree-2). L1 gave 1.10x on a fast (~8ms) board, notable since other fast boards had slight regression.
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
- `findings/3.2-neighbor-partitioning-level-2.md` — Level 2 result + revised pipeline
- `sessions/3.20-2-neighbor-partitioning-levels.md` — original theory doc (three levels)
- `sessions/3.20-2-solver-architecture-reference.md` — solver internals reference
- `sessions/3.20-3-neighbor-assignment-notes.md` — L2 experiment analysis + review critique

## What's next

The next step is integrating L1 into the main solver, then adding L3 pruning.

Concrete candidates for next session:

1. **Integrate L1 into solver-v3** — replace flat candidate iteration with partitioned search. Reduce overhead: precompute neighbor bits, use arrays instead of Maps. Run full test suite to confirm speedups and no regressions.
2. **L3 pruning: per-neighbor feasibility** — precompute `neighborBlankMasks` (BFS from each neighbor excluding general, cumulative by distance). Add per-neighbor feasibility check in L1's partition loop: `popcount(neighborBlankMasks[B][M-1] & ~coveredMask) >= captures`. Strict prune, one bigint op per check.
3. **Symmetry breaking** — fix burst-1 direction on symmetric boards. Independent, stacks with everything. ~2x on symmetric degree-2 corners. ~10 lines.
4. **Group ordering** — reorder timing groups by feasibility heuristic. Attacks corner-9x9 bottleneck. ~10 lines.
