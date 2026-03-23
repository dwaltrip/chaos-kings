# Path Prefix Structure Theory

A working theory about how the near-general structure of paths can dramatically reduce the solver's search space. Written during session 3.23-2 as a framework for upcoming experiments.

## Motivating observations

- The solver spends most of its time in the inner loop checking path compatibility. On hard boards, ~90% of candidate checks are wasted rejections. The waste feels structural, not incidental.

- Human intuition when looking at a board: "send one burst left, one up-left, one down" — thinking in *directions from the general*, not specific tile sequences. The first few moves commit to a direction; the rest is filling in.

- The pocket-2-11x11 manual solution (see `tmp-scripts/prove-solution-for-pocket-2-11x11.ts`): all the creative work was choosing prefixes. The suffixes were obvious once the prefixes were set.

- Thread 7 showed slow boards split into two populations — structurally constrained and structurally open. Both have tight geometry near the general. For open boards, the near-general funnel is the *only* structure. For constrained boards, the structure extends further but is even tighter near the general. In both cases, the action is at the root.

- Non-backtracking paths are "sticky" — once a path commits to a direction in the first few moves, it largely stays in that region. Early divergence implies late independence.

- The problem has a "narrow waist" near the general where all bursts compete for the same few tiles, then fans out. The prefix is the narrow waist. The suffix is the fan-out.

## Core concept: prefix sets

A **prefix set** is a collection of short non-backtracking paths from the general (length 3-4), one per burst slot, that are mutually compatible. Compatible means: zero-overlap bursts don't share tiles; overlap-K bursts have their first K tiles in the covered set (union of all prior bursts' tiles). The overlap lands on *any* previously covered tiles, not on a specific prior burst's path.

*Terminology note:* "Prefix" in this doc means the first few tiles of a burst that determine its direction — the **directional prefix**. This is distinct from the solver's existing "prefix overlap" concept (the segment of a burst that retraces covered territory). When a burst has overlap, the overlap segment is part of the directional prefix. These definitions are loose and exploratory — don't over-index on them. They'll sharpen as experiments reveal what matters.

The number of viable prefix sets is conjectured to be small — tens to low hundreds per board.

## The "opens up" property

A prefix is *good* if its tip leads into space where the burst can extend freely to any reasonable length without conflicting with other bursts.

This is NOT about disjoint regions. Multiple bursts can share the same area of the board. The key is **non-crossing trajectories** — parallel lines through shared space. Think two bursts following an L-shaped corridor side by side, both with flexible length.

Three outcomes at the tip:
- **Clean lines** — suffix extension is unconstrained, burst length doesn't matter
- **Fixed boundary** (pocket, edge, corridor end) — burst length is capped but deterministic
- **Moderate flexibility** — enough space for some burst lengths but not all; suffix needs a small search

The mitigating factor: most bursts have short or zero suffixes (see "Why most suffixes are short" below), so even the moderate case has small combinatorics.

**Width as a proto-metric:** The available "width" perpendicular to a trajectory determines how many parallel non-crossing bursts can pass through. Width=1 is a corridor (one burst only). Width=2 supports two flexible-length bursts side by side. Extends naturally around turns — an L-shaped region 2 tiles wide supports 2 parallel L-shaped paths. Generalizes the thread 7 corridor concept to arbitrary widths.

## Overlap as prefix parameterization

The overlap budget (0 to maxOverlapPerBurst per burst) controls where divergence happens. Overlap=K means "retrace K tiles of prior territory, then take a fresh step that commits to a direction." The prefix = overlap segment + first fresh divergence.

Different overlap budgets produce different prefix set geometries. The total number of overlap configurations is bounded by something like (maxOverlapPerBurst+1)^(numBursts-1) — in practice much smaller after timing constraints prune infeasible combos.

When multiple bursts have overlap, their prefixes are tightly coupled. E.g., if b2 has overlap=3 and b3 has overlap=2, b3's first 2 tiles must be in the covered set from b1+b2 combined. This coupling *narrows* the viable prefix sets — each additional overlap burst constrains the possibilities rather than expanding them.

This coupling also means overlap prefix sets are built incrementally — b2's choices depend on b1's coverage, b3's on b1+b2, etc. This is a form of shallow backtracking over tiny domains (3-4 tiles per burst), much cheaper than the current solver's deep backtracking over full-length paths. There may also be related non-sequential analyses we can do — we should keep both framings in mind as we explore.

## The decomposition

1. **Enumerate prefix candidates**
   - All non-backtracking paths from the general up to depth D
   - Small pool by construction (bounded by degree and depth)
   - Each candidate is a tile sequence + bitmask

2. **Build compatible prefix sets**
   - A prefix set assigns one prefix to each burst slot, respecting overlap constraints
   - Zero-overlap bursts: prefixes share no tiles
   - Overlap-K bursts: the first K tiles of the prefix are already in the covered set (union of all prior bursts' tiles)
   - The overlap just needs to land on *any* previously covered tiles, not on a specific prior burst's path — this is more permissive than tracking per-burst overlap
   - The overlap configuration (which bursts overlap and by how much) is a parameter — different configs produce different families of prefix sets
   - Compatibility checking is cheap: bitmask ops on short paths

3. **Check trajectory independence**
   - For each prefix set, verify the trajectories extending from each prefix tip are non-crossing
   - Width analysis at the prefix tips

4. **Match against timing entries**
   - Does each burst's required captures fit within what its prefix's trajectory can support?
   - Some cases will be simple capacity checks, others may require more work

5. **Extend suffixes**
   - Find actual full-length paths by extending each prefix along its trajectory
   - Since trajectories are independent, this is a per-burst subproblem — no cross-burst backtracking
   - Could be as simple as a greedy walk from the prefix tip

**Why most suffixes are short:** Burst patterns use descending capture counts (e.g., [12, 7, 3, 2]). At prefix depth 3-4:

| Burst | Length | Prefix | Suffix |
|-------|--------|--------|--------|
| B1    | 12     | 3-4    | 8-9 tiles |
| B2    | 7      | 3-4    | 3-4 tiles |
| B3    | 3      | 3      | 0 tiles |
| B4    | 2      | 2      | 0 tiles |

The shorter bursts are entirely within the prefix domain — fully resolved at the prefix level. Only B1 has a substantial suffix, and it's the first burst (overlap=0, heading into open territory with the most room). This means suffix independence mostly only matters for the longest burst, which is the easiest case.

**Where the savings come from:** Cross-burst interaction is fully resolved at the prefix level. The current solver discovers the same prefix conflicts thousands of times across different suffixes. The prefix approach resolves conflicts once in the small domain, then extends independently.

**Two separable claims:**
1. *Prefix structure reduces the search space* — enumerating prefix sets and extending them visits fewer total states than the current solver. This holds even if suffixes interact somewhat.
2. *Suffixes don't interact* — once prefixes are fixed, extending each burst is an independent subproblem. This gives the full independence win but isn't required for claim 1 to be valuable.

The experiments should test both, but claim 1 alone would be a significant improvement.

## Relationship to existing work

L1 neighbor partitioning (already in the solver) is effectively a depth-1 prefix partition — it splits candidates by which neighbor they start through. The prefix structure theory can be seen as a generalization to deeper prefixes. That said, we want to approach this with a fresh perspective and an exploratory "see what we find" mindset, not as an incremental extension of L1. The ideas here are promising enough to warrant several sessions of open-ended exploration before worrying about solver integration.

## Open questions

- What's the right prefix depth (3? 4? variable per board)?
- How to formalize "opens up" / trajectory independence as a computable check?
- How does width interact with turns and irregular geometry?
- Does this hold on degree-3+ boards where the near-general space is wider?
- What happens on the structurally constrained boards (tight-corner-1)?
- Is there a clean way to enumerate prefix sets that accounts for overlap without blowing up?
