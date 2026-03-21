# Introduction

## The problem

Find the optimal opening expansion for a generals.io-style game: which tiles to capture, in what order, to maximize territory within 50 ticks. One general, no opponents, no cities. The general produces +1 troop every 2 ticks. Moving costs 1 tick per tile and leaves 1 troop behind. 24 captures (25 owned tiles) is the proven maximum under these rules.

## The burst model

Brute-force search over individual moves is intractable — 50 sequential decisions with branching factor ~4 explodes even on 7x7. But optimal openings decompose into a small number of **bursts** (typically 3-5), where each burst is a non-backtracking path from the general. Between bursts, the general accumulates troops for the next departure.

This decomposition splits the problem into two subproblems:

- **Timing** (board-independent): what sequences of burst sizes fit within 50 ticks, given troop production rates? A burst of N captures needs N+1 troops before departing.
- **Spatial** (board-specific): for a given burst sequence, can we find compatible paths from the general that don't fight over tiles?

**Overlap**: later bursts may retrace already-owned tiles to reach uncaptured territory. This is modeled as a prefix overlap — the first K tiles of a path traverse owned tiles, costing ticks but not troops.

## The current solver (custom-algo-1)

The solver has a pipeline: generate all paths from the general (DP, up to length 12), generate all valid timing entries (burst partitions × overlap combos), then search for compatible path assignments via grouped backtracking with feasibility pruning. BigInt bitmasks enable fast spatial operations — overlap checks, unions, and popcount are all bitwise ops.

It works well: most boards solve in under 200ms. A few constrained boards (corner generals, narrow corridors) take seconds. The search is the bottleneck on hard boards — the solver tries many timing entries and path candidates before finding a compatible assignment.

For implementation details, see `custom-algo-1/README.md`.

## What this research is about

The solver currently treats the board as an unstructured set of tiles and paths. It doesn't exploit spatial structure — sectors, corridors, bottlenecks, directional affinity — that humans see immediately. A human looking at a corner board instantly sees "2 exits, send bursts each way." The solver brute-forces this.

We're exploring whether structural and spatial awareness — constraint propagation, sector decomposition, path equivalence classes, direction-aware pruning, and related ideas — can yield significant improvements. See `EXPLORATION-SURVEY.md` for the full idea catalog and `SURVEY-DOC-CRITICAL-REVIEW.md` for the critical review.
