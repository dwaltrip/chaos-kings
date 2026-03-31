# Session 1: Equivalent Burst Chains in a 1xN Corridor

## Context

Exploring the "landscape" of burst chain strategies to inform the perfect-start-solver. This session focused on a simplified model: a one-sided 1xN corridor.

The codebase already had an **abstract-moves model** (no geometry, no re-traversal — as if every burst goes to a fresh neighbor). The corridor model adds the key cost of **re-traversal**: each burst walks back through all owned tiles before capturing new ones.

## Model

- General at x=0, corridor extends right
- A **burst** sends army from the general outward, capturing new tiles
- Army needed per burst = (new tiles) + 1 (leave 1 behind)
- Total moves per burst = frontier + burstSize (re-traverse owned tiles, then capture)
- Army grows via production ticks (every 2 ticks, starting at tick 2)
- A **chain** = sequence of burst sizes [s1, s2, ..., sn], frontier = sum of sizes
- Two chains are **equivalent** if they produce the same (tick, generalArmy, frontier)

## Key Findings

### 1. Massive equivalence class collapse

Within MAX_TICK=50: 4,959 valid chains collapse to just 132 unique end states.

Separately, looking at ALL compositions of N (ignoring tick limits): the reduction grows with N. At N=15, 16,384 compositions produce only 77 distinct states (~213x reduction).

*(See `output/q2/summary.md` for the full equivalence group table)*

### 2. Free threshold at N ≤ 3

Starting from the initial state (tick=0, army=1, frontier=0), ALL compositions of N produce the same end state for N = 1, 2, 3. At N = 4 it splits into 2 distinct states.

This means: how you partition the first 3 tiles of expansion from the general doesn't matter — any repartitioning produces the same (tick, army, frontier) at the end.

Note: this is specifically about chains starting from the initial state. The same property does not necessarily hold when starting from an arbitrary intermediate state.

*(See `output/q2/verification.md`, Part 1)*

### 3. Free prefix + fixed suffix decomposition

Most equivalence groups (129/131) decompose as: all chains in the group share a common suffix, and the prefixes exactly match a complete equivalence group at a lower frontier.

Example from frontier=6 (5 groups, from `output/q2/verification.md` Part 3):

| tick | chains | suffix    | prefixN |
|------|--------|-----------|---------|
| 18   | 12     | (none)    | 6       |
| 19   | 4      | [1, 2]    | 3       |
| 21   | 8      | [1]       | 5       |
| 23   | 4      | [1, 1]    | 4       |
| 24   | 4      | [1, 1, 1] | 3       |

Reading: the tick=21 group shares suffix [1], and its 8 prefixes exactly match the single equivalence group at frontier=5 (which has 8 chains).

### 4. Decomposition becomes uninformative at higher frontiers

At frontier ≥ 8, most groups have no common suffix (suffix = none). The decomposition still *passes* (trivially — the "prefix" is the entire chain), but it doesn't reveal any structure. By frontier=10, 16/20 groups have no common suffix. The equivalences at higher frontiers come from something deeper than simple suffix decomposition.

### 5. Two "converging suffix" cases

Two groups (frontier=9 tick=29, frontier=13 tick=42) have prefixes producing 2 different intermediate states, yet the suffix maps both to the same end state. The suffix erases the difference. This is a deeper form of equivalence than the prefix+suffix model predicts.

## Why splitting is free (intuition)

Splitting a burst into two smaller ones adds re-traversal moves but reduces waiting time (less army needed per burst). For small frontiers, these exactly cancel out. As frontier grows, re-traversal becomes expensive enough that splitting genuinely costs extra ticks.

The exact threshold (N=3) is likely tied to the production timing (growth every 2 ticks).

## Open Questions

- **Why N=3 specifically?** Is the free threshold a direct consequence of the production-every-2-ticks schedule?
- **What structure governs the suffix=(none) groups at higher frontiers?** The longest-common-suffix decomposition doesn't capture it — a different analysis approach may be needed.
- **Double-sided corridor**: natural next extension. The general can expand left and right. How does the equivalence structure change when you have two independent frontiers?
- **Canonical enumerator**: can we enumerate only canonical (shortest) chains per equivalence class, skipping redundant ones entirely?

## Files

All paths relative to `explore-landscape/`:

- `questions/q2-equivalent-burst-chains-simple.ts` — enumeration + output generation
- `questions/q2-verify.ts` — verification of free-prefix theory
- `output/q2/summary.md` — equivalence group table
- `output/q2/full-data.json` — structured data for all groups
- `output/q2/verification.md` — verification results
