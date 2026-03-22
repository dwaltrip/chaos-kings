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
- A1: Phase timing breakdown
- A2: Timing entry utilization
- E14: Path gen profiling
- F15: BigInt vs Uint32Array

**Feasibility & Target Selection**
- B3: Capture-target pre-check
- B4-light: Per-neighbor capacity pruning

**Board Structure** (one body of work)
- C6: Sector/affinity decomposition
- C7: Tile scarcity & bottlenecks
- C8: Must-capture analysis
- C9: BFS tree structure (folded into C6/C7)

**CSP / Search Structure**
- D10: Arc consistency (lighter forms)
- D11: Watched literals / event-driven invalidation
- D12: Forced-move propagation (downstream of C7/C8)

**Path Generation**
- E13: Lazy path generation

**Also needed:** Board suite expansion (more 25x25, 30x30+, adversarial geometries).

---

## Context: What the First 5 Sessions Taught Us

### Key findings

**Realistic boards are fast.** All 6 realistic 25x25 boards solve in <500ms. Four solve in 20-53ms (path gen dominates). Two tight-corner boards: 260ms and 412ms, 22 captures. The toy boards (corner-7x7, corner-9x9, corner-13x13) that initially motivated the research are synthetic worst cases, not representative.

**Path generation is a significant fixed cost.** 20-60ms on 25x25 boards. Dominates on easy boards where the solution is found on the first burst-1 candidate. For the sub-50ms stretch goal, path gen optimization is necessary.

**The spatial dimension is not the binding constraint (so far).** Multiple independent experiments converged:
- L2 (explicit neighbor assignment): negative result — no improvement over L1 on degree-2 boards.
- L3 (per-neighbor spatial feasibility): zero additional prunes on all 29 boards.
- Symmetry breaking: narrow applicability — rarely fires on realistic boards with random terrain.
- Path mask redundancy: 1.2x compression — masks are nearly unique, killing the dedup line of work.

The solver's waste is **combinatorial** (too many compatible candidates to scan through), not **spatial** (too few reachable tiles).

**Candidate scanning is the bottleneck on hard boards.** L1 partitioning gave 1.28-1.41x speedup purely from scanning fewer candidates, confirming the inner loop is where time goes on corner-general boards.

**Capture-target iteration is a source of waste.** Tight-corner boards achieve 22 captures, but the solver starts at 24 and works down, exhausting all timing groups at 24 and 23 before finding anything. Each infeasible target generates timing entries, groups them, and iterates through feasibility checks — all to discover what could be known earlier. The magnitude of this waste is unknown — per-target timing (A1) would quantify it.

**Longest-first group ordering is already good.** Fewest-candidates-first was 3-8x worse. Short burst-1 groups have fewer candidates but trigger deeper, more expensive recursion.

**L1 is optimal on degree-2 boards.** After burst-1 claims one neighbor, exactly one partition remains. No variant of L2 or beyond can improve on this for the boards that are currently hard.

**Dropping grouping is never worth it.** Timing-entry grouping amortizes candidate scanning. Any optimization that breaks grouping must compensate with large per-search savings. (L2 failed partly because it dropped grouping.)

### What's been integrated

- **L1 neighbor partitioning** — candidates partitioned by starting neighbor, irrelevant partitions skipped. 1.3-1.4x on corner boards.
- **L3 per-neighbor pruning** — per-neighbor reachable-tile check. Zero fires on current boards, kept as cheap insurance. Produced `board-bfs.ts` and `NeighborInfo.blankMasks` infrastructure.

### What's dead

- **Path dedup (4.1):** 1.3 showed 1.2x compression — not enough to justify.
- **Tree packing (3.3) as a solver replacement:** Review argued the tree approximation is bad where you need it. However, the underlying insight (non-backtracking paths are more tree-like than arbitrary walks) is worth noting — the early branching decision is "sticky" because self-avoiding walks can't cross their own trail. This observation may be useful within board structure analysis but doesn't warrant a standalone thread.
- **Inverted-index search:** Depended on dedup shrinking domains. Dead.

---

## Key Framings

### Board structure vs path structure

Two complementary lenses for understanding the problem:

**Board structure** = properties of the terrain. Sectors, bottlenecks, corridors, how territory decomposes directionally from the general. This is about the *problem* — what the board looks like independent of the solver.

**Path structure** = properties of the candidate set. How generated paths relate to each other — spatial clustering, conflict density, diversity distribution, tile-to-path membership. This is about the *search space* — what the solver has to navigate.

The solver currently understands neither. Most ideas in the survey target board structure. But several threads (watched literals, coverage clustering, arc consistency, conflict-count ordering) are really about path structure. The most powerful optimizations probably exploit both.

Several threads map to both lenses. Board structure analysis (C6/C7) reveals terrain properties; path structure analysis reveals how those properties manifest in the candidate set the solver actually works with.

### Broad-then-deep strategy

The first 5 sessions went deep on one branch (neighbor partitioning L1→L2→L3) plus targeted pokes (group ordering, symmetry, path redundancy). That depth produced definitive answers but left large swaths untouched.

Next phase: **broad initial coverage** across the top threads. For each, do enough work to get a signal (promising / neutral / dead), then go deep on the 2-3 winners. Each mini-spike should have a concrete hypothesis and a measurable outcome. Target 3-5 sessions of broad exploration, then depth.

---

## Thread Deep-Dives

### A1: Phase Timing Breakdown

**Survey ref:** 1.2. **Pipeline phase:** All (diagnostic). **Work type:** Instrumentation.

Instrument the solver to report time per phase (path gen, timing table, search) and per capture target within search. We have partial data — path gen is 20-60ms on 25x25 — but no per-target breakdown for the search phase.

**Why it matters now:** The tight-corner boards waste time on infeasible capture targets (24, 23 before solving at 22). We don't know the split. If 60% of time is on infeasible targets, that's a different priority than if 90% is in the successful target's search. This single measurement sharpens priorities for B3, B4, D11, and everything in the search phase.

**Effort:** Low — half a session or less. Pure instrumentation, no algorithmic changes.

**Assessment:** Should be one of the very first things done. Almost every other decision benefits from this data. "Turn on the lights."

---

### A2: Timing Entry Utilization

**Survey ref:** 4.3. **Pipeline phase:** Timing/target selection. **Work type:** Measurement.

Across all boards, log which timing entries produce solutions. How early in the ordering does the winner appear? Are there common patterns?

**Why it matters:** If solutions cluster around a few timing patterns, a fast-path ("try these 5 first") could make the common case near-instant. Also reveals whether the current entry ordering is good or leaves gains on the table.

**Effort:** Low — run solver, log metadata, aggregate.

**Assessment:** Useful but secondary to A1. Revisit after A1 data is in — at that point we'll have better context for what this would tell us. Connects to B3 (capture-target pre-check): patterns in which targets are infeasible for certain geometries.

---

### E14: Path Gen Profiling

**Pipeline phase:** Path generation. **Work type:** Measurement.

Break down the 20-60ms path generation cost. Where does time go — DP exploration (walking the path tree)? Materialization (building PathEntry objects, computing masks, copying tile arrays)? Memory allocation?

**Why it matters:** Path gen dominates on easy 25x25 boards and is a meaningful floor on hard boards. For the sub-50ms stretch goal, we need to either make it faster or avoid doing it eagerly. But the right approach depends entirely on where the cost is:
- If exploration dominates → lazy gen doesn't help (you still walk the tree), need algorithmic improvement
- If materialization dominates → defer building PathEntry objects for unused lengths
- If allocation dominates → object pooling or structural changes

This is the prerequisite for E13 (lazy path gen) and any path gen optimization work.

**Effort:** Low to moderate. Needs careful measurement methodology to separate the phases.

**Assessment:** Pairs naturally with A1. Both are "turn on the lights" measurements for different pipeline phases.

---

### F15: BigInt vs Uint32Array

**Survey ref:** 1.1. **Pipeline phase:** Cross-cutting (constant factor). **Work type:** Benchmark.

Benchmark core bitmask operations (overlap check, popcount, union, AND-NOT) with BigInt vs Uint32Array at realistic mask sizes: 625 bits (25x25), 900 bits (30x30), and possibly larger.

**Why it matters now:** The review was skeptical at the original performance targets (most boards <200ms, constant factor doesn't matter much). With sub-100ms targets and the push to 30x30, the calculus shifts. At 900+ bits, BigInt is doing multi-word arithmetic internally. Uint32Array gives explicit control. The benchmark also reveals whether there's a board-size cliff where BigInt degrades, directly informing "how big can we go."

**Effort:** Low — self-contained benchmark, half a session. Measure the hot-path pattern (overlap check + branch + union), not just isolated ops.

**Assessment:** Quick to resolve, relevant for 30x30 target, affects everything downstream. Good early spike.

---

### B3: Capture-Target Pre-Check

**Pipeline phase:** Target selection. **Work type:** Algorithmic.

Skip provably infeasible capture targets before entering the full search loop. The waste is identified: tight-corner boards exhaust targets 24 and 23 before solving at 22.

**Approaches (cheap to expensive):**
- Total reachable blanks < target → skip (cheapest, may not fire on 25x25 with 500+ tiles)
- Run root-level feasibility on all timing entries for this target — if every entry fails at depth 0 (coveredMask = general only), skip
- Per-neighbor capacity check at the target level — can the available neighbors collectively support this many captures?

**Effort:** Low for the cheap version (a few lines). Moderate for the root-feasibility version.

**Assessment:** One of the most concrete, grounded optimizations available. The waste is identified, the mechanism is understood. Open-ended in approach — there are many angles. Best approach: 1-2 quick spikes early on (especially after A1 quantifies the waste), revisit with more sophistication later if needed.

**Dependency:** A1 (phase timing) tells us the magnitude of the waste.

---

### B4-light: Per-Neighbor Capacity Pruning

**Pipeline phase:** Target/feasibility. **Work type:** Algorithmic.

Lighter-weight version of direction-aware feasibility (survey 3.1) that skips the full sector analysis. Uses existing `NeighborInfo.blankMasks` from L3 infrastructure. For a timing entry with specific burst sizes, check whether any assignment of bursts to neighbors is feasible given each neighbor's reachable territory.

**Example:** Timing entry needs two zero-overlap bursts of size 10 and 8 on a degree-2 board. Check: can neighbor A support 10 and neighbor B support 8 (or vice versa)? If neither assignment works, kill the entry.

**Why it's different from L3:** L3 checks per-candidate feasibility (does this specific burst through B have enough tiles?). B4-light checks per-assignment feasibility (can this timing entry's burst sizes be distributed across available neighbors?). L3 fires zero times because individual bursts always fit. B4-light could fire when the *combination* doesn't fit, even though each piece individually could.

**Effort:** Low — uses existing infrastructure, quick to prototype.

**Assessment:** Quick spike candidate. May not fire often on current boards (similar concern as L3), but cheap to test and stacks with B3.

---

### C6: Sector/Affinity Decomposition

**Survey ref:** 2.1. **Pipeline phase:** Pre-search analysis. **Work type:** Analysis/measurement.

For each tile, compute directional affinity — BFS distance from each neighbor, path inclusion counts per neighbor, exclusive reachability. Derive per-tile metrics: affinity strength (how clearly owned by one direction) and contestedness (how many directions compete).

**Why it matters:** This is the foundational "make the solver see what humans see" analysis. Every spatial improvement in the survey traces back to understanding how the board decomposes directionally. It answers: are boards cleanly separable into sectors? How many contested tiles? How balanced are sectors?

**What we'd learn:**
- Whether sectors are clean enough to exploit (80% clearly-owned, 20% contested? or 50/50?)
- Whether sector balance predicts difficulty
- Whether the "sector" concept is even well-defined on realistic boards with random mountains
- Data that informs B4-full (direction-aware feasibility with sectors), if we go there later

**Why it wasn't killed by L3's zero-prune result:** L3 tested a narrow question (does neighbor B have enough reachable tiles for one burst?). Sector analysis answers broader questions about the full spatial decomposition. L3's failure doesn't imply sectors are useless — it implies that per-neighbor reachability at the per-candidate level isn't binding. Sector-level reasoning (capacity budgets, coverage balance) operates at a different granularity.

**Effort:** Moderate — build metrics, run across board suite, study results. Maybe a full session.

**Assessment:** High information value even if the answer is "sectors aren't clean enough." Part of the board structure body of work (C6+C7+C8). The results either validate the spatial direction or definitively redirect away from it.

---

### C7: Tile Scarcity & Bottlenecks

**Survey ref:** 2.3. **Pipeline phase:** Pre-search analysis. **Work type:** Analysis/measurement.

For each tile: path inclusion count (how many paths cover it), bottleneck score (articulation point / cut vertex detection — does removing this tile disconnect regions from the general?), corridor membership.

**Why it matters:** Scarce tiles constrain the solution space. A tile reachable by only 5 paths is almost a forced assignment. Bottleneck tiles that gate access to regions are structural features the solver is blind to. This directly feeds CSP ideas (D12: forced-move propagation) — if you know which tiles are scarce, you can propagate constraints.

**Articulation points / cut vertices** are especially interesting. They're cheap to compute (one DFS pass), they're hard structural facts (not heuristic), and they connect to multiple downstream ideas:
- Forced-move propagation (D12): bottleneck tile with few covering paths → forced assignment
- Dynamic reachability (parked B5 idea): if a cut vertex gets covered, tiles behind it become unreachable for zero-overlap bursts — cheaper than full BFS recomputation
- Board difficulty prediction: boards with many cut vertices near the general are structurally constrained

**Effort:** Moderate. Path inclusion counts fall out of existing path data. Bottleneck detection is standard graph algorithms. Natural to combine with C6 in the same session(s).

**Assessment:** Pairs with C6 as part of the board structure body of work. Potentially more directly actionable than C6 — if we find tiles with very low path coverage, that immediately suggests forced-move propagation.

---

### C8: Must-Capture Analysis

**Survey ref:** 2.4. **Pipeline phase:** Pre-search analysis. **Work type:** Analysis.

Given W walkable tiles and target C captures, slack = W - C. For each tile: is it possible to achieve C captures without it? Quick version: if a tile gates K tiles (bottleneck from C7) and W - 1 - K < C, it's must-capture.

**Why it matters:** Must-capture tiles are hard constraints identifiable before search. On tight boards (low slack), many tiles are must-capture, which constrains which paths are viable. Feeds D12.

**Realistic assessment:** On 25x25 boards with 500+ walkable tiles and 22-24 captures, slack is ~476+. Must-capture tiles are rare in this regime. More relevant for boards with heavy mountains, corridors, or constrained geometries. Could become important as we add adversarial boards to the test suite.

**Effort:** Low — builds directly on C7 bottleneck data.

**Assessment:** Narrower sub-topic within the board structure body of work. Cheap to check once C7 is done. Worth measuring even if it doesn't fire on current boards — it tells us about the constraint landscape.

---

### C9: BFS Tree Structure

**Survey ref:** 2.5. **Pipeline phase:** Pre-search analysis. **Work type:** Analysis.

Build BFS trees from the general / each neighbor. Measure branching factors, subtree sizes, branch points.

**Assessment:** Folded into C6/C7 work, not a standalone thread. The original motivation (tree packing 3.3) is dead as a solver replacement. However, the non-backtracking insight is worth noting: self-avoiding walks are more tree-like than arbitrary walks because the early branching decision is "sticky" — the path can't cross its own trail to switch branches. This means the BFS tree's coarse branch structure (which direction does each burst serve?) is a reasonable approximation even on open boards with cycles. This observation lives within C6/C7 analysis and could inform how we think about burst-to-sector assignment.

---

### D10: Arc Consistency (Lighter Forms)

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

### D11: Watched Literals / Event-Driven Invalidation

**Review ref:** Section 1 (watched literals). **Pipeline phase:** Search (inner loop). **Work type:** Algorithmic/architectural.

Build an inverted index: for each tile, which candidates include it? When a burst covers tiles, propagate invalidation only to affected candidates. Replaces the O(all candidates) scan with O(newly-covered-tiles × candidates-per-tile) propagation.

**Napkin math for 25x25:** ~100K candidates at length 12, each covering 12 tiles, ~500 walkable tiles → ~2400 candidates per tile. A 12-tile burst invalidates ~29K candidates via the index vs scanning all 100K. ~3x fewer checks. Additionally, validity state carries across timing entries within a search node — no re-scanning for the next group.

**Implementation considerations:**
- Need push/pop bookkeeping for backtracking (undo invalidations when the solver backtracks)
- Current approach (flat scan + bitmask check) is simple and cache-friendly
- A simplified prototype (rebuild index at each depth, no push/pop) could validate the gains before building the full version

**Measurement-first approach:** Before building anything, instrument the current inner loop to count candidates scanned vs candidates that pass the overlap check, per search node. If 95%+ of scans are wasted rejections, the case is strong. If it's only 60%, the overhead might eat the gains.

**Effort:** Moderate for measurement, significant for full implementation. Well-scoped despite the architectural change.

**Assessment:** Potentially a large constant-factor win on the search inner loop. The measurement step is cheap and definitive — it tells us the ceiling before we build anything. Worth an early measurement spike, then prototype if signal is strong.

---

### D12: Forced-Move Propagation

**Review ref:** Section 3 (underexplored connections). **Pipeline phase:** Search. **Work type:** Algorithmic.

If a must-capture tile T is reachable by only K paths (K small), one must be chosen. Try each, propagate resulting coverage, check for further forced assignments. CSP unit propagation / look-ahead.

**Why it's exciting:** On tightly constrained boards, a cascade of forced assignments could determine the solution with minimal backtracking.

**Why it's conditional:** Requires must-capture tiles with low path coverage — which requires low slack and scarce tiles (C7/C8 analysis). On open 25x25 boards with slack ~476, nothing is must-capture. Only fires on constrained boards.

**Effort:** Depends on C7/C8 results.

**Assessment:** Not a standalone thread. Falls out naturally if C7/C8 reveals the right structure. Should be viewed as a downstream consumer of board structure analysis, not pursued independently.

---

### E13: Lazy Path Generation

**Review ref:** Section 1 (conspicuously absent). **Pipeline phase:** Path generation. **Work type:** Architectural.

Generate paths on demand instead of eagerly. Multiple versions:
- **Simple:** Skip materializing PathEntry objects for lengths not needed by current timing entries. Saves allocation, not exploration.
- **Medium:** Generate paths incrementally by length. Defer short-path materialization. If burst-1 (long) succeeds immediately, skip building entries for shorter lengths.
- **Hard:** Demand-driven generation guided by search state. Fundamentally different architecture.

**Key constraint:** The DP builds paths bottom-up (length L from length L-1). You can't generate long paths without first exploring the tree through shorter intermediates. The exploration cost is unavoidable. The lever is deferring *materialization* (building PathEntry objects) for lengths you don't need yet.

**Whether this helps depends entirely on E14:** if exploration dominates the 20-60ms cost, lazy materialization saves little. If materialization/allocation dominates, it could be significant.

**Effort:** Medium version is moderate. Hard version is a major rearchitecture.

**Assessment:** Needed for the sub-50ms stretch goal on easy boards (where path gen is the bottleneck). But E14 profiling is the prerequisite — no point designing a solution without understanding the cost breakdown. There may also be straightforward optimization work (better allocation, reduced copying) that grinds down path gen without restructuring.

---

### Board Suite Expansion

Not an experiment, but essential infrastructure. The current test suite has 29 simple boards (7x7-13x13) and 6 realistic boards (25x25). The sub-100ms target needs to be measured against a representative set.

**What to add:**
- 4-5 more realistic 25x25 boards with terrain generation — variety of general positions, mountain densities
- 5-10 boards in the 30x30-40x40 range — this is the primary scaling target
- Some adversarial geometries — constrained generals, narrow corridors near the general, asymmetric neighbor territories (the geometry that would make L3/B4 fire)

**When:** Early. Every experiment is more credible with a representative board suite. Generate the boards once, use them throughout.

---

## Resolved Threads

### Completed (results integrated)

| Thread | Key finding |
|--------|-------------|
| **L1 neighbor partitioning** | 1.3-1.4x on corner boards. Integrated. Optimal on degree-2. |
| **L3 per-neighbor pruning** | Zero fires. Integrated as cheap insurance. Produced `board-bfs.ts`, `NeighborInfo.blankMasks`. |
| **Path mask redundancy (1.3)** | 1.2x compression. Masks nearly unique — non-backtracking paths on grids are ~1:1 with bitmasks. |
| **Group ordering** | Fewest-candidates-first 3-8x worse. Longest-first is already good. |
| **Symmetry breaking** | Thorough analysis. BFS territory comparison is the correct approach, but narrow applicability on realistic boards. |
| **L2 neighbor assignment** | Negative result — dropped grouping, collapses to L1 on degree-2. |

### Dead

| Thread | Why |
|--------|-----|
| **Path dedup (4.1)** | Killed by 1.3 — only 1.2x compression, not worth it. |
| **Tree packing (3.3) as solver** | Tree approximation is bad where you need it. Non-backtracking insight noted but doesn't warrant standalone thread. |
| **Inverted-index search** | Depended on dedup shrinking domains. Dead. |

### Parked

| Thread | Status | Notes |
|--------|--------|-------|
| **Coverage clustering (4.2)** | Mechanism suspect | Threshold tuning problem. But the underlying observation (solver grinds through near-duplicate candidates) is valid — folds into "path structure" lens. |
| **Greedy probing (2.2)** | Needs falsifiable hypothesis | Useful as a general exploration/visualization technique across sub-problems, not a standalone experiment. |
| **Solution census (4.4)** | Tractability concerns | Possible small-board validation tool (confirm must-capture tiles, validate solver for sub-24 solutions). Not a priority. |
| **Flow/matching/planarity** | Theoretical, no practical path | Full treewidth-based approach out of scope. Conflict graph as analysis tool noted under path structure. |
| **Dynamic BFS feasibility (B5)** | Expensive, better alternatives | BFS recomputation per search node is costly. The useful kernel (detecting when coverage creates unreachable regions) is better addressed through cut-vertex analysis (C7). |
| **B4-full (direction-aware feasibility with sectors)** | Deferred | Needs C6 results first. B4-light is the sector-free version to try first. |
