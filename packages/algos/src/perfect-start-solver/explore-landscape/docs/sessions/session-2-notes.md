# Session 2: Equivalent Burst Chains in a Double-Sided Corridor

## Context

Session 1 explored a one-sided 1xN corridor and found significant equivalence structure (N≤3 free threshold, suffix decomposition, massive collapse). This session extends to a double-sided corridor to see which patterns are fundamental and which are artifacts of the one-sided setup.

## Model

- General at center, corridor extends left and right
- Each burst chooses a **direction** (L or R) and a **size**
- Re-traversal cost = that direction's frontier (not the other direction's)
- Army needed per burst = burstSize + 1 (captures + 1 left behind)
- Total moves per burst = directionFrontier + burstSize
- A **chain** = sequence of (direction, size) steps: [L2, R1, L3, ...]
- State = (tick, generalArmy, leftFrontier, rightFrontier)
- Two chains are **equivalent** if they produce the same state

## Key Findings

### 1. Free threshold is per-direction, N≤3

Single-direction compositions (e.g., only bursting left) reproduce the exact same N≤3 free threshold from session 1. All partitions of N≤3 produce the identical state; at N=4 it splits.

This confirms: the free threshold is a property of corridor re-traversal mechanics + production timing, not an artifact of the one-sided setup.

Total frontier is never "free" — even N=1 gives 2 distinct states (L1 vs R1). On a real board, (leftF=3, rightF=1) and (leftF=1, rightF=3) are genuinely different positions. They cannot be assumed equivalent without careful analysis depending on board geometry and solver design.

**Caveat:** the N≤3 threshold was only tested from the initial state (tick=0, army=1), same as session 1. It has not been verified from arbitrary intermediate states. See [Appendix A](#appendix-a-free-threshold-starting-state-dependence) for details on what could break and how to test.

### 2. Direction ordering has conditional freedom

**Established: order is free when both directions are unexplored.** When two bursts go to directions that both have frontier=0, order doesn't matter. Each burst sees zero re-traversal regardless of sequence, so the cost math is identical. Example: [L2, R2] and [R2, L2] both end at tick=10, army=2, leftF=2, rightF=2.

**Established: order matters in general.** Traced [L1, R1, L2] (tick=11) vs [L1, L2, R1] (tick=10) — same frontier split (3,1), different end ticks. The cheap burst (R1, frontier_R=0, 1 move) benefits from being placed *after* the expensive burst (L2, frontier_L=1, 3 moves): after L2 completes, the general already has enough army from production during those 3 moves to launch R1 immediately with no wait. Placing R1 before L2 consumes wait-for-army ticks that push the entire schedule later.

**Hypothesis (untested):** there may be deeper conditional freedom beyond the new-path case — situations where order doesn't matter even with previously explored paths. Would need careful analysis.

**Practical implication:** the new-path freedom gives a concrete pruning rule for a solver — canonicalize by always doing L before R (or vice versa) when both directions are unexplored.

### 3. Suffix decomposition is weak and declining

In session 1, suffix decomposition explained ~98% of equivalence groups (single-sided). In double-sided, it's much weaker and declining with scale.

Overall clean decomposition rate across ALL multi-chain groups:

| maxTick | groups | no common suffix | clean decomposition | failed | overall rate |
|---------|--------|------------------|---------------------|--------|-------------|
| 20      | 101    | 47 (47%)         | 50 (49%)            | 4      | ~49%        |
| 30      | 470    | 240 (51%)        | 172 (37%)           | 58     | ~37%        |
| 40      | 1409   | 901 (64%)        | 386 (27%)           | 122    | ~27%        |

Two trends driving the decline:

1. **"No common suffix" groups are the majority and growing** (47% → 51% → 64%). The suffix lens has nothing to grab onto for these groups.
2. **Among groups that DO have a suffix**, the pass rate dropped from 93% (tick-20) to ~75% (tick-30/40) and leveled off around that range. The failures (58 at tick-30, 122 at tick-40) are groups where chains share a suffix but prefixes don't form a clean equivalence group — a "converging suffix" phenomenon that was rare in single-sided (only 2 cases) but is much more common here.

**Hypothesis (untested):** normalizing direction reorderings at new-path boundaries *before* checking suffixes might recover some structure. Chains like [..., L2, R3] and [..., R3, L2] are equivalent when both directions were unexplored at that point, but they appear as different suffixes to the literal suffix matcher. This is distinct from L↔R state-level symmetry (~2x on state count).

The suffix lens may simply not be the right primary tool for understanding double-sided equivalences. The majority of groups (and the growing fraction) have no common suffix, and this is where the structural questions are.

### 4. Collapse ratio accelerates — and exceeds single-sided squared

| maxTick | single ratio | double ratio | double/single | single² |
|---------|-------------|--------------|---------------|---------|
| 20      | 4.7x        | 17.7x        | 3.8x          | 22.1    |
| 30      | 10.5x       | 88.4x        | 8.4x          | 110.3   |
| 40      | 18.9x       | 468.3x       | 24.8x         | 357.2   |
| 50      | 37.6x*      | 2439.5x*     | 64.9x         | 1413.8  |

*(\*tick-50 single from session 1; tick-50 double from headline numbers only, JSON too large)*

If the two directions were fully independent, we'd expect double ≈ single². At tick-20/30 it's somewhat below. At tick-40/50, double **exceeds** single². This suggests cross-direction equivalences that don't reduce to per-direction structure alone — the new-path direction-ordering freedom is likely one source of these.

Decomposing sources of collapse: L↔R symmetry contributes a clean ~2x to state count (every non-self-symmetric state has a mirror twin — perfect symmetry, 0 states without). Since the model is perfectly L↔R symmetric, each mirror pair has the same number of chains, so this ~2x on state count translates directly to ~2x on reduction ratio. The remaining ~44x at tick-30 comes from burst-splitting equivalences + direction-interleaving equivalences.

**For the solver:** redundancy grows faster than actual complexity at larger scales. Pruning equivalent chains becomes *more* powerful exactly where you need it most.

## Infrastructure Changes

- **writeJson** (`packages/algos/src/utils/json.ts`): now writes raw JSON to file first, then runs fjson in-place. Eliminates the execSync stdin buffer limit that caused silent fallback to uncompacted JSON for large files.
- **q3 script**: typed-command CLI with `--max-tick` flag (defaults to 50). Smart chain truncation per group: ≤20 chains stores all, >20 stores 5 shortest + 5 longest by chain length. Always includes per-group aggregate stats: chainLengths (min, p10, median, p90, max), burstSizes (min, max), directionSplit (avgLeft, avgRight).
- **AlgoConfig** threaded through helpers instead of relying on global MAX_TICK constant.

## Open Questions (prioritized)

1. **What structure governs the "no common suffix" groups?** This is the majority of groups and the fraction is growing. The suffix decomposition can't see it. A different analysis approach is needed — possibly one that accounts for direction-reordering equivalences natively.
2. **Does normalizing direction reorderings recover suffix structure?** Canonicalizing new-path reorderings before checking suffixes could reveal hidden shared suffixes. Untested.
3. **Deeper conditional freedom in direction ordering?** Beyond the established new-path case, are there other conditions where interleaving order doesn't matter? Hypothesis only.
4. **Canonical chain enumerator:** can we enumerate only one representative per equivalence class, skipping redundant chains entirely? The per-direction N≤3 threshold and new-path ordering rule are two concrete pruning rules.
5. **Extension beyond corridors:** branching paths, 2D geometry. How does the equivalence structure change when the general has more than 2 directions?

## Files

All paths relative to `explore-landscape/`:

- `questions/q3-equivalent-burst-chains-double.ts` — enumeration + output generation
- `questions/q3-verify.ts` — reproducible verification of session 2 findings
- `output/q3/summary-max-tick-{20,30,40}.md` — equivalence group tables with direction ordering + symmetry analysis
- `output/q3/full-data-max-tick-{20,30,40}.json` — structured data with aggregate stats
- `output/q3/verification-max-tick-{N}.md` — verification output
- `docs/sessions/session-2-notes.md` — this file

---

## Appendix A: Free threshold starting-state dependence

The N≤3 free threshold (Finding #1) was tested only from the initial state (tick=0, army=1, frontier=0 in both directions). Session 1 flagged the same limitation for single-sided: "this is specifically about chains starting from the initial state. The same property does not necessarily hold when starting from an arbitrary intermediate state."

In the double-sided model, this caveat becomes more relevant because the other direction's bursts naturally create varied starting states for each direction's splits.

### What could break it

The re-traversal *cost* for a direction depends only on that direction's frontier — this is independent. But two other factors are path-dependent:

1. **Army availability.** The army level when you begin a split depends on the full chain history. A split that cancels perfectly from army=1 might not cancel from army=3, because wait-for-army timing shifts.

2. **Tick parity.** Production happens on even ticks. Starting a split on an odd vs even tick changes which production ticks fall during each sub-burst. A split that exactly cancels from an even starting tick might not from an odd one.

### How to test

Run all compositions of N for a single direction from a variety of non-initial states:

- Fix a starting state like (tick=10, army=2, leftF=0, rightF=5)
- Run all compositions of N=1,2,3,4 going left only
- Check: do all compositions of N still produce the same end state for N≤3?
- Repeat across varied starting states (different tick parities, army levels, other-direction frontiers)

If the threshold holds universally, it's a stronger result. If it depends on starting state, we need to characterize which states preserve it — that directly affects how a solver can use this pruning rule.
