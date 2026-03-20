# solver-v3 perf session handoff

## What changed this session

Three optimizations added to solver-v3:

1. **Grouped search** — deduplicate candidate scanning across timing entries.
   Instead of scanning burst-2 candidates once per timing entry, bucket entries
   by (moveLen, overlap) and scan once per unique combo. Pure win, no behavior change.

2. **Flex score ordering** — sort candidate lists by how much open space they
   leave near the general (BFS distance masks, FLEX_SCORE_MAX_DIST=4). Paths that
   extend outward tried before paths that trap the general.

3. **Feasibility pruning** — at each depth in searchGrouped, check if remaining
   bursts can get enough free tiles within their reach. Uses cumulative free tile
   counts from BFS distance masks (FEASIBILITY_MAX_DIST=4). Prunes 76% of branches.

## Current performance on corner-9x9

| Version             | Time  |
|---------------------|-------|
| v3.0 (baseline)     | 237s  |
| + grouped search    | 106s  |
| + flex + feasibility| 53s   |

## Code cleanup needed

1. **Three different solvers "versions"**
  - v1 should be entirely obselete by now.
  - Can we delete v2 also? Probably.
  - What other related cleanup is there?

2. **solver-v3.ts has both early AND post-candidate feasibility checks.**
  They're logically redundant (same correctness) but NOT performance-equivalent:
    - Post-only (52s): filters before recursing → 6.7M search calls, but
      pays cumFree + filter at every compatible candidate.
    - Early-only (53s): skips dead branches before scanning → 26.4M search
      calls (extra recursive calls that die at next level's early check).
    - Both (55s): most checks, most overhead, diminishing returns.

  Recommend keeping only one.

3. **SearchStats / instrumentation** — useful for development but adds
  clutter. Consider making optional or moving to a profiling wrapper.

4. **FLEX_SCORE_MAX_DIST and FEASIBILITY_MAX_DIST are both 4** — could
  share one set of distance masks instead of building two.

5. **profile-v3.ts is stale** — written for old v3 (pre-grouped search).
  Either update or delete.

## Open perf directions (not yet explored)

1. **Group ordering**: corner-9x9 still exhausts b1=12 and b1=11 before
  finding the solution in b1=10. Better group ordering could skip dead
  groups earlier. Biggest remaining win.

2. **Stronger pruning**: current feasibility only checks per-burst tile
  counts. Doesn't account for multiple bursts competing for same tiles,
  or path connectivity. Could do a combined check.

3. **Candidate ordering at deeper depths**: flex score sorts globally at
  startup but doesn't re-sort per coveredMask at deeper levels.
