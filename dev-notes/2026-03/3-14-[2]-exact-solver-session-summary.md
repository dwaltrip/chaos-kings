# Exact Solver — Session 1 Summary

## What we did

### 1. Updated kickoff doc
Added precision to `dev-notes/2026-03/3-13-[10]-optimal-solver-kickoff.md`:
- Tick timing (tick 0 = initial state, first production tick 2, first move tick 3)
- FlatBoard data structure internals (typed arrays, index scheme, incremental stats)
- `generateMoves` and `fingerprintState` implementation details
- Concrete 25-land burst sequence example
- Reference to experiments report for perf numbers

### 2. Promoted shared files from prototyping/
Moved reusable code from `perfect-start-solver/prototyping/` to `perfect-start-solver/`:
- `test-boards.ts`, `types.ts`, `helpers.ts`, `format.ts`, `simulation.ts` — direct promotions
- `moves.ts` — new file extracting `generateMoves`, `fingerprintState` (lossless, no unit cap),
  and `flatMoveToMove` from the beam search solver

Updated all prototyping imports to reference parent paths. Beam-search-specific
code (`beam-search.ts`, `solver.ts`, `scoring-functions.ts`, etc.) stays in prototyping/.

### 3. Built BFS-by-tick exact solver
`perfect-start-solver/exact-solver.ts` — implements the design from the design doc.
`perfect-start-solver/run-exact.ts` — CLI runner.

### 4. First results on open-7x7 (20 ticks)
```
tick  1:        1 states
tick  5:       15 states
tick 10:      552 states
tick 15:    38712 states
tick 20: 1154187 states
```
- **State space grows ~3x every 2 ticks** — exponential, will not reach 50 ticks without pruning
- **105 seconds for 20 ticks** — most time in later ticks
- **Found 10 land at tick 20** — the solver correctly discovers accumulate-then-burst
  (waits 10 ticks, then captures). This is the pattern beam search couldn't find.
- **50 ticks is not feasible** without pruning (extrapolated: trillions of states)

### 5. State space analysis
Built analysis scripts in `perfect-start-solver/tmp/`:
- `analyze-states.ts` — territory shape distribution, property distributions,
  within-territory variance, tile-by-tile army grids
- `dump-states.ts` — dumps all board states per tick to individual text files

Key findings from analysis (open-7x7 through tick 15):

**Territory dedup ratio grows but isn't enough alone:**
```
tick 10:    552 states →   278 territories (2.0x)
tick 15: 38712 states →  6898 territories (5.6x)
```

**The main waste is army position permutations within identical territories.**
At tick 15, the largest territory group has 35 variants — all with identical
`totalExcess=4`, `frontierExcess=4`, `interiorExcess=0`. The only difference
is which frontier tiles hold the excess units.

**Zero interior excess at these tick counts.** Territories are small enough
(max 8 land at tick 15) that nearly every owned tile is on the frontier.
Interior waste likely emerges later with larger territories.

## Current state of thinking on pruning

The exponential growth is driven by army-shuffling permutations — many states
are functionally equivalent (same territory, same total army) but differ in
which tiles hold the excess.

Ideas discussed but not yet implemented:
- **Territory + total excess dedup** — collapse all army permutations for same
  territory into one representative. Aggressive but high-impact.
- **Upper bound pruning** — `land + totalExcess + remainingProduction < bestKnown` → prune
- **Restricted move generation** — skip moves that are provably useless

The "keep highest general army per territory" idea was rejected — states
mid-expansion have low general army but are actively capturing, so this would
kill productive states.

Daniel is reviewing the tick-12 state dumps to look for patterns visually
before we decide on a pruning approach.

## Next steps
- Review state dumps for visual patterns / pruning intuitions
- Design and implement first pruning pass
- Goal: make open-7x7 at 50 ticks tractable

## File inventory

New/modified in `packages/algos/src/perfect-start-solver/`:
- `exact-solver.ts` — BFS-by-tick exact solver
- `run-exact.ts` — CLI runner
- `moves.ts` — promoted: generateMoves, fingerprintState (lossless), flatMoveToMove
- `types.ts` — promoted: Move, ArmySnapshot, SimulationResult
- `helpers.ts` — promoted: ALL_DIRECTIONS, toMoveEvent, runWithTiming
- `format.ts` — promoted: alignColumns, coordStr, formatMove, formatTable, num
- `simulation.ts` — promoted: simulate
- `test-boards.ts` — promoted: parseBoard, allBoards, makeBoard
- `tmp/analyze-states.ts` — state space analysis script
- `tmp/dump-states.ts` — dumps all states per tick to text files
- `tmp/data/` — output directory for analysis/dump files
