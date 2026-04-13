# Algo-1 reference: what makes it fast

Analytical companion to `custom-algo-1/README.md`. That doc covers the full pipeline, types, files, and CLI usage. This doc focuses on *why* the architecture works well and what that implies for algo-2.

---

## Architecture overview

Algo-1 splits the problem into two independent subproblems — **timing** (board-independent: what burst-size sequences fit within 50 ticks?) and **spatial** (board-specific: can we find compatible paths for a given burst sequence?). It pre-generates ALL non-backtracking paths from the general, pre-generates all valid timing entries, then searches for compatible pairs using grouped backtracking with multi-level pruning.

See `custom-algo-1/README.md` for the full pipeline walkthrough.

---

## Why algo-1 is fast: the compounding advantages

The individual optimizations are each significant, but they compound:

**1. Complete path availability.** DP enumeration gives access to ALL valid paths. No scoring heuristic filters out the winning solution before search begins. This is the most fundamental advantage — algo-1 never fails because "the right path wasn't in the pool."

**2. Two-level entry ordering.** Timing entries are grouped by burst-1 move length (longest-first), then sorted by total overlap ascending within each group. This means zero-overlap entries with the longest first burst — patterns like `[12, 7, 3, 2]` — are tried before shorter or overlapping alternatives like `[10, 5, 4, 3, 2]`. Most boards have zero-overlap solutions at 24 captures, so the FIRST timing entry tried produces a solution — hence "1 entries" in the stats. This is why algo-1 solves most boards in under 100ms.

**3. Early termination.** The search returns the first solution found. Combined with the two-level entry ordering, this means it stops at the simplest valid solution. No need to explore the full space.

**4. Feasibility pruning eliminates dead branches fast.** Three checks (per-burst reach, aggregate reach, neighbor bottleneck) run before candidate scanning at each depth. On constrained boards, these kill the vast majority of entries. The optimization history on corner-9×9 shows the compounding effect: grouped search alone took 237s → adding per-burst + aggregate checks brought it to 25s (~10x) → adding the neighbor bottleneck check brought it to ~1.5s (~16x). A later bug fix corrected over-eager pruning in one of the checks, bringing corner-9×9 to ~3s currently — still a ~80x improvement over the pre-feasibility baseline. The pruning is cheap (integer comparisons and bigint operations) and fires early.

**5. Grouped search amortizes candidate checks.** Rather than scanning candidates once per timing entry, entries with matching `(moveLen, overlap)` share one scan. This is a multiplicative savings — 100 entries × 1000 candidates becomes ~5 buckets × 1000 candidates.

**6. L1 partitioning avoids irrelevant candidates entirely.** By pre-grouping candidates by starting neighbor, the search only looks at candidates that could plausibly start from an available neighbor. On corner-9×9, this gave a 1.3–1.4x speedup on top of the feasibility pruning gains.

**7. Bitmask operations are cache-friendly and fast.** Overlap checking, feasibility, and covered-mask updates are all bigint bitwise operations — constant-time for practical board sizes. No set lookups, no iteration over tile arrays for collision detection.

### Performance profile

Algo-1 runtime falls into two regimes:

**Path-gen dominated** (most boards): Search is trivial — 1 timing entry, 4 search calls. The first zero-overlap entry works immediately. Runtime scales with board size and openness due to path enumeration. On open boards (the path-gen ceiling): ~70ms on 7×7, ~120ms on 9×9, ~200ms on 11×11, ~280ms on 13×13. Mountains reduce path counts significantly — sparse-mountain boards run in 10–80ms regardless of size.

**Search-dominated** (boards with difficult local geometry near the general): Thousands of entries, millions of candidate checks. Feasibility pruning does the heavy lifting, but runtime ranges from 80ms to ~3.8s. The common factor is local geometry near the general — corners, pockets, edges — that creates overlap contention between bursts, producing huge numbers of plausible-but-failing candidate combinations. The difficulty comes from the local geometry, not overall board tightness — the boards themselves are often wide open (see examples below).

**Two sources of search cost on hard boards:**

1. **Descent cost:** When max captures < 24, the solver must prove each higher target infeasible before descending. The bulk of runtime on these boards is spent exhaustively searching at impossible targets. For example, pocket-11x11 solves at 23 captures in ~1.6s — but most of that time is exhaustively searching at 24 before descending.

2. **Within-target grinding:** Even at the *correct* capture target, certain boards require millions of candidate checks. Corner-9x9 is a completely open 9x9 grid with the general in the corner — achieves 24 captures but takes ~3.8s and 20M candidate checks. Pocket-2-11x11 is a wide-open 11x11 with just a small 3-mountain pocket near the general — only 3 moves to exit, but still ~500ms and 2M candidate checks. The local geometry creates many burst path combinations that look viable at each search depth but ultimately can't be completed.

Both are manifestations of the same underlying problem: the search space is too large to scan without stronger reduction techniques.

#### Search-dominated boards (`--board slowSearch`)

| Board                            | Caps | Time    | Entries | Search calls | Cands checked | Feas prunes |
| -------------------------------- | ---- | ------- | ------- | ------------ | ------------- | ----------- |
| 3.22-semi-open-with-small-pocket | 24   | 84ms    | 23,747  | 54,130       | 152,380       | 49,039      |
| edge-9x9                         | 24   | 85ms    | 37      | 7,986        | 121,935       | 2,708       |
| edge-pocket-9x9                  | 23   | 232ms   | 5,125   | 40,649       | 619,007       | 19,168      |
| pocket-2-11x11                   | 24   | 402ms   | 22,987  | 183,283      | 2,169,785     | 156,705     |
| 3.21-real-board-tight-corner-1   | 22   | 443ms   | 961     | 9,374        | 88,587        | 6,944       |
| 3-22.tight-edge-with-chokes      | 23   | 606ms   | 2,829   | 100,786      | 2,337,927     | 72,166      |
| edge-pocket-2-9x9                | 22   | 819ms   | 4,058   | 23,862       | 315,532       | 16,195      |
| corner-7x7                       | 24   | 861ms   | 36,388  | 983,240      | 13,692,252    | 643,008     |
| 3.21-real-board-tight-corner-2   | 22   | 1,034ms | 9,199   | 98,234       | 2,993,775     | 87,005      |
| floating-corner-11x11            | 24   | 1,194ms | 15,616  | 582,464      | 7,933,632     | 340,380     |
| pocket-11x11                     | 23   | 1,603ms | 18,004  | 329,663      | 7,476,913     | 281,495     |
| scattered-pockets-13x13          | 20   | 2,110ms | 871     | 11,308       | 155,761       | 5,596       |
| corner-9x9                       | 24   | 3,149ms | 50,545  | 1,528,774    | 20,222,561    | 986,042     |
| corner-13x13                     | 24   | 3,288ms | 52,091  | 1,594,250    | 20,906,873    | 1,027,381   |


---

## Implications for algo-2

Algo-2's decomposition (prefix pool → timing entries → burst mapping → greedy lane construction) introduces structural disadvantages relative to algo-1:

1. **Filtered path availability.** The top-K prefix pool may not contain the right prefix configuration. Algo-1 never has this problem because ALL paths are available.

2. **No timing entry ordering.** Algo-2 iterates timing entries without ranking. Algo-1's two-level ordering (burst-1 length descending, then overlap ascending) means the easiest solutions are tried first.

3. **No feasibility pruning.** Algo-2 tries every (prefix set, timing entry, mapping) combination blindly. Algo-1 kills infeasible entries early, before scanning candidates.

4. **Greedy lane builder has no backtracking.** If the first DFS path fails, there's no recovery within a lane attempt. Algo-1's recursive search backtracks freely across all bursts.

5. **No candidate amortization.** Algo-2 processes each mapping independently. Algo-1's grouped search shares candidate scans across entries with the same `(moveLen, overlap)`.

6. **Pattern bias toward many small bursts.** Algo-2 consistently produces 6-burst patterns with small bursts (`[5,4,4,4,4,2]`, `[4,4,4,4,4,3]`), while algo-1 almost always uses 4-burst patterns with a dominant first burst (`[12,7,3,2]`, `[12,6,4,2]`). This is a structural consequence of the prefix pool approach — shorter prefixes score better and are easier to combine, so the pipeline gravitates toward many-small-burst configurations. See `4.12-6-baseline-comparison.md` for the full comparison.

These aren't necessarily fatal — algo-2's decomposition offers advantages algo-1 doesn't have (prefix reuse across targets, independent near/mid-region reasoning). But the prototype doesn't yet exploit those advantages, while it does suffer from the disadvantages.
