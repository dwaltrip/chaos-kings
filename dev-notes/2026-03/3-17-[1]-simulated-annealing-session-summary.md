# Simulated Annealing — Implementation Session Summary

## What we did

### 1. Set up sim-anneal module

Created `packages/algos/src/perfect-start-solver/sim-anneal/` as a peer to
`prototyping/` (beam search) and the exact solver. Imports shared modules
from the parent directory (`moves.ts`, `test-boards.ts`, `helpers.ts`,
`format.ts`).

Decision: Use FlatBoard + `core-next/processStep` for the hot loop (not the
original `simulation.ts` which uses `@core` types). The exact solver and beam
search both use the flat-board path — SA should too, since it does ~25M
processStep calls at 1M iterations.

Note: `simulation.ts` (promoted from prototyping/) is only used by
`prototyping/run-comparison.ts` for post-hoc tick log replay. May un-promote
it later.

### 2. Step 1 — Solution representation

A solution is `FlatMove[]` of length 50 (null = WAIT) plus a state cache
(`FlatBoard[]` of length 51 — index 0 is initial, index t is board after
tick t). Initial solution: all WAITs, score = 1.

Verified: general army at tick 50 = 27 (1 starting + 25 general production +
1 land production at tick 50). Checks out with `DEFAULT_TIMING`:
`generalProductionTicks: 2`, `landProductionTicks: 50`.

### 3. Step 2 — Neighborhood operator

`generateNeighbor(current)`:
- Pick random tick t in [0, 50)
- Get legal moves from `stateCache[t]` (board before tick t's move)
- Pick a random legal move different from current
- Re-simulate from tick t forward, splicing the state cache

Returns a full `SASolution` (moves + stateCache + score). This is simple but
allocates a new 51-element cache on every call, even for rejected neighbors.
Left a TODO to optimize when scaling up.

### 4. Steps 3-4 — Acceptance loop + cooling schedule

Standard SA acceptance: `delta >= 0` → always accept, else accept with
probability `exp(delta / temperature)`. Temperature decays geometrically:
`T = T0 * alpha^i` where `alpha = epsilon^(1/iterations)`.

**Parameters:** T0 = 3.0, epsilon = 0.001 (from the impl prompt, informed
by the algorithm review doc's temperature calibration flag).

**Results on open-7x7:**
- 100k iterations (~2.5s): reliably hits 24
- 1M iterations (~26s): frequently hits 25 (known optimal)

Found optimal on first try at 1M iterations. SA finds 25 by about 30% of
the way through the run.

### 5. Delta distribution analysis

Built `tmp-scripts/delta-sampler.ts` to sample random neighbors around
solutions at various quality levels and examine the distribution of score
changes. Ran SA at different iteration counts (10 to 500k, some with cold
temperature) to collect solutions from score 7 up to 25.

**Key findings:**

| Score level | % negative | % zero | % positive | Avg neg delta | Min delta |
|-------------|-----------|--------|------------|---------------|-----------|
| Low (1-8)   | 7.7%      | 53.3%  | 39.0%      | -1.04         | -2        |
| Mid (9-16)  | 49.3%     | 48.3%  | 2.3%       | -1.58         | -4        |
| High (17-21)| 55.7%     | 43.0%  | 1.3%       | -1.71         | -5        |
| Near-opt    | 76.0%     | 24.0%  | 0.0%       | -2.06         | -7        |

- **No catastrophic deltas.** The feared -10 to -15 swings from burst chain
  disruption (flagged in the algorithm review doc) don't materialize. Worst
  observed is -7, and that's rare.
- **T0 = 3.0 is well-calibrated.** At near-optimal solutions (the critical
  regime), avg acceptance probability for worsening moves is ~54%. At T0=1.0
  it would be ~20% — too cold. At T0=5.0 it's ~68% — too hot.
- **Low-score solutions have mostly positive or zero deltas** — easy to
  improve, temperature barely matters.
- **Ticks 30-39 are the most sensitive** (largest avg negative deltas) —
  this is where burst chains are actively expanding.
- Promoted `buildSolution(boardState, moves, totalTicks)` from the delta
  sampler to `sim-anneal.ts` — generally useful for reconstructing a full
  SASolution from a move sequence.

### 6. Multi-run runner

Replaced the single-run `run-sa.ts` with a multi-config sweep runner:
- All params accept comma-separated lists (board, iterations, t0, epsilon)
- `--seeds N` runs each config combo N times
- Outputs timestamped JSON + summary markdown to `data/`
- Console shows progress lines, summary table, and best move sequence

Example: `--t0 1.0,3.0,5.0 --seeds 3` runs 9 total SA invocations and
produces a comparison table.

## File inventory

New files in `packages/algos/src/perfect-start-solver/sim-anneal/`:
- `sim-anneal.ts` — Core: createInitialSolution, generateNeighbor, runSA, buildSolution, simulateForward
- `types.ts` — SASolution, SAConfig, SAResult
- `run-sa.ts` — Multi-run CLI runner
- `README.md` — Module docs
- `data/.gitignore` — Ignore output files
- `tmp-scripts/delta-sampler.ts` — Delta distribution analysis

## Observations

- SA is surprisingly effective on this problem. Even 10k iterations (0.2s)
  reliably finds 24/25 on open-7x7.
- The search landscape is benign — no catastrophic cliffs. Single-move
  perturbations cause modest score changes (-1 to -7), well within the range
  T0=3.0 can handle.
- Acceptance rate settles around 33-37% at T0=3.0 for 50k-1M iterations.
  This is in the typical healthy range for SA.
- The `simulation.ts` file promoted from prototyping/ is only used by beam
  search experiments — may want to move it back.

## Next steps

- Write dev notes within the module (`sim-anneal/dev-notes.md`) as tuning
  work continues
- Try other boards (maze, corridor, larger grids) to see if SA scales
- Consider the optimization TODO: lazy state cache rebuild for rejected
  neighbors
- Eventually: NRPA implementation (the next algorithm in the roadmap)
