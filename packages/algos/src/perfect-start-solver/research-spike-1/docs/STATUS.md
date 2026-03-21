# Status

Last updated: 2026-03-20 (session 3.20-1)

## Current state

First experiment complete. 1.3 (path mask redundancy) returned a definitive negative result — redundancy is only 1.1–1.4x, ruling out dedup as a meaningful optimization. A follow-up on starting-neighbor distribution surfaced a promising lead for direction-based candidate partitioning.

Start with `INTRO.md` for problem/model context.

## Active threads

None actively in progress. Next candidates:

- **1.2 Phase timing breakdown** — where does solver time go per board. Would clarify whether candidate scanning (where neighbor partitioning helps) or backtracking over timing entries is the bottleneck.
- **3.2 Neighbor pre-filtering** — trivial to implement, immediate signal. The neighbor distribution data (session 3.20-1) suggests this could skip 50–85% of candidates on asymmetric boards.
- **1.1 BigInt vs Uint32Array** — microbenchmark of core bitmask ops. Still independent, but the critical review argues constant-factor gains are less impactful than search structure improvements.
- **Group ordering** — reviewer argued this is a near-free win for corner-9x9

## Completed threads

- **1.3 Path mask redundancy** — see `findings/1.3-path-mask-redundancy.md`. Compression ratio ~1.2x across all boards. Zero dominated masks. Dedup (4.1), inverted-index search, and cheap arc consistency are ruled out. Follow-up: neighbor distribution shows significant imbalance on asymmetric boards.

## Key decisions / learnings

- **Path masks are nearly unique** — non-backtracking paths on a grid are ~1:1 with their bitmasks. The contiguity constraint kills the combinatorial explosion we expected.
- **Dedup (4.1) is not worth pursuing** — 1.2x reduction doesn't justify the code.
- **Direction-based candidate partitioning looks promising** — paths distribute unevenly across neighbors on asymmetric boards (2–4x imbalance at length 12). Partitioning by `tiles[0]` is the simplest form of directional awareness. Not yet validated as a solver speedup.
- Spatial/structural awareness is the main research direction — making the solver see what humans see (sectors, directional structure, bottlenecks)
- Hard sector boundaries won't work well in practice; fuzzy tile affinity is more promising
- Constraint propagation (CSP framing) surfaced as a major missing angle in the critical review
- Tree packing (3.3) is likely a dead end per the review — tree approximation is worst where you need it most

## Key docs

- `INTRO.md` — problem, model, and what the research is about
- `EXPLORATION-SURVEY.md` — full idea catalog (4 themes, execution order)
- `SURVEY-DOC-CRITICAL-REVIEW.md` — critical review (missing techniques, contrarian takes)
- `README.md` — docs workflow guide
- `custom-algo-1/README.md` — solver implementation details
- `findings/1.3-path-mask-redundancy.md` — first experimental result + neighbor distribution follow-up

## What's next

After re-reading the survey and review in light of 1.3 results (see findings doc for full analysis), the strongest next direction is the **review's pipeline idea**: timing entry → neighbor assignment → path partitioning by starting direction → per-partition search. This is grounded in data we have, incrementally buildable, and each step is independently testable.

Concrete candidates for next session:

1. **The pipeline (3.2+)** — build the neighbor assignment → path partitioning pipeline. Start with the simplest version: partition paths by `tiles[0]`, assign zero-overlap bursts to specific neighbors based on timing entry, search within partitions. Measure actual solver speedup.
2. **Quick wins: group ordering + symmetry breaking** — ~10 lines each, directly attack known bottlenecks. Group ordering addresses corner-9x9 specifically. Symmetry breaking (fix burst-1 direction) is free and stacks with everything.
3. **1.2 Phase timing** — still useful diagnostically but less urgent now that we have a concrete direction to try.

See `findings/1.3-path-mask-redundancy.md` "Re-reading the survey and review" section for which ideas got stronger/weaker after 1.3.
