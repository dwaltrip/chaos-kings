# Status

Last updated: 2026-03-23 (session 3.23-4)

## Current state

**Prefix set enumeration done — per-pattern counts are moderate, most sets are geometrically self-defeating.** For a given overlap pattern, hard boards have median ~20-24 prefix sets at N=5, D=4. But on constrained boards, 78-100% of these have at least one dead tip (free=0 when accounting for all tiles in the set). The "real" count of viable sets is much smaller. Important caveat: short bursts fully within the prefix don't need free tips — dead-tip analysis needs burst-length awareness. See `sessions/3.23-4-prefix-set-initial-exploration.md` for full data.

Prior session (3.23-3) validated the theory's core predictions: prefix pools are small (≤96 at D=4), fan-out narrowing is steep (~20-30x), most prefixes "open up" by D=3-4. See `sessions/3.23-3-prefix-enumeration-results.md`.

Theory doc: `PREFIX-STRUCTURE-THEORY.md`.
Reusable prefix utilities in `research-spike-1/prefix-utils.ts` (enumeration, prefix sets, visualization).
CLI: `tools/show-prefix-sets.ts`. 

Thread 7 (graph topology) initial spike is complete. Built reusable graph topology infrastructure (`utils/board-graph.ts`) and ran two experiments across all 46 boards. Key result: **slow boards split into two distinct populations** — structurally constrained (high pocket density near general) and structurally open (topology-free, difficulty is purely combinatorial from degree-2). These likely need different optimization strategies. See `sessions/3.23-1-graph-topology-analysis.md` for full data.

The solver handles most boards in <100ms. Hard boards fall into three regimes: infeasible-target waste, deep recursive search (~90% candidate waste), and path generation cost. See `findings/3.22-3-deep-phase-analysis.md` for the structural analysis (note: absolute times in that doc are pre-bugfix).

Start with `INTRO.md` for problem/model context. Start with `ROADMAP.md` for current direction and thread catalog.

## Completed threads

- **Thread 7 — graph topology (analysis phase)** — see `sessions/3.23-1-graph-topology-analysis.md`. Built `utils/board-graph.ts` (adjacency, corridors, Tarjan, region decomposition). Slow simple boards have zero articulation points — difficulty is combinatorial. Realistic boards have dozens of cut vertices but mostly gate small pockets; several have non-trivial secondary regions (20-100 tiles). Local structure analysis: slow boards split into structurally constrained (95-100% pocket near general) vs structurally open (0-3% constrained) populations.
- **Thread 5 — capture-target pre-check** — see `findings/thread-5-wrap-up.md`. Five approaches tried or analyzed across sessions 3.22-4 through 3.22-6. All dead. Infeasibility is path-level spatial incompatibility, not detectable by capacity-based pre-checks. Degree filter removed from solver.
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
- **Two populations of slow boards** — structurally constrained (tight-corner-1 at 95% pocket, tight-corner-2 at 100%) vs structurally open (corner-9x9 at 3%, corner-13x13 at 2%). Different optimization strategies likely needed.
- **"Structural features within burst range" is the right analysis lens** — global topology (cut vertices across the whole board) is less informative than local structure within distance 12 of the general.

## Key docs

- `INTRO.md` — problem, model, and what the research is about
- `BOARD-INFRA.md` — board loading, path generation, and utility infrastructure reference
- `ROADMAP.md` — **primary planning document** — thread catalog, deep-dives, key framings, resolved threads
- `EXPLORATION-SURVEY.md` — original idea catalog (4 themes, execution order)
- `SURVEY-DOC-CRITICAL-REVIEW.md` — critical review (missing techniques, contrarian takes)
- `README.md` — docs workflow guide
- `custom-algo-1/README.md` — solver implementation details
- `findings/` — experiment findings (one doc per completed experiment)
- `sessions/` — session logs and working notes
- `PREFIX-STRUCTURE-THEORY.md` — working theory on path prefix structure

## What's next

Several open analyses building on the prefix set enumeration results. See `sessions/3.23-4-prefix-set-initial-exploration.md` for the full list.

- **Burst-length-aware dead-tip analysis** — short bursts fully within the prefix don't need free tips. Refining the dead-tip filter with burst-length awareness will give tighter viability counts.
- **Prefix/suffix boundary** — per-prefix expansion profiles from tips. Does free≥2 actually open up or hit walls immediately?
- **Unordered set analysis** — how much of the set count is permutation noise vs real geometric diversity?
- **Candidate scoping** — for a viable prefix set + timing entry, how many full-length paths remain per burst?

See `ROADMAP.md` for the full thread catalog.
