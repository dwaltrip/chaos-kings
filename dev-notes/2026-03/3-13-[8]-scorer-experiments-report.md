# Scorer Experiments Report — 2026-03-14

## Summary

Ran comprehensive scoring function experiments for the perfect-start solver.
Three categories tested: weight sweeps on existing scorers, general-army-aware
scorers, and superlinear capturable variants. **No scorer has broken 24 land**
(optimal is 25 on open boards). The 24->25 gap appears to require fundamentally
different approach than static linear scoring.

## Infrastructure Changes

- **All scorers are now parameterizable factories** (like `makeFrontierScorer`).
  Closures capture board-specific info (generalCoord) at construction time.
- **`ScoringFn` signature extended**: `(board, tick) => number` — enables
  time-aware scoring.
- **`scorer-presets.ts`** — preset collections for different experiment runs.
  `activePreset` controls which set `run-comparison` uses.
- **New scorer families**: `makeLandGenScorer`, `makeCapGenScorer`,
  `makeFrontierGenScorer`, `makeTimeAwareCapGenScorer`, `superlinearCapCount`.

## Test Matrix

- **8 boards**: open-7x7, sparse-mtns-7x7, corridor-7x7, maze-7x7,
  open-9x9, sparse-mtns-9x9, open-11x11, sparse-mtns-11x11
- **Beam widths**: 50, 200
- **50 ticks** (25 turns)

---

## Results by Scorer Family

### 1. Capturable Land Weight Sweep (L{N}+cap)

Formula: `land * L + capturable * C`

| Scorer   | avg@50 | avg@200 | best | #best@200 | regressions@200 |
|----------|--------|---------|------|-----------|-----------------|
| L1+cap   | 15.0   | 8.5     | 22   | 0/8       | 7 (collapses)   |
| L2+cap   | 23.1   | 23.4    | 24   | 5/8       | 1 (sparse-7x7)  |
| L3+cap   | 23.1   | 23.5    | 24   | 6/8       | 1 (sparse-7x7)  |
| L5+cap   | 23.1   | 23.5    | 24   | 6/8       | 1 (sparse-7x7)  |
| L10+cap  | 23.1   | 23.5    | 24   | 6/8       | 1 (sparse-7x7)  |

**Findings:**
- L1 is catastrophically broken — capturable dominates, beam fills with hoarding states.
- L2 through L10 are nearly identical. Land weight >= 3 is sufficient to prevent
  capturable from dominating; beyond that, diminishing returns.
- L3+cap and L5+cap are the sweet spot — tied for best with 6/8 boards at 24.
- All capturable scorers share the same sparse-mtns-7x7 regression (24@b50 -> 23@b200).

### 2. Cap Weight Sweep (L5+capN)

Formula: `land * 5 + capturable * C`

| Scorer   | avg@50 | avg@200 |
|----------|--------|---------|
| L5+cap   | 23.1   | 23.5    |
| L5+cap2  | 23.1   | 23.5    |
| L5+cap3  | 23.0   | 23.3    |

**Findings:** Increasing cap weight from 1 to 2 makes no difference. Cap weight 3
slightly hurts (corridor-7x7 drops to 22). The capturable signal is already well-
calibrated at weight 1.

### 3. Superlinear Capturable (excess^2)

Formula: `land * L + sum(excess_i^2)`

| Scorer | avg@50 | avg@200 |
|--------|--------|---------|
| L5+sup | 23.1   | 20.8    |
| L3+sup | 19.5   | 9.6     |
| L2+sup | 17.3   | 1.0     |

**Findings:** Catastrophic failure. The squared term creates massive score variance
that overwhelms land weight. At high beam widths, the beam fills with states where
one tile has huge excess (e.g., 10^2 = 100) even though that never converts to
actual land. L5+sup survives at beam=50 but collapses on maze@200 (22->1).

### 4. Frontier Scorers

Formula: `land * L + frontier_count`

| Scorer     | avg@50 | avg@200 | #best@200 | regressions |
|------------|--------|---------|-----------|-------------|
| frontier-2 | 23.4   | 23.4    | 5/8       | 1           |
| frontier-5 | 23.8   | 23.6    | 7/8       | 1 (maze)    |

**Findings:** frontier-5 is the overall best scorer:
- Highest avg at beam=50 (23.8) — no other scorer comes close
- Highest #best at beam=200 (7/8)
- Only regression is maze-7x7 (23->22)
- Fast execution (~300ms at beam=200 vs ~600-1500ms for capturable scorers)
- Frontier provides better score resolution than capturable (fewer ties)

### 5. General-Army-Aware Scorers

#### land + gen * W (no capturable)

| Scorer      | avg@50 | avg@200 |
|-------------|--------|---------|
| land+gen0.5 | 22.0   | 22.0    |
| land+gen2   | 1.0    | 1.0     |

**Broken.** Without capturable/frontier pressure, gen credit causes indefinite
hoarding. Even gen*0.5 significantly underperforms baselines.

#### L5 + cap + gen * W

| Scorer     | avg@50 | avg@200 | #best@200 |
|------------|--------|---------|-----------|
| cap+gen0.3 | 22.6   | 22.6    | 2/8       |
| cap+gen0.5 | 21.6   | 21.6    | 3/8       |
| cap+gen1   | 21.4   | 21.4    | 1/8       |
| cap+gen2   | 23.3   | 23.3    | 4/8       |

**Findings:**
- cap+gen2 at beam=200 matches tier-1 scorers (avg 23.3) but never beats them.
- Lower gen weights (0.3, 0.5, 1) are strictly worse — they cause hoarding at
  low beam widths without enough capturable pressure to compensate.
- cap+gen2 is the only gen-aware scorer that's competitive, and only at high beam.
- No gen weight breaks the 24 barrier.

#### frontier + gen * W

| Scorer        | avg@50 | avg@200 |
|---------------|--------|---------|
| frontier+gen2 | 12.9   | 12.9    |

**Broken.** Frontier provides even less counterweight to gen hoarding than
capturable does.

---

## The 24->25 Gap

### Why 24 is the ceiling

The optimal 25-land strategy on open-7x7 requires **wait-and-burst**:
1. Wait to accumulate 11 on general -> burst 10 (captures 10 tiles)
2. Accumulate to 9 -> burst 8
3. Burst 4
4. Burst 2
5. Total: 1 + 10 + 8 + 4 + 2 = 25

The general keeps producing during bursts, so waits between bursts are shorter
than the naive calculation suggests.

### Why no static scorer can reach 25

Looking at the frontier-5 tick log (open-7x7, beam=200, 24 land):
- The solver discovers a "move every other tick" pattern early on
- It never accumulates past gen=3 because any accumulation lowers the score
- The optimal strategy requires sitting at gen=11 before first move (ticks 1-22
  doing nothing), which scores terribly under any scorer that rewards land/frontier

**Core tension:** Static scorers evaluate board state at each tick independently.
The optimal strategy requires the solver to choose states that look worse now
(gen=11, land=1) in exchange for being better later. This is a credit assignment
problem that linear scoring can't solve.

### Possible approaches for 25

1. **Phase-aware scoring** (partially implemented as `makeTimeAwareCapGenScorer`):
   Different weights early vs late. Gen credit decays linearly with ticks remaining.
   Not yet tested.

2. **Projected-land scoring**: Instead of scoring current state, project how many
   tiles the general's army *could* capture if sent optimally. Score = land +
   projected captures from gen army. This differs from capturable because it
   specifically models "if I send gen army now, how far does it get?"

3. **Explicit phase structure**: Hard-code the accumulate->burst pattern into the
   solver rather than trying to discover it via scoring. E.g., constrain moves to
   "wait until gen >= threshold, then expand greedily."

4. **Multi-step lookahead in scoring**: Score based on best achievable land in
   next N ticks, not just current tick. Expensive but addresses the temporal
   credit assignment directly.

---

## Performance Notes

All runs used beam dedup via `fingerprintState`. Timings at beam=200:

| Scorer family | ~time per run |
|---------------|---------------|
| land-only     | 150-450ms     |
| frontier      | 270-550ms     |
| capturable    | 450-1600ms    |

Frontier scorers are ~2-3x faster than capturable due to no BFS computation.
On larger boards (11x11), capturable runs approach 1.5s which may become a
concern at higher beam widths.

---

## Recommendations

1. **Use frontier-5 as the default scorer.** It's the best overall: highest avg,
   most boards at best, fast execution, minimal regressions.

2. **Drop L1+cap, L2+cap2, all superlinear variants.** They're broken or strictly
   dominated.

3. **Trim the capturable sweep.** L3+cap through L10+cap are interchangeable;
   keep L5+cap as the representative.

4. **Gen-aware scoring is a dead end for breaking 24.** The fundamental problem
   is temporal credit assignment, not weight tuning. Try phase-aware or
   projected-land approaches instead.

5. **Test `makeTimeAwareCapGenScorer`** — it's implemented but untested. Gen credit
   that decays over time might encourage early accumulation without late-game hoarding.
