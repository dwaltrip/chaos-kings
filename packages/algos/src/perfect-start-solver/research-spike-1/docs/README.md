# research-spike-1 — Docs

Research effort exploring improvements to the `custom-algo-1` burst-path solver.

## Workflow

### Starting a session

1. Read `STATUS.md` — it's the entry point. Current state, active threads, what's next.
2. If picking up a specific thread, check its session notes in `sessions/` and any findings in `findings/`.
3. `LOG.md` has brief chronological entries if you need to see the timeline.
4. The historical docs (survey, review) provide full context on the idea space if needed, but STATUS should be enough for most sessions.

### During a session

- **Session notes**: Write to `sessions/` as you go — observations, intermediate results, design discussions, dead ends. Named by date and topic (e.g., `3-21-bigint-bench.md`). This is the detailed record, like dev-notes.
- **Running experiments**: Scripts live in `../experiments/`. They import from `custom-algo-1` (paths, bitmasks, timing, boards, etc.).
- **Log entries**: Append brief entries to `LOG.md` as results come in. One paragraph per event — what was run, what was found, what it implies.
- **Findings**: When a thread reaches a clear conclusion, distill it into `findings/` (e.g., `findings/bigint-benchmark.md`). These are polished writeups, not session notes. Reference the session docs for the full trail.

### Ending a session

- Update `STATUS.md` with any changes to active threads, new learnings, or shifts in priorities.
- Make sure `LOG.md` and `sessions/` capture what happened.
- Commit everything.

## Doc index

| Doc | Role | Updated |
|-----|------|---------|
| `STATUS.md` | Living dashboard — read this first | Regularly |
| `LOG.md` | Brief chronological entries | Append-only |
| `sessions/` | Detailed session notes (mirrors dev-notes) | Per session |
| `findings/` | Polished writeups of conclusions | When a thread concludes |
| `EXPLORATION-SURVEY.md` | Original brainstorm survey (historical) | Rarely |
| `SURVEY-DOC-CRITICAL-REVIEW.md` | Idea-gaps review of survey (historical) | Rarely |
