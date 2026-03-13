# Perfect Start Solver — Progress Update

## What's built

All in `packages/algos/src/perfect-start-solver/prototyping/`:

- **`beam-search.ts`** — Generic beam search parameterized by `<S, M>`. Takes `generateMoves`, `clone`, `step`, `score` functions. No game-specific knowledge.
- **`solver.ts`** — Game-specific wiring. Move generation (scan for player 0 tiles with units > 1, try 4 directions + wait), cloning via `structuredClone`, stepping via core's `processStep`.
- **`scoring-functions.ts`** — Just `landOnly` so far.
- **`simulation.ts`** — Standalone simulation harness (wraps `processStep`, replays a move sequence, returns land curve). Not used by solver — useful for verifying solutions.
- **`comparison.ts`** — Runs solver across configs, collects results + timing.
- **`run-comparison.ts`** — Executable runner. Run with: `cd packages/algos && npx tsx src/perfect-start-solver/prototyping/run-comparison.ts`
- **`test-boards.ts`** — Hardcoded 7x7 open field for now.
- **`types.ts`** — Shared types (`Move`, `ScoringFn`, `SolverConfig`, etc.)

## Key result

On a 7x7 open field, 25 ticks:

```
Beam width 50:  land = 12, 274ms
Beam width 100: land = 12, 499ms
Beam width 200: land = 12, 967ms
```

**The optimal solution is 25 land.** Land-only scoring gets 12 — less than half. Beam width made zero difference. The scoring function is the bottleneck, not search breadth.

## What we learned

1. **Land-only scoring is very bad.** It can't see value in routing or accumulation moves, so it plays a greedy star pattern instead of accumulate-and-burst.
2. **Beam width doesn't matter with a bad scorer.** All widths converge to the same answer.
3. **The scoring function is everything.** This is where the next effort should go.
4. **The infrastructure works.** Beam search, comparison runner, timing — all functional. Adding new scoring functions is easy (implement `ScoringFn`, add to runner).

## What's next

The big task is designing better scoring functions. Several ideas were discussed (see `3-12-[2]-perfect-start-solver-algorithm-ideas.md`):

- Army-to-frontier distance (reward units close to blank tiles, weighted by army size)
- Frontier surface area (count blank tiles adjacent to owned territory)
- Projected land (estimate future captures based on unit positions and remaining ticks)

These ideas are starting points — talk through the approach with Daniel before implementing. The gap between 12 and 25 is huge, so there's a lot of room to experiment.

Also still TODO:
- **Op counter** — add once we know what to count (likely after trying a scoring function that does BFS or pathfinding)
- **Board factory** — text-based board parsing. Save for last, needs visual input from Daniel to get good test boards. Currently using a hardcoded 7x7 open field.
- **More test boards** — plan is 3 boards on a mountain density gradient (open, sparse mountains, dense mountains)

## Reference docs

- `dev-notes/2026-03/3-12-[2]-perfect-start-solver-algorithm-ideas.md` — scoring ideas, blank tile valuation discussion
- `dev-notes/2026-03/3-12-[3]-perfect-start-solver-implementation-sketch.md` — full implementation plan with architecture decisions
