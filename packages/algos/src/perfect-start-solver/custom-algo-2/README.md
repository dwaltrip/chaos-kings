# custom-algo-2: Prefix + Lane Decomposition + Corridor DAG Solver

Next-gen solver candidate for the perfect-start problem. Replaces `custom-algo-1`'s monolithic grouped backtracking with a staged pipeline where each stage handles a different region of the board.

## Status

**Early exploration.** Components are being prototyped individually before being assembled into a working solver. Session 1 focuses on lane decomposition (see `lane-decomp/`).

## The hypothesis

The board splits naturally into three regions around the general:

- **Near-region** — tiles all bursts interact with (prefix paths, overlap re-traversal). Handled by **prefix-set enumeration**: enumerate compatible prefix-per-burst assignments at some depth D.
- **Mid-region** — tiles reached only by the longer bursts (B1-B2, sometimes B3-B4). Handled by **lane decomposition**: partition the mid-region into non-overlapping corridor-like lanes, one per mid-region-extending burst.
- **Far-region** — unreachable within the tick budget. Ignored.

Once the mid-region is decomposed into lanes, the remaining search is a parameterized N-corridor problem, which the **corridor DAG equivalence** results (see explore-landscape sessions) solve efficiently via state collapse.

## Key docs

- [Session 4.09-1 — Formalizing solver ideas](../docs/sessions/4.09-1-brainstorm-for-formalizing-solver-ideas.md) — overall framework, 6 key questions.
- [Session 4.09-2 — Burst segmentation analysis](../docs/sessions/4.09-2-burst-segmentation-analysis.md) — which bursts extend into the mid-region.
- [Session 4.09-4 — Lane decomposition brainstorm](../docs/sessions/4.09-4-lane-decomposition-brainstorm.md) — approach catalog for the mid-region problem.
- [Session 4 future directions](../explore-landscape/docs/sessions/session-4-future-directions.md) — corridor-to-lane model, saved tiles.

## Subdirectories

- `lane-decomp/` — mid-region lane decomposition prototype (session 1).
