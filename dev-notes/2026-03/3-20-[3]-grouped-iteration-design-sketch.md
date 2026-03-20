# Grouped Iteration Design Sketch — 2026-03-20

## Background

See 3-20-[2]-v2-perf-analysis.md. v2 precomputes timing tables
(eliminating timing calls in the hot loop) but introduces redundant
burst-1 work: each timing entry re-scans the burst-1 candidate list
from scratch. This doc sketches a "grouped iteration" approach (v3)
that combines v2's precomputed timing with shared burst-1 exploration.

## The burst-1 insight: no filtering at depth 0

A critical fact: at burst-1, `coveredMask` is always `0n` (nothing
placed yet) and overlap is always 0. So the mask check
`(cand.mask & 0n) !== 0n` is always false — **every burst-1 candidate
passes**. There's no filtering at burst-1.

This means "redundant burst-1 scanning" isn't about redundant *mask
checks* — it's about redundant *recursion into burst-2+*. v2 picks
burst-1 candidate P, recurses into burst-2+, fails, backtracks. Then
for the next timing entry, picks the same P again, recurses into a
*different* burst-2+ structure, fails, backtracks. The recursion cost
is the problem, not the picking.

## Cost model comparison

Setup: burst-1=12 group at 24 captures. 23 timing entries. C candidates
at length 12 (36K on corner-9x9, 1,758 on corridor-7x7). Solution
exists at candidate K, entry J.

**v2 flat** (entry-outer, candidate-inner):
```
for each entry E (1..23):
  for each candidate P (1..C):
    if P compatible: searchRemaining(P.mask, E)
```
Entries 1..(J-1) each exhaust all C candidates. Entry J stops at K.
Work: **(J-1) × C + K** burst-2+ searches.

**Grouped** (candidate-outer, entry-inner):
```
for each candidate P (1..C):
  for each entry E (1..23):
    if P compatible: searchRemaining(P.mask, E)
```
Candidates 1..(K-1) each try all 23 entries. Candidate K stops at J.
Work: **(K-1) × 23 + J** burst-2+ searches.

### Concrete example: corridor-7x7

v2 found the solution at entry 140, after checking 139 zero-overlap
entries that failed. All 139 are in different burst-1 groups (entries
are sorted by total overlap, not by burst-1 length). But within the
burst-1=12 group, there are 4 zero-overlap + 19 overlap entries = 23
total.

With grouped iteration on just the burst-1=12 group:
- v2: 4 zero-overlap entries fail × 1,758 candidates = 7,032
  burst-2+ searches before reaching the overlap entries
- Grouped: candidate #K × 23 entries. If K=500, that's
  499 × 23 + a few = ~11,500 entry-checks

**The critical variable is K** — how early in the candidate list does
the winning burst-1 path appear? If K is small (early), grouped wins
big. If K is large (late), grouped still wins because 23 << 1,758.

For any group where `entries_in_group << candidates_at_this_length`,
grouped iteration is better. This is true for virtually all groups:

| burst-1 | Entries | Candidates (corridor) | Candidates (corner-9x9) |
|---------|---------|----------------------|------------------------|
| 12      | 23      | 1,758                | 36,048                 |
| 11      | 217     | 1,240                | 14,496                 |
| 10      | 497     | 758                  | 5,778                  |
| 9       | 1,073   | 542                  | 2,300                  |
| 8       | 1,234   | 323                  | 912                    |
| 7       | 1,237   | 223                  | 366                    |

For burst-1≥10, entries << candidates, so grouped wins. For burst-1≤8,
entries > candidates, so v2-style (entry-outer) might be better. But
the long-burst-1 groups dominate the search cost because they have
the most candidates.

## Design

### Data structure: TimingGroup

```ts
interface TimingGroup {
  burst1Moves: number;    // burst-1 move/capture length (overlap=0)
  entries: TimingEntry[]; // all entries with this burst-1 length
}
```

Built from the timing table by grouping. Within each group, entries
sorted by total overlap (zero-overlap first).

### Iteration structure

```ts
function solveV3(board, generalPos, config) {
  const entriesByLen = buildPathEntries(genPathsDP(...));

  for (let captures = maxCaptures; captures >= minCaptures; captures--) {
    const groups = buildTimingGroups(captures, timingConfig);

    for (const group of groups) {
      const candidates = entriesByLen.get(group.burst1Moves);
      if (!candidates) continue;

      for (const cand of candidates) {
        // cand is the burst-1 path — coveredMask after placing it
        const coveredMask = cand.mask;

        // Forward check: can any entry's burst-2 be satisfied?
        if (!hasViableEntry(group.entries, coveredMask, entriesByLen))
          continue;

        // Try all entries in this group with this burst-1 path
        for (const entry of group.entries) {
          const result = searchRemaining(
            coveredMask, entry, entriesByLen, burstIdx=1
          );
          if (result) return buildSolution(cand, result, entry);
        }
      }
    }
  }
}
```

### searchRemaining — burst-2+ backtracking

Same as v2's `findPathsFixed` but starting at `burstIdx=1` with an
already-chosen burst-1 path. No timing, no overlap loop — move lengths
and overlaps are fixed by the entry.

```ts
function searchRemaining(
  coveredMask: bigint,
  entry: TimingEntry,
  entriesByLen: PathEntriesByLen,
  burstIdx: number,
  moves: number[],
): PathEntry[] | null {
  if (burstIdx === moves.length) return [];

  const moveLen = moves[burstIdx];
  const overlap = entry.overlaps[burstIdx];
  const candidates = entriesByLen.get(moveLen);
  if (!candidates) return null;

  for (const cand of candidates) {
    if (overlap === 0) {
      if ((cand.mask & coveredMask) !== 0n) continue;
    } else {
      if (popcount(cand.mask & coveredMask) !== overlap) continue;
      if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap)
        continue;
    }

    const newTiles = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
    const rest = searchRemaining(
      coveredMask | newTiles, entry, entriesByLen, burstIdx + 1, moves
    );
    if (rest) {
      rest.unshift(cand);
      return rest;
    }
  }
  return null;
}
```

### Forward checking: hasViableEntry

After choosing a burst-1 path (coveredMask known), cheaply check
whether any entry in the group could possibly succeed. For each entry,
verify that at least one compatible candidate exists at burst-2's move
length. If no entry has a viable burst-2, skip this burst-1 candidate.

```ts
function hasViableEntry(
  entries: TimingEntry[],
  coveredMask: bigint,
  entriesByLen: PathEntriesByLen,
): boolean {
  // Collect distinct (moveLen, overlap) pairs needed at burst-2
  // across all entries. Check each once.
  const checked = new Map<string, boolean>();

  for (const entry of entries) {
    const moveLen = entry.captures[1] + entry.overlaps[1];
    const overlap = entry.overlaps[1];
    const key = moveLen + ',' + overlap;

    if (checked.has(key)) {
      if (checked.get(key)) return true; // already found viable
      continue;
    }

    const candidates = entriesByLen.get(moveLen);
    if (!candidates) { checked.set(key, false); continue; }

    let viable = false;
    for (const cand of candidates) {
      if (overlap === 0) {
        if ((cand.mask & coveredMask) === 0n) { viable = true; break; }
      } else {
        if (popcount(cand.mask & coveredMask) === overlap) {
          if (countPrefixOverlap(cand.tiles, coveredMask) === overlap) {
            viable = true; break;
          }
        }
      }
    }
    checked.set(key, viable);
    if (viable) return true;
  }

  return false;
}
```

This is a necessary but not sufficient check — it only looks at burst-2,
not deeper. But it's cheap (stops at first viable candidate) and catches
the main failure mode: burst-1 covers tiles that block all burst-2
candidates.

On corner-9x9 where all paths radiate from (0,0), a long burst-1 path
covers many tiles near the general. Short burst-2 paths also start near
the general, so many will overlap with burst-1. Forward checking can
detect when ALL short paths overlap, pruning that burst-1 candidate
without recursing.

### Group ordering

Groups are ordered by burst-1 move length, **descending** (longest
first). Rationale: longer burst-1 paths capture more tiles, meaning the
solution is more likely to be found with a long first burst. The data
confirms this — all current solutions use burst-1=10, 11, or 12.

Within a group, entries are sorted by total overlap (zero-overlap
first). This means for each burst-1 candidate, we try the simplest
entries first.

### What about cross-group interleaving?

v2 sorts all entries globally by total overlap, interleaving entries
from different burst-1 groups. This means v2 tries the best-looking
entries from ALL groups before exhausting any single group.

The grouped approach commits to exhausting all candidates in one
burst-1 group before moving to the next. If the solution requires
burst-1=9 but the burst-1=12 group is tried first, we waste time on
12 before discovering this.

In practice, this is mitigated by:
1. Groups are tried longest-first (most likely to contain solutions)
2. Forward checking culls bad candidates quickly
3. Small groups with few entries are cheap to exhaust
4. For the problem boards (corner, edge), all burst-1 lengths need to
   be tried anyway — the question is total work, not ordering

If cross-group interleaving proves important, a round-robin scheme
is possible: try N candidates from each group, cycling through groups.
But this adds complexity. Start simple, measure, then optimize.

## Expected impact

**Corridor-7x7** (1,758 len-12 candidates, 23 entries in burst-1=12
group): grouped iteration reduces burst-1 candidate visits from
~7,000 (4 failed entries × 1,758) to ≤1,758 per entry-check, with
forward checking likely pruning many. Estimated 3-10x improvement.

**Corner-9x9** (36K len-12 candidates, 23 entries): forward checking
is the key here. If it prunes 90% of burst-1 candidates, the search
becomes 3,600 × 23 = 83K entry-checks instead of 36K × (many entries)
= millions. This could bring corner-9x9 from >60s to seconds.

**Open boards that already solve instantly**: minimal change (solution
found on first candidate of first entry, forward check is wasted
work but cheap).

## Open questions

1. **Forward checking depth.** Checking only burst-2 is simple and
   cheap. Checking burst-3+ would catch more dead ends but costs more
   per candidate. Profile after implementing to see if burst-2-only
   is sufficient.

2. **Entry ordering within a group.** Currently sorted by total
   overlap. Could sort by some board-specific heuristic (e.g.,
   prefer entries whose burst-2 move length has many candidates).
   Deferred — measure with simple ordering first.

3. **Sharing burst-2 work across entries.** Within a group, entries
   with the same burst-2 move length and overlap could share burst-2
   candidate scanning. This is deeper grouping:
   ```
   for each burst-1 candidate:
     for each (burst-2 moveLen, overlap) pair:
       for each burst-2 candidate:
         for each entry with this (moveLen, overlap) at burst-2:
           searchRemaining from burst-3
   ```
   More complex, more sharing. Defer unless burst-2 is the bottleneck.

4. **Candidate ordering.** The burst-1 candidate list is in path
   enumeration order (essentially BFS from general). Could we order
   candidates to try "most likely to succeed" first? E.g., paths that
   cover diverse directions, or paths with maximum "breathing room"
   for later bursts. This is heuristic-land — could help a lot or
   not at all. Measure baseline first.
