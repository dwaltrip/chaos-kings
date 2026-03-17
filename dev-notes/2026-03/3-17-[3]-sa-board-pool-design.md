# SA Board Pool Design — Scratch Buffer + Copy-on-Accept

## Context

In the SA solver, `cloneBoard` accounts for ~29% of total runtime. It's called ~25 times per iteration (once per tick in the forward simulation), and ~65% of iterations are rejected — meaning those boards are allocated and immediately become garbage.

At 1M iterations, that's ~25M `cloneBoard` calls, producing ~16M boards that are GC'd without ever being used. Each clone does three typed array `.slice()` calls (Uint8Array, Int8Array, Int32Array) plus object + stats array construction.

The goal: eliminate allocation on rejected iterations entirely.

## Board Lifetime Analysis

Two `FlatBoard[]` arrays are in play during the SA loop:

### `current.stateCache` (the accepted solution)
- Length: `totalTicks + 1` (e.g. 51 for totalTicks=50)
- `stateCache[t]` = board state before `moves[t]` is applied
- Lives until a neighbor is accepted and replaces it

### Neighbor stateCache (built each iteration)
- Built by `generateNeighbor` → `simulateForward`
- Shares boards `[0..t]` with `current.stateCache` via `current.stateCache.slice(0, t + 1)` (reference sharing, not deep copy)
- Has freshly simulated boards for `[t+1..end]`
- On rejection (~65%): entire array is discarded
- On acceptance (~35%): becomes the new `current`, old current's unique boards become garbage

### Individual board lifetimes
A board at stateCache index `k` survives until some future iteration picks `t <= k` AND gets accepted. This means individual boards have unpredictable lifetimes — a board at index 3 could survive dozens of iterations if `t` keeps landing above 3.

This rules out a simple "swap two fixed buffers" approach, since we can't predict when specific slots will be freed.

## Design: Scratch Buffer + Copy-on-Accept

### Structure
Pre-allocate a reusable scratch buffer of `totalTicks` FlatBoard objects at SA init time. These are used for forward simulation every iteration and are never stored in stateCache directly.

```
scratchBoards: FlatBoard[]   // length = totalTicks, pre-allocated once
```

### Per-iteration flow

1. **Forward simulate into scratch boards.** Instead of `cloneBoard(source)`, use `copyInto(scratchBoards[idx], source)` — which does `target.types.set(source.types)` etc. on pre-existing typed arrays. No allocation.

2. **Read score** from the last scratch board.

3. **On rejection (65%):** Do nothing. Scratch boards will be overwritten next iteration. Zero allocation, zero GC pressure.

4. **On acceptance (35%):** Clone the scratch boards into fresh FlatBoard objects to create durable stateCache entries. This is the only path that allocates.

### `copyInto` helper
```ts
function copyInto(target: FlatBoard, source: FlatBoard): void {
  target.types.set(source.types);
  target.owners.set(source.owners);
  target.units.set(source.units);
  // width, height already match (same board dimensions)
  // stats:
  for (let i = 0; i < source.stats.landCounts.length; i++) {
    target.stats.landCounts[i] = source.stats.landCounts[i];
    target.stats.armyCounts[i] = source.stats.armyCounts[i];
  }
}
```

### Expected savings
- **Rejected iterations (65%):** 0 allocations (was ~25 cloneBoard calls each)
- **Accepted iterations (35%):** same allocation cost as before (clone scratch → durable)
- **Net:** ~65% reduction in total cloneBoard allocations
- **GC pressure:** substantially reduced since rejected iterations produce zero garbage

### Where this lives
- `copyInto` is a general utility — goes in `core-next/flat-board.ts` alongside `cloneBoard`
- Scratch buffer allocation and the modified simulate loop are SA-specific — stay in `sim-anneal.ts`
- `cloneBoard` is unchanged — other callers (exact solver, beam search, tmp-scripts) are unaffected

## Assumptions

### A1: `totalTicks` is fixed for the entire SA run
Set once at init, never changes. Pool size = `totalTicks` is known upfront. If this ever became dynamic, the pool would need resizing.

### A2: Board dimensions are fixed
All boards in a run have the same `width * height`, so typed arrays are all the same size. `copyInto` can use `.set()` without bounds checking. This is inherent to the game design — board size doesn't change mid-game.

### A3: Player count is fixed
Stats arrays (`landCounts`, `armyCounts`) have the same length for all boards. Currently the SA solver is 1-player (PLAYER_INDEX = 0), but the stats arrays are sized by playerCount from the initial board conversion.

### A4: `processStep` mutates only the board it's given
It doesn't hold references to previous board state or return borrowed references. Confirmed by reading the implementation — all operations are direct array index writes on the passed-in board. This means it's safe to pass scratch boards that will be overwritten later.

### A5: Acceptance rate is low enough for this to matter
At ~35% acceptance, we save allocation on the majority (65%) of iterations. If acceptance rate were 90%+, the savings would be marginal since we'd still allocate on most iterations. Worth validating that acceptance rate holds across different configs.

### A6: `.set()` is faster than `.slice()` for typed arrays
`.slice()` allocates a new typed array + copies data. `.set()` copies data into an existing array. The savings come from avoiding allocation, not from faster copying. This is well-established for typed arrays in V8 but should be benchmarked to confirm the magnitude.

## Experiments to Validate

### E1: Confirm `.set()` vs `.slice()` speedup (validates A6)
Micro-benchmark: allocate two Uint8Array/Int8Array/Int32Array of size 49 (7x7), time 1M iterations of `.slice()` vs `.set()`. Measure both throughput and GC pause frequency.

### E2: Confirm acceptance rate across configs (validates A5)
The SA runner already tracks `acceptedCount`. Check existing run data or run a quick sweep: does acceptance rate stay in the 25-45% range across different `t0`/`epsilon` configs? If some configs have 80%+ acceptance, the pool helps less there.

### E3: End-to-end SA benchmark (validates overall design)
Run the same SA config (e.g. 100k iterations, open-7x7) with profiling before and after the pool change. Compare `cloneBoardMs` and `totalMs`. Expected: cloneBoardMs drops by ~60-65%, totalMs drops by ~15-20% (since cloneBoard is 29% of total).

### E4: Correctness via score equivalence
Run identical configs with identical seeds before and after the change. The `bestScore` and `scoreProgression` should be bitwise identical — the pool changes allocation strategy, not computation.

### E5: GC pressure measurement (nice-to-have)
Run with `--expose-gc` and `--trace-gc` flags. Compare GC pause count and total GC time between pooled and non-pooled versions over a 1M iteration run.

## Open Questions

- **Should `copyInto` go in `flat-board.ts` or stay local to the SA module?** It's a general-purpose operation on FlatBoard, so flat-board.ts seems right. But it's only used by SA currently. Leaning toward flat-board.ts since the beam search solver could use it too if we add pooling there later.

- **Scratch buffer indexing:** When `simulateForward` starts at tick `t`, scratch boards should use relative indexing (`scratchBoards[j - t]`). Wastes no space, straightforward mapping.

## Pre-work

- **Refactor profiled/non-profiled duplication.** The profiled inline loop in `runSA` duplicates `generateNeighbor` logic. Both paths need scratch buffer changes. Factor simulation into a single function with optional timing accumulators before adding the pool.

## Considered and Deferred

- **Skip stateCache construction on rejection path.** The reviewer suggested restructuring so the accept/reject decision happens before building the stateCache array, avoiding the `[...slice, ...forwardStates]` construction on rejected iterations. However, stateCache construction is only ~1% of total runtime, so skipping it on 65% of iterations saves ~0.65% total — not worth the added complexity of splitting the `generateNeighbor` abstraction. Can revisit if profiling shows it matters after the bigger wins are captured.

- **Scratch `newMoves` array.** `[...current.moves]` allocates a 50-element array every iteration, discarded on rejection. Trivial follow-on if we want to squeeze further.
