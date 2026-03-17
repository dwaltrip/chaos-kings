
## Perf comments from most recent Simluated Annealing (SA) session

From what I've seen so far, some quick thoughts:

**cloneBoard** — it's doing `types.slice()`, `owners.slice()`, `units.slice()` (typed array copies) plus a new object allocation with `stats` deep copy. Potential wins:
- **Object pooling** — pre-allocate a ring buffer of FlatBoard objects and reuse them instead of allocating new ones. Avoids GC pressure. The SA loop has predictable allocation patterns (51 boards per solution) so this is feasible.
- **Copy-on-write** — only clone when a board actually gets mutated. Lots of early ticks are WAITs where the only mutation is production. But this adds complexity and branching in the hot path.

**processStep** — would need a deeper look. It's already pretty lean (typed array index reads/writes, simple arithmetic). Potential directions:
- Profile *within* processStep to see if it's the move validation, the army transfer, or the production loop that dominates
- The production loop iterates all N tiles every tick — could be skippable on non-production ticks
- For SA specifically, we might be able to skip production calculation on intermediate ticks if we only care about the final score... but that changes the game state so probably not

I'd say a separate session with a focused dive into `processStep` internals and `cloneBoard` pooling is the right move. The current ~26μs/iteration is decent but there's probably a 2-3x in there with targeted work.


---

## Additional perf notes specific to the SA algorithm

- **SA does ~25M processStep + cloneBoard calls per 1M iterations** — each iteration re-simulates from a random tick (avg tick 25) to tick 50, cloning the board at each step to build the state cache
- **~65% of iterations are rejected** — the neighbor is evaluated (full re-simulation with caching) then thrown away. All those cloneBoard allocations become garbage immediately
- **Profile breakdown at 100k iterations (2.2s):** processStep 59%, cloneBoard 29%, generateMoves 2%, array construction 1%, rest 9%
- **cloneBoard cost is pure allocation** — three `.slice()` calls on typed arrays (types, owners, units) plus object construction. No logic, just copying. A pooling strategy that reuses pre-allocated FlatBoard objects could eliminate most of this
- **processStep iterates all tiles for production** every 2 ticks (general production) — for a 7x7 board that's 49 tiles, but for 11x11 it's 121. Could skip non-production ticks or maintain a list of production tiles instead of scanning
- **The state cache is 51 FlatBoard objects** (one per tick + initial). On every accepted neighbor, the cache is rebuilt from the changed tick forward via array spread (`[...stateCache.slice(0, t+1), ...forwardStates]`). This is cheap (1% of time) but creates a new array each time
- **Current throughput: ~40k iterations/sec on open-7x7** (25μs per iteration). Target for the big parameter sweep is ~1100 configs × 10 seeds × 50k iterations = 550M iterations total, which would take ~3.8 hours at current speed
