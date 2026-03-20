# Continuation Prompt — Custom Algo Perf Work

## Context

Read these in order:

1. `dev-notes/2026-03/3-18-[1]-notes-for-custom-algo-burst-path-search.md` — original algorithm design
2. `dev-notes/2026-03/3-19-[1]-custom-algo-session-notes.md` — initial implementation
3. `dev-notes/2026-03/3-19-[3]-overlap-design-sketch.md` — overlap re-traversal design
4. `dev-notes/2026-03/3-19-[6]-overlap-implementation-session-notes.md` — overlap implementation
5. `dev-notes/2026-03/3-20-[1]-perf-investigation-session-notes.md` — first perf pass, profiling, v2 idea
6. `dev-notes/2026-03/3-20-[2]-v2-perf-analysis.md` — v2 results + deep perf analysis
7. `dev-notes/2026-03/3-20-[3]-grouped-iteration-design-sketch.md` — v3 grouped iteration design

Code lives in `packages/algos/src/perfect-start-solver/custom-algo-1/`.
Read all top-level `.ts` files (not `__tests__/`, `tools/`, or `tmp-scripts/`).
Also skim `tools/` — reusable CLI scripts for analysis.

Check recent git log (`git log --oneline -20` on branch `custom-algo-1`).

## Where we left off

Built solver-v2 with precomputed timing tables. Added 7 new test
boards (corner-9x9, edge-9x9, double-corridor-9x9, dense-mtns-9x9,
maze-9x9, pinch-9x9, corridor-11x11). Did deep perf analysis. The
key findings and ideas are in the docs above — read them carefully,
but treat them as working hypotheses, not settled conclusions.

Created reusable CLI tools:

- `tools/board-info.ts`
- `tools/timing-info.ts`
- `tools/check-burst-timing.ts`
- `tools/profile-search-detail.ts`

## Goals for this session

The overall goal is improving solver performance, especially on the
hard boards (corridor-7x7, double-corridor-9x9, corner-9x9, edge-9x9).
We have ideas but haven't committed to a specific path yet. Please
check in with Daniel before diving deep into implementation — discuss
the approach, brainstorm alternatives, poke holes in assumptions.

### Grouped iteration (v3) — our leading idea

The design sketch in `3-20-[3]-grouped-iteration-design-sketch.md`
proposes grouping timing entries by burst-1 move length and sharing
burst-1 path picks across entries. The analysis looks promising but
there are open questions about ordering, forward checking details,
and whether the grouping actually helps on the hardest boards.

Worth discussing before building:
- Does the cost model analysis hold up? (See the "no filtering at
  burst-1" insight in the design doc — it complicates things)
- Is grouped iteration the right level of optimization, or should
  we be thinking about the problem differently?
- Forward checking: how deep should it go? Just burst-2, or deeper?

If we build it: `solver-v3.ts`, wire into `run.ts` (`--solver v3`),
compare against v2 on all boards. v3 would replace v1 (delete v1).
Keep v2 as a simple reference for correctness checks.

### Verify assumptions

Several assumptions underpin the solver design. Some may be wrong.
Worth investigating — could change what we optimize for:

- **"maxBursts=6 covers all optimal solutions"** — Quick to check:
  run v2 with maxBursts=8 on a few boards.
- **"Overlap is prefix-only"** — Assumed but not proven. Could
  matter on constrained boards.
- **"Solutions always use 4 bursts"** — True on current boards, but
  is this fundamental or just an artifact of the test set?
- **"Longer burst-1 is always better"** — All solutions so far use
  burst-1=10+. Relevant for group ordering.

### Build CLI tools as we go

We've been building small, composable CLI scripts (`tools/board-info.ts`,
`tools/timing-info.ts`) to make analysis easier. Keep doing this — when
you find yourself writing ad-hoc `npx tsx -e` scripts more than
once, consider promoting to a proper tool. Next likely candidate:
`profile-solve.ts` (phase-by-phase timing breakdown).

Convention: `typed-command` pattern, `--board` flag, clean text
output, live in `tools/` or alongside `run.ts`.

### Other directions to think about

These are speculative but worth discussing:
- **Candidate ordering** — on corner-9x9 (36K len-12 candidates),
  the order in which burst-1 candidates are tried matters a lot. If
  the "good" candidates (ones that leave room for burst-2+) appear
  late in the enumeration order, even v3 with forward checking will
  be slow. Possible heuristics: prefer paths that spread outward
  (maximize distance from general), prefer paths that go in "unique"
  directions, sort by number of compatible burst-2 candidates. All
  speculative — measure before optimizing.
- **Are there fundamentally different approaches** we haven't
  considered? The burst-path decomposition is one framing — are
  there others?
- **What's a realistic perf target?** Is <1s on all 9x9 boards
  reasonable, or are some boards inherently hard?
