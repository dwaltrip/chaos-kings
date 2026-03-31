# Explore Landscape

Structured exploration of the burst-chain landscape to inform the perfect-start-solver.

## Structure

- `questions/` — each question is a self-contained exploration script (q1, q2, ...)
- `output/` — generated data and summaries (gitignored)
- `docs/sessions/` — session notes and handoff docs
- `__tests__/` — tests for shared helpers
- `run-questions.ts` — early attempt at a unified runner, may be defunct. For q2, running individual scripts directly worked better.

## Running

Each question script runs directly from project root:

```sh
tools/run-from-algos.sh src/perfect-start-solver/explore-landscape/questions/q2-equivalent-burst-chains-simple.ts
```

## Output Formatting

See [FORMAT-GUIDE.md](../../utils/FORMAT-GUIDE.md) for helpers when writing `.md` and `.json` output files.
