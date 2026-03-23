# Finding: Thread 5 Wrap-Up — Capture-Target Pre-Check

**Date**: 2026-03-22
**Sessions**: 3.22-4, 3.22-5, 3.22-6, follow-up analysis
**Verdict**: Spent. No viable approach found for skipping infeasible capture targets cheaply. The fundamental constraint is path-level spatial incompatibility, which no capacity-based pre-check can detect.

## Goal

Skip provably infeasible capture targets before entering the B1 candidate loop. 7 of 12 slow boards spend 66-99.6% of total time on infeasible targets (post-bugfix numbers). Perfect target-skipping would turn all 7 into sub-105ms boards.

## Approaches tried

### 1. Reachable tile count (session 3.22-4)

Check if total reachable blank tiles from the general < target captures. **Dead** — never fires on any board. Even constrained boards (scattered-pockets-13x13) have far more reachable tiles than needed. The binding constraint is timing, not tile availability.

### 2. Per-neighbor capacity union (session 3.22-4)

For each neighbor, count reachable tiles, then check if the union covers the target. **Collapses to approach #1** — the union of per-neighbor reachable tiles approximates total reachable tiles.

### 3. Degree-based timing entry filter (session 3.22-6)

Filter entries where total zero-overlap bursts > general's degree. Pure arithmetic, near-zero cost. Kills 91.6% of entries at cap=24 on degree-2 boards (13 of 14 slow boards). **Correct but ineffective** — strictly weaker than the in-search N feasibility check, which already catches these entries. No runtime improvement; some boards slightly slower. Removed from solver. See `findings/3.22-6-degree-filter.md`.

### 4. Root-level feasibility sweep (analysis, not implemented)

Before iterating B1 candidates, run feasibility checks on all timing entries with coveredMask=0. If all entries fail at root level, skip the entire target.

**Won't fire on degree-2 boards.** The three existing checks at root level:
- **N check** at root = the degree filter (approach #3). 458 entries (8.4%) survive at cap=24 on degree-2.
- **P check** (per-burst tiles within reach) with coveredMask=0: every burst trivially passes — nothing is covered, so all tiles are available.
- **A check** (aggregate tiles within reach) with coveredMask=0: total reachable tiles far exceed target captures.

### 5. Improved distance approximation (session 3.22-5)

`FEASIBILITY_MAX_DIST` was 4, with a crude `beyondTiles = dist - 4` heuristic for longer moves. Turned out to be a **correctness bug**, not an optimization opportunity — the heuristic underestimated by 3x at distance 8, falsely pruning valid entries. Fixed by extending BFS masks to cover all possible move lengths (maxBurst + maxOverlapPerBurst = 15). pocket-2-11x11 went from 23 to 24 captures. Several infeasible-target boards got 2-4x slower as the false prunes were removed.

## Why no capacity-based pre-check can work

All five approaches test some form of **tile/neighbor capacity**: are there enough tiles, enough neighbors, enough tiles per neighbor, enough tiles within reach? On every current board, the answer is yes. The boards have ample tiles — the geometry just makes them unreachable via compatible paths within the 50-tick budget.

The actual failure mode at infeasible targets: entries survive feasibility checks (pass N, P, and A), reach the candidate scan, and find no compatible path. The incompatibility is at the level of specific path masks — two paths that each individually fit within reach but can't coexist without spatial overlap. Detecting this requires something close to actually doing the search.

This is a fundamental limitation, not a matter of making the checks tighter. Tighter capacity checks (per-neighbor burst assignment, sector-based capacity) face the same problem — the per-neighbor capacity is sufficient, the paths just don't exist.

## What Thread 5 cannot address

The 5 slowest boards (corner-7x7 through corner-13x13, floating-corner, pocket-2-11x11) are **deep-search dominated** with 0% infeasible-target waste — they solve at cap=24 on the first target tried. Thread 5 was never going to help these boards regardless.

## Files

- `findings/3.22-6-degree-filter.md` — degree filter experiment details
- `sessions/3.22-4-LOG.md` — approaches #1 and #2, infeasibility investigation
- `sessions/3.22-5-LOG.md` — distance approximation bugfix
- `sessions/3.22-6-LOG.md` — degree filter implementation and profiling baseline
- `sessions/3.22-6-profiling-overview-post-bugfix.md` — current baseline numbers
