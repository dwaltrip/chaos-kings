# Algorithm Review — SA and NRPA

Review of search algorithms presented in Doc 1 (Search Algorithms for the
Expansion Problem). Each algorithm's assumptions are validated against the
actual game mechanics.

Companion to: bounds-review-notes.md

---

## Simulated Annealing on Move Sequences

### Representation

A solution is a flat array of T=50 moves. Each entry is (source_tile,
direction) or WAIT.

**Validated assumptions:**

- Exactly one move per tick, or WAIT. If no tile has >1 army, WAIT is
  the only option — this is not a design choice, it's forced.
- (source_tile, direction) is sufficient as minimal input, but move
  validity requires board state: (a) player owns source, (b) source has
  >1 army, (c) target tile is passable, (d) target is within board
  boundaries.
- T=50 is fixed for this project. The move array is always length 50.

**No issues found.** The representation maps cleanly to the problem.

### Neighborhood Operator

Pick random tick t, simulate to t, pick a different legal move, re-simulate
from t forward.

**Validated assumptions:**

- Game is fully deterministic. Given a state and a move, the next state
  is uniquely determined. Confirmed.
- Treat-illegal-as-wait is always safe. Doing nothing is always a legal
  move. Confirmed.
- Re-simulation requires a correct simulator. SA calls the simulator
  more intensively than most approaches (millions of partial
  re-simulations), so simulator performance matters. But it's the same
  simulator used everywhere — no special requirements.

**No issues found.**

### Evaluation

Score = tiles owned at tick T. The doc correctly identifies this as the
sole objective.

**No issues found.**

### Cooling Schedule

**One flag: the doc's temperature guidance may be miscalibrated.**

The doc suggests T₀ ≈ 1.0, calibrated so a score decrease of 1 is
accepted ~37% of the time. This assumes typical neighbor score deltas
are small (1-3 tiles).

**Problem:** Changing a single move that disrupts a burst chain can void
all downstream moves that depended on it. Score swings of 5-10+ tiles
are possible from a single-move change. If typical bad-neighbor deltas
are -5 to -10, then exp(-10 / 1.0) ≈ 0.00005 — the algorithm
degenerates into pure hill-climbing immediately, losing its ability to
escape local optima.

**The delta distribution is likely bimodal:** most single-move changes
are small (redirecting a small army, changing a wait to a move), but
some are catastrophic (breaking a burst chain). The right T₀ depends
on the actual distribution.

**Recommendation:** Empirically sample a few hundred random neighbors
early in development and examine the delta distribution. Calibrate T₀
and α from observed data, not from the doc's defaults. This is not a
correctness issue — SA will still work — but getting temperature wrong
wastes most of the compute budget.

### Overall Assessment

**SA's mapping to this problem is clean.** No problematic assumptions.
The only flag is temperature calibration, which is straightforwardly
empirical. SA is the safest first implementation — minimal design
decisions, and any issues reveal themselves quickly through
experimentation.

---

## Nested Rollout Policy Adaptation (NRPA)

### Core Algorithm

NRPA's recursive structure maps cleanly: deterministic game, fixed-length
playouts of 50 moves, softmax sampling over legal moves, policy gradient
adaptation after each playout, recursive nesting with policy copies at
each level.

**No issues with the core algorithm.** Simulator requirements are the
same as SA.

### Policy Representation — Significant Concern

**The doc's suggested (tile, direction) feature representation is too
lossy for this problem.**

The doc proposes one weight per (tile, direction) pair. For 7×7 with 4
directions + wait: ~245 weights.

**Why this is problematic:** Move quality in the expansion problem is
highly state-dependent. The same tile-direction pair can be great or
terrible depending on:

- Army count on the source tile (army of 2 vs army of 10 moving right
  are completely different strategic decisions)
- Ownership of the target tile (capturing unclaimed territory vs
  shuffling through owned interior)
- Nearby expansion potential (moving toward open territory vs dead ends)
- Game phase (early accumulation vs late-game expansion)

The policy learns an *average* value for each (tile, direction) across
all game states where that move was legal. If a move is great half the
time and terrible half the time, the average is meaningless.

**Comparison to Morpion Solitaire (the doc's reference domain):** In
Morpion Solitaire, a move's spatial position is inherently informative —
placing near existing lines is almost always what you want. The game state
matters less per-move. The expansion problem is much more state-dependent,
so the doc's claim that NRPA is the "single strongest recommendation"
based on Morpion performance may not transfer cleanly. The structural
similarity between the problems is weaker than the doc implies,
specifically because of how state-dependent move quality is.

### Policy Feature Engineering — Promising Direction

**Feasibility constraint:** The bottleneck is policy copying, not lookup.
At level 3 with N=100, the policy is copied ~1,000,000 times. Rough
scaling:

- ~250 weights (~2KB): trivial
- ~2,500 weights (~20KB): comfortable
- ~25,000 weights (~200KB): noticeable overhead
- ~250,000 weights: probably too expensive without copy-on-write tricks

**Low thousands of weights is the sweet spot.**

**Proposed richer feature space:**

Movement weights indexed by:
- Tile (49 for 7×7)
- Direction (4)
- Source army bucket: {2}, {3-5}, {6-9}, {10+}
  (0-1 is hard-coded as immovable — these tiles never generate legal
  moves, so they never need weights)
- Target tile owned: yes/no
- Expansion potential of target: small bucket like {0}, {1-2}, {3+}
  uncaptured passable neighbors of target tile

49 × 4 × 4 × 2 × 3 = **4,704 weights** for 7×7. Well within budget.

Wait weights: separate small set, possibly conditioned on general army
bucket and/or tick bucket.

**What this feature space captures:**

The combinations encode meaningfully distinct decisions:

- {army=2, target uncaptured, expansion=3+} → single capture into open
  territory. Useful.
- {army=10+, target uncaptured, expansion=3+} → burst chain beginning
  into open territory. Excellent.
- {army=2, target owned, expansion=0} → shuffling a small army through
  interior toward a dead end. Almost always wasteful. Policy should
  learn to avoid.
- {army=10+, target owned, expansion=0} → moving a big army through
  territory. Could be setup for a burst, but the policy can't see that
  from these features alone.

**Expansion potential measurement:** The simplest version just counts
uncaptured passable neighbors of the target tile — O(4) per move,
trivially cheap. No BFS needed. A target with 3 uncaptured neighbors is
likely an opening into open territory. A target with 0 uncaptured
neighbors is likely a dead end. This captures most of the signal.

More sophisticated options (BFS-based expansion scoring, maintained
incrementally) are available if the simple version proves insufficient.

### Open Questions

- **Setup moves:** The policy sees one move at a time. A big army moving
  through owned territory toward the frontier looks like "army=10+,
  target owned" — the policy might penalize it even though it's setting
  up a valuable burst. Whether NRPA's rollout volume compensates for
  this short-sightedness is empirical.

- **Does brute force compensate for coarseness?** Level 3 with N=100
  produces 10⁶ playouts. Even with a weak policy, that's a lot of
  random exploration. The question is whether convergence is fast enough
  to find the good strategies within that budget, or whether the noisy
  signal from coarse features makes the adaptation wander.

- **Warmstarting from SA:** The doc mentions initializing NRPA's policy
  from a good SA solution. This could help a lot — SA finds a good move
  sequence, you adapt the policy toward it, and NRPA refines from there
  rather than starting from uniform random.

### Overall Assessment

**The core algorithm is sound but the doc undersells the policy design
challenge.** The feature engineering is the real work, not the algorithm
itself. The doc's default (tile, direction) representation is likely
too lossy. The proposed richer features (army bucket, target ownership,
expansion potential) are feasible and capture much more strategic
signal. Whether NRPA with enriched features outperforms SA on this
problem is an open empirical question — the doc's confidence based on
Morpion Solitaire results is not fully warranted.

---

## Still To Review

The following algorithms from Doc 1 have not yet been reviewed:

- Beam Search with Monte Carlo Rollout Evaluation
- CP-SAT for ground-truth optimal solutions

Additionally, techniques from Docs 2-4 (state space reduction, grid
structure exploitation, problem framings) have not yet been reviewed
for domain-specific assumptions. See bounds-review-notes.md for the
completed review of upper bounds.
