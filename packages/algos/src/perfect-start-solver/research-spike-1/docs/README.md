# research-spike-1 — Docs

Research effort exploring improvements to the `custom-algo-1` burst-path solver.

## Workflow

### Starting a session

1. Read `INTRO.md` (if new to this research) and `STATUS.md` (always).
2. If picking up a specific thread, check its session notes in `sessions/` and any findings in `findings/`.
3. The historical docs (survey, review) provide full context on the idea space if needed, but STATUS should be enough for most sessions.

### During a session

- **Session notes**: Write to `sessions/` as you go — observations, intermediate results, design discussions, dead ends. Named as `{M}.{DD}-{N}-{topic}.md` (e.g., `3.21-1-bigint-bench.md`).
- **Session logs**: Create a `{M}.{DD}-{N}-LOG.md` in `sessions/` to summarize what happened in the session.
- **Running experiments**: Scripts live in `../experiments/`. They import from `custom-algo-1` (paths, bitmasks, timing, boards, etc.). Save raw output to `../experiments/output/` (gitignored). Name output files to match the script: `{M}.{DD}-{N}-{topic}.txt`.
- **Findings**: When a thread reaches a clear conclusion, distill it into `findings/` (e.g., `findings/bigint-benchmark.md`). Reference session docs for the full trail.

### Ending a session

- Write or update the session LOG in `sessions/`.
- Update `STATUS.md` with any changes to active threads, new learnings, or shifts in priorities. The "what's next" section in STATUS serves as a brief handoff.
- If the next session needs more detailed context (mid-flight work, tricky state, specific instructions), write a `{M}.{DD}-{N}-HANDOFF.md` in `sessions/` and link to it from STATUS.
- Commit everything.

## Doc index

| Doc | Role | Updated |
|-----|------|---------|
| `INTRO.md` | Problem, model, and research motivation | Rarely |
| `STATUS.md` | Living dashboard — read this first | Regularly |
| `sessions/` | Session logs, notes, and handoffs | Per session |
| `findings/` | Polished writeups of conclusions | When a thread concludes |
| `../experiments/` | Experiment scripts + `output/` (gitignored) for raw results | Per session |
| `EXPLORATION-SURVEY.md` | Original brainstorm survey (historical) | Rarely |
| `SURVEY-DOC-CRITICAL-REVIEW.md` | Idea-gaps review of survey (historical) | Rarely |
