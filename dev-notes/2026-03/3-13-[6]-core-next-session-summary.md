# core-next Session Summary

## What we accomplished

Replaced `structuredClone` in the solver's beam search inner loop with a flat typed array board representation (`core-next`). The solver now clones game state ~30-40x faster.

### Perf results (beam=50, land-only scorer, ranges across all four 7x7 test boards)

| Metric | Old (structuredClone) | New (FlatBoard) | Speedup |
|---|---|---|---|
| `cloneStepMs` | ~550ms | ~13-22ms | **~30x** |
| `totalMs` | ~550ms | ~15-27ms | **~20-35x** |
| `scoreSortMs` (frontier scorers) | ~110-120ms | ~40-50ms | **~2.5x** |

`totalMs` = `genMs` + `cloneStepMs` + `scoreSortMs` (fields from `beam-search.ts` `PerfStats`). For land-only, scoring is trivial so `totalMs ≈ cloneStepMs`.

**Correctness verification:** Tile-by-tile smoke tests (6 scenarios) pass against old core at every tick — comparing types, units, owners, and player stats. Separately, comparison runs across all 4 boards × 7 scorers produce matching land counts at the solver level (weaker check, but covers the full pipeline).

### What was built

```
packages/algos/src/core-next/
  flat-board.ts      — FlatBoard type, TileType constants, cloneBoard, Board namespace
  process-step.ts    — processStep, applyMove, applyProduction, validateMove
  convert.ts         — GameState ↔ FlatBoard conversion bridge
  smoke-test.ts      — Tile-by-tile correctness comparison vs old core
```

Solver files updated to use FlatBoard internally: `solver.ts`, `scoring-functions.ts`, `types.ts`. External API unchanged — `solve()` still takes `BoardState` and returns `Move[]`.

### How to run

```sh
cd packages/algos

# Smoke test (tile-by-tile vs old core)
npx tsx src/core-next/smoke-test.ts

# Comparison benchmark
npx tsx src/perfect-start-solver/prototyping/run-comparison.ts --beam=50 --score=land-only

# Output goes to src/perfect-start-solver/prototyping/data/
```

---

## Key decisions

**Design doc:** `dev-notes/2026-03/3-13-[5]-flat-board-design.md`

- **Three flat typed arrays** — `types: Uint8Array`, `owners: Int8Array`, `units: Int32Array` (Int32 not Int16, to avoid overflow on large boards)
- **Stats are `number[]`** not typed arrays — `landCounts` and `armyCounts` per player, cloned with `[...arr]`
- **processStep owns all stat maintenance** — no caller-side stat fixup. The perf path's advantage is direct array reads, not writes
- **NEUTRAL_CITY deferred** — value 2 reserved in TileType but not implemented (current engine doesn't handle it either)
- **Direction uses enum, not raw offsets** — `Board.neighbor(board, idx, dir)` converts at point of use. Readable, negligible perf cost
- **No helper factories in core API** — all Board functions take `board` as first arg. Solver can create local shorthands if needed
- **Tick lives outside the board** — board is purely spatial state, tick passed as parameter

Implementation notes:
- **`forEachTile` allocates a Tile object per cell** — documented as not for hot paths
- **`recomputeStats(board)`** exists for initialization/validation — used by `fromBoardState` in convert.ts
- **`Board.applyMove`** from the design doc's ergonomic API was not built — move application lives in `process-step.ts` as `applyMove(board, playerIndex, src, destIdx)`. Can add the ergonomic wrapper when needed

Implementation matched the design doc with the minor exception above. See design doc for full rationale on each decision.

---

## Things to know for continued solver work

- **SolverState is** `{ board: FlatBoard, tick: number, moves: FlatMove[] }`
- **FlatMove is** `{ src: number, dir: Direction } | null` — `src` is flat index, not coord
- **ScoringFn signature changed** — now `(board: FlatBoard) => number` instead of `(gameState: GameState) => number`
- **processStep signature** — `processStep(board, move, playerIndex, tick, timing)`. Takes `playerIndex` explicitly (supports multi-player), though the solver hardcodes player 0 throughout
- **`fromBoardState` / `toBoardState`** in convert.ts bridge between old and new representations. Used at solver init (one `structuredClone` remains there for the initial board copy) and for simulation output
- **Clone+step is no longer the bottleneck** — at beam=200 with frontier scorers, scoring is now ~80% of runtime. Next perf win would be optimizing scoring functions
- **Scoring functions already benefit from flat arrays** — the BFS and frontier scorers use direct array iteration and `Uint8Array` visited arrays instead of `Set<string>`, giving ~2.5x scorer speedup for free

---

## core-next as candidate for replacing core

### What it covers today

- Board representation (create, clone, read, mutate with ergonomic and perf APIs)
- processStep (move validation, movement with all combat cases, production)
- Incremental stats (land count, army count per player)
- Conversion bridge to/from current GameState

### What's missing for a full core replacement (priority order)

- **Multi-move per tick** — current processStep takes a single move + playerIndex. The real game sorts and applies multiple players' moves per tick. Straightforward (loop over sorted moves, call applyMove for each) but needs the event emission plumbing
- **Game end detection** — processStep doesn't check for winner (solver doesn't need it)
- **GameEvent emission** — `player_defeated` events not emitted (solver doesn't use them)
- **NEUTRAL_CITY** — capture semantics (garrison mechanic) not implemented
- **Move queuing** — the real game has per-player move queues across ticks, distinct from multi-move-per-tick
- **Fog of war** — not implemented, but flat arrays make bitmask-based fog natural
- **Serialization** — not implemented, but flat arrays are designed for cheap binary serialization
- **Frontend integration** — Board namespace would need to match patterns expected by stores/UI, or adapters via the conversion bridge

### Assessment

The core data structure and mutation logic are solid and tested. The gaps are all additive (new features on top of what exists) rather than structural.

Note: the solver only exercises player 0 code paths. Multi-player combat (cases 3-6 in applyMove) is implemented but untested beyond the code review. Adding multi-player smoke tests would be needed before trusting those paths for the real game.

Recommended path: keep building features in core-next as the solver needs them, and when it reaches feature parity with core for the game's needs, swap it in. The conversion bridge means both can coexist during migration.
