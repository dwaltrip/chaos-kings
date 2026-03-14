# Optimal Solver — Kickoff & Reference

## Background

### The game

Generals.io is a real-time strategy game where players expand territory by
moving armies between adjacent tiles. Each player starts with a general tile
that produces +1 army every 2 ticks. Moving from a tile sends all but 1 army
to the destination. Moving onto a blank tile captures it. The goal is to
control as much territory as possible.

### The "perfect start" problem

In a real game, the opening turns are spent expanding into unclaimed territory
before encountering opponents. This expansion phase is purely mechanical —
there's an objectively optimal way to do it for any given board layout.

We're isolating this problem: **given a board with blanks and mountains, a
single general, no opponents, find the move sequence that maximizes land
count in N ticks.**

The mechanics that matter:
- One move per tick (or wait / do nothing)
- Tick 0 is the initial state. First move happens on tick 1 (though you
  have nothing to move yet). General produces +1 army on even ticks
  (first production on tick 2), so the first actual move is tick 3.
- Moving to blank: source keeps 1, destination gets `source.units - 1`
- Moving to friendly: source keeps 1, destination gains `source.units - 1`

### Why this matters

The immediate use case is the **puzzles minigame**: we need to know the max
possible score for a given board, and show the user what moves they could
have done to achieve it. There are often multiple optimal solutions for a
given board (sometimes a large number), so showing *an* optimal path is
enough.

Beyond puzzles:
- Benchmark AI opponents against provably optimal play
- Understand the game's expansion mechanics deeply (burst patterns, routing
  efficiency, army pipelining)
- Training content ("here's the optimal opening for this board")

### What we've built so far

**Phase 1: Beam search solver** (3-12 through 3-13)

Built a complete beam search solver with configurable scoring functions,
8 test boards (7x7 through 11x11), comparison runner, and analysis tooling.
Also built `core-next` — a flat typed-array board engine optimized for
high-throughput cloning and simulation.

Algorithm docs: `dev-notes/2026-03/3-12-[2]-perfect-start-solver-algorithm-ideas.md`

**Phase 2: Scorer experiments** (3-13 through 3-14)

Ran extensive experiments across scoring function families:
- **Capturable** (land×L + capturable×C) — estimates chain-capture potential via BFS
- **Frontier** (land×L + frontier_count) — counts blank tiles adjacent to territory
- **Gen-aware** (land×L + cap + gen×W) — credits armies on general tile
- **Superlinear** (land×L + excess²) — rewards concentrated armies
- **Weight sweeps** — land weights 1-10, cap weights 1-3

Results: all scorers cap at **24 land** on open-7x7 (optimal is 25).
frontier-5 is the best overall scorer. Most gen-aware and superlinear
variants were degenerate (1-12 land).

Full report: `dev-notes/2026-03/3-13-[8]-scorer-experiments-report.md`

### Why we're shifting to exact search

After extensive scorer experiments, beam search consistently hits 24 land
on open-7x7 where the optimal is 25. It's possible a better scoring function
or beam strategy could close the gap, but the deeper issue is that beam
search can never *guarantee* optimality — even if it finds 25, we can't
prove it's the best without exhaustive search.

The pattern we observed: every scorer converges on a "drip-feed" strategy
(wait 1 tick, send 1 army, repeat). The general never accumulates past 3-4.
The optimal strategy likely requires deliberate accumulation before bursting,
which looks strictly worse under any static scorer for many ticks before
paying off. Beam search struggles with this because it evaluates states
independently at each tick and prunes states that look worse now but lead
to better outcomes later.

Beam search remains valuable for use cases where a good approximate solution
is sufficient (e.g., AI opponents, real-time move suggestions). But for the
puzzles minigame we need proven optimal solutions, which requires exact search.

### How we're working on this

This is a collaborative exploration between Daniel and AI coding agents.
Both sides contribute algorithm ideas. Daniel brings game intuition and
design direction, and helps ground the work — pushing back on assumptions,
asking for ways to validate claims, and steering away from dead ends. The
agent brings implementation speed, systematic experimentation, and the
ability to quickly test ideas. The pattern is: discuss approaches, sketch
out designs together, implement and test, review results, iterate. The
dev-notes serve as shared context so new sessions can pick up where the
last one left off.

## Goal

Find provably optimal move sequences for perfect-start expansion on small
boards (7x7, 9x9). Prove optimality or get close with bounded suboptimality.

## State Space

On open-7x7 with 50 ticks:
- Each tick: ~(4 dirs × owned tiles with excess) + wait ≈ 5-20 legal moves
- Naive branching: ~20^50 — far too large for brute force
- But many paths reach identical board states (transpositions), and many
  branches are clearly suboptimal early

The search is tractable *with good pruning*. The question is which pruning
strategies cut deepest.

## Reusable Components from Beam Search Phase

### Core engine (`packages/algos/src/core-next/`)
- `FlatBoard` — typed array board with three parallel arrays:
  `Uint8Array types`, `Int8Array owners`, `Int32Array units`.
  Index scheme: `y * width + x`. Stats (landCounts, armyCounts) maintained
  incrementally. Cloning is O(n) via `.slice()` on each array.
- `processStep` — tick simulation: validates move, applies it (capture/merge),
  then runs production. Handles all 5 move outcomes (blank capture, friendly
  merge, defender wins, attacker wins, general capture).
- `Board` — neighbor lookups, coordinate conversion
- `fromBoardState` — converts test boards to flat format

### Solver infrastructure (`packages/algos/src/perfect-start-solver/prototyping/`)
- **`generateMoves`** (solver.ts) — returns `null` (wait) plus all
  `{ src, dir }` for owned tiles with >1 unit whose destination is passable.
  No strategic filtering — exhaustive enumeration of legal moves.
- **`fingerprintState`** (solver.ts) — one-byte-per-tile board hash:
  `min(units, 15)` for owned tiles, 0 otherwise, encoded via
  `String.fromCharCode`. Caps at 15 units (sufficient for dedup but may
  need revisiting for exact search if unit counts exceed 15).
  Generalizes to transposition table key when paired with tick.
- **Test boards** (test-boards.ts) — `parseBoard`, `allBoards`, all 8 boards
- **Simulation** (simulation.ts) — replay moves to get tick-by-tick stats
- **Tick log formatting** (format.ts, run-comparison.ts) — `formatTickLog`,
  `alignColumns`, `coordStr`, `formatMove` for visualizing solutions
- **Timing** (helpers.ts) — `runWithTiming` for profiling search phases

### Analysis tooling
- `analyze-results.ts` — pivot, summary, diff, regression views
- Results JSON format — board, scoring, beamWidth, finalLand, perf breakdown
- See `dev-notes/2026-03/3-13-[9]-scorer-experiments-report-appendix.md` for
  full toolchain docs (CLI usage, tick log reading, jq recipes)
- See `dev-notes/2026-03/3-13-[8]-scorer-experiments-report.md` for
  detailed performance numbers, scorer comparison tables, and per-board
  results across beam widths

## Key Observations from Beam Search

- **All scorers converge on "drip-feed"**: wait 1 tick, send 1 army, repeat.
  General never accumulates past 3-4. This is locally optimal but globally not.
- **The 25-land strategy requires burst patterns**: One known optimal path
  on open-7x7: accumulate to 11, burst 10 captures, accumulate to 9, burst
  8, then burst 4, burst 2 → 1+10+8+4+2 = 25. There are multiple optimal
  paths on open/minimal-obstruction boards. The general keeps producing
  during bursts so waits are shorter than expected.
- **Transpositions are common**: beam dedup removed 30-60% of candidates at
  beam=200. An exact search will see even more sharing.
- **Move ordering matters**: frontier-5 was the best scorer — its ranking
  could inform which moves to try first in exact search (speeds up pruning).

## Considerations for Exact Search

### Transposition table
Board fingerprinting already works (one byte per tile, cap at 15). For exact
search, store `(fingerprint, tick) → best_land_achievable`. If we reach a
state we've seen before at the same tick, skip it. At a later tick, it's
strictly worse — also skip.

### Upper bounds for pruning
For any state, we can compute an upper bound on achievable land:
`currentLand + totalExcessArmy + remainingProduction`. If this can't beat
the current best known solution, prune the branch.

### Dominated moves
Some moves are provably worse than alternatives:
- Waiting when you have excess army adjacent to blank tiles (could move instead
  and still wait later — strictly more options)
- Moving army away from frontier (into interior) when frontier tiles are available
- Sending 1 army to a tile that's not on any path to a blank

### Symmetry reduction
Open boards have 8-fold symmetry (4 rotations × 2 mirrors). First move breaks
some symmetry but not all. Could reduce search by 2-8x on symmetric boards.

### Move ordering from heuristics
Use beam search scorers (frontier-5) to rank moves before exploring them.
Better move ordering → earlier discovery of good solutions → more pruning.

---

## Possible Approaches

Daniel has a few ideas to discuss and explore:

1. **DP-inspired incremental board expansion**: Start with a single square
   available, expand to 1x2, 2x2, 3x2, 3x3, etc. Solve optimally on tiny
   boards and build up, potentially reusing sub-solutions.

2. **Aggressive pruning strategies**: Focus on identifying and eliminating
   "dead" states that can't possibly lead to optimal solutions — tighter
   upper bounds, dominated-state detection, early termination.

Other possibilities to consider:

- **DFS with alpha-beta style pruning**: Depth-first with best-known bound.
  Memory-efficient. Move ordering from heuristics helps.
- **BFS by tick with transposition table**: Explore all states at tick N
  before tick N+1. Natural dedup. But memory may blow up.
- **IDA* (iterative deepening A\*)**: Combines DFS memory efficiency with
  BFS optimality. Needs a good heuristic (admissible upper bound).
- **Constraint-based / meet-in-the-middle**: Solve first 25 ticks and last
  25 ticks separately, find compatible join points.
