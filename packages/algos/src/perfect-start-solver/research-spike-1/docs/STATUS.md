# Status

Last updated: 2026-03-20

## Current state

Research spike kicked off. We have a detailed survey of ideas, a critical review with additional angles (constraint propagation, watched literals, etc.), and a docs/workflow structure in place. No experiments run yet.

Start with `INTRO.md` for problem/model context.

## Active threads

None yet. Phase 1 candidates (all independent, can be tackled in parallel):

- **1.1 BigInt vs Uint32Array** — microbenchmark of core bitmask ops
- **1.2 Phase timing breakdown** — where does solver time go per board
- **1.3 Path mask redundancy** — how many paths share identical masks

Also worth considering early (from the critical review):
- **3.2 Neighbor pre-filtering** — trivial to implement, immediate signal
- **Group ordering** — reviewer argued this is a near-free win for corner-9x9

## Key decisions / learnings

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

## What's next

First real session — pick an experiment and go. Two good starting candidates:

- **1.3 Path mask redundancy** — pure data analysis, fast to run, and results directly inform multiple downstream ideas (dedup, clustering, inverted index, constraint propagation). High connectivity to the spatial themes.
- **1.1 BigInt vs Uint32Array** — equally self-contained with a definitive answer, but less connected to the spatial ideas. Resolves a clean performance question.

Either works. Both are Phase 1, independent, no prerequisites.
