# Perfect Start Solver — Implementation Sketch

Detailed plan for building the solver + comparison tooling. Goal: get data to guide scoring function decisions.

**Build order:**
1. Simulation harness
2. Beam search (land-only scoring)
3. Comparison runner (JSON output)
4. Op counter (once we know what to count)
5. Board factory (last — needs visual tuning with Daniel)

For steps 1-3, use hardcoded tiny boards inline for development/testing.

---

## 1. Simulation Harness

Wraps core's `processStep`. Takes a board + move sequence, runs forward, collects tick-by-tick data.

**What it wraps:**
- `processStep(gameState, events, timing)` from `@core/step-processor`
- `createGameState(board, playerCount)` from `@core/step-processor`
- Uses `DEFAULT_TIMING` from `@core/game-timing-config`

**Function signature:**
```ts
interface SimulationResult {
  finalLand: number;
  landCurve: number[];       // land count at each tick
  finalState: GameState;
}

function simulate(
  board: BoardState,
  moves: Move[],             // one per tick (or null for "wait")
  ticks: number,
  timing?: TimingConfig,
): SimulationResult
```

**Move type:**
```ts
type Move = {
  sourceCoord: Coord;
  direction: Direction;
} | null;  // null = wait
```

The harness converts each `Move` into a `MoveEvent` (adding `playerIndex: 0`, `tick`) and calls `processStep` each tick. Records `landCount` from player stats after each step.

**Note on MoveEvent bridging:** `processStep` expects `MoveEvent[]` which includes `playerIndex` and `tick`. The simulation harness handles this conversion — always player 0, tick derived from loop index.

**Location:** `packages/algos/src/perfect-start-solver/simulation.ts`

**Note:** The solver's beam search will use `processStep` directly for correctness. The harness is useful for: (a) verifying solver output is correct, (b) replaying solutions, (c) testing.

---

## 2. Beam Search — Core Solver

### State Representation

```ts
interface SolverState {
  gameState: GameState;       // full game state (board + tick + players)
  moves: Move[];              // move history for this path
  landCount: number;          // read from gameState.players[0].landCount
}
```

Start simple with the full `GameState`. We can optimize to a lighter representation later if cloning cost is significant — but we won't know until we measure.

### Scoring Function Interface

```ts
type ScoringFn = (state: SolverState) => number;
```

First implementation: `(state) => state.landCount`

This is a naive baseline — it can't see the value of routing/gathering moves. Expected to perform poorly but gives a floor to measure improvements against.

### Move Generation

```ts
function generateMoves(state: SolverState): Move[]
```

Two-step process:
1. Find all tiles owned by player 0 with `units > 1` (the engine's `Board.canMove` does NOT check ownership or unit count — we must do this ourselves)
2. For each hot tile, try all 4 directions via `Board.canMove` (checks bounds + mountains)

Categorize results as capture (dest is blank) vs route (dest is friendly). This tagging is informational for v1 — no filtering. **Future improvement:** prune routes aggressively (e.g., "all captures + top N routes") once we have data on branching factor.

Add one `null` (wait) option per state (not per tile — wait is a global action, "do nothing this tick").

### Cloning

`applyMovement` mutates the board in place. Must clone state BEFORE applying each candidate move to avoid corrupting sibling branches.

Use `structuredClone(gameState)` for v1. It deep copies everything — no shared references. Measure cost later. **Future improvement:** lighter state representation (drop `players` array, track land incrementally) + custom `processStep` that avoids the full grid scan in `updatePlayerStats`.

### Main Loop

```ts
interface SolverConfig {
  beamWidth: number;
  maxTicks: number;
  scoringFn: ScoringFn;
}

interface SolverResult {
  bestState: SolverState;
  finalLand: number;
  landCurve: number[];
  moves: Move[];
}

function solve(
  board: BoardState,
  generalCoord: Coord,
  config: SolverConfig,
): SolverResult
```

Pseudocode:
```
beam = [initial state]

for tick in 0..maxTicks:
  nextStates = []
  for each state in beam:
    moves = generateMoves(state)
    for each move in moves:
      clone state
      apply move via processStep
      push to nextStates
  score all nextStates
  sort by score descending
  beam = top B states

return best state in beam
```

**Start with maxTicks ~20-25** for fast iteration. Increase to 49 once the core loop is validated.

**Deduplication:** skip for v1. If added later, must hash full board state (ownership + unit counts), not just owned-tile sets — two states with same territory but different army positions are meaningfully different.

**Location:** `packages/algos/src/perfect-start-solver/solver.ts` (replace existing stub)

---

## 3. Comparison Runner

Runs the solver across multiple boards × scoring functions × beam widths.

**Function signature:**
```ts
interface RunConfig {
  board: { name: string; board: BoardState; generalCoord: Coord };
  scoringFn: { name: string; fn: ScoringFn };
  beamWidth: number;
  maxTicks: number;
}

interface RunResult {
  boardName: string;
  scoringFnName: string;
  beamWidth: number;
  maxTicks: number;
  finalLand: number;
  landCurve: number[];
  durationMs: number;
  moves: Move[];
}

function runComparison(configs: RunConfig[]): RunResult[]
```

**Output:** dump raw JSON to console for v1. Pretty table formatting is a future nicety.

**Location:** `packages/algos/src/perfect-start-solver/comparison.ts`

**Runner script:** `packages/algos/src/perfect-start-solver/run-comparison.ts` — imports boards, scoring functions, calls `runComparison`. Run with `npx tsx`.

---

## 4. Op Counter

Added after we've built and run the solver, so we know which operations actually matter.

Likely shape (to be refined based on what we observe):
```ts
interface OpCounter {
  stateExpansions: number;
  scoringCalls: number;
  stateClones: number;
  // scoring sub-operations (added per scoring fn):
  bfsSteps: number;
  frontierScans: number;
  // ... discovered through profiling
}
```

Pass through the solver as a mutable object. Increment as we go. Report alongside results in the comparison output.

Key question to answer: what is the relative cost of scoring functions vs state cloning vs move generation? This guides where to optimize.

---

## 5. Board Factory (Last)

Text-based board definitions. Parse to `BoardState`. Done last because good test boards need visual tuning.

```
. . . M .
. . . . .
. . G . .
. . . . .
. M M . .
```

Legend: `.` = blank, `M` = mountain, `G` = general (playerIndex 0, 1 unit)

```ts
function parseBoard(text: string): { board: BoardState; generalCoord: Coord }
```

**Three test boards** (gradient of mountain density):
1. **Open field** — no mountains
2. **Sparse mountains** — a few scattered mountains
3. **Dense mountains** — lots of mountains, forces routing through tight gaps

Board generation may need a randomized approach with visual review to find boards that are interesting/representative. Exact board designs TBD with Daniel.

**Location:** `packages/algos/src/perfect-start-solver/board-factory.ts`

---

## File Structure

```
packages/algos/src/perfect-start-solver/
  simulation.ts           # simulate() harness
  solver.ts               # beam search (replace existing stub)
  scoring-functions.ts    # pluggable scoring fns
  comparison.ts           # runComparison()
  run-comparison.ts       # executable script
  board-factory.ts        # parseBoard() — built last
  types.ts                # shared types (Move, SolverState, etc.)
  a-star.ts               # existing — wire in for distance-to-blank scoring
  path-finding.ts         # existing (keep, may use later)
  utils.ts                # existing (keep)
  __tests__/
    simulation.test.ts
    solver.test.ts
```

---

## Future Improvements (Noted, Not v1)

- **Custom processStep:** inline move application + incremental land tracking to avoid full grid scan per step
- **Lighter state:** drop `players` array, just grid + tick + cached land count
- **Route pruning:** separate capture/route moves in generation, limit route moves to top N by some heuristic
- **A* for scoring:** wire existing `a-star.ts` into distance-to-blank scoring functions
- **Deduplication:** hash full board state to avoid duplicate states in beam
- **Table formatting:** pretty-print comparison results

---

## What We'll Learn

After running the comparison with land-only scoring on hardcoded boards:
1. **Is beam search tractable?** How long does it take for various beam widths?
2. **Where does time go?** State cloning? Move generation? Scoring?
3. **Does beam width matter?** If B=100 and B=500 give the same land, we can use smaller beams.
4. **What do the solutions look like?** Do they match our intuition (star pattern early, extend arms later)?
5. **How bad is land-only scoring?** Sets the floor for measuring scoring improvements.

This data tells us exactly what to optimize and which scoring ideas are worth trying.
