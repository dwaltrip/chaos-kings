# Status

Last updated: 2026-03-22 (session 3.21-3)

## Current state

Research reflection session complete. Produced a draft of `ROADMAP.md` — a comprehensive thread catalog and deep-dive document covering all promising directions for the next phase. The roadmap needs finishing: restructure board structure sections (C6/C7/C8/C9) into 3 layers, renumber threads, final consistency pass and review. Updated performance targets: sub-100ms for all boards (stretch: sub-50ms), board scope expanded to include 30x30.

The solver handles realistic 25x25 boards in <500ms. Path gen is 20-60ms (dominates on easy boards). Search dominates on tight-corner boards (260-412ms). The first 5 sessions explored neighbor partitioning (L1/L2/L3), group ordering, symmetry breaking, and path mask redundancy — producing definitive results that narrow the search space of ideas.

Start with `INTRO.md` for problem/model context. Start with `ROADMAP.md` for current direction and thread catalog.

## Completed threads

- **Symmetry breaking analysis** — see `findings/3.21-symmetry-breaking-analysis.md`. BFS territory comparison under reflection is the correct approach, but local symmetry is rare on realistic boards. Contains 5 claims requiring independent verification. Deprioritized.
- **Group ordering experiment** — negative result (session 3.21-2). Fewest-candidates-first ordering is 3-8x slower than longest-first on most hard boards. Short burst-1 groups have fewer candidates but trigger deeper, more expensive recursion. Longest-first is already a good heuristic.
- **Realistic board profiling** — 6 boards at 25x25 with generated terrain. 4 solve in 20-53ms (path gen dominates). 2 tight-corner boards: 260ms and 412ms, 22 captures. Per-feasibility-check profiling shows neighbor check (N) kills 96%+ of entries.
- **L3 per-neighbor pruning** — see `findings/3.21-l3-per-neighbor-pruning.md`. Zero additional prunes on all 29 boards. Correct implementation, but the geometry that triggers it (asymmetric neighbor territories) isn't in the test suite. Kept in solver as cheap insurance. Produced useful infrastructure: `board-bfs.ts`, `NeighborInfo.blankMasks`.
- **L1 integration into solver-v3** — done in session 3.21-1. SearchContext, NeighborInfo struct, buildSolution helper, BucketKey namespace. 50% candidate reduction on corner boards confirmed. 68 tests passing.
- **3.2 Neighbor partitioning — Level 2** — see `findings/3.2-neighbor-partitioning-level-2.md`. Inconclusive: L2-without-grouping is slower than L1 on all boards (dropped grouping was a design error). L2-with-grouping collapses to L1 on degree-2 boards (all our hard boards). Could have value on degree-3+ if properly implemented.
- **3.2 Neighbor partitioning — Level 1** — see `findings/3.2-neighbor-partitioning-level-1.md`. 1.28–1.41x speedup on corner boards, 50% candidate reduction. Confirms candidate scanning is the bottleneck on hard boards.
- **1.3 Path mask redundancy** — see `findings/1.3-path-mask-redundancy.md`. Compression ratio ~1.2x across all boards. Zero dominated masks. Dedup (4.1), inverted-index search, and cheap arc consistency are ruled out.

## Key decisions / learnings

- **Realistic 25x25 boards are not a scaling challenge** — all 6 solve in <500ms. The toy board performance was misleading about what needs optimizing.
- **Path generation is a significant fixed cost** — 20-60ms on 25x25 boards, dominates on easy boards. Search optimizations are irrelevant when path gen is the bottleneck.
- **Capture-target iteration may be a source of waste** — tight-corner boards get 22 captures, meaning the solver exhausts all timing groups at captures=24 and 23 before finding anything. Per-target timing hasn't been measured yet.
- **The specific spatial approaches tried so far haven't been the binding constraint** — L2/L3/symmetry all underperformed. But these represent a small slice of the spatial possibility space; broader approaches (sector decomposition, bottleneck detection) remain untested.
- **Candidate scanning is the bottleneck on hard boards** — Level 1 partitioning gave 1.28–1.41x from filtering alone, confirming that the inner candidate loop is where time goes on corner-general boards.
- **Longest-first group ordering is already good** — fewest-candidates-first was 3-8x worse.
- **L1 is already optimal on degree-2 boards** — after burst-1 claims one neighbor, exactly one partition remains.
- **Dropping grouping is never worth it** — timing-entry grouping amortizes candidate scanning.
- **Path masks are nearly unique** — non-backtracking paths on a grid are ~1:1 with their bitmasks. Dedup is not a lever.
- **Board structure vs path structure** — two complementary lenses identified during session 3.21-3. Board structure = terrain properties. Path structure = candidate set properties. Most powerful optimizations probably exploit both.
- **Non-backtracking paths are more tree-like than assumed** — early branching is "sticky" because self-avoiding walks can't cross their own trail. Relevant for sector/tree reasoning.

## Key docs

- `INTRO.md` — problem, model, and what the research is about
- `ROADMAP.md` — **primary planning document** — thread catalog, deep-dives, key framings, resolved threads
- `EXPLORATION-SURVEY.md` — original idea catalog (4 themes, execution order)
- `SURVEY-DOC-CRITICAL-REVIEW.md` — critical review (missing techniques, contrarian takes)
- `README.md` — docs workflow guide
- `custom-algo-1/README.md` — solver implementation details
- `findings/` — experiment findings (one doc per completed experiment)
- `sessions/` — session logs and working notes

## What's next

Next session: **finish ROADMAP.md revisions** (restructure board structure sections into 3 layers, renumber threads, final consistency pass, opus review). Then pick first experiments.

See `ROADMAP.md` for the full thread catalog. Priority areas for the broad phase:
- Profiling / measurement (phase timing, path gen profiling, BigInt benchmark)
- Board structure analysis (graph topology, directional structure, spatial path analysis)
- Capture-target pre-check
- Watched literals / inner-loop measurement
- Board suite expansion (more 25x25, 30x30+)
