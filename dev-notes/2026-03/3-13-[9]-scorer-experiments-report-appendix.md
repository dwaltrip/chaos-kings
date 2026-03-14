# Scorer Experiments — Appendix: Analysis Toolchain & Process

Companion to [3-13-[8]-scorer-experiments-report.md](./3-13-[8]-scorer-experiments-report.md).
Documents the prototyping module's scripts, CLI tools, and data formats — everything
needed to run experiments, analyze results, and produce reports like the one above.

All commands run from `packages/algos/`.

### A. File Layout

```
src/perfect-start-solver/prototyping/
  solver.ts              # Core beam search wrapper (solve function)
  beam-search.ts         # Generic beam search with dedup
  scoring-functions.ts   # All scorer factories
  scorer-presets.ts      # Named collections of scorers (switch activePreset)
  run-comparison.ts      # CLI: runs solver across boards × scorers × beams
  analyze-results.ts     # CLI: post-processing views on results JSON
  test-boards.ts         # Board definitions (parseBoard, allBoards)
  simulation.ts          # Replay moves to get tick-by-tick stats
  comparison.ts          # Orchestrates solve() calls, prints progress
  types.ts               # ScoringFn, SolverConfig, SolverResult, etc.
  format.ts              # Table formatting helpers
  helpers.ts             # ALL_DIRECTIONS, runWithTiming
  tmp-scripts/           # One-off investigation scripts
  data/                  # Timestamped output from run-comparison
    YYYY-MM-DDTHH-MM-SS-results.json   # Machine-readable results
    YYYY-MM-DDTHH-MM-SS-ticks.log      # Tick-by-tick move/army logs
    YYYY-MM-DDTHH-MM-SS-summary.md     # Console summary table
```

### B. Running Experiments

#### 1. Choose your scorers

Edit `scorer-presets.ts` — set `activePreset` to the preset you want, or create
a new one. Each preset is a `ScorerSpec[]` with `{ name, make(board) }` entries.

#### 2. Run the comparison

```bash
# Full run (all boards × activePreset × default beams 50,100,200)
npx tsx src/perfect-start-solver/prototyping/run-comparison.ts

# Filter scorers by name substring
npx tsx ... --score=frontier,cap+gen

# Custom beam widths
npx tsx ... --beam=50,200,500

# Combine filters
npx tsx ... --score=frontier --beam=200
```

This prints a progress line per run, then a summary table. Three files are
written to `data/`:
- **`*-results.json`** — one object per run with board, scoring, beamWidth,
  maxTicks, finalLand, durationMs, landCurve (chunked by 10-tick buckets),
  and perf breakdown (genMs, cloneStepMs, dedupMs, scoreSortMs, totalCandidates,
  totalScoreCalls).
- **`*-ticks.log`** — tick-by-tick log per run showing land count, general army,
  move made, and top army positions. Essential for understanding *how* a scorer
  expands.
- **`*-summary.md`** — the console table, saved for quick reference.

#### 3. Analyze results

```bash
# Default (pivot + regressions), uses most recent results file
npx tsx src/perfect-start-solver/prototyping/analyze-results.ts

# Explicit file
npx tsx ... src/perfect-start-solver/prototyping/data/2026-03-14T05-16-59-results.json
```

**Views:**

```bash
# Pivot table: boards (rows) × scorers (cols), one table per beam width.
# Stars (*) mark best-in-row. Good for spotting which scorer wins on which board.
npx tsx ... --pivot

# Per-scorer scorecard: best, worst, avg, #boards-at-best, regressions.
# Sorted by avg descending. Best single view for ranking scorers.
npx tsx ... --summary

# Filter to specific beam width (works with --pivot and --summary)
npx tsx ... --summary --beam=200

# Regressions only: cases where higher beam → lower land (a bug smell).
npx tsx ... --regressions

# Filter to specific boards (substring match, comma-separated)
npx tsx ... --summary --board=open,maze

# Diff two result files: shows +/- land changes per board/scorer/beam.
# Great for before/after comparisons when changing a scorer or adding dedup.
npx tsx ... --diff file1.json file2.json
```

### C. Reading Tick Logs

The tick logs are the most valuable artifact for understanding *why* a scorer
succeeds or fails. Each run produces a section like:

```
=== frontier-5 | beam=200 | open-7x7 | land=24 | 310ms ===
general: (3,3)
Tick  1:  land= 1  gen[ 2]  move=WAIT         top:
Tick  2:  land= 1  gen[ 2]  move=WAIT         top: 2@(3,3)
Tick  3:  land= 2  gen[ 1]  move=(3,3)→UP     top:
...
```

**Columns:**
- `land=N` — total tiles owned at end of this tick
- `gen[N]` — army count on the general tile
- `move=` — what the solver chose (WAIT or coord→direction)
- `top:` — tiles with excess armies (units > 1), sorted by count

**What to look for:**
- **Hoarding**: gen count climbing while land stays flat = scorer rewards sitting
- **Burst patterns**: gen spikes then drops as army is sent out
- **Move-every-other-tick**: the "wait, accumulate 2, send 1" pattern that all
  greedy scorers converge on — this is why they cap at 24
- **Wasted armies**: large `top:` values far from frontier = army stuck in interior

**Useful grep patterns on tick logs:**

```bash
# Find all runs that achieved a specific land count
grep "land=25" data/*-ticks.log

# See the header lines (scorer/board/result) for all runs in a file
grep "^===" data/*-ticks.log

# Compare move patterns between two scorers on same board
grep -A 55 "frontier-5 | beam=200 | open-7x7" data/FILE.log
grep -A 55 "cap+gen2 | beam=200 | open-7x7" data/FILE.log
```

### D. Working with Results JSON

The JSON files are machine-readable and can be processed with `jq` or loaded
into scripts.

```bash
# All results where finalLand < 20 (find broken scorers)
jq '[.[] | select(.finalLand < 20)] | length' data/FILE.json

# Land curve for a specific run (see expansion rate)
jq '.[] | select(.board=="open-7x7" and .scoring=="frontier-5" and .beamWidth==200) | .landCurve' data/FILE.json

# Perf breakdown — which phase is slowest?
jq '.[] | select(.beamWidth==200) | {scoring, board, totalMs: .perf.totalMs, scoreSortMs: .perf.scoreSortMs, dedupMs: .perf.dedupMs}' data/FILE.json

# Average finalLand per scorer across all boards at beam=200
jq -r '[.[] | select(.beamWidth==200)] | group_by(.scoring) | .[] | {scorer: .[0].scoring, avg: ([.[].finalLand] | add / length)}' data/FILE.json
```

### E. Creating a Report

The process used to generate this report:

1. **Run experiments** with different `activePreset` settings. Two major runs:
   - `genAware` preset: baselines + all gen-aware variants
   - `capWeightSweep` preset: land/cap weight grid + superlinear

2. **Summary view at each beam width** to rank scorers:
   ```bash
   npx tsx ... --summary --beam=50   # stability at low beam
   npx tsx ... --summary --beam=200  # quality at high beam
   ```

3. **Pivot view** to see per-board breakdowns and identify which boards are
   hardest for which scorers.

4. **Regressions view** to flag beam-width instability (if a scorer gets worse
   with more compute, something is wrong).

5. **Tick log analysis** on interesting cases — especially the best scorer on
   the hardest board (frontier-5 on open-7x7) to understand the 24→25 gap.

6. **grep for milestones** (`grep "land=25"`) to confirm no run has ever hit
   the target.

7. **Diff view** when comparing two runs (e.g., before/after adding dedup):
   ```bash
   npx tsx ... --diff data/before.json data/after.json
   ```
