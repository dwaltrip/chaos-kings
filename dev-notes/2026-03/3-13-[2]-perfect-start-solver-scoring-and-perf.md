# Perfect Start Solver — Scoring Experiments & Performance

Continuation of `3-13-[1]`. Moved to 50 ticks (matching 25 generals.io turns) and added scoring/perf instrumentation.

---

## Tick/turn clarification

The solver runs in **ticks** (the engine's internal unit). With `generalProductionTicks: 2`, general produces +1 every 2 ticks. Key mappings:

- 25 ticks = ~12 generals.io turns. Max units = 13. Land ceiling = ~13.
- 50 ticks = 25 generals.io turns. Max units = 26. Land ceiling = ~25.

The previous run used 25 ticks and got 12 land — that was actually near-optimal for that tick count, not a scoring failure. Bumped to **50 ticks** so optimal (25 land) is reachable and there's a meaningful gap to close.

---

## Results: 50 ticks, 7x7 open field

| Scoring | beam=50 | beam=100 | beam=200 |
|---|---|---|---|
| land-only | 23 | 23 | 23 |
| capturable-tiles | 22 | 22 | 22 |

Optimal is 25. Land-only gets 23 (92%). Capturable-tiles gets 22 — actually **worse**.

Beam width makes zero difference for either scorer (same result at 50/100/200).

### Why capturable-tiles failed

Formula: `score = land + sum(max(0, excess - dist))` where `dist` = BFS distance to nearest blank.

On the open field, player tiles are almost always distance 1 from a blank. So `excess - 1` adds a small signal but doesn't change which states the beam prefers:
- Capturing gives +1 land, -1 capturable → net 0 change in score
- Accumulating gives +1 capturable (from production), same land → net +1

In theory this should favor accumulation, but the effect is tiny and at the **final tick** the scorer actively hurts: it picks a state with 22 land + 3 capturable over 23 land + 0 capturable. Unrealized potential is worthless with no ticks left.

### What the tick logs show

Land-only plays a greedy star pattern:
1. **Ticks 1-10:** Produce, capture one adjacent tile, repeat. Star arms extend from general.
2. **Ticks 11-30:** Route units from general through owned territory to frontier. 1 capture per ~2-3 ticks.
3. **Ticks 31-50:** Routing gets longer as frontier moves away. Efficiency drops. Last 2 ticks are WAITs with 5 idle units on the general.

The general never accumulates past 2-3 units. It's locked into produce→route→capture, one unit at a time.

---

## Performance instrumentation

Added `performance.now()` timing around three phases in the beam search loop:

1. **gen** — move generation (scan board for hot tiles, try 4 directions + wait)
2. **clone+step** — `structuredClone(gameState)` + `processStep` per candidate
3. **score+sort** — score each candidate + sort + prune to beam width

Also tracking: total candidates generated, total score() calls.

### Initial profiling (before score caching)

```
land-only         beam=200  2904ms  [gen   32  clone+step 2863  score+sort   10]   50K cands  298K scores
capturable-tiles  beam=200  9335ms  [gen   30  clone+step 3065  score+sort 6240]   55K cands  445K scores
```

Key findings:
- **land-only** is 99% clone+step. Scoring is free (just reads a number).
- **capturable-tiles** spends 67% in score+sort. 445K score calls for 55K candidates — the sort comparator was calling `score()` inline, so O(n log n) redundant calls.
- Move generation is trivial (~30ms).

### Score caching fix

Compute scores once per candidate, sort by cached values. Eliminated redundant calls.

```
land-only         beam=200  2746ms  [gen   39  clone+step 2699  score+sort    8]   50K cands   50K scores
capturable-tiles  beam=200  3751ms  [gen   35  clone+step 2864  score+sort  853]   55K cands   55K scores
```

- **capturable-tiles 2.5x faster** overall (9.3s → 3.7s). Score+sort phase **7.3x faster** (6240ms → 853ms).
- land-only barely changed (scoring was already trivial).
- Score calls now match candidate count exactly (no redundancy).

### Remaining bottleneck: clone+step (~2.8s at beam=200)

`structuredClone` is the likely culprit — it deep-copies the entire `GameState` (grid + players + metadata) for every candidate. This is ~50K clones per run on a 7x7 board. Future optimizations:
- Custom lightweight state (just grid + tick, drop players array)
- Incremental `processStep` that avoids full grid scan in `updatePlayerStats`
- Pool/reuse state objects instead of GC-heavy clone cycle

Not blocking for now — 2.8s is fine for iterating on scoring functions.

---

## Diagnostic tooling

### File output
Runner writes timestamped files to `prototyping/data/` (gitignored):
- `comparison-{timestamp}.json` — structured results with land curves in 10-tick buckets, perf stats. Formatted with `fjson`.
- `comparison-{timestamp}.log` — tick-by-tick text logs per run.

### Tick log format
```
=== land-only | beam=50 | open-7x7 | land=23 | 725ms ===
general: (3,3)

Tick  1: land= 1  gen[ 1]  move=WAIT
Tick  2: land= 1  gen[ 2]  move=WAIT
Tick  3: land= 2  gen[ 1]  move=(3,3)→UP
...
```

Shows land count, general army, and move at each tick. Easy to scan for patterns (accumulation, routing, idle ticks).

### JSON land curve format
```json
"landCurve": {
    "tick10": [ 1,  1,  2,  2,  3,  3,  4,  4,  5,  5],
    "tick20": [ 5,  6,  6,  7,  7,  8,  8,  9,  9, 10],
    ...
}
```
Skips tick 0 (always 1), buckets into groups of 10 for scannability.

---

## Open threads

### Scoring function ideas (not yet tried)

The core challenge: land-only is already at 92% optimal on the open field. The remaining 2-land gap comes from suboptimal late-game routing. Ideas to explore:

1. **Time-aware projected land** — discount capturable estimate by remaining ticks. At tick 50, only actual land matters.
2. **Superlinear army concentration** — value N units on one tile more than N scattered 1-unit tiles. Captures the chain-capture efficiency advantage.
3. **Frontier surface area** — count blank tiles adjacent to owned territory. Penalizes dead-end captures, rewards expansion toward open space.

### The open field may be the wrong test case

The 23→25 gap is small. Greedy play works well when there's always a blank adjacent to capture. Mountain boards with chokepoints should create a much larger gap where routing decisions matter. Adding test boards with varying mountain density is probably higher value than more scoring experiments on the open field.

### Future performance work

- Custom lightweight state to speed up cloning
- Incremental step function to avoid full grid scans
- Route pruning in move generation (filter interior-to-interior moves)
- State deduplication to avoid redundant beam entries
