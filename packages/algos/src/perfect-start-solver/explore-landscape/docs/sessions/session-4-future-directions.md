# Future Directions: From Corridors to the Real Solver

## The lane model

### From corridors to lanes

The simple N-corridor model treats each corridor as independent — the only shared resource is army and tick at the general. As we explored wider corridors, we found that width-W corridors decompose into W "lanes" per side (per direction), where each lane behaves like a simple corridor with some per-burst traversal overhead.

**Terminology:** a "lane" is a single-column path extending from the general, analogous to a simple corridor. Multiple lanes can run in parallel (wider corridor) or radiate in different directions (star graph).

### Lane traversal overhead

In a width-W corridor, the general occupies one column. Lanes in other columns must cross through intermediate columns to reach their own territory. The first tile in each lane belongs to that lane (it's a capture, not a re-traversal).

For a single-sided width-W corridor with the general in column 0:

| lane (column) | overhead per burst |
|---------------|-------------------|
| 0 | +0 |
| 1 | +0 (lane 1's entry tile belongs to it) |
| 2 | +1 (traverse lane 1's entry tile) |
| 3 | +2 (traverse lanes 1 and 2's entry tiles) |

General position matters. General in the middle of width-3 gives two lanes at +0 overhead. General on the edge gives lanes at +0, +0, +1.

### Toward the open board

As width increases, the lane model approaches the full 2D grid:

- Width-1: 1D line (pure corridor)
- Width-2: 2 parallel lanes, almost identical to 2-corridor
- Width-W: W parallel lanes with increasing overhead
- Width-infinity in both directions: open 2D board

On an open board, initial bursts along the 4 cardinal directions create "spines" that divide space into quadrants. Each quadrant contains parallel lanes at increasing distance from the spine. A 7x7 area can be covered perfectly with 4 spine bursts + 12 lane bursts of length 3.

Different spine/covering patterns give different lane structures and overhead distributions. The optimal decomposition likely depends on the board geometry.

### Width-2 corridors: crossing between columns

For infinite-length width-2 corridors, crossing between columns mid-burst never helps — you always start from the general, both columns extend infinitely, no reason to cross. Width-2 collapses to the simple 2-corridor model.

**Exception — "saved tiles" for final burst optimization:** optimal openings often reserve a few uncaptured tiles near the general for a small final burst in the last ticks of the round (~ticks 45-49). Without this, you can exhaust your second-to-last burst with ticks to spare but no nearby tiles. In a width-2 corridor, this means saving tiles in the adjacent column and routing earlier bursts through the general's column before crossing over.

This is a broadly applicable optimization, not specific to any board shape. It matters most when the general has fewer than 4 empty neighbors (against a wall, near mountains), since there's less flexibility for where to place the final burst.

## Connection to the existing solver (custom-algo-1)

The current solver splits the problem into timing (board-independent burst patterns) and spatial (board-specific path search):

1. **Timing:** enumerate descending partitions of capture count, expand overlap combinations, simulate timing
2. **Spatial:** for each timing entry, search for non-overlapping paths via grouped backtracking with bitmask pruning

### Where equivalence applies

The solver's **descending partitions** already reduce burst size ordering permutations — e.g., it tries [12,7,3,2] but not [3,7,12,2]. This is a form of equivalence reduction.

But it doesn't capture deeper equivalence: different burst size sequences that produce the same (tick, army) state. Our corridor analysis shows this deeper collapse is massive (42x to 500,000x). Even a fraction of that applied to the solver's timing entries could significantly reduce the number of spatial searches attempted.

The solver's **overlap model** (prefix overlap = re-traversal of owned tiles) maps directly to the corridor model's frontier concept. The solver's **paths** are analogous to our "lanes."

### The bottleneck

The solver's spatial search is the bottleneck on hard boards (tight corners, constrained geometry). It spends 90%+ of time in the inner-loop candidate scan, with ~90% of candidates failing bitmask checks. Reducing the number of timing entries fed into this search — by deduplicating equivalent entries — directly reduces total work.

## Open questions

### A. Compact state representation

In the corridor model, state is `(tick, army, frontiers[])`. On a real board, the full state would be `(tick, army, owned_tile_set)` — far too large.

Can we find a compact summary of owned territory that determines future burst costs? The corridor results suggest this might be possible: only a few (tick, army) pairs exist for any given frontier configuration. Maybe something like distances-to-frontier-tips per direction, or a summary of the boundary shape.

This is the most foundational open question — solving it unlocks DAG-based search on real boards.

### B. Board decomposition and lane covering

Can complex board shapes be decomposed into lane-like subproblems? Mountains and chokepoints might create natural decomposition boundaries (narrow gaps where multiple lanes merge). Open areas might resist decomposition.

Related: what are the optimal ways to cover a board region with lanes? How does terrain constrain the decomposition? Different covering patterns produce different lane structures and traversal overheads. The solver's path generation may already be doing something similar implicitly.

### C. Equivalence in existing solver timing entries

The most immediately actionable direction. The solver already generates timing entries (burst patterns + overlap combinations). Many of these may be equivalent in the sense that they produce the same state after the same number of captures.

Approach: take the solver's timing table, compute the end state for each entry, group by state, and measure how much deduplication is possible. This requires no architectural changes — just filtering before the spatial search.

### D. DAG-based search as solver architecture

Instead of enumerating burst chains and then searching for paths, traverse the state graph directly — discovering states and expanding only the unique ones.

This is the corridor DAG approach applied to the real solver. It requires solving A first (compact state representation on real boards), but the potential is enormous: 54,000x fewer traversals for 4-corridor, and the ratio improves with problem size.

A hybrid approach might work: use DAG-based search for the timing subproblem while keeping the spatial search as-is.
