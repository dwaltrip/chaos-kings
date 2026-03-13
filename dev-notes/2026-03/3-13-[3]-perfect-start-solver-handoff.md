# Perfect Start Solver — Handoff for Next Session

**Previous docs:**
- `3-12-[2]` — Algorithm ideas and scoring function designs
- `3-12-[3]` — Implementation sketch and build plan
- `3-13-[1]` — Initial progress (beam search works, land-only baseline)
- `3-13-[2]` — Scoring experiments, perf instrumentation, score caching

**Code:** `packages/algos/src/perfect-start-solver/prototyping/`

---

## Current state

Infrastructure is solid and clean. Beam search, comparison runner with file output (JSON + tick logs), perf instrumentation — all working. Easy to add new scoring functions or boards and compare.

**Results (50 ticks, 7x7 open field, optimal = 25):**
- land-only: 23 land (92% optimal)
- capturable-tiles: 22 land (worse — see `3-13-[2]` for why)

**Bottleneck:** clone+step is ~75% of runtime. `structuredClone` is expensive but fine for now (~3s at beam=200 on 7x7).

---

## What to do next

Two directions, probably do both:

1. **Mountain boards** — The open field is nearly solved by greedy play (23/25). Routing decisions matter much more on boards with chokepoints. Add 2-3 test boards with varying mountain density to the comparison matrix. This will expose a bigger gap for scoring functions to close.

2. **Better scoring functions** — Ideas in `3-12-[2]` that haven't been tried yet:
   - Time-aware projected land (discount capturable estimate by remaining ticks)
   - Superlinear army concentration (value N units on one tile more than N×1)
   - Frontier surface area (count blanks adjacent to territory)

Mountain boards first is probably higher value — gives a harder test case to iterate scoring against.

---

## Recent cleanup (this session)

- Shared `helpers.ts` (ALL_DIRECTIONS, toMoveEvent, runWithTiming)
- `format.ts` (alignColumns, formatMove, num) — auto-aligned text output
- Score caching in beam search (2.5x speedup for expensive scorers)
- Perf instrumentation: gen / clone+step / score+sort breakdown per run
- File output: timestamped JSON + tick logs to `prototyping/data/`
