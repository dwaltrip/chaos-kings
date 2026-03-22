# Status

Last updated: 2026-03-22 (session 3.22-4)

## Current state

Deep phase analysis complete — three performance regimes identified across 26 boards (including 9 new 30x30). Board geometry near the general drives difficulty, not board size. `slowSearch()` (13 boards) and `slowPathgen()` (3 boards) defined as optimization targets in `test-boards.ts`.

The solver handles most boards in <100ms. Hard boards fall into three regimes: infeasible-target waste (timing entry explosion), deep recursive search (~90% candidate waste), and path generation cost. See `findings/3.22-3-deep-phase-analysis.md` for the full breakdown.

**Session 3.22-4 investigated pocket-11x11 infeasibility.** Exhaustive search over hand-designed burst patterns confirmed 24 captures is genuinely timing-infeasible on pocket boards (closest: 55 ticks, 5 over budget). The solver is correct. Naive pre-check approaches (#1 reachable tile count, #2 per-neighbor capacity) are dead — the binding constraint is timing, not tile availability. Thread 5 needs smarter approaches.

Start with `INTRO.md` for problem/model context. Start with `ROADMAP.md` for current direction and thread catalog.

## Completed threads

- **Deep phase analysis (threads 1 + 10, enhanced)** — see `findings/3.22-3-deep-phase-analysis.md`. Three regimes: infeasible-target waste (thread 5 lever), deep recursive search (thread 10 lever), path gen (thread 3/13 lever). Timing entries explode combinatorially (678/grp at cap=24 → 3,858 at cap=23 → 8,401 at cap=22) — board-independent, config-determined. Board size is not the driver: corner-9x9 takes 5.8s while 30x30 boards solve in 8-55ms.
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
- **Infeasible-target waste is the biggest single time sink** — 7 of 13 slowSearch boards spend 68-99% of time on infeasible targets. pocket-11x11 spends 99.2% of time on infeasible cap=24, then solves at cap=23 in 0.3ms.
- **Infeasible targets are genuinely infeasible** — confirmed on pocket-11x11 via exhaustive manual pattern search (session 3.22-4). The solver's feasibility check is correct, not over-pruning. The binding constraint is timing (50 ticks), not tile availability.
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

Next session: **Thread 5 — capture-target pre-check.** The highest-leverage optimization: 7 of 13 slowSearch boards spend 68-99% of time on infeasible targets. Naive approaches (reachable tile count, per-neighbor capacity union) are dead. Need smarter approaches — perhaps degree-based timing entry filtering, or root-level feasibility probes with better distance approximations. See `sessions/3.22-4-LOG.md` and the handoff doc for context.

See `ROADMAP.md` for the full thread catalog (13 threads, sequentially numbered).
