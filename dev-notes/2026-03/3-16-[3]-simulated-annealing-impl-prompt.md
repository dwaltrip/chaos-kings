# Task: Implement Simulated Annealing Baseline

This is a collaborative session. I'll be available to help keep you
grounded, answer questions to shore up assumptions about the game
mechanics or codebase, and suggest ideas as we go. Check in with me
at the points described below — don't go heads-down for too long.

## Goal

Implement simulated annealing (SA) for the grid expansion problem and test
it on an open 7×7 board. The target is finding a solution that scores 25
tiles owned at tick 50. The known optimal for this board is 25.

## Context

I have an existing codebase from beam search prototyping. The project lives
in `packages/algos/` and includes a working game simulator, board
definitions, and experiment tooling. See the attached experiment appendix
for project structure details.

Please read and refer to the following documents during this session:
- **Doc 1 (search algorithms)** — contains SA pseudocode and design
  guidance. Use the SA section as a reference.
    - filepath: dev-notes/2026-03/3-16-[1]-deep-research-explainer-doc1-search-algorithms.md
- **algorithm-review-sa-nrpa.md** — a review doc with notes on
  domain-specific concerns. Read the SA section before implementing —
  it flags a temperature calibration issue.
    - filepath: dev-notes/2026-03/3-16-[2]-algorithm-review-sa-nrpa.md
- **Experiment appendix** — documents the project structure, CLI tools,
  data formats, and workflows from the beam search prototyping phase.
  Use this to understand what already exists in the codebase.
    - dev-notes/2026-03/3-13-[9]-scorer-experiments-report-appendix.md

## Code organization

The beam search prototype lives in `src/perfect-start-solver/prototyping/`.
SA should go in its own directory — something like
`src/perfect-start-solver/sa/` — as a peer to the prototyping directory,
not nested inside it. SA is a distinct solver approach, not a prototype
experiment.

Reuse the existing simulator, board definitions, and types from the
codebase. Don't duplicate them — import what you need. Explore the
project structure to understand what's available before writing new code.

## Implementation plan

Build in this order. Get each step working before moving to the next.

### Step 1: Solution representation

A solution is an array of 50 moves. Each entry is either
{source_tile, direction} or WAIT.

Generate an initial solution of all WAITs (score = 1). This is the
simplest valid starting point.

### Step 2: Neighborhood operator

To generate a neighbor:
1. Pick a random tick t (0-49).
2. Look up the cached game state at tick t.
3. Get the list of legal moves at that state.
4. Pick a random legal move (different from the current one if possible).
5. Replace the move at tick t.
6. Re-simulate from tick t forward to get the new score.

**Important:** Cache the game state at every tick for the current solution.
When a move is accepted, update the cache from tick t forward. This avoids
re-simulating from tick 0 every iteration.

**Important:** If a move becomes illegal due to upstream changes, treat it
as WAIT. This is always safe.

### Step 3: Acceptance loop

```
if delta >= 0:
    accept (always)
else:
    accept with probability exp(delta / temperature)
```

Track `bestScore` and `bestMoves` separately from `currentScore` and
`currentMoves`. The current solution can get worse (that's the point),
but you never lose track of the best found.

### Step 4: Cooling schedule

Starting parameters (these are deliberately conservative, not optimized):

- Iterations: 1,000,000
- T₀: 3.0
- ε (final temperature ratio): 0.001
- α = ε^(1/iterations) ≈ 0.999993
- temperature = T₀ × α^i at iteration i

**Why T₀ = 3.0 not 1.0:** Changing a single move can disrupt a burst
chain and cause score swings of 5-10 tiles. T₀ = 1.0 would make the
algorithm refuse almost all worsening moves from the start. T₀ = 3.0
gives it room to explore. We can tune this later.

### Step 5: Run and report

Run SA on the open 7×7 board. Print:
- Best score found
- Score progression (best score at 10%, 20%, ..., 100% of iterations)
- Total runtime
- The winning move sequence (so we can verify it in the simulator)

If it doesn't hit 25 on the first run, try 5 runs with different random
seeds and report the best across runs.

## Game rules (quick reference)

- NxN grid (start with N=7), some tiles are walls, some are passable
- Player starts owning one tile (the general) with 1 army
- General produces +1 army every 2 ticks (on even ticks: t=2, 4, ..., 50)
- **Production happens AFTER movement within a tick**
- Each tick: player makes one move (send armies from an owned tile to an
  adjacent tile) or WAITs
- Moving sends all-but-1 armies from source to target (source keeps 1)
- Moving onto an unowned passable tile captures it
- Moving onto an already-owned tile merges armies
- Only tiles with >1 army can be a move source
- Goal: maximize tiles owned at tick 50

## Working style

- Check in with me after completing each step (1-5) before moving on.
  Show me what you built and any decisions you made.
- If you hit something ambiguous in the game rules or the existing
  codebase, ask me rather than guessing.
- Build on the existing project structure and simulator. Don't rewrite
  what already works.

## Tooling

Build ergonomic tools for inspecting and analyzing SA runs as you go.
The beam search prototyping benefited hugely from this (see the experiment
appendix for examples — CLI tools, structured JSON output, tick logs,
analysis scripts).

Some ideas, but use your judgment on what would actually help you iterate:

- **Tick-by-tick move log** for a solution — show land count, army on
  general, move made, top army positions at each tick. Same format as
  the beam search tick logs if possible.
- **Run summary output** — JSON with score, runtime, parameters, score
  progression curve. Machine-readable so you can compare runs.
- **Multi-run script** — run N seeds in sequence, report best/worst/avg.
- **Solution verifier** — replay a move sequence through the simulator
  and confirm the score. Sanity check for bugs.
- **Delta distribution sampler** — sample random neighbors of a solution
  and report the distribution of score changes. Directly useful for
  temperature tuning.

Don't build all of these upfront. Build them when they'd help you
understand what's happening or debug a problem. Quick inspection with
unix tools (grep, jq, etc.) is fine for one-off checks. But if you
find yourself doing repeated complex ad-hoc text processing to
understand behavior, that's the signal to build a proper tool.

I'm happy to brainstorm tooling ideas with you at check-ins.

## Documentation

Write dev notes as you work. Create a markdown file (e.g.
`sa/dev-notes.md`) and append to it at natural breakpoints — after
getting something working, after a tuning session, after discovering
something surprising.

Each entry should be dated and include:
- What you did
- What you observed (scores, timings, behavior)
- Any insights, surprises, or open questions
- Parameter settings that worked or didn't

These notes serve two purposes: they help me catch up on what happened
when I check in, and they accumulate into a record of what we've tried
and learned — which is valuable when we move to other algorithms later.

Don't over-polish these. Stream of consciousness is fine. The goal is
capturing observations while they're fresh, not producing a report.
