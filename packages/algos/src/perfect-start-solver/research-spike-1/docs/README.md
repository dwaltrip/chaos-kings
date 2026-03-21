# research-spike-1 — Docs

Research effort exploring structural and spatial improvements to the `custom-algo-1` burst-path solver.

## Workflow

### Starting a session

1. Read `STATUS.md` — it's the entry point. Current state, active threads, what's next.
2. If diving into a specific experiment, check `LOG.md` for prior runs and `findings/` for structured writeups.
3. The historical docs (survey, review) provide full context if needed, but STATUS should be enough for most sessions.

### During a session

- **Running experiments**: Scripts live in `../experiments/`. They import from `custom-algo-1` (paths, bitmasks, timing, boards, etc.).
- **Logging**: Append to `LOG.md` after each experiment or meaningful result. Keep entries short — what was run, what was found, what it implies. Include the date.
- **Findings**: When an experiment produces enough substance to stand on its own, write it up in `findings/` (e.g., `findings/bigint-benchmark.md`). LOG entries should link to these.

### Ending a session

- Update `STATUS.md` with any changes to active threads, new learnings, or shifts in priorities.
- Make sure LOG.md captures what was done.
- Commit everything.

## Doc index

| Doc | Role | Updated |
|-----|------|---------|
| `STATUS.md` | Living dashboard — read this first | Regularly |
| `LOG.md` | Chronological experiment log | Append-only |
| `findings/` | Structured writeups of experiment results | As needed |
| `EXPLORATION-SURVEY.md` | Original brainstorm survey (historical) | Rarely |
| `SURVEY-DOC-CRITICAL-REVIEW.md` | Idea-gaps review of survey (historical) | Rarely |
