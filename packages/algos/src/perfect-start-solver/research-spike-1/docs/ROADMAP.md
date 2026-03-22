# Research Roadmap

Written after 5 sessions of research-spike-1 work. Captures the full landscape of promising directions, informed by experimental results and a planning discussion. Complements `EXPLORATION-SURVEY.md` (original ideas) and `SURVEY-DOC-CRITICAL-REVIEW.md` (critique) — this document filters those ideas through what we've learned and orients the next phase.

---

## Overview

### Performance targets

- **Primary:** sub-100ms for all boards
- **Stretch:** sub-50ms for all boards
- **Board scope:** 25x25 with strong variety of semi-realistic boards (terrain generation). Push into 30x30, ideally with similar performance. 40x40 is nice-to-have.
- **Out of scope:** Very large boards where BigInt mask size itself becomes the bottleneck (we don't yet know where this limit is).

### Thread catalog

**Profiling / Measurement**
- **1. Phase timing breakdown** — per-target timing, path-gen vs search split. Foundation for prioritizing everything else.
- **2. Timing entry utilization** — which burst patterns produce solutions? How early in the entry ordering? Fast-path potential.
- **3. Path gen profiling** — where does the 20-60ms go? Exploration vs materialization vs allocation. Prerequisite for path gen optimization.
- **4. BigInt vs Uint32Array** — constant-factor benchmark at realistic mask sizes (625-900+ bits). Reveals if there's a board-size cliff.

**Feasibility & Target Selection**
- **5. Capture-target pre-check** — skip provably infeasible capture targets before entering search. Multiple approaches from cheap to sophisticated.
- **6. Per-neighbor capacity pruning** — check whether burst sizes can be distributed across neighbors. Uses existing L3 infrastructure, no sector dependency.

**Board Structure** (three layers, each building on the previous)
- **7. Graph topology** — cut vertices, n-vertex cut sets, corridors, region decomposition. Pure graph algorithms on the terrain, independent of general position.
- **8. Directional structure** — BFS-based sector assignment, sector capacity/balance, BFS tree branching, contested tiles. How the board decomposes from the general's perspective.
- **9. Spatial path analysis** — path inclusion counts, per-neighbor affinity refinement, scarcity distribution, constrained-tile ordering. Bridges board structure and path structure. Requires path data.

**CSP / Search Structure**
- **10. Watched literals / event-driven invalidation** — inverted index (tile → candidates), propagate coverage events instead of scanning all candidates. Measurement first (quantify scan waste), then prototype.
- **11. Arc consistency (lighter forms)** — pairwise path pruning between bursts. Raw version too expensive; lighter forms (forward checking, partitioned AC) worth exploring.
- **12. Forced-move propagation** — must-capture tiles with few covering paths → forced assignment cascade. Downstream of threads 7 and 9.

**Path Generation**
- **13. Lazy path generation** — defer materialization of unused path lengths. Depends on thread 3 to know if it helps.

**Infrastructure**
- Board suite expansion — more 25x25 variety, 30x30-40x40, adversarial geometries. Needed early for credible benchmarking.

---

## Context: What the First 5 Sessions Taught Us

### Key findings

**Realistic boards are fast.** All 6 realistic 25x25 boards solve in <500ms. Four solve in 20-53ms (path gen dominates). Two tight-corner boards: 260ms and 412ms, 22 captures. The toy boards (corner-7x7, corner-9x9, corner-13x13) that initially motivated the research are synthetic worst cases, not representative.

**Path generation is a significant fixed cost.** 20-60ms on 25x25 boards. Dominates on easy boards where the solution is found on the first burst-1 candidate. For the sub-50ms stretch goal, path gen optimization is necessary.

**The specific spatial approaches tried so far haven't been the binding constraint.** Several experiments probed spatial/structural reasoning without finding large gains:
- L2 (explicit neighbor assignment): inconclusive — implementation dropped grouping; collapses to L1 on degree-2 boards regardless.
- L3 (per-neighbor spatial feasibility): zero additional prunes on all 29 boards.
- Symmetry breaking: narrow applicability — rarely fires on realistic boards with random terrain.
- Path mask redundancy: 1.2x compression — masks are nearly unique, killing the dedup line of work.

These results suggest that the solver's waste on hard boards is primarily **combinatorial** (too many compatible candidates to scan through) rather than **spatial** (too few reachable tiles). However, these experiments represent a small slice of the spatial/structural possibility space — broader approaches (sector decomposition, bottleneck detection, constraint propagation using spatial structure) remain untested.

**Candidate scanning is the bottleneck on hard boards.** L1 partitioning gave 1.28-1.41x speedup purely from scanning fewer candidates, confirming the inner loop is where time goes on corner-general boards.

**Capture-target iteration is a source of waste.** Tight-corner boards achieve 22 captures, but the solver starts at 24 and works down, exhausting all timing groups at 24 and 23 before finding anything. Each infeasible target generates timing entries, groups them, and iterates through feasibility checks — all to discover what could be known earlier. The magnitude of this waste is unknown — per-target timing (thread 1) would quantify it.

**Longest-first group ordering is already good.** Fewest-candidates-first was 3-8x worse. Short burst-1 groups have fewer candidates but trigger deeper, more expensive recursion.

**L1 is optimal on degree-2 boards.** After burst-1 claims one neighbor, exactly one partition remains. On degree-2 boards (which are all the currently hard boards), L2+ variants collapse to L1. On degree-3+ boards, L2-with-grouping could still have value — but this was never properly tested (the L2 experiment dropped grouping).

**Dropping grouping is never worth it.** Timing-entry grouping amortizes candidate scanning. Any optimization that breaks grouping must compensate with large per-search savings. (L2 failed partly because it dropped grouping.)

### What's been integrated

- **L1 neighbor partitioning** — candidates partitioned by starting neighbor, irrelevant partitions skipped. 1.3-1.4x on corner boards.
- **L3 per-neighbor pruning** — per-neighbor reachable-tile check. Zero fires on current boards, kept as cheap insurance. Produced `board-bfs.ts` and `NeighborInfo.blankMasks` infrastructure.

### What's dead

- **Path dedup (4.1):** 1.3 showed 1.2x compression — not enough to justify.
- **Tree packing (3.3) as a solver replacement:** Review argued the tree approximation is bad where you need it. However, see "Non-backtracking paths and tree structure" under Key Framings for a nuance that partially rehabilitates the underlying insight. Still dead as a solver replacement.
- **Inverted-index search (as proposed in the review):** The review's version depended on dedup shrinking domains to make the index small. With domains at 50-200K, that specific approach is dead. However, the inverted index *data structure* (tile → candidate list) is very much alive as the foundation for watched literals (thread 10) — which works on the raw domain without needing dedup. See thread 10.

---

## Key Framings

### Board structure vs path structure

Two complementary lenses for understanding the problem:

**Board structure** = properties of the terrain. Sectors, bottlenecks, corridors, how territory decomposes directionally from the general. This is about the *problem* — what the board looks like independent of the solver.

**Path structure** = properties of the candidate set. How generated paths relate to each other — spatial clustering, conflict density, diversity distribution, tile-to-path membership. This is about the *search space* — what the solver has to navigate.

Path structure can also be viewed as another angle on **search space reduction** — understanding the shape of the candidate set (not just its size) to avoid redundant or wasted exploration. Prior work on search space reduction (path dedup, coverage clustering) approached this from a "shrink the set" perspective. Path structure broadens that to "understand the set's geometry" — clustering, conflict patterns, diversity — which opens different optimization strategies even when the set can't be shrunk.

The solver currently understands neither board structure nor path structure. Most ideas in the survey target board structure. But several threads (watched literals, coverage clustering, arc consistency, conflict-count ordering) are really about path structure. The most powerful optimizations probably exploit both.

### Non-backtracking paths and tree structure

An insight from our discussion of tree packing (3.3): the review dismissed tree-based approaches because "the grid has cycles everywhere." But our paths are **non-backtracking** (self-avoiding walks), which significantly constrains them toward tree-like behavior.

The key mechanism: the early branching decision is **sticky**. When a path starts through neighbor A and takes the leftward fork, the non-backtracking constraint means it largely stays in the left region — it can't cross its own trail to switch branches. On larger boards with length-12 paths (12 tiles out of 500+), the path is too short to meander far from its initial direction.

This means the BFS tree's coarse branch structure — which direction does each burst serve, where do overlap bursts through the same neighbor diverge — is a reasonable approximation of actual path behavior, even on open boards. This doesn't resurrect tree packing as a solver (still dead), but it means tree/branch reasoning could usefully inform search ordering, burst-to-sector assignment, and understanding of overlap burst divergence within the board structure work (threads 7-9).

### Greedy strategies as exploration tools

Greedy path extension (from survey 2.2) is parked as a standalone experiment, but "greedy" approaches are a useful general-purpose tool throughout the research — both for exploration and potentially as sub-components of actual solver techniques. Quick greedy probes can reveal board topology, validate whether heuristics match optimal solutions, and build intuition about specific geometries. Beyond exploration, greedy results could feed into rigorous techniques — e.g., a greedy solution attempt could produce a coverage bound that tightens feasibility pruning, or greedy path extension could identify likely capture regions to prioritize in search ordering. Not a research thread — a technique and a framing to keep in mind across other threads.

---

## Thread Deep-Dives

**A note on follow-ups:** Some threads will naturally spawn sub-investigations and new directions as we explore them. The board structure body of work (threads 7-9) is the most likely to branch — understanding spatial structure could open several optimization paths we can't predict yet. We should stay open to unexpected follow-ups while being careful not to chase too many rabbit holes without pausing to assess where we are.

### 1. Phase Timing Breakdown

**Survey ref:** 1.2. **Pipeline phase:** All (diagnostic). **Work type:** Instrumentation.

Instrument the solver to report time per phase (path gen, timing table, search) and per capture target within search. We have partial data — path gen is 20-60ms on 25x25 — but no per-target breakdown for the search phase.

**Why it matters now:** The tight-corner boards waste time on infeasible capture targets (24, 23 before solving at 22). We don't know the split. If 60% of time is on infeasible targets, that's a different priority than if 90% is in the successful target's search. This single measurement sharpens priorities for thread 5, thread 6, thread 10, and everything in the search phase.

**Effort:** Low — half a session or less. Pure instrumentation, no algorithmic changes.

**Assessment:** Should be one of the very first things done. Almost every other decision benefits from this data. "Turn on the lights." Can be combined with thread 10's measurement step (count candidates scanned vs passing) in a single instrumentation pass to save time.

---

### 2. Timing Entry Utilization

**Survey ref:** 4.3. **Pipeline phase:** Timing/target selection. **Work type:** Measurement.

Across all boards, log which timing entries produce solutions. How early in the ordering does the winner appear? Are there common patterns?

**Why it matters:** If solutions cluster around a few timing patterns, a fast-path ("try these 5 first") could make the common case near-instant. Also reveals whether the current entry ordering is good or leaves gains on the table.

**Effort:** Low — run solver, log metadata, aggregate.

**Assessment:** Useful but secondary to thread 1. Revisit after thread 1 data is in — at that point we'll have better context for what this would tell us. Connects to thread 5 (capture-target pre-check): patterns in which targets are infeasible for certain geometries.

---

### 3. Path Gen Profiling

**Pipeline phase:** Path generation. **Work type:** Measurement.

Break down the 20-60ms path generation cost. Where does time go — DP exploration (walking the path tree)? Materialization (building PathEntry objects, computing masks, copying tile arrays)? Memory allocation?

**Why it matters:** Path gen dominates on easy 25x25 boards and is a meaningful floor on hard boards. For the sub-50ms stretch goal, we need to either make it faster or avoid doing it eagerly. But the right approach depends entirely on where the cost is:
- If exploration dominates → lazy gen doesn't help (you still walk the tree), need algorithmic improvement
- If materialization dominates → defer building PathEntry objects for unused lengths
- If allocation dominates → object pooling or structural changes

This is the prerequisite for thread 13 (lazy path gen) and any path gen optimization work.

**Effort:** Low to moderate. Needs careful measurement methodology to separate the phases.

**Assessment:** Pairs naturally with thread 1. Both are "turn on the lights" measurements for different pipeline phases.

---

### 4. BigInt vs Uint32Array

**Survey ref:** 1.1. **Pipeline phase:** Cross-cutting (constant factor). **Work type:** Benchmark.

Benchmark core bitmask operations (overlap check, popcount, union, AND-NOT) with BigInt vs Uint32Array at realistic mask sizes: 625 bits (25x25), 900 bits (30x30), and possibly larger.

**Why it matters now:** The review was skeptical at the original performance targets (most boards <200ms, constant factor doesn't matter much). With sub-100ms targets and the push to 30x30, the calculus shifts. At 900+ bits, BigInt is doing multi-word arithmetic internally. Uint32Array gives explicit control. The benchmark also reveals whether there's a board-size cliff where BigInt degrades, directly informing "how big can we go."

**Effort:** Low — self-contained benchmark, half a session. Measure the hot-path pattern (overlap check + branch + union), not just isolated ops.

**Assessment:** Quick to resolve, relevant for 30x30 target, affects everything downstream. Good early spike.

---

### 5. Capture-Target Pre-Check

**Pipeline phase:** Target selection. **Work type:** Algorithmic.

Skip provably infeasible capture targets before entering the full search loop. The waste is identified: tight-corner boards exhaust targets 24 and 23 before solving at 22.

**Approaches (cheap to expensive):**
- Total reachable blanks < target → skip (cheapest, may not fire on 25x25 with 500+ tiles)
- Run root-level feasibility on all timing entries for this target — if every entry fails at depth 0 (coveredMask = general only), skip
- Per-neighbor capacity check at the target level — can the available neighbors collectively support this many captures?

**Effort:** Low for the cheap version (a few lines). Moderate for the root-feasibility version.

**Assessment:** One of the most concrete, grounded optimizations available. The waste is identified, the mechanism is understood. Open-ended in approach — there are many angles. Best approach: 1-2 quick spikes early on (especially after thread 1 quantifies the waste), revisit with more sophistication later if needed.

**Dependency:** Thread 1 (phase timing) tells us the magnitude of the waste.

---

### 6. Per-Neighbor Capacity Pruning

**Pipeline phase:** Target/feasibility. **Work type:** Algorithmic.

Lighter-weight version of direction-aware feasibility (survey 3.1) that skips the full sector analysis. Uses existing `NeighborInfo.blankMasks` from L3 infrastructure. For a timing entry with specific burst sizes, check whether any assignment of bursts to neighbors is feasible given each neighbor's reachable territory.

**Example:** Timing entry needs two zero-overlap bursts of size 10 and 8 on a degree-2 board. Check: can neighbor A support 10 and neighbor B support 8 (or vice versa)? If neither assignment works, kill the entry.

**Why it's different from L3:** L3 checks per-candidate feasibility (does this specific burst through B have enough tiles?). Thread 6 checks per-assignment feasibility (can this timing entry's burst sizes be distributed across available neighbors?). L3 fires zero times because individual bursts always fit. Thread 6 could fire when the *combination* doesn't fit, even though each piece individually could.

**Effort:** Low — uses existing infrastructure, quick to prototype.

**Assessment:** Quick spike candidate. May not fire often on current boards (similar concern as L3), but cheap to test and stacks with thread 5.

---

### 7. Graph Topology

**Survey ref:** 2.3, 2.4. **Pipeline phase:** Pre-search analysis. **Work type:** Analysis/measurement.

Structural features of the board graph, independent of general position. Standard graph algorithms.

**Analyses:**
- **Articulation points / cut vertices:** Tiles whose removal disconnects the graph. One DFS pass (Tarjan's algorithm). Identifies chokepoints. The n=1 case of vertex cut sets.
- **n-vertex cut sets:** Generalizes articulation points — a set of n tiles whose removal disconnects the graph. Many board regions may not have single-tile chokepoints but do have 2- or 3-tile cut sets (narrow passages 2 tiles wide, etc). n=2 and n=3 are the most relevant cases.
- **Corridor detection:** Chains of tiles with exactly 2 walkable neighbors. Forced-path segments — any burst traversing this region must follow the corridor.
- **Region decomposition:** What connected regions do the cut vertices (and n-vertex cut sets) create? A board with 3 cut vertices might decompose into 4 regions of known sizes. Gives a coarse structural map.
- **Bridge edges:** Edges whose removal disconnects the graph. Related to cut vertices but sometimes more informative (a tile might not be a cut vertex but an edge from it might be a bridge).

**Why it matters:** These are hard structural facts (not heuristic), cheap to compute (one DFS pass, O(V+E)), and connect to multiple downstream ideas:
- Forced-move propagation (thread 12): bottleneck tile with few covering paths → forced assignment
- Dynamic reachability (parked B5 idea): if a cut vertex gets covered, tiles behind it become unreachable for zero-overlap bursts — cheaper than full BFS recomputation
- Board difficulty characterization: boards with many cut vertices near the general are structurally constrained

**Must-capture follow-up:** Given W walkable tiles and target C captures, slack = W - C. If a cut vertex gates K tiles and W - 1 - K < C, the tile is must-capture. On 25x25 boards with slack ~476, must-capture tiles from topology alone are rare — more relevant for constrained geometries or adversarial boards. Cheap to check once the topology analysis is done. Thread 9's path-based scarcity analysis is a complementary, finer-grained way to identify effectively-must-capture tiles.

**Effort:** Low. All standard graph algorithms, O(V+E). Half a session including analysis across the board suite.

**Assessment:** High information value. The results either validate bottleneck-based reasoning or definitively redirect away from it. Part of the board structure body of work (threads 7-9). Each layer is independently useful — this one can be done in isolation.

---

### 8. Directional Structure

**Survey ref:** 2.1, 2.5. **Pipeline phase:** Pre-search analysis. **Work type:** Analysis/measurement.

How the board decomposes from the general's perspective. BFS-based, anchored to the general's position and neighbors.

**Analyses:**
- **BFS-based sector assignment:** For each walkable tile, which neighbor is it closest to (by BFS distance from each neighbor, excluding the general)? Assign tiles to their nearest neighbor. Gives a simple hard-boundary sector map.
- **Sector capacity & balance:** How many tiles per sector? Ratio of largest to smallest. Imbalanced sectors mean one direction has much more territory — relevant for burst-to-neighbor assignment.
- **BFS tree branching:** From each neighbor, where are the major branch points? What are the subtree sizes? This tells us where overlap bursts through the same neighbor must diverge. Connects to the non-backtracking / tree structure insight (see Key Framings): self-avoiding walks are more tree-like than arbitrary walks, so the BFS tree's coarse branch structure is a reasonable approximation of actual path behavior.
- **Contested tiles:** Tiles equidistant from 2+ neighbors (ties in BFS assignment). How many? Where? These are the tiles that could be served by bursts from multiple directions.

**Why it matters:** This is the foundational "make the solver see what humans see" analysis. Answers: are boards cleanly separable into sectors? How many contested tiles? How balanced are sectors? Whether the "sector" concept is even well-defined on realistic boards with random mountains.

**Why it wasn't killed by L3's zero-prune result:** L3 tested a narrow question (does neighbor B have enough reachable tiles for one burst?). Sector analysis answers broader questions about the full spatial decomposition. L3's failure doesn't imply sectors are useless — it implies that per-neighbor reachability at the per-candidate level isn't binding. Sector-level reasoning (capacity budgets, coverage balance) operates at a different granularity.

**Effort:** Low to moderate. BFS infrastructure already exists from L3 (`NeighborInfo.blankMasks`, `board-bfs.ts`). Main work is computing the metrics and analyzing across the board suite.

**Assessment:** High information value even if the answer is "sectors aren't clean enough." Part of the board structure body of work (threads 7-9). The results either validate the spatial direction or definitively redirect away from it.

**Downstream consumers:** Thread 6 / B4-full (per-sector feasibility), sector-aware search ordering, the "degree-2 independent subproblems" idea (see Additional Ideas).

---

### 9. Spatial Path Analysis

**Survey ref:** 2.3, 3.4. **Pipeline phase:** Pre-search analysis. **Work type:** Analysis/measurement.

How generated paths distribute across the board. Requires path data (from path gen). Bridges board structure and path structure.

**Analyses:**
- **Path inclusion counts per tile:** Across all paths (all lengths), how many include tile T? Histogram of inclusion counts. Identifies scarce tiles (low count) vs flexible tiles (high count).
- **Path inclusion per neighbor per tile:** Of the paths through neighbor N, how many include tile T? Refines the BFS-based sector assignment from thread 8 — the "fuzzy affinity" version. A tile might be BFS-closest to A but reachable by more paths through B (due to terrain routing).
- **Scarcity distribution:** Are scarce tiles clustered in specific regions? Near corridors? Near the board edges? Correlation with thread 7 topology (cut vertices, corridors).
- **Per-length breakdown:** How does inclusion count vary by path length? A tile might be in many length-12 paths but few length-4 paths, which matters for specific burst sizes.

**Why it matters:** Scarce tiles constrain the solution space. A tile reachable by only 5 paths is almost a forced assignment. This directly feeds CSP ideas (thread 12: forced-move propagation) — if you know which tiles are scarce, you can propagate constraints. Even when no tile is strictly must-capture by topology (thread 7), path-based scarcity can reveal effectively-must-capture tiles.

**Effort:** Moderate. Path inclusion counts require iterating all generated paths (already available). Analysis across the board suite.

**What we'd learn:** How much scarcity variation exists on realistic boards? If most tiles have similar inclusion counts (high slack, open boards), scarcity-based ordering adds little. If there's a long tail of scarce tiles, constrained-tile-first ordering and forced-move propagation become promising.

**Potential follow-up — constrained-tile-first ordering (survey 3.4):** If this analysis reveals tiles with meaningfully different scarcity levels, a natural next step is ordering candidate paths by how many scarce tiles they cover — try paths covering the most constrained tiles first. This is lighter than thread 12 (forced-move propagation): it's a search ordering heuristic, not a propagation cascade, and works even when no tile is strictly must-capture. It sits at the intersection of board structure (scarcity data from this thread) and path structure (candidate ordering). Would be a quick follow-up if significant scarcity variation is found.

**Assessment:** Part of the board structure body of work (threads 7-9). Potentially the most directly actionable layer — if we find tiles with very low path coverage, that immediately suggests forced-move propagation or constrained-tile-first ordering.

---

### 10. Watched Literals / Event-Driven Invalidation

**Review ref:** Section 1 (watched literals). **Pipeline phase:** Search (inner loop). **Work type:** Algorithmic/architectural.

Build an inverted index: for each tile, which candidates include it? When a burst covers tiles, propagate invalidation only to affected candidates. Replaces the O(all candidates) scan with O(newly-covered-tiles × candidates-per-tile) propagation. Note: this uses the same inverted-index data structure that the review proposed for search, but applied differently — the review's version depended on dedup shrinking the index; this version works on the raw (large) candidate set.

**Rough napkin math for 25x25** (actual path counts at this scale are unknown — we only have toy-board data): ~100K candidates at length 12, each covering 12 tiles, ~500 walkable tiles → ~2400 candidates per tile. A 12-tile burst invalidates ~29K candidates via the index vs scanning all 100K. ~3x fewer checks as a rough floor. The real gain could be larger: validity state carries across timing entries within a search node (no re-scanning for the next group), and tiles near the general appear in far more candidates than distant tiles, so covering general-adjacent tiles invalidates disproportionately many candidates. Profiling (thread 1) will give real numbers.

**Implementation considerations:**
- Need push/pop bookkeeping for backtracking (undo invalidations when the solver backtracks)
- Current approach (flat scan + bitmask check) is simple and cache-friendly
- A simplified prototype (rebuild index at each depth, no push/pop) could validate the gains before building the full version

**Measurement-first approach:** Before building anything, instrument the current inner loop to count candidates scanned vs candidates that pass the overlap check, per search node. If 95%+ of scans are wasted rejections, the case is strong. If it's only 60%, the overhead might eat the gains. This measurement is relevant context for the whole CSP section — it quantifies how much the inner loop wastes on dead candidates.

**Effort:** Moderate for measurement, significant for full implementation. Well-scoped despite the architectural change.

**Assessment:** Potentially a large constant-factor win on the search inner loop. The measurement step is cheap and definitive — it tells us the ceiling before we build anything. Worth an early measurement spike, then prototype if signal is strong.

---

### 11. Arc Consistency (Lighter Forms)

**Review ref:** Section 1 (biggest omission). **Pipeline phase:** Search. **Work type:** Algorithmic (research).

The solver is implicitly a CSP: bursts are variables, candidate paths are domains, spatial compatibility is the constraint. Arc consistency (AC-3) prunes paths incompatible with ALL paths in another burst's domain.

**The problem:** Raw AC-3 is O(d1 × d2) per burst pair. With domains of 50-200K, that's 10^9+ operations. Too expensive.

**Lighter forms worth exploring:**
- **Forward checking:** after committing burst-1, verify burst-2 has at least one compatible candidate before recursing. The solver partially does this via feasibility checks, but doesn't do an exact check.
- **Single-pass AC on partitioned domains:** L1 already splits by starting neighbor. AC within a single partition (much smaller domain) might be tractable.
- **Batch compatibility via bitmask tricks:** instead of pairwise path checks, compute "conflict signature" per path and use bitwise ops to batch-check compatibility.

**Effort:** Full session to prototype and evaluate. Need to find the sweet spot between "cheap loose feasibility" and "expensive exact AC."

**Assessment:** The most intellectually interesting idea in the CSP cluster. Large domains make the raw version impractical, but lighter forms could find a useful middle ground. Worth a spike to explore.

---

### 12. Forced-Move Propagation

**Review ref:** Section 3 (underexplored connections). **Pipeline phase:** Search. **Work type:** Algorithmic.

If a must-capture tile T is reachable by only K paths (K small), one must be chosen. Try each, propagate resulting coverage, check for further forced assignments. CSP unit propagation / look-ahead.

**Why it's exciting:** On tightly constrained boards, a cascade of forced assignments could determine the solution with minimal backtracking.

**Why it's conditional:** Requires must-capture tiles with low path coverage — which requires low slack and scarce tiles (threads 7 and 9). On open 25x25 boards with slack ~476, nothing is must-capture. Only fires on constrained boards.

**Effort:** Depends on threads 7 and 9 results.

**Assessment:** Not a standalone thread. Falls out naturally if threads 7 and 9 reveal the right structure. Should be viewed as a downstream consumer of board structure analysis, not pursued independently.

---

### 13. Lazy Path Generation

**Review ref:** Section 1 (conspicuously absent). **Pipeline phase:** Path generation. **Work type:** Architectural.

Generate paths on demand instead of eagerly. Multiple versions:
- **Simple:** Skip materializing PathEntry objects for lengths not needed by current timing entries. Saves allocation, not exploration.
- **Medium:** Generate paths incrementally by length. Defer short-path materialization. If burst-1 (long) succeeds immediately, skip building entries for shorter lengths.
- **Hard:** Demand-driven generation guided by search state. Fundamentally different architecture.

**Key constraint:** The DP builds paths bottom-up (length L from length L-1). You can't generate long paths without first exploring the tree through shorter intermediates. The exploration cost is unavoidable. The lever is deferring *materialization* (building PathEntry objects) for lengths you don't need yet.

**Whether this helps depends entirely on thread 3:** if exploration dominates the 20-60ms cost, lazy materialization saves little. If materialization/allocation dominates, it could be significant.

**Effort:** Medium version is moderate. Hard version is a major rearchitecture.

**Assessment:** Needed for the sub-50ms stretch goal on easy boards (where path gen is the bottleneck). But thread 3 profiling is the prerequisite — no point designing a solution without understanding the cost breakdown. There may also be straightforward optimization work (better allocation, reduced copying) that grinds down path gen without restructuring.

---

## Additional Ideas (from review discussion)

Ideas surfaced during the sub-agent review of this roadmap. Not yet developed into full threads — captured here for future reference.

### CDCL / Nogood Recording

When a search branch fails, record *which* coverage pattern caused the failure and avoid that combination in future branches. E.g., if burst-1 covering tiles {X, Y, Z} leads to failure because no burst-2 candidate is compatible, record that nogood — and skip any other burst-1 candidate whose mask is a superset of {X, Y, Z} (since it would fail for the same reason).

This is standard in modern SAT/CSP solvers and is orthogonal to the other CSP techniques (threads 10, 11, 12). The main question is practical overhead: nogoods accumulate during search, and checking whether a new candidate matches any recorded nogood requires superset checks against potentially many stored masks. Whether the pruning gains outweigh the bookkeeping cost depends on how often the same conflict pattern recurs across different search branches.

**Status:** Noted, not yet evaluated. Worth considering during any CSP/search structure work.

### Degree-2 Decomposition as Independent Subproblems

On degree-2 boards (all current hard boards), the two sectors are nearly independent — burst-1 goes one way, burst-2 goes the other. L1 already exploits this by filtering candidates by starting neighbor. But the idea goes further: independently enumerate what's achievable through each neighbor (which burst sizes can each sector support?), then combine compatible pairs. This reframes the search from "try assignments and backtrack" to "compute per-sector capabilities and match."

This is concretely motivated by degree-2 structure and related to thread 8 (directional structure). Whether it generalizes to degree-3+ is unclear.

**Status:** Noted. Could surface naturally during board structure work (thread 8) or feasibility improvements (thread 6).

### Solution-Symmetry on Same-Length Bursts

When two zero-overlap bursts in a timing entry have the same length (e.g., [10, 10, 4]), "10 through A then 10 through B" covers the same total territory as "10 through B then 10 through A." This is genuine symmetry that holds regardless of board geometry. However, same-length burst pairs are a narrow subset of timing entries, and the savings would be small (skip one of two assignments). For different-length bursts, the assignments are NOT symmetric — different territory at different lengths — so there's no safe symmetry to break. The broader "solution symmetry" idea from the review reduces to board symmetry in the general case, which was already analyzed and deprioritized.

**Status:** Unlikely to be useful. Not worth a thread. Noted for completeness.

---

## Infrastructure

### Board Suite Expansion

The current test suite has 29 simple boards (7x7-13x13) and 6 realistic boards (25x25). The sub-100ms target needs to be measured against a representative set.

**What to add:**
- 4-5 more realistic 25x25 boards with terrain generation — variety of general positions, mountain densities
- 5-10 boards in the 30x30-40x40 range — this is the primary scaling target
- Some adversarial geometries — constrained generals, narrow corridors near the general, asymmetric neighbor territories (the geometry that would make L3/thread 6 fire)

**When:** Early. Every experiment is more credible with a representative board suite. Generate the boards once, use them throughout.

---

## Resolved Threads

### Integrated into solver

| Thread | Key finding |
|--------|-------------|
| **L1 neighbor partitioning** | 1.3-1.4x on corner boards. Candidates partitioned by starting neighbor, irrelevant partitions skipped. Optimal on degree-2. |
| **L3 per-neighbor pruning** | Zero fires on current boards. Kept as cheap insurance. Produced `board-bfs.ts` and `NeighborInfo.blankMasks` infrastructure. |

### Completed experiments (not integrated)

| Thread | Result | Key finding |
|--------|--------|-------------|
| **Path mask redundancy (1.3)** | Neutral | 1.2x compression — masks nearly unique. Non-backtracking paths on grids are ~1:1 with bitmasks. Killed the dedup line of work but produced useful neighbor distribution data. |
| **Group ordering** | Negative | Fewest-candidates-first 3-8x worse. Longest-first is already good — long burst-1 front-loads coverage. Other orderings (interleaving, board-structure-informed) are conceivable but nothing concrete; likely to be subsumed by improvements from other threads. |
| **Symmetry breaking** | Low priority | Thorough analysis. BFS territory comparison under reflection is the correct detection approach. But narrow applicability on realistic boards with random mountains. Most interesting follow-up: BFS territory comparison could be a cheap pre-check on boards where it does fire (see `findings/3.21-symmetry-breaking-analysis.md`). Solution-level symmetry (same-length bursts through different neighbors) is a narrow special case — see "Additional Ideas" section. |
| **L2 neighbor assignment** | Inconclusive | Implementation dropped grouping (design error), causing regressions. L2-with-grouping was never tested. Collapses to L1 on degree-2 boards regardless. Could still have value on degree-3+ boards if properly implemented with grouping preserved. |

### Dead

| Thread | Why |
|--------|-----|
| **Path dedup (4.1)** | Killed by 1.3 — only 1.2x compression, not worth it. |
| **Tree packing (3.3) as solver** | Tree approximation is bad where you need it. Non-backtracking insight partially rehabilitates the idea as an analytical tool (see Key Framings) but still dead as a solver replacement. |
| **Inverted-index search (review's version)** | Depended on dedup shrinking domains. Dead as proposed. The inverted index data structure itself is alive as the foundation for watched literals (thread 10). |

### Parked

| Thread | Status | Notes |
|--------|--------|-------|
| **Coverage clustering (4.2)** | Mechanism suspect | Threshold tuning problem. But the underlying observation (solver grinds through near-duplicate candidates) is valid — folds into "path structure" lens. Could be addressed through lighter approaches (diversity ordering, skip-ahead after rejection). Note: thread 10 (watched literals) may be a cleaner solution to the same underlying problem — event-driven invalidation naturally handles near-duplicate candidates that share covered tiles. |
| **Greedy probing (2.2)** | Not standalone | Parked as a dedicated experiment. Greedy strategies live on as a general-purpose technique / framing (see Key Framings). |
| **Solution census (4.4)** | Tractability concerns | Exhaustive enumeration likely intractable even on 7x7. Possible as a small-board validation tool (confirm must-capture tiles, validate solver for sub-24 solutions on tiny boards). Not a priority. |
| **Flow/matching/planarity** | Theoretical | Full treewidth-based approach out of scope. Conflict graph as analysis tool noted under path structure. |
| **Dynamic BFS feasibility (B5)** | Expensive, better alternatives | BFS recomputation per search node is costly. The useful kernel (detecting when coverage creates unreachable regions) is better addressed through cut-vertex analysis (thread 7). |
| **B4-full (direction-aware feasibility with sectors)** | Deferred | Needs thread 8 results first. Thread 6 is the sector-free version to try first. |
