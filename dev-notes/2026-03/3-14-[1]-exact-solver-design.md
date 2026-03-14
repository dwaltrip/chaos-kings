# Exact Solver — First Pass Design

## Context

Following the beam search phase (3-12 through 3-13), we're building an exact
solver for the perfect-start expansion problem. Beam search with every scorer
we tried caps at 24 land on open-7x7 where the optimal is 25. The fundamental
issue is that static scorers can't handle temporal credit assignment — optimal
play requires accumulating armies on the general (looking terrible for many
ticks) before bursting a chain of captures. Beam search prunes these
"worse-looking" states before they pay off.

We need exact search to both find and prove optimal solutions.

See `dev-notes/2026-03/3-13-[10]-optimal-solver-kickoff.md` for full background,
state space analysis, and pruning ideas.

## Approach: BFS-by-tick with transposition table

The simplest exact approach. Expand all states at tick N, deduplicate via
board fingerprinting, move to tick N+1.

### Algorithm

```
states = Map<fingerprint, { board, moves[] }>
initialize with starting board state

for tick = 1 to maxTicks:
  nextStates = new Map()

  for each { board, moves } in states.values():
    for each move in generateMoves(board):
      child = clone(board)
      processStep(child, move, player=0, tick)
      fp = fingerprint(child)

      if fp not in nextStates:
        nextStates.set(fp, { board: child, moves: [...moves, move] })

  states = nextStates
  log: tick, states.size, best land so far

return state with best land at final tick
```

### Key design decisions

**Transposition dedup is the main win.** Beam search saw 30-60% dedup at
beam=200. With exhaustive expansion the sharing should be even higher — many
different move orderings lead to the same board state.

**Per-tick dedup only.** No cross-tick transposition table needed. If the same
board state appeared at tick 8 and tick 10, the tick-8 version was already
expanded through ticks 9 and 10 via the BFS — we'll naturally find all its
descendants. Within-tick dedup handles all transpositions.

**Lossless fingerprint.** The beam search fingerprint capped unit counts at 15
for speed. For exact search we use the raw unit count (max possible ~26 for
open-7x7 at 50 ticks, well within a byte). Already implemented in
`perfect-start-solver/moves.ts`.

**Full move history per state.** Each state carries its complete move array
for solution reconstruction. At tick 40 with 100K states, that's 100K arrays
of 40 moves. Could be heavy on memory. If this becomes the bottleneck, we can
switch to parent pointers with a separate move log — but for a first pass,
simplicity wins.

**Clone per expansion.** Every (state, move) pair gets a fresh `cloneBoard()`
before `processStep`. The flat typed-array clone is fast (3 `.slice()` calls)
but the volume is high. Apply-then-undo would be faster but `processStep` does
complex mutations (production, stat updates). Clone is the safe first pass.

**Evaluate at maxTicks.** Land is monotonically increasing in single-player
(no one taking your land), so the best land at the final tick is the global
best.

### What we want to learn from the first run

- **State count per tick** — does it plateau (transpositions keep it bounded)
  or explode (exponential growth)?
- **Where the bottleneck hits** — memory (too many states) or time (too many
  expansions per tick)?
- **Can it solve open-7x7 at 50 ticks at all**, or do we need pruning first?

Plan is to run with increasing tick limits (20, 30, 40, 50) to observe the
growth curve before committing to a full 50-tick run.

### Future pruning (not in first pass)

Once we see the baseline numbers, we can layer on:

- **Upper bound pruning**: `currentLand + totalExcess + remainingProduction
  < bestKnown` → skip the branch
- **Dominated state detection**: if state A has same land as B but strictly
  less army everywhere, drop A
- **Move ordering from heuristics**: use frontier-5 scorer to try promising
  moves first (helps if we switch to DFS later)
- **Symmetry reduction**: open boards have 8-fold symmetry

## Reusable components

All from `packages/algos/src/perfect-start-solver/`:

- `moves.ts` — `generateMoves`, `fingerprintState` (lossless), `flatMoveToMove`
- `test-boards.ts` — board definitions and parsing
- `helpers.ts` — `ALL_DIRECTIONS`, `runWithTiming`
- `format.ts` — tick log formatting
- `simulation.ts` — replay/validate solutions via core engine
- `types.ts` — `Move`, `ArmySnapshot`, `SimulationResult`

From `packages/algos/src/core-next/`:

- `FlatBoard`, `cloneBoard` — board data structure and cloning
- `processStep` — tick simulation
- `fromBoardState` — convert test boards to flat format
