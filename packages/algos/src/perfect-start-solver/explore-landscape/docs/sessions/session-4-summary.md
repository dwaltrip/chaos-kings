# Session 4: N-Corridor Generalization, State DAG Traversal, Future Directions

## Overview

This session covered a lot of ground: generalized the corridor model to N corridors, hit a scalability wall, invented a DAG-based DP approach to solve it, ran analyses on the results, explored how wider corridors decompose into "lanes," and then stepped back to brainstorm how all of this connects to improving the real solver.

### Session arc

1. **N-corridor generalization** — extended the 2-corridor model (session 3) to 3 and 4 corridors. Brute-force enumeration hit a wall: 98M chains for 3-corridor caused OOM, 4-corridor was completely intractable (~20B chains).

2. **State DAG traversal** — realized the state graph is a DAG (tick always increases), so we can discover unique states via BFS and count chains via DP propagation. 382K edge traversals instead of 20B chain enumerations for 4-corridor. Completes in 0.27s. This was the key technical breakthrough of the session.

3. **N-corridor analysis** — used the efficient traversal to measure states-per-frontier-config (empirically bounded at 2×numCorridors for N up to 4) and free threshold (total frontier ≤ 2). State growth decelerates with each added corridor (18x → 11.4x → 8.5x), while collapse ratio grows super-linearly.

4. **Width-2 corridor exploration** — analyzed whether width-2 corridors add new structure beyond the simple N-corridor model. Conclusion: for infinite-length corridors, crossing between columns never helps. Width-2 collapses to the simple 2-corridor model. Exception: "saved tiles" near the general for final burst optimization, which is broadly applicable on real boards.

5. **Lane model** — wider corridors decompose into parallel "lanes" with per-burst traversal overhead proportional to distance from the general's column. This provides a smooth bridge from corridors toward open 2D boards: corridors → lanes with overhead → quadrant-based covering of open space.

6. **Solver connections** — brainstormed how corridor equivalence findings connect to the real solver (custom-algo-1). Initially thought timing entry deduplication was the most immediately actionable direction, but realized it depends on first solving the state representation question: what "state" do we collapse on? Identified two paths forward — finding a compact abstract state, or decomposing boards into lanes and reusing the corridor state directly.

## Key results

All results at maxTick=50.

| corridors | total chains | unique states | edges | collapse ratio |
|-----------|-------------|---------------|-------|----------------|
| 1 | 1,019 | 24 | (not measured) | 42.5x |
| 2 | 376,916 | 431 | 3,164 | 874.5x |
| 3 | 98,897,859 | 4,893 | 40,848 | 20,212x |
| 4 | 20,821,807,328 | 41,828 | 382,448 | 497,796x |

- State growth decelerates: 18x, 11.4x, 8.5x per added corridor
- Collapse ratio grows super-linearly
- States-per-frontier-config empirically bounded at 2 * numCorridors (tested up to 4)
- Free threshold: all frontier configs with total frontier ≤ 2 collapse to a single state
- DAG traversal: ~50,000x fewer operations than brute force for 4-corridor

## Two paths to making this actionable

The corridor equivalence results are strong but depend on having a compact state to collapse on. On real boards, the full state `(tick, army, owned_tile_set)` is too large. Two paths forward: (1) find a compact abstract state directly, or (2) decompose boards into corridor-like lanes and reuse `(tick, army, frontier-per-lane)`. These may complement each other. Either path unlocks timing entry deduplication, DAG-based search, and transposition tables.

See [Future Directions](session-4-future-directions.md) for detailed analysis of both paths.

## Detailed docs

- **[State DAG Traversal](session-4-state-dag-traversal.md)** — The DAG DP algorithm: how it works, why naive BFS fails, performance gains
- **[N-Corridor Results](session-4-n-corridor-results.md)** — Concrete analysis: state counts, states-per-frontier, free threshold
- **[Future Directions](session-4-future-directions.md)** — Lane model, two paths forward, downstream applications, solver connections

## Files created

- `questions/q4-equiv-burst-multi-corridor-state-traverse.ts` — DAG DP state enumeration (the fast approach)
- `questions/q4-multi-corridor-analysis.ts` — states-per-frontier and free threshold analysis
- `questions/q4-equivalent-burst-chains-multi.ts` — brute-force N-corridor (superseded by DAG approach, can be deleted)
- `tmp-scripts/visualize-state-dag.ts` — step-by-step visualization of DAG vs brute-force
