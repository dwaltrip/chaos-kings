# Status

Last updated: 2026-03-20

## Current state

Research spike just kicked off. We have a detailed survey of ideas and a critical review, but no experiments have been run yet.

## Active threads

None yet. Phase 1 candidates (all independent, can be tackled in parallel):

- **1.1 BigInt vs Uint32Array** — microbenchmark of core bitmask ops
- **1.2 Phase timing breakdown** — where does solver time go per board
- **1.3 Path mask redundancy** — how many paths share identical masks

## Key decisions / learnings

- (none yet)

## What's next

Pick one or more Phase 1 experiments and run them. Results will inform which Phase 2 directions (structural analysis, constraint propagation, etc.) to pursue.

See `EXPLORATION-SURVEY.md` for the full idea catalog and `SURVEY-DOC-CRITICAL-REVIEW.md` for the critical review that surfaced constraint propagation, watched literals, and other missing angles.
