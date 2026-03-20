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
boards. Did deep perf analysis and found that v2's main weakness is
redundant burst-1 work (re-scanning candidates for each timing entry).
Designed a "grouped iteration" approach (v3) that fixes this. Also
identified forward checking as a complementary optimization.

Created reusable CLI tools: `board-info.ts`, `timing-info.ts`,
`tools/check-burst-timing.ts`, `tools/profile-search-detail.ts`.

## What to do next

### 1. Implement grouped iteration (v3)

Follow the design in `3-20-[3]-grouped-iteration-design-sketch.md`.
Key files to create:
- `solver-v3.ts` — new solver with grouped iteration
- Update `timing-table.ts` to support grouping by burst-1 length

The search structure:
```
for each capture target (24 down to 15):
  for each burst-1 move length group (longest first):
    for each burst-1 candidate path:
      for each timing entry in this group:
        searchRemaining(burst-1 path, entry, burstIdx=1)
```

Include forward checking: after choosing a burst-1 path, verify at
least one entry has a viable burst-2 candidate before recursing.

Wire into `run.ts` (already supports `--solver` flag, add `v3`).
Compare v1/v2/v3 on all boards, especially corridor-7x7,
double-corridor-9x9, corner-9x9, and edge-9x9.

### 2. Continue verifying assumptions

Key assumptions to test (from the perf analysis doc):

- **"maxBursts=6 covers all optimal solutions"** — Run v1 with
  maxBursts=8 on a few boards and confirm no solution needs 7+ bursts.
  Quick check, should do this early.

- **"Overlap is prefix-only"** — Hard to verify without a reference
  solver. Could check: on boards where the solver struggles, does
  relaxing the prefix constraint (allowing mid-path overlap) find
  better solutions? Would need to modify `countPrefixOverlap` to
  allow non-prefix overlap and see if results improve.

- **"Solutions always use 4 bursts"** — Check the burst count
  distribution across solutions. The timing-info script shows most
  entries have 5-6 bursts at 24 captures — are any of those needed?

- **"Longer burst-1 is always better"** — All current solutions use
  burst-1=10, 11, or 12. Is there a board where burst-1=8 or shorter
  produces a better result? Relevant for group ordering in v3.

### 3. Build more CLI tools

We have `board-info.ts` and `timing-info.ts`. Next useful tool:

- **`profile-solve.ts`** — Phase-by-phase timing breakdown for a
  solve. Path gen time, table build time, search time (separately).
  Entries checked, nodes visited, rejection rates per burst. More
  detailed than `run.ts` but uses the real solver (not duplicated
  instrumented code like the tmp-scripts do).

General principle: small, composable scripts using `typed-command`,
same `--board` flag convention, living in `tools/` or alongside
`run.ts`. Each script does one thing and outputs clean text.

### 4. Stretch: think about candidate ordering

The grouped iteration design note mentions candidate ordering as an
open question. On corner-9x9 (36K len-12 candidates), the order in
which burst-1 candidates are tried matters a lot. If the "good"
candidates (ones that leave room for burst-2+) appear late in the
enumeration order, even v3 with forward checking will be slow.

Possible heuristics: prefer paths that spread outward (maximize
distance from general), prefer paths that go in "unique" directions,
sort by number of compatible burst-2 candidates. All speculative —
measure before optimizing.
