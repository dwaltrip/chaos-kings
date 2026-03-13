# Perfect Start Solver — Algorithm Ideas

## Problem Statement

Given a board (blanks + mountains, no cities, single general, no opponents), find the move sequence that maximizes land count in N ticks (targeting N < 50, pre-land-production).

**Mechanics:**
- One move per tick
- Moves process before production each step
- General produces +1 unit every 2 ticks (even tick numbers)
- Moving to blank: source keeps 1, dest gets `source.units - 1`
- Moving to friendly: source keeps 1, dest gains `source.units - 1`

**Core insight:** The optimization is about minimizing "routing overhead" — ticks spent moving units through already-owned territory to reach blank tiles. Every routing tick is a tick not spent capturing.

---

## Algorithm: Beam Search + Simulation

BFS with a memory cap. At each tick, expand all states in the beam (generate possible moves), score the resulting states, keep the top B. Repeat until tick N.

- **Beam width:** B = 200–500 (tunable)
- **Move generation:** For each owned tile with units > 1, try all 4 adjacent directions. Categorize as "capture" (dest is blank) or "route" (dest is friendly). Also include "wait" (no-op).
- **Pruning:** Don't consider moves that push units deeper into the interior (away from all blank tiles).

The key open question is the **scoring function** — how to rank states within a beam. Several ideas below.

---

## Scoring Idea 1: Land Count + Army-to-Frontier Distance

For each tile with units > 1, compute distance to nearest blank tile. Score higher when large armies are close to blank tiles.

```
score = landCount * W
      + sum over hot tiles of: (units - 1) / dist_to_nearest_blank
```

**Strengths:**
- Rewards states with army positioned to capture immediately
- Handles "momentum" — a mid-route state with 4 units at distance 1 scores well
- A state mid-chain naturally scores higher as units move closer to the frontier

**Weaknesses:**
- Doesn't distinguish between blank tiles worth capturing and dead ends
- Needs a weight W to balance land vs positioning (tuning required)

---

## Scoring Idea 2: Frontier Surface Area

Count the number of unique blank tiles adjacent to your territory ("frontier surface area").

- Capturing a dead-end tile → surface area shrinks (consumed 1 blank, exposed 0 new)
- Capturing an open tile → surface area grows (consumed 1 blank, exposed 2-3 new)

```
score = landCount * W1
      + frontierSurfaceArea * W2
      + sum(excess / dist_to_nearest_blank) * W3
```

**Strengths:**
- Naturally penalizes dead-end captures without precomputation
- Adapts as board state changes (computed per state, cheap)
- Steers expansion toward open regions

**Weaknesses:**
- Three weights to tune (W1, W2, W3)
- Surface area alone doesn't capture army positioning

---

## Scoring Idea 3: Projected Land (Single Metric, No Weights)

Instead of weighting multiple factors, estimate one thing: "how much land will this state have at tick 50?"

```
projected_land = current_land + estimated_future_captures
```

Estimate future captures by: for each excess unit, compute ticks until it can capture (distance to nearest blank). Subtract from remaining ticks to get "productive ticks remaining" for that unit.

```
for each tile with units > 1:
  excess = units - 1
  dist = distance to nearest blank
  productive_ticks = max(0, ticks_remaining - dist)
  // each capture needs ~2 ticks (1 capture + 1 production wait), rough estimate
  estimated_captures += productive_ticks / 2
projected_land = current_land + estimated_captures
```

**Strengths:**
- Single number, no weights to tune
- Directly estimates what we're optimizing
- Collapses land, positioning, and frontier quality into one meaningful metric

**Weaknesses:**
- The estimate is rough — doesn't account for routing chains, army splitting, production pipelining
- Might need refinement once we see real data

---

## Blank Tile Valuation

Not all blank tiles are equally worth capturing. A blank tile with mountains on 3 sides is a dead end (+1 land, zero future expansion). A blank tile in open space gives +1 land AND access to more tiles.

This could augment any scoring idea above by weighting distance-to-blank by the blank tile's value.

**Approaches considered:**

1. **Count blank neighbors** — simple, but too shallow (doesn't see past immediate neighbors)
2. **Connected component size** — precompute via flood fill. Tiles in large open regions score high, tiles in small pockets score low. But static — doesn't adapt as tiles get captured.
3. **Reachable blanks within radius R** — BFS from each blank, count reachable blanks within R steps. Captures local openness.
4. **Frontier surface area** (Idea 2 above) — sidesteps per-tile valuation entirely by measuring the state's overall expansion potential.

**Open question:** Static precomputation is cheap but becomes inaccurate as tiles are captured. Per-state recomputation is accurate but expensive. Frontier surface area avoids this tradeoff but is a coarser signal. Need real data to see which matters.

---

## Next Steps

1. Implement beam search skeleton with the simplest scoring (just land count)
2. Build a few test boards (open field, narrow corridors, mountain mazes)
3. Add scoring ideas incrementally, compare results on the same boards
4. Use the data to guide which scoring approach to invest in
