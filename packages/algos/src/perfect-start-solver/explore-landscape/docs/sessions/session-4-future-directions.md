# Future Directions: From Corridors to the Real Solver

## Terminology

**Burst:** a sequence of moves that deploys the general's accumulated army. On a real board, the path can turn, zigzag, or follow any shape. In the corridor model, bursts happen to follow straight lines because the geometry forces it. Bursts can also re-traverse already-owned tiles (costing an extra tick per tile but no army). In the corridor model this re-traversal cost is called "frontier"; in the solver it's called "overlap."

**Frontier:** the number of already-owned tiles a burst must re-traverse before reaching uncaptured territory in a given direction. In the corridor model, frontier for direction D = total tiles previously captured in that direction. Each re-traversal costs 1 tick but no army (you pick up 1 troop and leave 1 behind). The solver's equivalent concept is "overlap."

**Lane:** a sequential path of tiles extending from the general (or from an entry point near the general) outward. Lanes don't need to be straight — they can turn and curve around obstacles. In the corridor analysis, lanes happen to be straight columns because the geometry forces it, but on real boards they follow the terrain. Multiple lanes can run in parallel (wider corridor) or radiate in different directions (star graph). Distinguished from "corridor" (the simplified model we've been analyzing) and "path" (the solver's term for a specific tile sequence on a real board).

## The lane model

### From corridors to lanes

The simple N-corridor model treats each corridor as independent — the only shared resource is army and tick at the general. As we explored wider corridors, we found that width-W corridors decompose into W "lanes" per side, where each lane behaves like a simple corridor with a fixed per-burst traversal overhead.

### Lane traversal overhead

In a width-W corridor, the general occupies one column. Each lane owns its entry tile (the tile in its column at the general's row). Lanes further from the general must traverse intermediate lanes' entry tiles to reach their own territory.

For a single-sided width-W corridor with the general in column 0:

| lane (column) | overhead per burst |
|---------------|-------------------|
| 0 | +0 (general's column) |
| 1 | +0 (moving into lane 1's entry tile is a capture, not a re-traversal) |
| 2 | +1 (traverse lane 1's entry tile) |
| 3 | +2 (traverse lanes 1 and 2's entry tiles) |

*Note: each tile in the general's row is assigned to the lane it belongs to, which simplifies the overhead calculation — the first move into a lane's own entry tile is always a capture, not a re-traversal.*

General position matters. General in the middle of width-3 gives two lanes at +0 overhead. General on the edge gives lanes at +0, +0, +1.

### Width-2 corridors: crossing between columns

For infinite-length width-2 corridors, crossing between columns mid-burst never helps — you always start from the general, both columns extend infinitely, no reason to cross. Width-2 collapses to the simple 2-corridor model.

### Saved tiles / final burst optimization

Optimal openings often reserve a few uncaptured tiles near the general for a small final burst in the last ticks of the round (~ticks 45-49). Without this, you can exhaust your second-to-last burst with ticks to spare but no nearby tiles to capture. This is a broadly applicable optimization — it matters most when the general has fewer than 4 empty neighbors (against a wall, near mountains), since there's less flexibility for where to place the final burst.

In width-2 corridors, the saved tiles would be in the adjacent column, forcing earlier bursts to route through the general's column before crossing over. This is one scenario where cross-column movement becomes relevant.

### Toward the open board

As width increases, the lane model approaches the full 2D grid:

- Width-1: 1D line (pure corridor)
- Width-2: 2 parallel lanes, almost identical to 2-corridor
- Width-W: W parallel lanes with increasing overhead
- Width-infinity in both directions: open 2D board

One brainstorm for how lanes might extend to fully open boards: initial bursts along the 4 cardinal directions create "spines" that divide space into quadrants. Each quadrant contains parallel lanes at increasing distance from the spine. A 7x7 area can be covered perfectly with 4 spine bursts + 12 lane bursts of length 3.

Different spine/covering patterns give different lane structures and overhead distributions. Multiple decompositions exist for any given board region. This is speculative — how well it works on real boards with mountains and irregular shapes is an open question.

## Two paths to making corridor equivalence actionable

The corridor equivalence results are strong: massive collapse ratios (up to 500,000x for 4-corridor), bounded states-per-frontier, and efficient DAG traversal. But applying these to real boards requires a compact state to collapse on. The full state `(tick, army, owned_tile_set)` is too large. Two paths forward:

### Path 1: Compact state representation

Find an abstract state for arbitrary boards that captures what matters for future burst costs. In the corridor model, `(tick, army, frontiers[])` is sufficient — knowing the frontier distances fully determines future costs. On a real board, it could be something like frontier distances per direction, boundary shape summary, or some other compact representation.

This is the most general approach but also the hardest. It requires understanding what properties of owned territory actually affect future burst costs and finding a way to summarize them compactly.

### Path 2: Lane decomposition

Decompose a real board into corridor-like lanes, then reuse the corridor state `(tick, army, frontier-per-lane)` directly. The lane overheads add constant per-burst costs; the corridor equivalence structure should survive.

Criteria for a valid lane decomposition:
- **Non-overlapping** — each tile belongs to at most one lane (so frontier-per-lane is well-defined)
- **Sequential** — each lane is a sequential path of tiles from an entry point outward (can turn and curve, doesn't need to be straight)
- **Sufficient length** — each lane is long enough for the burst(s) assigned to it
- **Computable overhead** — the per-burst traversal cost to reach each lane from the general is known

Note: complete coverage is *not* required — only the bursts that extend into the mid-region need lanes, and those lanes don't need to tile the entire reachable space.

The decomposition doesn't need to be unique. Multiple decompositions can be tried per board (like the different spine patterns on an open board), with the best result kept. As long as the number of reasonable decompositions is manageable and each can be evaluated quickly (the DAG traversal is sub-second), this is tractable.

### How the paths relate

These paths may complement each other. Lane decomposition might be how you *discover* the right compact state — if boards consistently decompose into lanes, then `frontier-per-lane` IS the compact state. Conversely, finding the right abstract state might reveal that it's equivalent to some lane-based summary.

## Downstream applications

Once either path is solved, several things become possible:

### Timing entry deduplication

The existing solver generates many timing entries (burst patterns + overlap combinations). Many of these may produce the same state. With a compact state definition, equivalent entries can be identified and deduplicated before the expensive spatial search — directly reducing the solver's bottleneck.

### DAG-based search

Instead of enumerating burst chains and then searching for paths, traverse the state graph directly. The DAG DP approach (proven in this session's corridor analysis) discovers states via BFS and propagates path counts, visiting each state exactly once. For 4-corridor this was 54,000x faster than brute-force chain enumeration. On real boards with a compact state, the same approach could replace or augment the timing subproblem entirely.

### Transposition tables

A transposition table keyed on the compact state allows the solver to recognize when it reaches a previously-seen state via a different path and reuse the result. The N-corridor analysis shows that transposition tables would stay small: at most 2×N (tick, army) pairs per frontier configuration, and states-per-frontier grows slowly with corridor count.

## Connection to existing solver (custom-algo-1)

The solver splits the problem into timing (board-independent burst patterns) and spatial (board-specific path search):

1. **Timing:** enumerate descending partitions of capture count, expand overlap combinations, simulate timing
2. **Spatial:** for each timing entry, search for non-overlapping paths via grouped backtracking with bitmask pruning

### Existing equivalence reduction

The solver's **descending partitions** already reduce burst size ordering permutations — e.g., it tries [12,7,3,2] but not [3,7,12,2]. This is a form of equivalence reduction, but doesn't capture deeper equivalence (different size sequences reaching the same state).

### Structural parallels

- The solver's **overlap model** (prefix overlap = re-traversal of owned tiles) maps directly to the corridor model's frontier concept
- The solver's **paths** are analogous to lanes — each is a sequential tile sequence from the general outward
- The solver's **bitmask overlap check** ensures paths don't share tiles, similar to the non-overlapping lane requirement
- The solver's **path generation** (all non-backtracking paths from general) may already be computing candidate lanes implicitly

### The bottleneck

The spatial search is the bottleneck on hard boards (tight corners, constrained geometry), spending 90%+ of time in the inner-loop candidate scan. Reducing the number of timing entries fed into this search — via deduplication or DAG-based search — directly reduces total work.
