# Custom Algorithm: Burst-Path Combinatorial Search

## Core Insight

If optimal solutions decompose into a small number of bursts (4-6), and
bursts are non-backtracking paths from the general, then we can enumerate
the building blocks (paths) and assemble them combinatorially instead of
searching tick-by-tick through the move space.

This decomposes the problem into two independent subproblems:

1. **Timing (board-independent):** What sequences of burst lengths fit
   within 50 ticks, accounting for accumulation time between bursts?
2. **Spatial (board-specific):** For a given sequence of burst lengths,
   can we find non-overlapping paths from the general that match?

## Precomputation

### Paths from the general (once per board)

Enumerate all non-backtracking paths starting from the general, up to
some maximum length (12-13, the longest burst that could appear in an
optimal solution).

Path counts on an open 11×11 board:

```
Length  1:        1
Length  2:        4
Length  3:       12
Length  4:       36
Length  5:       98
Length  6:      262
Length  7:      650
Length  8:    1,610
Length  9:    3,938
Length 10:    9,816
Length 11:   24,142
Length 12:   59,626
```

These counts are very workable. Computation took <1 second.

Walls reduce the path count significantly, so less-open boards are
cheaper to search — which is convenient since those are the boards
where tick-by-tick search struggles most.

### Burst patterns (once, board-independent)

Enumerate all valid sequences of burst lengths that fit in 50 ticks.
A burst of length L requires accumulation time (to build up L armies)
plus L ticks of execution. The exact timing model for accumulation
overlap between bursts needs to be worked out, but the enumeration
is finite and probably produces hundreds to low thousands of patterns.

The burst pattern space has good pruning structure:
- Picking a burst length constrains what lengths can follow (fewer
  remaining ticks)
- After 3-4 bursts, only 1-2 more lengths are typically valid
- Patterns can be extended with an overlap budget dimension (see below)

## The search algorithm

For each burst pattern (e.g., lengths [10, 7, 5, 3]):

1. Start with the longest burst. Select a path of that length from
   the precomputed set.
2. Mark all tiles covered by that path. Remove all paths that overlap
   with covered tiles.
3. Take the next longest burst. Select a path of that length from the
   remaining paths.
4. Repeat until all bursts are assigned, or backtrack if no valid path
   exists for a burst.
5. Score the result: count total unique tiles captured.

First valid combination that matches or exceeds the SA baseline score
is sufficient — we don't need to enumerate all solutions.

## Bitmask representation

Represent each path as a bitmask: bit i is set if tile i is part of
the path.

- 7×7 = 49 bits → fits in a single 64-bit integer
- 11×11 = 121 bits → two 64-bit integers or BigInt

Key operations become single CPU instructions:

- **Overlap check:** `path1 & path2 !== 0` → incompatible
- **Union after placing:** `covered |= newPath`
- **Filter remaining:** `candidates.filter(p => (p & covered) === 0)`
- **Count tiles:** `popcount(covered)`

Filtering 60K paths against a coverage mask is microseconds. This makes
the inner loop of the combinatorial search extremely fast.

## Handling overlap (bursts traversing owned territory)

Not all bursts in an optimal solution will be pure captures. Later,
smaller bursts may need to traverse already-owned tiles to reach
uncaptured territory, especially on walled boards.

Several factors make this manageable:

1. **Small bursts come last.** By the time we need overlapping paths,
   we're looking at short paths (length 3-5), which are far fewer
   in number.
2. **Walled boards have fewer paths overall.** The boards where overlap
   is most likely are also the boards where the path set is smallest.
3. **Overlap as a lookup parameter.** A burst that captures 5 new tiles
   but walks over 2 owned tiles uses a path of length 7. We look up
   paths of length `burst_capture_count + num_overlap_tiles`, reusing
   the same path-length index. Start with overlap = 0 and increase
   if no valid assignment is found.

Burst patterns can be precomputed with varying overlap budgets. Since
overlap costs extra army (you need a bigger army to traverse owned tiles
and still capture the target number), it feeds back into the timing
constraint — more overlap means more accumulation time, which may
shrink later bursts or invalidate the pattern.

## Why this might work

The two extremes both favor this approach:

- **Open boards:** Many valid paths, many valid solutions. We only need
  to find one. The search terminates quickly because solutions are
  abundant.
- **Walled boards:** Far fewer paths to consider. The combinatorial
  space is small. Bitmask filtering makes it fast.

The middle ground (moderately walled boards) is the potential hard case,
but the bitmask operations are fast enough that even large candidate
sets are manageable.

## Potential optimizations

- **Most constrained first.** Pick the longest burst first — it has the
  fewest valid paths after overlap filtering, maximizing early pruning.
- **Symmetry breaking.** On symmetric boards (general at center, no
  walls), paths related by rotation/reflection are equivalent. Fixing
  the first path's general direction (e.g., "first burst goes right
  or down") could cut the search by 4-8×.
- **Early termination.** If total unique tiles covered so far plus the
  maximum possible from remaining bursts is below the target score,
  backtrack immediately.
- **Precomputed compatibility.** Could precompute which path pairs are
  non-overlapping, but bitmask AND is already so fast this may be
  unnecessary.

## Open questions

1. **Burst timing model.** What exactly is the tick cost of a burst
   pattern? Accumulation overlaps with previous burst execution (the
   general produces armies while you're executing the previous burst).
   Need to work out the precise formula to enumerate valid patterns.
2. **Maximum burst length.** The path enumeration goes up to 12-13.
   What's the theoretical maximum burst length that could appear in
   an optimal 50-tick solution? This determines the path generation
   cutoff.
3. **Are optimal solutions purely burst-composed?** SA results should
   answer this. If the best SA solutions include small opportunistic
   captures between bursts (single army moves that aren't part of a
   burst chain), the algorithm needs to account for those. How common
   is this?
4. **Completeness.** Under what conditions does this algorithm guarantee
   finding the optimal solution? If all optimal solutions are composed
   of bursts from the general with bounded overlap, and the burst
   pattern enumeration is exhaustive, it should be complete. But what
   if an optimal solution uses a move that isn't part of any burst
   (e.g., gathering armies)?
5. **Path count scaling.** 60K paths of length 12 on open 11×11. What
   about length 13? Does it roughly 2.5× per length? At what point
   does the combinatorial search over path assignments become the
   bottleneck rather than the path enumeration?
6. **Proof of concept priority.** What's the fastest way to test
   whether this approach finds known-optimal solutions? Probably:
   hard-code a few burst patterns known from SA results, run just
   the path assignment search, see if it finds a valid combination
   scoring 25 on open 7×7.
