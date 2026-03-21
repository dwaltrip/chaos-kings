# Exploration Survey: Structural & Spatial Improvements to custom-algo-1

This document is a detailed exploration of ideas, experiments, and analysis directions for fundamentally improving the burst-path combinatorial solver. It is written in brainstorm/exploration mode — ideas are developed in full, with reasoning, connections, and open questions preserved. The goal is to serve as a rich starting point for further investigation, not a polished specification.

A final section documents the reasoning, decisions, and problem knowledge from the discussion that produced this document.

---

## Theme 1: Performance Foundations

Self-contained measurements that inform everything else. These don't require changing the solver — they're pure analysis of what we have.

### 1.1 BigInt vs Uint32Array Performance

**The question**: How much faster would core bitmask operations be with `Uint32Array` instead of `BigInt`?

**Why it matters**: Bitmask operations (overlap checks, popcount, union, andNot) are in the innermost loop of the solver. Every candidate path check does at least one `(cand.mask & coveredMask) !== 0n`. If BigInt is 10x slower than equivalent Uint32Array operations, that's a 10x constant-factor improvement on the tightest loop.

**What to measure**: Implement both BigInt and Uint32Array versions of the core operations. Size the arrays to match actual board sizes: `Uint32Array(4)` for 11x11 (121 tiles, 128 bits) and `Uint32Array(6)` for 13x13 (169 tiles, 192 bits). Benchmark both sizes since performance may differ. Operations to benchmark:
- `hasOverlap(a, b)` — `(a & b) !== 0n` vs manual word-by-word AND
- `popcount(mask)` — Kernighan bit trick on BigInt vs lookup-table or Hamming weight on 32-bit words
- `union(a, b)` — `a | b` vs word-by-word OR
- `andNot(a, b)` — `a & ~b` vs word-by-word AND-NOT
- `isZero(mask)` — `mask === 0n` vs check all words
- `setBit(mask, i)` / `testBit(mask, i)` — `mask | (1n << BigInt(i))` vs `words[i >> 5] |= (1 << (i & 31))`

Benchmark methodology:
- Generate a large set of realistic masks (e.g., from actual path generation on open-11x11)
- Run each operation 10M+ times on random pairs from this set
- Measure both throughput (ops/sec) and latency (ns/op)
- Test with different popcount densities (sparse masks vs dense masks)
- Test the combined pattern that the solver actually does: `if ((a & b) !== 0n) continue; newMask = a & ~b; covered = covered | newMask;` — this is the hot path

**Prior knowledge**: A brief investigation found BigInt more competitive than expected, but results weren't saved. This time we produce a proper writeup with methodology and numbers.

**Expected outcomes**:
- If Uint32Array is 5-20x faster per operation: worth switching, meaningful speedup on all boards
- If Uint32Array is 2-3x faster: marginal, probably not worth the code complexity
- If roughly equivalent: BigInt is fine, focus effort elsewhere

**Connections**: This is fully independent of all other experiments. Do it first to establish the constant-factor baseline.

### 1.2 Phase Timing Breakdown

**The question**: For each board, how is total solver time distributed across phases?

**Why it matters**: If 90% of time on hard boards is in the search phase, then search improvements (pruning, ordering, spatial awareness) are the lever. If path generation dominates, lazy generation or path pruning matters more. If timing table generation is significant, pre-filtering timing entries matters.

**What to measure**: For each board, report:
- Path generation time (genPathsDP + buildPathEntries)
- Path counts by length (how many paths of length 3, 4, ..., 12)
- Timing table generation time per capture target
- Timing entry counts per capture target
- Search time per capture target (broken out by timing group)
- Total BigInt operation count during search (instrument with counters)
- Wall time and per-phase percentage

Run across all test boards. Present as a table so easy vs hard boards can be compared side-by-side.

**Note**: The existing `profile-search-detail.ts` tool profiles the search phase with detailed counters, but it uses an older search implementation (pre-v3, no grouping or feasibility pruning). We need a profiler that instruments the actual `searchGrouped` code path in solver-v3, and also captures the pre-search phases.

**Connections**: Results from this directly prioritize themes 2-4. If search dominates on hard boards (expected), spatial improvements are the priority.

### 1.3 Path Mask Redundancy & Equivalence Classes

**The question**: How many generated paths are redundant — i.e., multiple paths produce the same bitmask?

**Why it matters**: For zero-overlap bursts, the solver only checks `(cand.mask & coveredMask) !== 0n`. Tile order is irrelevant. If 1000 paths of length 10 collapse to 50 distinct masks, the solver is doing 20x redundant work on every zero-overlap check at that length. For overlap bursts, order matters — but only the first `overlap` tiles (the prefix). So the effective equivalence class is `(mask, prefix[0..maxOverlap])`, which is still much smaller than all paths.

**What to measure**: For each board and each path length:
- Total path count
- Distinct mask count (number of unique BigInt values)
- Compression ratio (paths / distinct masks)
- For overlap: distinct (mask, prefix_1) count, distinct (mask, prefix_2) count, distinct (mask, prefix_3) count (for overlap 1, 2, 3)
- Distribution: how many masks have 1 path vs 2 vs 5 vs 50?

Also measure: **dominated paths**. Path A (length L, mask M_A) is dominated by path B (length L, mask M_B) if M_A is a strict subset of M_B. A dominated path is never the best choice — B covers everything A does and more. Count dominated paths per length.

**Expected outcomes**:
- On open boards: high redundancy (many orderings of the same tiles), compression ratio 10-50x
- On constrained boards (walls, corridors): lower redundancy, each path is more distinct
- This directly quantifies the benefit of mask-based deduplication

**Connections**: Feeds directly into 4.1 (path deduplication). If redundancy is high, dedup is a near-free speedup. If low, the full path set is necessary and we need smarter search instead.

---

## Theme 2: Board Structure Analysis

Understanding the spatial structure of each board before searching. The core insight: the solver currently treats the board as an unstructured set of tiles, but boards have rich directional and topological structure that humans exploit effortlessly.

### 2.1 Sector / Tile Affinity Decomposition

**The idea**: Every walkable tile has a "natural affinity" to one or more of the general's neighbors. A tile deep in the upper-right region of the board is naturally served by bursts going through the general's right or up neighbor. This affinity structure reveals how the board decomposes into regions.

**Hard vs fuzzy boundaries**: A hard Voronoi-like decomposition (assign each tile to its nearest general-neighbor) would be clean but unrealistic — walls, corridors, and board geometry create irregular shapes where many tiles are reachable from multiple directions.

A fuzzy/continuous model is more realistic: for each tile T and each general neighbor N, compute:
- BFS distance from N to T (ignoring the general itself, so we measure "how far is T if you go through N first?")
- Path count: how many paths of length ≤ maxBurst starting through N include T?
- Exclusive reachability: is T reachable through N but not through any other neighbor?

From these, derive per-tile metrics:
- **Affinity strength**: how much closer/more accessible is T through its best neighbor vs its second-best? High affinity strength = tile is "clearly owned" by one direction.
- **Contestedness**: how many neighbors can reach T with similar efficiency? High contestedness = tile is a source of burst interference.

**What to measure**: For each board:
- General degree (number of walkable neighbors)
- Per-neighbor sector capacity (tiles reachable through each neighbor)
- Distribution of affinity strength across all tiles (histogram)
- Count of "clearly owned" tiles (affinity strength above some threshold) vs "contested" tiles
- Spatial map: print the board with each tile labeled by its primary sector or marked as contested
- Sector balance: ratio of largest to smallest sector capacity

**Why it matters**: If 80% of tiles are clearly owned by one sector and only 20% are contested, the effective search complexity is determined by the contested tiles, not the total tile count. The solver is currently unaware of this structure.

On corner-9x9: 2 neighbors, so 2 sectors. The sectors are large and relatively balanced. Very few tiles should be contested (mostly tiles near the diagonal). This means the board naturally decomposes into two nearly-independent subproblems — which is exactly what a human sees.

**Connections**: Directly informs 3.1 (direction-aware feasibility), 2.2 (greedy probing), and the broader question of whether sector-based search decomposition is viable.

### 2.2 Greedy Structural Probing

**The idea**: Use simple greedy path extension as a tool for **revealing board structure**, not as a solver. By greedily extending paths from each general neighbor, we discover the board's natural arms, funnels, branch points, and dead ends.

**Approach**: From each neighbor of the general:
1. Greedily extend a path, always choosing the next tile that maximizes "remaining reachable tiles" (or some simpler heuristic like "most open neighbors")
2. Record: how far does the path go before hitting a dead end? Where does it naturally bend? Where does it encounter the boundary of another sector?
3. Repeat with different greedy heuristics (most open, most distant, random) to map out the "reachable shape" from each direction.

Also: extend paths from each neighbor simultaneously (like a flood fill from all neighbors at once). The boundaries where fills meet are the natural sector boundaries — this is an alternative way to compute sectors (2.1).

**What we learn**:
- The "natural reach" of each direction — how many tiles can a single burst greedily claim going each way?
- Branch points — where does a direction's territory fork? These are where a second burst through the same neighbor would diverge.
- Dead ends and funnels — areas where paths are forced through narrow corridors.
- Whether the greedy paths look anything like the solver's optimal paths (do they pick the same regions?).

**This is exploratory, not prescriptive.** We don't know exactly what the probing will reveal. The point is to build visual and quantitative intuition about each board's topology from the general's perspective. Some things to capture per-neighbor along the way: greedy reach length, where branches and dead ends appear, how the greedy paths compare to the solver's chosen paths. But the specific outputs should evolve as we learn what's informative.

**Connections**: Feeds into 2.1 (sector decomposition), 2.5 (tree structure), and 3.3 (tree packing). Also useful for validating whether spatial heuristics match what the solver finds.

### 2.3 Tile Reachability Scarcity & Bottleneck Detection

**The idea**: Some tiles are easy to capture — many paths of various lengths include them. Other tiles are hard — only a few specific paths reach them, often through a narrow corridor. Scarce tiles constrain the solution more than flexible tiles.

**Metrics per tile**:
- **Path inclusion count**: across all generated paths (all lengths), how many include this tile?
- **Path inclusion by length**: for each length L, how many paths of length L include this tile?
- **Bottleneck score**: if this tile is removed from the board, how many tiles become unreachable from the general? A tile with high bottleneck score gates access to a region.
- **Corridor membership**: is this tile part of a corridor (a chain of tiles each with exactly 2 walkable neighbors)?

**What to measure**: For each board:
- Distribution of path inclusion counts (histogram: how many tiles have count < 10, < 100, < 1000, etc.)
- List of bottleneck tiles and the regions they gate
- Count and location of corridors
- Correlation: do scarce tiles cluster in specific board regions?

**Why it matters**: Scarce tiles are like "forced moves" in a chess problem — they constrain the solution space dramatically. If 5 tiles can only be reached by paths going through a specific corridor, then some burst *must* traverse that corridor. Identifying these constraints upfront could allow:
- Forced path assignments (reducing search space)
- Better search ordering (assign scarce tiles first, like most-constrained-first in CSP)
- Earlier pruning (if a scarce tile becomes unreachable given current coverage, prune immediately)

**Connections**: Feeds into 3.4 (constrained-tile-first ordering), and combines with 2.4 (must-capture analysis) to identify forced assignments.

### 2.4 Must-Capture Analysis

**The idea**: If the board has W walkable tiles and we need C captures, at most W-C tiles can be skipped. If W is only slightly larger than C, most tiles are mandatory. For each tile, determine: is it possible to achieve C captures without this tile?

**Approach**: For a tile T to be skippable, the remaining W-1 tiles must contain enough reachable, coverable territory to achieve C captures. A conservative check: remove T from the board (treat it as a mountain), and verify that the modified board still has at least C tiles reachable from the general within the path-length and burst-count constraints.

A tighter check: actually run the solver (or a fast feasibility check) on the board with T removed. This is expensive but definitive.

A quick approximation: if T is a bottleneck tile gating access to K tiles behind it, and (W - 1 - K) < C, then T is must-capture (removing T itself plus the K tiles it gates leaves too few tiles to reach the capture target).

**What to measure**: For each board:
- W (walkable tiles), C (target captures), slack = W - C
- Must-capture tile count and locations
- Skippable tile count and locations
- For each must-capture tile: why is it must-capture? (bottleneck? raw count? structural?)

**Expected outcomes**:
- On open 11x11 (W ≈ 121, C = 24): huge slack, almost no must-capture tiles. Solutions are highly flexible.
- On constrained 7x7 (W ≈ 40-45, C = 24): moderate slack, some must-capture tiles.
- On boards with corridors: bottleneck tiles likely must-capture.

**Connections**: Must-capture tiles can be propagated as constraints before search begins. They also inform tile scarcity (2.3) and forced assignments.

### 2.5 BFS Tree Structure & Branch Points

**The idea**: Build a BFS tree from the general (or from each neighbor). This tree reveals the hierarchical structure of reachable territory — the trunk, major branches, and leaf regions. Understanding this tree is key to the tree-packing approach (3.3).

**What to compute**: From the general, run BFS. At each BFS level (distance), record:
- How many tiles at this distance
- How many "branch points" — tiles at distance D whose children at distance D+1 go in different directions
- The tree's branching factor at each depth
- Which subtrees correspond to which sectors (from 2.1)

Also: from each general neighbor, build a BFS tree restricted to that neighbor's sector. This gives the "per-direction tree" that bursts navigate.

**What to measure**:
- Tree depth (max BFS distance to any tile)
- Branching factor profile (avg and max branching at each depth)
- Subtree sizes (how many tiles are reachable through each major branch)
- Branch point locations (these are where multiple bursts through the same direction would diverge)

**Why it matters**: On a corner-9x9, the BFS tree from each neighbor likely has 1-2 major branches. Two bursts through the same neighbor can be thought of as "one takes the left branch, one takes the right branch." This structured view is much simpler than "search over all paths."

**Connections**: Directly informs 3.3 (tree packing). The tree structure determines how many bursts can be routed through each neighbor and where they must diverge.

---

## Theme 3: Structure-Aware Search Improvements

Using structural understanding to make the existing solver smarter. These range from "easy enhancement to current solver" to "significant architectural change."

### 3.1 Direction-Aware Feasibility Pruning

**The idea**: Replace the current global feasibility checks with sector-aware versions.

**Current approach**: `blankTilesWithinDist(dist, coveredMask, blankTileMasks)` counts all blank tiles within distance `dist` of the general, regardless of direction. After choosing a burst that covers tiles to the right, the check still counts right-side tiles as "available" for remaining bursts.

**Proposed approach**: Precompute per-sector distance masks: `blankTileMasks[sector][dist]`. When checking feasibility for a remaining burst, use only the sector(s) that the burst can actually reach. A burst through neighbor A can only capture tiles in sector A (and perhaps some contested tiles), not tiles in sector B.

**Concretely**: After choosing burst 1 through neighbor A (covering some tiles in sector A), the feasibility check for a remaining burst through neighbor B would ask: "are there enough blank tiles in sector B within distance X?" — ignoring the tiles in sector A entirely.

**Implementation complexity**: Moderate. Requires:
- Precomputing sector assignments (from 2.1)
- Building per-sector distance masks (similar to current `precomputeBlankTileDistMasks` but filtered by sector)
- Modifying feasibility checks to use per-sector masks
- Handling contested tiles (tiles in multiple sectors) — could count them in all relevant sectors (optimistic) or in none (pessimistic)

**Expected impact**: Significant on constrained boards where sectors are unbalanced. On corner-9x9, after placing a long burst in one direction, the current check might say "plenty of tiles left" because it counts tiles in both directions. The sector-aware check would correctly report "this direction is nearly exhausted."

**Also worth investigating**: The current global feasibility check uses BFS distance masks capped at distance 4, with a linear approximation beyond. Per-sector masks would inherit this same approximation. It's worth measuring whether the linear approximation is the binding source of looseness (in which case extending exact masks to distance 5-6 might matter more than per-sector splitting) or whether the directional blindness is the bigger issue. The phase profiling (1.2) and pruning instrumentation can help answer this.

**Risk**: If sectors are poorly defined (lots of contested tiles), the per-sector masks might not be much tighter than global masks. The affinity analysis (2.1) determines whether this is viable.

**Connections**: Depends on 2.1 (sector decomposition). Improved version of current feasibility pruning — could be a drop-in enhancement.

### 3.2 Neighbor-Constrained Pre-Filtering of Timing Entries

**The idea**: Before search begins, use the general's degree to eliminate provably infeasible timing entries.

**Current approach**: The neighbor bottleneck check is applied during search: at each recursive depth, count remaining zero-overlap bursts and compare to blank neighbor count. This catches infeasible entries, but only after entering the search tree.

**Proposed approach**: At timing entry generation time, immediately reject any entry where `count(overlaps[i] == 0) > generalDegree`. On a corner board (degree 2), this kills every timing entry with 3+ zero-overlap bursts — which is a large fraction of all entries.

**Going further**: Each zero-overlap burst must step to a distinct neighbor. So we can pre-assign: "the zero-overlap bursts go through neighbors A and B (the only two available)." This constrains which paths to even consider for those bursts — only paths starting through the assigned neighbor.

**What to measure**:
- For each board, count total timing entries vs entries surviving neighbor pre-filter
- Measure the kill rate by general degree (2, 3, 4 neighbors)
- For corner-9x9 specifically: what fraction of timing entries at captures=24 are killed?

**Expected impact**: High on corner/edge boards. On corner-9x9 (degree 2), a 4-burst solution requires at least 2 overlap bursts. Any timing entry for a partition like [12, 7, 3, 2] where all four overlap values are 0 is immediately dead (the partition itself may still be viable with different overlap assignments). This should eliminate a large portion of the search space before it even begins.

**Implementation complexity**: Low. Just add a filter in `buildTimingEntries` or `buildTimingGroups` based on general degree. Very easy to test and measure.

**Connections**: Independent of other improvements. Can be implemented and measured immediately. Complements 3.1 (direction-aware feasibility) — pre-filtering removes impossible entries, direction-aware pruning catches subtler infeasibilities during search.

### 3.3 Tree Packing for Multi-Burst-Per-Direction

**The idea**: Reframe the overlap-burst problem as "packing non-overlapping branches into a BFS tree."

**Current approach**: Overlap bursts are modeled as paths with a prefix that retraces owned tiles. The solver checks overlap validity by verifying that exactly `overlap` tiles form a clean prefix. This treats each path independently — it doesn't reason about the tree structure that overlap paths share.

**Reframing**: Multiple bursts through the same neighbor share a common prefix (the trunk) and diverge at some branch point. The question becomes: "In the BFS tree rooted at neighbor A, how can we pack N branches such that their non-shared portions don't overlap and their total capture count meets the burst sizes?"

**Why this helps**: Instead of trying all paths and discovering conflicts, we can reason about the tree:
- Identify the major branch points in each neighbor's tree
- At each branch point, enumerate the possible split: "burst 1 goes left (subtree: 15 tiles), burst 2 goes right (subtree: 12 tiles)"
- The number of major branch points is small (typically 1-3 per direction)
- This is a much smaller combinatorial space than "all paths"

**Challenges**:
- The board isn't a tree — there are cycles. BFS tree is an approximation.
- Paths don't have to follow the BFS tree — a path might take a non-shortest route to reach a region.
- The mapping from "branch assignment" back to specific paths needs care.

**This is more of a research direction than a concrete experiment.** It requires deeper investigation to determine whether the tree approximation is good enough and whether the packing formulation is tractable.

**Connections**: Depends on 2.5 (BFS tree structure). The tree analysis tells us whether the board's paths *do* decompose tree-like. If the tree has clean branches with few cross-edges, packing is viable. If the graph is highly connected, the tree approximation is too lossy.

### 3.4 Constrained-Tile-First Ordering

**The idea**: Order the search to assign scarce/constrained tiles first, similar to most-constrained-variable-first heuristics in constraint satisfaction.

**Current approach**: The solver tries burst-1 candidates in the order they appear in the path list. There's no preference for paths that cover constrained tiles.

**Proposed approach**: Score candidate paths by how many "scarce" tiles they cover (from 2.3). Try paths covering the most scarce tiles first. The intuition: if a scarce tile must be captured, and only 3 paths cover it, choosing one of those 3 paths first reduces the remaining search space immediately. Choosing a path that covers only "easy" tiles leaves all the hard constraints for later, leading to more backtracking.

**What to measure** (before implementing):
- Correlation between tile scarcity and solution membership: do solutions preferentially include scarce tiles? (They must, if the tiles are must-capture.)
- For the current solver's failed search branches: did they fail because a scarce tile became unreachable? (This would confirm that scarce tiles are the source of backtracking.)

**Expected impact**: Higher on constrained boards where some tiles are genuinely scarce. On open boards, few tiles are scarce, so ordering matters less.

**Connections**: Depends on 2.3 (tile scarcity analysis). Lightweight enhancement — just changes candidate ordering, not the search structure.

---

## Theme 4: Search Space Reduction

Reducing the number of things the solver needs to consider, without changing the search algorithm.

### 4.1 Path Deduplication by Mask

**The idea**: Multiple paths with the same bitmask are interchangeable for spatial compatibility checks. Deduplicate them to avoid redundant work.

**For zero-overlap bursts**: Two paths with the same mask are completely interchangeable. The solver checks `(cand.mask & coveredMask) !== 0n` — only the mask matters, not the tile order. Keep one representative per mask; the rest are wasted candidate checks.

**For overlap bursts**: Tile order matters, but only the prefix (first `overlap` tiles). Two paths with the same mask and the same first-K tiles (for K up to `maxOverlapPerBurst`) are interchangeable. The equivalence class is `(mask, prefix[0..maxOverlap])`.

**Implementation**: After `buildPathEntries`, group paths by mask (or by mask + prefix). Keep one representative per equivalence class. This is a one-time deduplication step — no solver changes needed.

**What to measure first** (from 1.3): The compression ratio tells us the payoff. If it's 20x on open boards, this is a major win. If it's 2x, it's marginal.

**Subtle point**: The solver currently returns the first solution found. After deduplication, it might find a *different* first solution (different tile ordering). This is fine — the solutions are equivalent in terms of spatial coverage and timing. But if we ever care about the specific tile ordering (e.g., for display), we'd need to recover the full path from the representative.

**Connections**: Directly informed by 1.3 (redundancy analysis). Independent of other improvements.

### 4.2 Coverage Clustering

**The idea**: Group paths not by exact mask equality, but by spatial similarity. Paths covering mostly the same region are "coverage-similar." During search, try one representative per cluster; only expand to other members if the representative fails.

**Why go beyond exact dedup**: Exact mask dedup (4.1) catches paths that cover the *identical* tile set. But there are also near-duplicates: paths that differ by 1-2 tiles (e.g., one path goes right-right-down-right, another goes right-right-right-down, differing in the last tile). These near-duplicates are often interchangeable in practice — if one works as a burst, the other likely does too.

**Approach**: Define similarity as Jaccard coefficient on masks: `popcount(A & B) / popcount(A | B)`. Cluster paths with similarity > threshold (e.g., 0.8). During search, try one path per cluster. If it fails, try the next cluster, not the next path in the same cluster.

**Alternatively**: Cluster by sector affinity — paths primarily covering sector A are one cluster, paths covering sector B are another. This is coarser but might align better with the actual search structure.

**What to measure**:
- For each path length, compute pairwise Jaccard similarities. What's the distribution? (Many near-duplicates, or mostly distinct?)
- Cluster sizes with various thresholds
- On solved boards: does the winning path always have high-similarity neighbors? (Validates that near-duplicates are interchangeable.)

**Risk**: If clusters are too coarse, we might skip the one path that works. Need to verify that solutions are robust to small perturbations in path choice.

**Connections**: Extends 4.1 (exact dedup). Informed by 1.3 (redundancy analysis) — if exact dedup already gives 20x reduction, near-dedup might not add much. Conceptually related to 2.1 (sector decomposition) — sector-based clustering is a form of coverage clustering.

### 4.3 Timing Entry Utilization & Fast-Path Patterns

**The question**: Across all boards, which timing entries (burst patterns + overlap combos) actually produce solutions?

**Why it matters**: If 90% of solutions on all boards use one of 5 specific timing patterns, we could try those 5 first as a fast path before falling back to full search. This would make the common case extremely fast.

**What to measure**: Run the solver on all boards (at all capture targets, not just max). For each solution found, log:
- The burst count
- The burst pattern (capture distribution)
- The overlap configuration
- The timing entry index in the sorted order (was it the 1st entry tried? 10th? 100th?)

Aggregate across boards:
- Frequency of each burst count (2-burst solutions vs 3-burst vs 4-burst)
- Most common burst patterns / partitions (e.g., is [12, 8, 4] a frequent partition?)
- Most common full timing entries (partition + overlap combo)
- How often overlap is needed (fraction of solutions with any overlap > 0)
- How early in the entry ordering the solution appears (if always in the first 10 entries, the full enumeration is wasteful)

**Connections**: Independent of other experiments. Could lead to a simple optimization: hard-code a "try these K patterns first" fast path.

### 4.4 Solution Census (Small Boards)

**The question**: On small boards (7x7, 9x9), how many distinct solutions exist at the max capture count?

**Why it matters**: Characterizes the solution space density. If there are thousands of solutions, the problem is underconstrained and almost any reasonable search strategy will find one quickly. If there are very few, the problem is tightly constrained and finding one requires precision.

**What to measure**: Modify the solver to not stop at the first solution — continue searching and count (or enumerate) all solutions. For each board:
- Total solution count at max captures
- Number of distinct covered masks (structurally different solutions)
- Per-tile coverage frequency: what fraction of solutions include each tile?
- Burst pattern distribution across solutions

**Limitations**: Exhaustive enumeration may be slow on 9x9. Could time-bound it (enumerate for 60 seconds, report what was found). On 7x7 it should be tractable.

**Connections**: Validates insights from 2.3 (tile scarcity) and 2.4 (must-capture). If some tiles appear in 100% of solutions, they are indeed must-capture. If solutions are highly diverse, coverage clustering (4.2) can be aggressive.

---

## Suggested Execution Order

Prioritized by: self-containedness, effort, and how much downstream work it unblocks.

**Phase 1 — Clean, independent measurements** (do in parallel):
1. **1.1 BigInt vs Uint32Array** — fully self-contained, definitive answer
2. **1.3 Path mask redundancy** — pure analysis of existing data, quantifies dedup opportunity
3. **1.2 Phase timing breakdown** — quick instrumentation, tells us where time goes

**Phase 2 — Board structure characterization**:
4. **2.1 Sector/affinity decomposition** — core structural analysis, unlocks theme 3
5. **3.2 Neighbor pre-filtering** — thematically a search improvement (Theme 3), but placed here because it's trivial to implement, requires no structural analysis, and has immediate payoff
6. **2.3 Tile reachability scarcity** — builds on path data from 1.3

**Phase 3 — Structure-aware improvements** (informed by phases 1-2):
7. **3.1 Direction-aware feasibility** — main enhancement to existing solver
8. **4.1 Path deduplication** — if 1.3 shows high redundancy
9. **2.5 + 3.3 BFS tree / tree packing** — deeper research direction

**Ongoing / as-needed**:
- 4.3 Timing utilization, 4.4 Solution census, 2.4 Must-capture analysis — run when useful for validating other ideas

**Note on combined effects**: Individual improvements may interact in non-obvious ways (e.g., neighbor pre-filtering + path dedup + direction-aware feasibility together might be more than the sum of their parts, or they might overlap). As Phase 3 progresses, it's worth measuring combined configurations, not just individual improvements in isolation.

---

## Discussion Context & Reasoning

This section documents the reasoning, claims, and decisions from the discussion that produced this document. It provides background for understanding why certain ideas were prioritized and others deprioritized.

### Problem Knowledge & Constraints

**24 captures is the provable maximum.** Under the standard timing model (1 troop per 2 ticks, starting with 1 troop), 24 captures (25 owned tiles including the general) is the theoretical maximum within 50 ticks. Most boards with moderate openness can achieve this. This means the solver's job is not "find how many captures are possible" but "quickly confirm 24 captures is achievable and find a valid path assignment."

**Naive BFS is intractable.** A tick-by-tick brute-force search (at each tick, choose one of 4 directions or wait) has a state space that explodes even on 7x7 boards. The burst decomposition is what makes the problem tractable — it reduces the search from 50 sequential decisions to 4-6 burst assignments.

**No army splitting.** The game mechanics require moving all troops from a tile (minus 1 left behind). You cannot split an army at a fork. This means each burst is a single non-branching path.

**Backtracking (returning partway) is not needed.** On any board with even moderate openness, optimal solutions don't require the army to retrace its steps mid-burst. The "overlap" mechanism (retracing previously-owned tiles at the start of a new burst) handles the cases where territory from different bursts is connected. Truly backtracking-dependent solutions might exist on extremely constrained boards, but none of the test boards approach this.

**The current solver works well.** All test boards solve in seconds or less. The bitmask-based filtering combined with feasibility pruning makes the problem tractable. The question is not "make it work" but "find further ways to efficiently carve through the search space."

### Key Insights from Discussion

**"Easy for humans, hard for solver"**: Corner-9x9 is the canonical example. A human immediately sees "2 exits, send bursts each way." The solver doesn't exploit this directional structure — it generates thousands of paths and brute-forces compatibility. This gap between human intuition and solver strategy is the primary motivation for spatial/structural improvements.

**Directional structure is the core insight**: The board naturally decomposes into directional sectors from the general's perspective. The solver's current approach (enumerate all paths, check compatibility) ignores this structure. Every improvement idea in this document, one way or another, tries to make the solver aware of directional structure.

**The evolution from "hard sectors" to "fuzzy affinity"**: We initially considered Voronoi-like hard sector boundaries, but recognized that walls, corridors, and board geometry make clean boundaries unrealistic. The tile affinity / contestedness model emerged as a more robust alternative — it doesn't require clean boundaries, just a measure of how strongly each tile is associated with each direction.

**Greedy as probing, not solving**: The greedy constructive approach was initially considered as an alternative solver, but reframed as a structural probing tool. Its value is in revealing the board's topology (natural arms, branch points, funnels), not in finding solutions directly.

**On the corner-9x9 constraint**: With only 2 general neighbors, at most 2 bursts can have zero overlap. This is a strong structural constraint that the solver only discovers during search (via neighbor bottleneck pruning). Pushing this reasoning earlier — to timing entry generation time — would eliminate a large fraction of the search space before search begins.

### What We Deprioritized and Why

**Oracle experiments** (giving solver the correct burst-1 path): Less valuable because we already know the solver finds solutions — the question is efficiency, not capability. Also, it would tell us "burst-1 choice matters" which we already suspect.

**Burst model optimality gap** (tick-by-tick BFS on small boards): Since we know 24 captures is the ceiling and the burst model hits it, measuring the gap has limited value. Also, naive BFS is intractable even on 7x7, so the experiment itself is hard to run.

**ASCII board visualization**: Potentially useful but likely requires extensive UI/UX iteration to find what's actually helpful to visualize. High effort, uncertain payoff. Could revisit if structural experiments produce results that need visual interpretation.

**Group ordering experiments** (trying different burst-1 length orderings): The README's "Open directions" flags this as "the biggest remaining win for corner cases." Our assessment differs: most optimal solutions can be expressed as long-to-short burst patterns, and the solver already uses this ordering. The deeper issue on constrained boards isn't ordering — it's that the solver tries too many spatially-redundant candidates regardless of order. Structural improvements (sector awareness, path dedup) address the root cause more directly. That said, if structural experiments don't pan out, revisiting group ordering is a reasonable fallback.

**Partial return / non-general-return bursts**: Since backtracking isn't needed on boards with any movement flexibility, relaxing the return-to-general constraint would add model complexity without improving results on realistic boards.

**Board difficulty prediction**: We aren't struggling with "hard boards" per se — we're seeking fundamental improvements to search efficiency. Predicting difficulty doesn't help us search better.

**Symmetry breaking**: On boards with symmetric geometry and a centrally-placed general, the solver explores mirror-image paths redundantly. Fixing the first burst's direction could cut search by up to 4x on symmetric boards. Deprioritized because most real game boards aren't symmetric, and the structural improvements we're pursuing would subsume symmetry breaking as a special case (sector decomposition naturally identifies symmetric sectors).

**Pruning ablation**: Already partially done. Current pruning rules have a smooth profile without catastrophic edge cases. Further ablation is low-priority validation, not discovery.

### Open Questions

- How clean is the sector decomposition in practice, across the full board suite? Is the contested-tile fraction consistently small enough to exploit?
- Does path mask deduplication interact well with overlap handling? (For overlap bursts, dedup is less straightforward.)
- Is the BFS tree approximation good enough for tree packing, or do graph cycles create too many cross-edges?
- Can structural pre-filtering (neighbor constraints, sector capacities) be pushed all the way into timing entry generation, or does it need to stay in the search loop?
- What is the right way to handle contested tiles in direction-aware feasibility? Count them in all sectors (optimistic, loose bound) or use a more sophisticated assignment?
