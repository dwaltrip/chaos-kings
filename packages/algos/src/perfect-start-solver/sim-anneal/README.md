# Simulated Annealing Solver

Simulated annealing (SA) for the grid expansion problem. Finds move sequences
that maximize tiles owned at tick 50.

## Usage

```bash
# From packages/algos/
npx tsx src/perfect-start-solver/sim-anneal/run-sa.ts [options]
```

Options:
- `--board <name>` — Board name (default: `open-7x7`)
- `--ticks <n>` — Number of ticks (default: `50`)
- `--iterations <n>` — SA iterations (default: `100000`)
- `--t0 <n>` — Initial temperature (default: `3.0`)
- `--epsilon <n>` — Final temperature ratio (default: `0.001`)

Example:
```bash
npx tsx src/perfect-start-solver/sim-anneal/run-sa.ts --iterations 1000000
```

## Results

On the open-7x7 board (known optimal = 25 tiles at tick 50):
- **100k iterations** (~2.5s): reliably finds 24
- **1M iterations** (~25s): frequently finds 25

## How it works

1. Start with an all-WAIT solution (score = 1)
2. Each iteration: pick a random tick, swap in a different legal move, re-simulate
   from that tick forward
3. Accept improvements always; accept worsenings with probability `exp(delta / T)`
4. Temperature decays geometrically: `T = T0 * alpha^i` where `alpha = epsilon^(1/iterations)`
5. Track the best solution seen across all iterations

### Key parameters

- **T0 = 3.0** — High enough to accept score swings of 5-10 tiles early on
  (disrupting a burst chain can cause large deltas)
- **epsilon = 0.001** — Final temperature is T0 * 0.001 = 0.003, effectively
  pure hill-climbing at the end
- **alpha** is derived: `alpha = epsilon^(1/iterations)` ensures smooth cooling
  across the full run

## Files

- `sim-anneal.ts` — Core SA: initial solution, neighbor generation, main loop
- `types.ts` — SASolution, SAConfig, SAResult
- `run-sa.ts` — CLI runner
- `tmp-scripts/` — One-off investigation scripts (created as needed)

## Architecture

Uses `FlatBoard` + `core-next/processStep` for the simulation hot loop (typed
arrays, fast deep copy). Imports shared modules from parent (`moves.ts`,
`test-boards.ts`, etc.).

Each solution carries a state cache (`FlatBoard[]` of length ticks+1) so
neighbor evaluation only re-simulates from the changed tick forward.

### Known optimization opportunity

`generateNeighbor` currently rebuilds the full state cache array on every call,
even for rejected neighbors. At scale, consider returning only the changed suffix
and splicing on acceptance. See the TODO in `sim-anneal.ts`.
