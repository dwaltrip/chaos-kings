# Session 3: Corridor Burst Model Fix + Revised Analysis

## Context

Sessions 1 and 2 explored equivalent burst chains in single-sided and double-sided corridors, finding significant equivalence structure. This session discovered a fundamental bug in the burst model and re-ran all analyses with corrected code.

**Goal:** Build towards a fast exact solver for optimal openings (round 1, through max_tick). The corridor analyses are stepping stones — understanding equivalence structure to enable search space pruning.

## Bug Found & Fixed

The corridor burst model treated burst size as a free parameter. You could request a "burst of 1" even when the general had 4 troops. In the actual game, you always move all troops minus 1 from a tile. The burst size is a consequence of how many troops you have when you decide to move.

**The decision is "how long to wait before bursting."** Waiting longer accumulates more army, which means a larger burst. You can't choose a burst smaller than `generalArmy - 1`. Note: production during prior bursts can leave the general with troops, constraining the *minimum* burst size for the next move.

**Fix:** Changed the recursion to iterate `targetArmy` from `max(2, state.generalArmy)` upward, deriving `burstSize = targetArmy - 1`. Added invariants to `corridorBurst` and `corridorBurstDouble` to reject `targetArmy < generalArmy`.

**Files fixed:** q2 (`corridorBurst`), q2-verify (`runChain`, free threshold logic), q3 (`corridorBurstDouble`, recursion), q3-verify (`runChain`, replaced Part 1 with per-(L,R) analysis).

## Impact on Numbers

| metric | old (buggy) | fixed |
|--------|-------------|-------|
| q2 chains | 4,959 | 1,019 |
| q2 unique states | 132 | 24 |
| q2 collapse ratio | 37.6x | 42.5x |
| q3 chains (maxTick=50) | — | 376,916 |
| q3 unique states | — | 431 |
| q3 collapse ratio | — | 874.5x |

Fewer chains but tighter collapse — the invalid chains were inflating both counts, but states more than chains.

## Findings That Held Up

### Free threshold N<=3

All valid compositions of frontier N produce the same end state for N=1,2,3. At N=4 it splits into 2 states. Robust through the fix. Confirmed for both single-sided (q2-verify) and per-direction in double-sided (q3 one-sided edges match q2).

### Equivalence collapse is massive

Collapse ratio slightly improved after fix (42.5x vs 37.6x for single-sided). Double-sided at 874.5x.

### Perfect L/R mirror symmetry (q3)

Every (L=a, R=b) state has a corresponding (L=b, R=a) state. 0 states without a twin.

### Direction ordering is free for unexplored paths

When both directions have frontier=0, burst order doesn't matter.

## Findings Invalidated

### "Collapse exceeds single-squared"

Session 2 claimed double-sided collapse exceeded the independent-directions prediction (single-ratio squared) at higher maxTick values. Corrected data shows it's consistently *below* single-squared:

| maxTick | single ratio | double ratio | single-squared |
|---------|-------------|--------------|----------------|
| 20 | 4.9x | 18.6x | 23.8 |
| 30 | 11.9x | 84.7x | 142.3 |
| 40 | 24.2x | 290.0x | 583.6 |
| 50 | 42.5x | 874.5x | 1806 |

Shared army/production between directions *reduces* independence.

### "Two converging suffix" cases

The 2 exceptions in q2 suffix decomposition (frontier=9 tick=29, frontier=13 tick=42) were artifacts of invalid chains reaching impossible states. These states don't exist in the corrected output.

### All absolute numbers from sessions 1 and 2

Chain counts, state counts, group counts were inflated by invalid chains.

## New Findings

### At most 2 states per frontier (single-sided)

Every frontier has either 1 or 2 distinct (tick, army) end states. Old buggy data showed up to 12+ states per frontier. This is a very tight structural constraint.

### Some frontiers above 3 collapse to 1 state

Among valid compositions, frontiers 5, 8, 11, 12, 14 collapse to a single state (in addition to 1, 2, 3). However, at higher N most compositions are invalid, so this is among a shrinking valid set. Pattern not yet explained.

### 100% clean suffix decomposition (q2)

All 23 multi-chain groups decompose as prefix-group + shared suffix. Zero exceptions (old data had 2). The equivalence structure is fully compositional.

### 29% of (L,R) splits collapse to single state (q3)

57 of 198 L,R splits have all valid chains reaching the same (tick, army). Includes large splits like (10,10), (8,12), (8,13). Pattern not yet characterized. Max states for any split is 4.

### q2-verify free threshold logic was wrong

Old code reported N<=14 because it took the last N where all valid compositions agreed, rather than requiring contiguous agreement from N=1.

## Model Assumptions (verified safe for opening solver)

- **Re-traversal is free** (costs time, not army): Correct. Each owned tile has exactly 1 army; moving stack picks up 1 and leaves 1, preserving stack size.
- **Bursts are atomic** (no mid-burst interleaving): Fine for v1 solver. In theory you could pause a stack mid-corridor and use newly-produced troops elsewhere, but this is rarely optimal for openings.
- **Neutral tiles have 0 army**: Valid for opening analysis. Real tiles have defensive army, but this is a known simplification of the corridor model.
- **No cities**: Cities are too expensive to capture during the opening round.
- **No enemy tiles**: Opening strategies assume no enemy contact. May occur in reality, but out of scope for the solver.
- **Non-initial-state caveat doesn't apply**: The solver always starts at t=0. Equivalence classes already account for all intermediate states within chains.

## Path Forward: Towards a Fast Exact Opening Solver

### Corridor extensions (increasing direction count)

- 3-arm star graph (general + 3 width-1 corridors)
- 4-arm star graph (max for grid geometry)
- Goal: confirm equivalence collapse pattern scales, measure state space growth vs collapse

### Corridor extensions (increasing width)

- Width-2, single-sided — first step beyond width-1. Fundamentally different: troops can move sideways, multiple paths exist, re-traversal structure changes
- Width-2, double-sided
- Width-3 — approaches "open area" geometry
- Goal: understand how width affects equivalence structure, whether free threshold survives

### Analysis questions for each extension

- How many states per frontier configuration? Still capped at 2 (single-sided) or 4 (double-sided)?
- Does the free threshold hold? At what value?
- What's the collapse ratio? How does it scale with maxTick?
- Does suffix decomposition work, or is a new analytical tool needed?

### Solver architecture considerations

- Canonical chain enumerator: generate one representative per equivalence class
- Transposition table keyed on (tick, generalArmy, frontier-per-direction)
- Branching factor on a real board (~3-4 open neighbors from general)
- Feasibility of exact search for realistic board size through round 1

## Files

All paths relative to `explore-landscape/`:

- `questions/q2-equivalent-burst-chains-simple.ts` — fixed corridorBurst, enumeration
- `questions/q2-verify.ts` — fixed runChain, free threshold logic, suffix decomposition
- `questions/q3-equivalent-burst-chains-double.ts` — fixed corridorBurstDouble, enumeration
- `questions/q3-verify.ts` — fixed runChain, new Part 1 (per-L,R state counts)
- `output/q2/summary.md` — corrected equivalence group table
- `output/q2/verification.md` — corrected verification results
- `output/q2/archive-buggy-version/` — old output for comparison
- `output/q3/summary-max-tick-50.md` — corrected double-sided results
- `output/q3/verification-max-tick-50.md` — corrected verification
- `tmp-scripts/debugging-corridor-bursts.ts` — script that exposed the bug
