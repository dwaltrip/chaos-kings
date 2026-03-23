# Status

Last updated: 2026-03-22 (session 3.22-6)

## Current state

Deep phase analysis complete — three performance regimes identified across 45 boards. Board geometry near the general drives difficulty, not board size. 12 slow boards are the optimization targets. See `sessions/3.22-6-profiling-overview-post-bugfix.md` for the current baseline numbers (post-bugfix).

The solver handles most boards in <100ms. Hard boards fall into three regimes: infeasible-target waste (timing entry explosion), deep recursive search (~90% candidate waste), and path generation cost. See `findings/3.22-3-deep-phase-analysis.md` for the structural analysis (note: absolute times in that doc are pre-bugfix).

**Session 3.22-6** established post-bugfix profiling baseline and spiked degree-based timing entry filtering (Thread 5). The filter kills 60-90% of entries but is strictly weaker than the in-search N feasibility check — no meaningful perf impact. See `findings/3.22-6-degree-filter.md`.

**Session 3.22-5 fixed a bug in aggregate feasibility pruning.** `blankTilesWithinDist` heuristic massively underestimated available tiles, falsely pruning valid entries. pocket-2-11x11 now correctly finds 24 captures. Several boards got 2-4x slower as false prunes no longer mask infeasible-target waste. See `sessions/3.22-5-LOG.md`.

**Session 3.22-4** attempted to prove that 24 captures is timing-infeasible on pocket-11x11, but the results are affected by the solver bug (fixed in 3.22-5). Naive pre-check approaches (#1 reachable tile count, #2 per-neighbor capacity) are dead — the binding constraint is timing, not tile availability.

Start with `INTRO.md` for problem/model context. Start with `ROADMAP.md` for current direction and thread catalog.

## Completed threads

- **Degree-based timing entry filter (from thread 5)** — see `findings/3.22-6-degree-filter.md`. Filter entries where zero-overlap bursts > general's degree. Kills 60-90% of entries but strictly weaker than in-search N check — no perf impact. Kept with TODO.
- **Deep phase analysis (threads 1 + 10, enhanced)** — see `findings/3.22-3-deep-phase-analysis.md` (note: absolute times are pre-bugfix). Three regimes: infeasible-target waste (thread 5 lever), deep recursive search (thread 10 lever), path gen (thread 3/13 lever). Timing entries explode combinatorially (678/grp at cap=24 → 3,858 at cap=23 → 8,401 at cap=22) — board-independent, config-determined. Board size is not the driver.
- **Phase timing + scan waste (threads 1 + 10, initial)** — see `sessions/3.22-2-phase-timing-and-scan-waste.md`. Built profiling infrastructure. Preliminary data identified infeasible-target waste and candidate scan waste.
- **BigInt vs Uint32Array (thread 4)** — see `sessions/3.22-2-bigint-vs-uint32array.md`. No board-size cliff. U32 is 1.7-1.8x faster on hot-path at 625-900 bits. BigInt wins on union.
- **Symmetry breaking analysis** — see `findings/3.21-symmetry-breaking-analysis.md`. BFS territory comparison under reflection is the correct approach, but local symmetry is rare on realistic boards. Deprioritized.
- **Group ordering experiment** — negative result (session 3.21-2). Fewest-candidates-first 3-8x slower. Longest-first is already good.
- **Realistic board profiling** — 6 boards at 25x25. 4 solve in 20-53ms (path gen dominates). 2 tight-corner boards: 260-412ms, 22 captures.
- **L3 per-neighbor pruning** — see `findings/3.21-l3-per-neighbor-pruning.md`. Zero additional prunes on all 29 boards. Kept as cheap insurance. Produced `board-bfs.ts`, `NeighborInfo.blankMasks`.
- **L1 integration into solver-v3** — 50% candidate reduction on corner boards. 68 tests passing.
- **L2 neighbor assignment** — inconclusive. Collapses to L1 on degree-2 boards.
- **L1 neighbor partitioning** — see `findings/3.2-neighbor-partitioning-level-1.md`. 1.28-1.41x speedup on corner boards.
- **Path mask redundancy (1.3)** — see `findings/1.3-path-mask-redundancy.md`. ~1.2x compression. Dedup killed.

## Key decisions / learnings

- **Three distinct performance regimes** — infeasible-target waste, deep recursive search, path generation. Different boards need different optimizations. See finding doc for classification of all 13 slowSearch boards.
- **Board geometry near the general drives difficulty, not board size** — corner-9x9 (81 tiles) = 5.8s; fairly-open-30x30 (900 tiles) = 55ms.
- **Timing entry counts are board-independent** — same config → same entries/group at each capture target. 678/grp at cap=24, 3,858 at cap=23, 8,401 at cap=22. The board only determines which targets are feasible.
- **Infeasible-target waste is the biggest single time sink** — 6 of 12 slow boards spend 66-99% of time on infeasible targets (post-bugfix numbers). pocket-11x11 spends 99.6% on infeasible cap=24.
- **Aggregate feasibility was over-pruning** — session 3.22-5 found `entryIsFeasibleAggregate` falsely pruned valid entries on pocket-2-11x11 due to a distance heuristic bug (now fixed). The session 3.22-4 experiment that "confirmed" pocket-11x11 infeasibility also had a bug (ascending sort on timing check). The fixed solver is now the authoritative source — pocket-11x11 still gets 23 after the fix, but via exhaustive solver search, not the flawed experiment.
- **scattered-pockets-13x13 is NOT tile-count-limited** — has plenty of reachable tiles, geometry just makes them hard to capture within timing constraints. Simple "reachable tiles < target" pre-checks won't work on any current board.
- **At 24 captures, max total overlap is 9 tiles** (with maxBursts=6, maxOverlapPerBurst=3). All 24-capture entries land at ticks 49-50 — zero timing slack.
- **Neighbor check (N) is the dominant feasibility filter** — kills 53-100% of entries across all boards. perBurst (P) almost never fires (<2%). Aggregate (A) fires meaningfully on some boards (up to 47% on scattered-pockets).
- **Candidate scanning is the bottleneck on deep-search boards** — L1 partitioning gave 1.28-1.41x from filtering alone.
- **Longest-first group ordering is already good** — fewest-candidates-first was 3-8x worse.
- **L1 is optimal on degree-2 boards** — after burst-1 claims one neighbor, exactly one partition remains.
- **Path masks are nearly unique** — dedup is not a lever.
- **Board structure vs path structure** — two complementary lenses. Most powerful optimizations probably exploit both.

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

TBD. Thread 5 (capture-target pre-check) seemed like the highest-leverage optimization, but the path forward is unclear. Naive approaches are dead (reachable tile count, per-neighbor capacity), and the degree-based filter turned out to be strictly weaker than existing checks. Need a different angle for skipping infeasible targets cheaply.

See `ROADMAP.md` for the full thread catalog (13 threads, sequentially numbered).
