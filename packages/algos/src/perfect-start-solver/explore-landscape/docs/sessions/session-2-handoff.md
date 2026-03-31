# Session 2 Handoff: Double-Sided Corridor

## Context

Session 1 explored equivalent burst chains in a one-sided 1xN corridor (as "question 2" in the explore-landscape framework) and found significant structure (see `session-1-notes.md`). The natural next step is a double-sided corridor: the general sits in the middle and can expand left or right. This would be question 3.

## Goal

Explore how the equivalence structure changes when the general has two directions to expand. Comparing with the single-sided results should surface which patterns are fundamental and which are artifacts of the one-sided setup.

## Model sketch

- General at center, corridor extends left and right
- State likely includes (tick, generalArmy, leftFrontier, rightFrontier) — but this may evolve
- Each burst chooses a direction; re-traversal cost depends on that direction's frontier
- Equivalence = same end state

The existing `countProductionTicks` and `tickForGeneralArmy` helpers should carry over. The `corridorBurst` function from q2 is a starting point but will need adaptation.

## Interesting threads

These are starting hypotheses from session 1. Once the double-sided data is generated, the patterns themselves may suggest better questions — follow whatever's most compelling.

- Does the free threshold (N ≤ 3 in single-sided) still appear? Is it per-direction, total, or something else entirely?
- Is burst ordering between directions free? (e.g., [L3, R2] vs [R2, L3]) — if so, that's a huge reduction
- How does the equivalence collapse ratio compare to single-sided?
- Does the suffix decomposition structure carry over, break down, or take a different form?

## Comparison points with single-sided

Using the same MAX_TICK=50 makes direct comparison easy:
- Total chains vs unique states (reduction ratio)
- Free threshold value
- Decomposition pass rate

## Reference

Paths relative to `packages/algos/src/`:

- `perfect-start-solver/explore-landscape/README.md` — project structure, how to run scripts
- `perfect-start-solver/explore-landscape/docs/sessions/session-1-notes.md` — findings from single-sided corridor exploration
- `perfect-start-solver/explore-landscape/questions/q2-equivalent-burst-chains-simple.ts` — single-sided implementation (good reference for patterns)
- `utils/FORMAT-GUIDE.md` — output formatting helpers (md, json)
