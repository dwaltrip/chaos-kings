# Search Algorithms for the Expansion Problem

*Part 1 of 4 in the Optimal Expansion Solver reference series.*

This document covers four algorithms for finding high-quality move sequences in the grid expansion problem. Each section explains what the algorithm is, how it works in concrete detail, and how to apply it to this specific problem. Pseudocode is included for all four.

The algorithms are presented in order of implementation complexity, not power. Simulated annealing is the simplest and should be your first implementation. NRPA is the strongest and should be your second. Beam search is a flexible middle ground. CP-SAT is for validation, not production solving.

---

## The search problem in concrete terms

You have a game simulator. It takes a game state and a move, and returns a new game state. A game state includes which tiles are owned, how many armies are on each tile, and the current tick number. A move is either "send armies from tile X in direction D" or "wait."

Your goal is to find a sequence of T=50 moves that maximizes the number of tiles owned at the final tick.

The search space is the set of all possible move sequences. The number of legal moves per tick varies considerably. On tick 3 (the first tick you can move at all), you have exactly 5 options: move in one of 4 cardinal directions, or wait. As you capture more territory, tiles with 2+ armies can each move in up to 4 directions — but in practice, most tiles hold exactly 1 army (since you leave 1 behind when moving out), so only 1-3 tiles are typically movable at any given time, giving roughly 5-13 legal moves per tick. Over ~47 ticks where movement is possible, even the conservative estimate of 5^47 ≈ 10^32 is an enormous number. Brute-force enumeration is not an option.

We need algorithms that explore this space intelligently — finding good sequences without examining more than a tiny fraction of the possibilities.

---

## Simulated Annealing on move sequences

### What it is

Simulated annealing (SA) is a local search algorithm. You start with some solution (even a random one), and repeatedly make small modifications to it. If a modification improves the solution, you always keep it. If it makes things worse, you keep it with some probability that decreases over time. This willingness to accept worse solutions early on lets the algorithm escape local optima — situations where every small change makes things worse, but a sequence of changes could find something much better.

The name comes from metallurgy: heating metal and slowly cooling it allows atoms to settle into a low-energy crystalline structure rather than getting stuck in a disordered high-energy state.

### How it works for this problem

**Representing a solution.** A solution is an array of T moves. Each entry is either a (source_tile, direction) pair or a special "wait" value. For a 7×7 grid with T=50, this is literally an array of 50 elements.

```
solution = [
  WAIT,                          // tick 0 (only 1 army, can't move)
  WAIT,                          // tick 1
  WAIT,                          // tick 2 (production happens, but can't move yet)
  { from: (3,3), dir: RIGHT },  // tick 3 (first possible move)
  WAIT,                          // tick 4
  { from: (3,3), dir: DOWN },   // tick 5
  ...                            // ticks 6-49
]
```

**Evaluating a solution.** Feed the move sequence into the game simulator tick by tick. At each tick, apply the move if it's legal in the current state (if not, treat it as a wait). After all 50 ticks, count the owned tiles. That count is the solution's score.

**The neighborhood operator.** This is the key design choice. To generate a neighbor of the current solution, pick a random tick index `t` between 0 and 49. Replace the move at tick `t` with a different randomly chosen legal move (determined by simulating from tick 0 to tick `t-1` to find the state at tick `t`, then sampling from its legal moves). Then re-simulate from tick `t` forward to get the new score.

The re-simulation is important. Changing the move at tick 10 might cause you to capture a different tile, which changes the army distribution at tick 11, which changes what moves are legal at tick 11, and so on. You can't just swap one move in isolation — the consequences cascade forward. Re-simulating from the changed tick handles this automatically.

The cost of evaluating one neighbor is O(T) simulator steps (re-simulate from tick `t` to tick `T`). On average, `t` is around T/2, so you re-simulate about 25 ticks per neighbor.

**The acceptance rule.** Given the current solution with score `S_current` and a neighbor with score `S_new`:

- If `S_new >= S_current`: always accept (move to the neighbor).
- If `S_new < S_current`: accept with probability `exp((S_new - S_current) / temperature)`.

When the temperature is high, bad moves are accepted frequently (exploration). As the temperature drops, only improvements are accepted (exploitation).

**The cooling schedule.** Start with temperature T₀ and multiply by a decay factor α after each iteration. The key requirement is that α should be set so that temperature decays smoothly to near-zero at the final iteration — not thousands of iterations before the end. If you're running N iterations and want the final temperature to be roughly ε × T₀ (say ε = 0.001), set α = ε^(1/N). For example, with N = 10,000,000 iterations and ε = 0.001, α = 0.001^(1/10000000) ≈ 0.9999993. Getting this wrong is easy — a value like α = 0.998 would kill the temperature after just ~5,000 iterations, wasting the rest of the run on pure hill-climbing with no ability to escape local optima.

The initial temperature T₀ should be calibrated so that a typical worsening move (score decreasing by 1) is accepted with probability ~0.5 at the start. Since `exp(-1 / 1.0) ≈ 0.37`, a T₀ of 1.0 is reasonable. If most worsening moves decrease the score by 2-3, you might raise T₀ to 2.0 or 3.0.

### Pseudocode

```
function simulatedAnnealing(board, T_ticks, iterations, T0, alpha):
  // Start with a random solution
  currentMoves = generateRandomMoveSequence(board, T_ticks)
  currentScore = simulate(board, currentMoves)
  bestMoves = currentMoves
  bestScore = currentScore
  temperature = T0

  for i in 0..iterations:
    // Pick a random tick to modify
    t = randomInt(0, T_ticks - 1)

    // Simulate up to tick t to find the state there
    stateAtT = simulatePartial(board, currentMoves, t)

    // Pick a different legal move at tick t
    legalMoves = getLegalMoves(stateAtT)
    newMove = randomChoice(legalMoves)

    // Create the neighbor solution
    neighborMoves = copy(currentMoves)
    neighborMoves[t] = newMove

    // Re-simulate from tick t forward to get the new score
    neighborScore = simulateFromTick(board, neighborMoves, t)

    // Acceptance decision
    delta = neighborScore - currentScore
    if delta >= 0 or random() < exp(delta / temperature):
      currentMoves = neighborMoves
      currentScore = neighborScore

    if currentScore > bestScore:
      bestMoves = currentMoves
      bestScore = currentScore

    temperature = temperature * alpha

  return bestMoves, bestScore
```

### What to expect

On a 7×7 open grid with T=50, SA should likely find solutions in the range of 23-25 tiles within a few seconds (millions of iterations). The known optimal is 25. SA won't always find 25, but running it multiple times with different random seeds gives it a good chance.

The main value of SA is as a baseline. It gives you a good score fast, and it tells you how much room for improvement remains (by comparing to upper bounds — see Part 4 of this series). It's also useful as a warmstart for other methods.

### Practical tips

**Restart strategy.** Rather than one long SA run, do 10-20 shorter runs with different random seeds and keep the best result. This is often more effective because each run explores a different region of the search space.

**Move legality.** When you change a move at tick `t`, the move you chose might become illegal after re-simulation from tick `t` (because the state at tick `t` might differ from what you expected if you modified an earlier tick in a previous iteration). Handle this gracefully — if a move is illegal, treat it as a wait.

**Efficient re-simulation.** You can cache the game state at every tick for the current solution. When you modify tick `t`, you only need to re-simulate from tick `t` onward (using the cached state at tick `t`). But note that modifying tick `t` invalidates the cached states at ticks `t+1` through `T`. So after accepting a neighbor, you need to update the cache from tick `t` forward.

---

## Nested Rollout Policy Adaptation (NRPA)

### What problem NRPA solves

If you run purely random playouts (random sequence of 50 moves, simulated to completion), the resulting scores will be terrible. Random moves waste armies walking in circles over already-owned territory, rarely capturing anything efficiently. A random playout on a 7×7 grid might score 5-10 tiles.

But what if you could learn which moves tend to be good at each game state, without hand-crafting an evaluation function? That's what NRPA does. It maintains a "policy" — a set of weights that bias the random playouts toward moves that have led to good outcomes in past playouts. Over many iterations, the policy gets better and better, and the playouts produce increasingly strong move sequences.

NRPA was introduced by Christopher Rosin in 2011 [^6] and holds world records on Morpion Solitaire, a single-player grid puzzle with a similar structure to this problem (sequential decisions on a grid, maximizing a count). Cazenave later extended it to GNRPA [^7][^8][^9] with temperature control and stabilization techniques [^10][^11].

### The policy

The policy is a table of weights, one weight per (state, move) pair. In practice, you can't have a weight for every possible game state (there are far too many), so you use a feature-based representation. The simplest version: one weight per (tile, direction) pair, shared across all game states. For a 7×7 grid with 4 directions plus wait, that's roughly 49 × 5 = 245 weights.

All weights start at 0, meaning the policy initially samples moves uniformly at random (modulo legality).

### Level 0: The playout

A level-0 call runs a single playout — a complete game from tick 0 to tick T, making one move per tick according to the current policy.

At each tick, the playout looks at the legal moves and samples one using softmax (also called Gibbs sampling). Each legal move `m` has weight `w[m]`. The probability of choosing move `m` is:

```
P(m) = exp(w[m]) / sum(exp(w[m']) for all legal moves m')
```

When all weights are 0, this is uniform random. When one weight is much higher than the others, that move is chosen almost certainly. The softmax provides a smooth interpolation between "explore everything" and "exploit the best known."

The playout runs to completion and returns two things: the score (tiles owned at tick T) and the sequence of moves played.

```
function playout(board, policy, T_ticks):
  state = initialState(board)
  moveSequence = []

  for t in 0..T_ticks-1:
    legalMoves = getLegalMoves(state)
    if legalMoves is empty:
      moveSequence.push(WAIT)
      state = applyMove(state, WAIT)
      continue

    // Softmax sampling
    weights = [policy.getWeight(state, m) for m in legalMoves]
    probabilities = softmax(weights)
    chosenMove = sampleFrom(legalMoves, probabilities)

    moveSequence.push(chosenMove)
    state = applyMove(state, chosenMove)

  score = countOwnedTiles(state)
  return score, moveSequence
```

### The adaptation step

After a playout, if the resulting sequence is the best found so far at the current search level, the policy is adapted to make that sequence more likely in future playouts. This is done by increasing the weight of each move in the best sequence and decreasing the weights of the alternatives.

The adaptation is essentially a policy gradient step. For each tick in the best sequence, you increase the weight of the move that was actually played and decrease the weights of all moves proportionally to their current probability of being selected.

```
function adapt(policy, bestSequence, board, alpha):
  state = initialState(board)

  for t in 0..len(bestSequence)-1:
    bestMove = bestSequence[t]
    legalMoves = getLegalMoves(state)

    // Increase weight of the best move
    policy.addWeight(state, bestMove, alpha)

    // Decrease all moves proportionally to their probability
    weights = [policy.getWeight(state, m) for m in legalMoves]
    probabilities = softmax(weights)
    for i, m in enumerate(legalMoves):
      policy.addWeight(state, m, -alpha * probabilities[i])

    state = applyMove(state, bestMove)
```

The parameter `alpha` controls the learning rate. A typical value is 1.0. Higher values adapt faster but risk overfitting to one sequence; lower values are more conservative.

### The recursive structure

NRPA at level 0 is just a single playout. The power comes from nesting.

At level 1, you run N playouts (level-0 calls), adapting the policy after each one toward the best sequence found so far. After N iterations, you return the best sequence and score.

At level 2, you run N iterations, each calling level 1. Each level-1 call explores thoroughly using its own sequence of adapted playouts. After each level-1 call, you adapt the policy toward the best sequence found across all level-1 calls so far.

In general, at level L, you run N iterations of level L-1, adapting after each. The recursion bottoms out at level 0 (a single playout).

```
function nrpa(board, policy, level, N, T_ticks, alpha):
  if level == 0:
    return playout(board, policy, T_ticks)

  bestScore = -infinity
  bestSequence = null

  for i in 0..N-1:
    // Recursive call with a COPY of the current policy
    score, sequence = nrpa(board, copy(policy), level - 1, N, T_ticks, alpha)

    if score > bestScore:
      bestScore = score
      bestSequence = sequence

    // Adapt the policy toward the best sequence found so far
    adapt(policy, bestSequence, board, alpha)

  return bestScore, bestSequence
```

Note the `copy(policy)` in the recursive call. Each recursive call gets its own copy of the policy to work with, so the adaptations within the recursive call don't interfere with the outer level's policy. The outer level only adapts its own policy based on the returned results.

### Putting it all together

A typical configuration is level 3 with N=100 iterations per level. This produces:

- Level 3: 100 iterations of level 2
- Each level 2: 100 iterations of level 1
- Each level 1: 100 iterations of level 0 (playouts)
- Total playouts: 100 × 100 × 100 = 1,000,000

Each playout simulates 50 ticks, so the total computation is about 50 million simulator steps. With an efficient simulator (thousands of steps per millisecond), this runs in seconds to low minutes.

### Why NRPA works well for this problem

The grid expansion problem has strong spatial locality. Good moves tend to involve tiles near the frontier, in directions that lead into uncaptured territory. NRPA's per-(tile, direction) weights naturally learn these spatial patterns. After enough adaptation, the policy strongly favors "move outward from the frontier" over "walk around in circles over owned territory."

The nested structure means that low-level exploration (random playouts) discovers promising move patterns, which get reinforced at higher levels. Roughly speaking, level-1 adaptation might learn spatial preferences like "going right then down tends to work well from this region." Level-2 adaptation might learn timing patterns like "this burst length produces good results." Level-3 adaptation combines these into a refined overall strategy. The exact nature of what each level captures will depend on the problem instance.

### Practical tips

**Policy representation.** The simplest approach uses a weight per (tile, direction) pair. A richer representation might use (tile, direction, tick_bucket) to let the policy distinguish between early-game and late-game preferences. Start simple.

**Initial policy.** All weights at 0 (uniform random). You can also warmstart the policy from SA results — extract the moves from a good SA solution and adapt the policy toward them before starting NRPA.

**Parallelization.** The iterations within a level are *not* independent — each iteration adapts the policy, and the next iteration uses the adapted version. That sequential adaptation is central to how NRPA works. The simplest way to parallelize is at the root: run multiple independent NRPA instances (different random seeds) in parallel and keep the best result. You can also parallelize the level-0 playouts within a single level-1 iteration if you batch them before the adaptation step, though this changes the algorithm's behavior slightly.

---

## Beam Search with Monte Carlo Rollout Evaluation

### What it is

Beam search is a breadth-first search that only keeps the K best states at each level (each tick, in our case). Think of it as a "controlled flood" — instead of exploring every possible state at every tick (which would blow up exponentially), you prune to the K most promising states at each step and only expand those.

The critical question is: how do you decide which K states are "most promising" when you're only at tick 15 out of 50 and can't see the future? This is where Monte Carlo rollouts come in.

### How it works

**Initialization.** At tick 0, you have exactly one state: the starting position. The beam contains just this one state.

**Expansion.** At each tick, take all K states in the beam and generate all their legal successors. Each state might have 5-13 legal moves depending on how many tiles have 2+ armies, so you get roughly 5K-13K candidate states for the next tick.

**Evaluation.** For each candidate state, estimate how good it is by running several random rollouts to completion. A rollout starts from the candidate state and plays out the remaining ticks using a simple greedy policy (for example, always move toward the nearest uncaptured tile). After 10-50 rollouts per candidate, average the final tile counts. This average is the candidate's evaluation score.

**Selection.** Sort the candidates by their evaluation score. Keep the top K. Discard the rest. These K states form the beam for the next tick.

**Termination.** After tick T, the beam contains K complete solutions. Return the one with the highest actual tile count (not estimated — the actual final score).

```
function beamSearch(board, T_ticks, beamWidth, rolloutsPerState):
  beam = [initialState(board)]

  for t in 0..T_ticks-1:
    candidates = []

    // Expand all states in the beam
    for state in beam:
      for move in getLegalMoves(state):
        newState = applyMove(state, move)
        candidates.push(newState)

    // Evaluate each candidate with Monte Carlo rollouts
    for candidate in candidates:
      scores = []
      for r in 0..rolloutsPerState-1:
        score = greedyRollout(candidate, T_ticks - t - 1)
        scores.push(score)
      candidate.estimate = average(scores)

    // Keep the top K
    candidates.sort(by: estimate, descending)
    beam = candidates[0..beamWidth-1]

  // Return the best complete solution
  return beam[0]
```

### The rollout policy

The quality of beam search depends heavily on the rollout policy used for evaluation. Pure random rollouts are noisy and unreliable. A greedy policy that captures the nearest frontier tile at each step should produce scores that correlate better with actual solution quality, though this would need to be validated empirically.

A reasonable greedy rollout policy to try for this problem:

1. If any owned tile has 2+ armies and is adjacent to an uncaptured tile, move that army to capture the uncaptured tile. Prefer tiles that open access to more uncaptured territory.
2. If no capture is immediately possible but armies can be moved toward the frontier, move the largest army one step toward the nearest frontier tile.
3. Otherwise, wait (accumulate on the general).

This greedy policy won't produce optimal solutions, but it should produce more consistent estimates than random rollouts. If candidate A evaluates to 18.5 and candidate B evaluates to 16.2 across enough rollouts, that's likely a meaningful signal that A is in a better position — though the correlation between rollout estimates and true solution quality is something you'd want to verify early on.

### Beam width tradeoffs

The beam width K controls the tradeoff between exploration and computation:

- K = 100: Fast (a few seconds), but might miss the optimal path if it's not among the top 100 states at any tick.
- K = 1,000: Good balance. Takes minutes with 10 rollouts per state.
- K = 5,000: Thorough. May take tens of minutes. Should cover most of the interesting strategic variations.

The number of rollouts per state also matters. More rollouts = more accurate estimates = better selection, but higher cost. Start with 10 rollouts per state and increase if the results are noisy.

### Integration with dominance pruning

Beam search benefits greatly from the dominance pruning techniques described in Part 2 of this series. Before the selection step, check if any candidate state is dominated by another candidate (same territory, same tick, but worse army distribution). Prune dominated states before ranking by rollout score. This concentrates the beam on genuinely distinct strategic positions rather than wasting slots on slight variations of the same position.

### When beam search shines

Beam search is the best algorithm when you need *diversity* — when you want to explore many qualitatively different strategies simultaneously. SA optimizes a single solution. NRPA learns a single policy. Beam search maintains K different solutions evolving in parallel, so it's less likely to get stuck in one strategic approach.

It's also the most natural algorithm for integration with the structural analysis techniques in Part 3 (frontier scoring, macro-actions). You can use frontier analysis to order the candidates before rollout evaluation, or to generate the rollout policy.

---

## CP-SAT for ground-truth optimal solutions

### What it is and why you want it

CP-SAT (Constraint Programming with a SAT solver backend) is a method for solving combinatorial optimization problems exactly. You declare variables, constraints, and an objective function. The solver explores the space of valid assignments and returns the one that maximizes (or minimizes) the objective. It guarantees optimality — when it finishes, you know the solution is the best possible.

You don't want CP-SAT as your main solver for large instances. For an 11×11 grid over 50 ticks, it might take hours. But for small instances (7×7), it solves in minutes, and the results are invaluable: they give you ground-truth optimal scores to validate and calibrate your heuristic methods. 

If your SA and NRPA consistently find 24 tiles on a specific 7×7 board and CP-SAT proves the optimal is 25, you know there's room for improvement and can investigate what the optimal solution does differently. If CP-SAT proves the optimal is 24, you know your heuristics are already finding the best possible solution on that board.

### The variables

The model needs to track the game state at every tick. The key variables are:

**Ownership:** `owned[t][v]` is a boolean — is tile v owned at tick t? There are T × V of these (50 ticks × up to 121 tiles for an 11×11 grid).

**Army counts:** `armies[t][v]` is an integer — how many armies are on tile v at tick t? Bounded between 0 and some reasonable maximum (say, 30). Same dimensionality as ownership.

**Movement:** `move_from[t]` is an integer identifying which tile is the source of the move at tick t, or a special value for "wait." `move_dir[t]` is the direction (0-3 for up/down/left/right) or a special value for "wait."

For a 7×7 grid with 50 ticks, this is roughly 50 × 49 × 2 = 4,900 boolean variables plus 50 × 49 = 2,450 integer variables plus 100 move variables. Total: around 7,500 variables. Manageable.

### The constraints

These encode the game rules as logical conditions the solver must satisfy:

**Initial state:** `owned[0][general] == true`, `armies[0][general] == 1`, all other tiles unowned with 0 armies.

**One move per tick:** For each tick t, at most one (source, direction) pair is active.

**Source validity:** If a move happens at tick t from tile v, then `owned[t][v] == true` and `armies[t][v] >= 2`.

**Movement mechanics:** If a move happens at tick t from tile v in direction d, targeting adjacent tile u:
- `armies[t+1][v] = 1` (leave one behind)
- `armies[t+1][u] = armies[t][u] + armies[t][v] - 1` (merge armies)
- `owned[t+1][u] = true` (capture if not already owned)

**No-move tiles:** For every tile w that is not the source or destination of the move at tick t: `armies[t+1][w] = armies[t][w]` and `owned[t+1][w] = owned[t][w]`.

**Army production:** `armies[t+1][general] += 1` for every even tick t (or however your production schedule works).

**Wall constraints:** Wall tiles are never owned and always have 0 armies.

**Objective:** Maximize `sum(owned[T][v] for all passable tiles v)`.

### Implementation

Google's OR-Tools CP-SAT solver is the most accessible tool. The Python API is well-documented. The model definition is declarative — you describe what you want, not how to find it.

```
from ortools.sat.python import cp_model

model = cp_model.CpModel()

# Variables
owned = {}
armies = {}
for t in range(T + 1):
    for v in passable_tiles:
        owned[t, v] = model.NewBoolVar(f'owned_{t}_{v}')
        armies[t, v] = model.NewIntVar(0, 30, f'armies_{t}_{v}')

# ... constraints as described above ...

# Objective
model.Maximize(sum(owned[T, v] for v in passable_tiles))

# Solve
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 300  # 5 minute timeout
status = solver.Solve(model)
```

The tricky part is encoding the conditional constraints (if tile v is the source, then...; if tile u is the destination and was previously unowned, then...). CP-SAT handles these with indicator constraints and channeling constraints. The OR-Tools documentation has good examples.

### What to do with optimal solutions

Build a test suite of 10-20 small boards (7×7 with various wall configurations) with known optimal scores from CP-SAT. Use this test suite to:

1. Validate correctness: your SA and NRPA should never exceed the CP-SAT optimal (if they do, there's a bug in your simulator or the CP-SAT model).
2. Measure heuristic quality: across your test suite, how close do SA and NRPA get to optimal? If they average 95% of optimal, that's probably good enough. If they average 80%, there's significant room for improvement.
3. Study optimal strategies: examine the CP-SAT solutions to understand what optimal play looks like. Does it always use burst strategies? When does it deviate? This informs the design of better macro-actions and heuristics (see Part 3 of this series).

### Warm-starting

If you have a good SA or NRPA solution, you can provide it to the CP-SAT solver as a hint. This doesn't change the guarantee of optimality, but it gives the solver a strong starting point for its internal branch-and-bound, often dramatically reducing solve time. In OR-Tools, use `model.AddHint(variable, value)` for each variable.

---

## Choosing an algorithm

The four algorithms complement each other:

**Simulated annealing** is the tool you reach for first. It's simple to implement, requires almost no design decisions, and tends to produce surprisingly good results on sequential optimization problems. Use it to establish a performance baseline and to generate warm-start solutions for other methods.

**NRPA** is the tool you reach for when you need the best possible score. In the literature on single-player grid puzzles (Morpion Solitaire, SameGame), NRPA has consistently outperformed SA-style approaches [^6][^7]. The hypothesis is that learning a policy that generalizes across states is more powerful than optimizing a single fixed sequence. Whether this advantage holds for the expansion problem specifically is something to validate, but the structural similarities are strong.

**Beam search** is the tool you reach for when you want to understand the search space. Because it maintains many solutions in parallel, you can inspect the beam at any tick to see what kinds of strategies are being explored. It also integrates naturally with the structural analysis techniques in Part 3.

**CP-SAT** is the tool you reach for when you need to know the truth. It tells you the optimal score, not just a good score. Use it on small instances to validate everything else.

A practical workflow: implement SA first (1-2 days), validate with CP-SAT on small boards, then implement NRPA (2-3 days) and compare. Add beam search later if you need the additional diversity or structural integration.
