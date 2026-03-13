# Perfect Start Solver — Scoring & Boards Handoff

**Previous docs:**
- `3-12-[2]` — Algorithm ideas and scoring function designs
- `3-12-[3]` — Implementation sketch and build plan
- `3-13-[1]` — Initial progress (beam search works, land-only baseline)
- `3-13-[2]` — Scoring experiments, perf instrumentation, score caching
- `3-13-[3]` — Handoff: mountain boards + scoring next steps
- `3-13-[5]` — Flat board design doc
- `3-13-[6]` — core-next session summary (FlatBoard perf work)

**Code:** `packages/algos/src/perfect-start-solver/prototyping/`

---

## Current state

Infrastructure is mature. Beam search with FlatBoard backend, comparison runner with CLI args, markdown table output, tick logs with army snapshots, 4 test boards, 7 scoring functions.

**Perf (post core-next):** land-only beam=200 on 7x7 runs in ~55-68ms. Frontier scorers ~220-270ms. Clone+step is no longer the bottleneck — scoring is now ~80% of runtime for frontier scorers.

### Test boards (all 7x7, general near center)
- `open-7x7` — wide open baseline
- `sparse-mtns-7x7` — 6 scattered mountains (~12% density)
- `corridor-7x7` — horizontal wall with one gap (chokepoint)
- `maze-7x7` — dense mountains (~30% density)

### Scoring functions and results

Best land counts at beam=50 / beam=200:

| Scorer | open | sparse | corridor | maze | Notes |
|--------|------|--------|----------|------|-------|
| land-only | 23/23 | 24/24 | 22/23 | 23/23 | Solid baseline, needs high beam for corridor |
| capturable-tiles | 22/22 | 19/19 | 19/19 | 9/9 | Broken — hoards armies near blanks instead of capturing |
| land-weighted-cap | 23/23 | 24/24 | 23/23 | 23/23 | Most robust across all boards and beam widths |
| frontier(2) | 24/24 | 24/24 | 23/23 | 23/21 | Best on open field, but **regresses on maze at high beam** |
| frontier(3) | 24/24 | 24/24 | 22/23 | 23/21 | Same regression |
| frontier(5) | 24/24 | 24/24 | 22/23 | 23/21 | Same regression |

### Key findings

1. **capturable-tiles is fundamentally broken.** It rewards proximity to blanks, which means hoarding armies *near* blanks scores better than actually capturing them (capturing removes a blank from the estimate). On maze, gets stuck at 9 land.

2. **land-weighted-cap is the most robust scorer.** Never regresses with more beam, consistent 23-24 everywhere. The `land * 5 + capturable` weighting ensures land dominates while capturable provides routing guidance.

3. **frontier(N) finds 24 on open field** (better than anything else), but has a regression bug: on maze, beam=50 gets 23 but beam=100/200 drops to 21. More search budget somehow makes it worse. This needs investigation.

4. **Army concentration is irrelevant for the opening.** Tick logs with top-5 army snapshots show the only tile that ever accumulates >1 units is the general. Optimal play is purely about routing — "pump" pattern of accumulate 2-3 on general, send out a chain, repeat. The global production tick (+1 to all tiles) only fires at tick 50 (end of round 1).

5. **Pure frontier (weight=0) is terrible.** Optimizes for border exposure without caring about actual territory. Gets stuck at 5-19 land. Filling tiles near edges/mountains *reduces* frontier (dead-end pockets), so it actively avoids expanding toward boundaries.

6. **Frontier weight barely matters once >= 2.** frontier(2), (3), (5) produce nearly identical results. The tiebreaker just needs enough land weight to prevent stalling.

---

## What to do next

### 1. Investigate frontier regression on maze at high beam

frontier(N) gets 23 at beam=50 but drops to 21 at beam=100/200 on maze. This is a red flag — a good scorer should never get worse with more search. Compare tick logs between beam=50 (good) and beam=200 (bad) to see where paths diverge. Likely the frontier signal is misleading the search down a suboptimal path that beam=50 doesn't have budget to explore.

### 2. Bigger boards

7x7 is nearly saturated — most scorers converge at 23-24. Perf now allows much larger boards. Try:
- 10x10 and 15x15 with varying mountain density
- More terrain variety: rooms connected by corridors, dead-end pockets, asymmetric layouts
- Boards from `test-boards.ts` using `parseBoard()` — easy to add new text layouts

Bigger boards will create more differentiation between scorers and expose whether current approaches scale.

### 3. New scoring function ideas

From `3-12-[2]` that haven't been tried yet:
- **Time-aware projected land** — discount capturable estimate by remaining ticks. Encourages urgency early, consolidation late.
- **Reachable blanks (BFS from territory)** — count how many blanks are reachable from current territory without going through other blanks. Like frontier but looks deeper — values positions with open paths ahead.
- **Composite scorer** — combine land + frontier + some forward-looking component. The insight is that land-weighted-cap is robust (never bad) and frontier finds better solutions on open boards. Can we get both?

Now that scoring is the bottleneck (~80% of runtime for frontier), scorer perf matters. Flat arrays help — `Uint8Array` visited sets instead of `Set<string>`, direct array iteration. But BFS-based scorers still scale with board size.

### CLI usage

```sh
cd packages/algos

# Full suite
npx tsx src/perfect-start-solver/prototyping/run-comparison.ts

# Quick iteration
npx tsx src/perfect-start-solver/prototyping/run-comparison.ts --beam=25,50 --score=frontier

# Filter supports substring match, comma-separated
npx tsx src/perfect-start-solver/prototyping/run-comparison.ts --score=land-only,frontier(2)
```

Output goes to `src/perfect-start-solver/prototyping/data/` as `TIMESTAMP-{results.json,ticks.log,summary.md}`.
