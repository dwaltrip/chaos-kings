# Critical Review: Idea Gaps & Contrarian Takes

Fresh-eyes review of EXPLORATION-SURVEY.md focused on the ideas themselves — missing angles, experiment design weaknesses, underexplored connections, and contrarian takes.

---

## 1. Missing Spatial/Structural Techniques

### Arc Consistency / Constraint Propagation (the biggest omission)

The document gestures toward CSP ideas (most-constrained-variable-first in 3.4) but never proposes actual constraint propagation. The problem has natural CSP structure: each burst is a variable, its domain is the set of candidate paths, and the constraints are pairwise non-overlap (or valid prefix overlap). AC-3-style arc consistency — before search, for each pair of bursts, prune paths from one that are incompatible with *every* path in the other — could massively reduce domains upfront. This is especially powerful on constrained boards where the current approach does zero pre-search domain reduction beyond timing feasibility.

This is more promising than coverage clustering (4.2), which tries to approximate the same thing heuristically.

### Flow / matching formulation for zero-overlap case

For zero-overlap bursts, the compatibility check is purely spatial (no mask overlap). This is essentially an independent set / packing problem on a conflict graph where paths are nodes and edges connect overlapping paths. For the restricted case where you need exactly K non-overlapping paths of specified lengths, this can be modeled as a multi-commodity flow problem on the grid, or as a maximum weight independent set on the conflict graph. The grid's planarity makes some of these tractable that would be NP-hard in general — planar graphs have treewidth O(sqrt(n)), and independent set on bounded-treewidth graphs is polynomial.

Not saying "implement treewidth-based DP" — rather the document should at least consider whether the grid's planarity can be exploited. On an 11x11 grid with obstacles, the treewidth is likely 8-12. That's borderline for treewidth-based exact methods, but could be useful for the 7x7/9x9 constrained cases that are actually slow.

### Lazy path generation (conspicuously absent)

The solver generates ALL paths up to length 12 eagerly. On open-11x11 that's ~60K paths. But the solver typically finds a solution after examining a tiny fraction. Lazy generation — generate paths on demand, guided by which regions still need coverage — could eliminate most of the path generation cost. The document mentions lazy generation in passing (1.2: "lazy generation or path pruning matters more") but never develops it as an experiment. If phase timing (1.2) shows path generation is significant on 13x13, this becomes critical.

### Constraint propagation via "watched literals"

The SAT-solving technique of watched literals maps well here. Instead of checking every candidate against the covered mask, maintain a short watch list per candidate — if any watched tile is covered, the candidate is dead. This turns the O(candidates) scan into an O(newly-covered-tiles) propagation step. Given that each burst covers 2-12 tiles, this could be a large constant-factor win on the inner loop, independent of all the structural ideas.

---

## 2. Experiment Design Weaknesses

### 1.1 BigInt vs Uint32Array: Expected outcomes miss the likely result

The expected outcomes are "5-20x faster" / "2-3x faster" / "roughly equivalent." Based on V8's BigInt implementation, the most likely outcome for 4-6 word bitmasks is 3-5x faster for Uint32Array on individual ops, but **less than 2x on the actual hot path** because the hot path's bottleneck is branch misprediction on the `continue` (most candidates fail the overlap check), not the bitwise op itself. The experiment should measure the hot-path pattern *including the branch*, not just isolated ops. The "expected outcomes" section should have a fourth bucket: "individual ops are faster but end-to-end solver speedup is <1.5x because the bottleneck is elsewhere."

### 2.2 Greedy Structural Probing: No clear go/no-go signal

This experiment is explicitly "exploratory, not prescriptive" and says "we don't know exactly what the probing will reveal." That's fine for understanding, but it means there's no falsifiable hypothesis. You could spend days building and visualizing greedy probes and come away with "interesting intuitions" that don't translate to any concrete solver improvement. Suggest either (a) tying it to a specific downstream decision (e.g., "if greedy paths cover >80% of the same tiles as optimal paths, then greedy-first search ordering is viable") or (b) deprioritizing it in favor of 2.1, which produces directly actionable metrics.

### 4.2 Coverage Clustering: Risk section understates the fundamental problem

The risk "if clusters are too coarse, we might skip the one path that works" is real, but the deeper issue is that clustering introduces a meta-parameter (threshold) that likely needs per-board tuning. On open boards clustering helps; on constrained boards where every path is structurally distinct, it adds overhead with no benefit. The experiment as described doesn't address how to set the threshold automatically. This is likely a dead end for the same reason "flex score" was reverted — heuristic orderings that help some boards hurt others.

### 4.4 Solution Census: Tractability is worse than stated

The doc says "on 7x7 it should be tractable." On a 7x7 with ~40 walkable tiles targeting 24 captures, the solution count could easily be in the millions (many permutations of which 16 tiles to skip, times many burst assignments). Exhaustive enumeration even on 7x7 might not terminate in 60 seconds. The experiment should use sampling (random restarts with counting) rather than exhaustive enumeration. Otherwise it might produce only "we hit the time limit," which is an ambiguous result.

---

## 3. Underexplored Connections

### 3.2 (Neighbor Pre-Filtering) + Constraint Propagation = Much stronger pre-search reduction

3.2 is pitched as a simple filter: reject timing entries with too many zero-overlap bursts for the general's degree. But once you've assigned "zero-overlap burst X goes through neighbor A," you can propagate further: burst X's candidates are restricted to paths starting with neighbor A. This immediately partitions candidates by starting direction, which is a form of the sector decomposition (2.1) that doesn't require any fuzzy affinity computation — it falls directly out of the timing entry structure. The document keeps these ideas separate when they should be developed as a pipeline: timing entry -> neighbor assignment -> path partitioning by starting direction -> per-partition search.

### 1.3 (Path Redundancy) feeds directly into a watched-literal / inverted-index approach

If deduplication (4.1) collapses 60K paths into 3K masks, those 3K masks can be organized into an inverted index: for each tile, which masks include it? When a tile gets covered, you iterate the inverted index to invalidate all masks containing that tile. This is O(masks-per-tile) per covered tile, not O(all-candidates) per search step. The document treats 1.3 and 4.1 as "measure then deduplicate" but misses that the deduplicated set enables a fundamentally different search data structure.

### 2.4 (Must-Capture) + 3.4 (Constrained-Tile-First) = Forced move propagation

If a must-capture tile T is reachable by only K paths, and K is small (say 3-5), this is a unit-propagation opportunity: one of those paths must be chosen. Try each, propagate the resulting coverage, and check for further forced assignments. This is the CSP technique of "look-ahead" and could solve constrained boards almost instantly if the constraint graph is tight enough. The document lists these as separate analysis/ordering ideas but doesn't connect them into a propagation cascade.

---

## 4. Contrarian Takes

### Tree Packing (3.3) is probably a dead end

The document acknowledges the challenges (board isn't a tree, paths don't follow BFS tree, cycles create cross-edges) but still presents tree packing as a "deeper research direction." On any board with moderate openness (which is most boards), the BFS tree is a poor approximation — tiles are reachable via many non-tree paths, and the optimal bursts frequently use non-shortest-route paths to snake through territory. The tree packing formulation only helps if the board is nearly a tree (long corridors, few cycles), but those boards are already easy for the solver. The boards where tree packing would theoretically help most (constrained, complex topology) are exactly where the tree approximation is worst. Suggest cutting this entirely and redirecting the effort toward constraint propagation.

### Group Ordering deserves a second look

The document deprioritizes group ordering, arguing that "structural improvements address the root cause more directly." But the README shows the optimization history: neighbor bottleneck pruning brought corner-9x9 from 25s to 1.5s. That's a pruning improvement, not a structural one. The corner-9x9 problem is specifically that the solver tries long burst-1 groups first (longest-first ordering), exhausting them all before finding the solution in a shorter group. Simply trying a few short groups early (or interleaving long and short) could bring the 1.5s case to <100ms with almost no code change. The structural improvements are more intellectually satisfying, but group ordering is a 10-line change that directly attacks the known performance bottleneck. It should be Phase 1, not "fallback."

### Symmetry Breaking deserves a second look for a different reason

The document deprioritizes symmetry breaking because "most real game boards aren't symmetric." But the value isn't about board symmetry — it's about *solution* symmetry. On open boards, many solutions are related by rotation/reflection of the burst assignment (burst 1 goes north, burst 2 goes east) vs (burst 1 goes east, burst 2 goes south, ...). Fixing burst-1's direction to the "first" available neighbor halves or quarters the search. This is free (one line: skip burst-1 candidates not starting with the first neighbor) and stacks with everything else. It was dismissed for the wrong reason.

### BigInt benchmarking (1.1) might not be worth the effort

The solver already solves most boards in <200ms. The hard case (corner-9x9) at 1.5s is slow because of combinatorial explosion, not constant factors. A 3x constant-factor speedup turns 1.5s into 0.5s — nice but doesn't change the qualitative situation. A 3x speedup on the 100ms cases turns them into 33ms — imperceptible. The effort for a proper Uint32Array migration (changing the core data structure, updating all operations, handling variable board sizes) is substantial. Meanwhile, neighbor pre-filtering (3.2) + group ordering could get corner-9x9 to <100ms with far less work. Suggest dropping 1.1's priority to "nice to have."

---

## Summary of Recommendations

1. **Add constraint propagation as a first-class theme.** Arc consistency on burst-pair compatibility, forced-move propagation from must-capture tiles, and watched-literal invalidation are all standard CSP techniques that map directly onto this problem and are absent from the document.

2. **Elevate group ordering and neighbor pre-filtering + path partitioning.** These are the lowest-effort, highest-impact changes for the known hard case. Do them before the analysis-heavy structural work.

3. **Cut tree packing (3.3).** The tree approximation is bad exactly where you need it. The effort is better spent on constraint propagation.

4. **Tighten experiment 2.2** (greedy probing) to have a falsifiable hypothesis, or deprioritize it.

5. **Rethink symmetry breaking** as solution-symmetry reduction (fixing burst-1 direction), not board-symmetry exploitation. It's nearly free.

6. **Consider lazy path generation** as an explicit experiment, especially for 13x13 boards.
