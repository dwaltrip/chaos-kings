# Custom Algo — Continuation Prompt

## Context
Read these for full background:
- dev-notes/2026-03/3-19-[1]-custom-algo-session-notes.md (what we did today)
- dev-notes/2026-03/3-18-[1]-notes-for-custom-algo-burst-path-search.md (the algorithm idea)

Code is in packages/algos/src/perfect-start-solver/custom-algo-1/

## Where we are
The solver works end-to-end. It enumerates burst patterns, generates
paths from the general, and finds non-overlapping path assignments via
bitmask backtracking search. Gets 24 captures (25 land) on all open/sparse
boards, 23 on corridor/maze. Tests are in place (48 tests passing).

## What's next
1. **Overlap re-traversal** — later bursts crossing already-owned tiles.
   Key for constrained boards. See "Handling overlap" in the notes doc.
2. **Path generation scaling** — maxBurst capped at 12 due to OOM at
   length 14+ on open-11×11. Need a strategy for longer bursts.

## Workflow
Collaborative session — check in at reasonable intervals, especially on
design questions. Write dev-notes as you work.
