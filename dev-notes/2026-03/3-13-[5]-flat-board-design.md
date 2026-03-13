# Flat Board Design — `core-next`

## Motivation

The perfect-start solver's beam search clones game state ~50k times per run. `structuredClone` on the current `Square[][]` object graph (49 Square objects + Coord objects + 7 row arrays + grid array) is 80-98% of runtime. We need a representation that clones cheaply.

Beyond solver perf, this representation unlocks:
- **Compact binary serialization** for WebSocket (flat arrays *are* the wire format)
- **Cheap delta updates** (diff two arrays, send only changed indices)
- **Efficient fog of war** (bitmask over flat array)
- **Instant snapshots** for replay (`slice()` / `set()`)

This design is intended to eventually port back to the main game code. We're building it in `packages/algos/src/core-next/` first, proving it in the solver context, then migrating.

---

## Data Structure

```ts
interface FlatBoard {
  types:  Uint8Array;   // TileType enum per cell
  owners: Int8Array;    // playerIndex or NO_OWNER (-1)
  units:  Int32Array;   // unit count (0 for non-player tiles)
  width:  number;
  height: number;
  // Maintained incrementally by processStep and Board mutation API.
  // NOTE: re-evaluate whether stats belong on the board during port to main game.
  // For solver context this is convenient; for game code, a separate concern might be cleaner.
  stats: {
    landCounts: number[];   // per player
    armyCounts: number[];   // per player
  };
}
```

Array length is always `width * height`. Cell at `(x, y)` is at index `y * width + x`. This is the single canonical index formula — all helpers derive from it.

### Type Constants

```ts
const TileType = {
  BLANK: 0,
  MOUNTAIN: 1,
  // NEUTRAL_CITY is not implemented yet. The current game engine doesn't handle
  // neutral city capture (moving onto one throws). When we add it, neutral cities
  // will store garrison strength in `units` with `owner = NO_OWNER`, and applyMove
  // will need a dedicated capture case (attacker must overcome garrison).
  // NEUTRAL_CITY: 2,
  ARMY: 3,
  GENERAL: 4,
  PLAYER_CITY: 5,
} as const;
type TileType = (typeof TileType)[keyof typeof TileType];

const NO_OWNER = -1;
```

These numeric values are a protocol — they show up in the wire format, the accessor layer, and the mutation API. Keep them stable. Value 2 is reserved for NEUTRAL_CITY.

### Tile View Object

Returned by ergonomic accessors. Fresh object per call (no aliasing concerns).

```ts
interface Tile {
  type: TileType;
  owner: number;    // playerIndex or NO_OWNER
  units: number;
  x: number;
  y: number;
  idx: number;
}
```

---

## Tick

Tick lives **outside** the board. The board is purely spatial state. Tick is passed as a parameter to functions that need it (e.g., `processStep`).

In the solver context: `SolverState = { board: FlatBoard, tick: number, moves: FlatMove[] }`.

---

## Two Access Patterns

### 1. Ergonomic Path (game code, UI, handlers)

`Board` namespace with accessors and mutation methods. Returns `Tile` objects. Maintains stats automatically on mutation.

```ts
// --- Read ---
Board.getTile(board, x, y): Tile
Board.getTileByIdx(board, idx): Tile
Board.isPassable(board, idx): boolean
Board.isPlayerTile(tile): boolean

// --- Mutate (maintains stats) ---
Board.setTile(board, idx, type, owner, units): void
Board.addUnits(board, idx, delta): void
Board.applyMove(board, srcIdx, destIdx): MoveResult

// --- Iteration ---
// NOTE: forEachTile allocates a fresh Tile object per cell. For a 20x20 board
// that's 400 allocations per call. Fine for game code, but avoid in hot paths.
// If perf iteration is needed, use direct array access or consider a callback
// with primitives: (idx, type, owner, units) => void.
Board.forEachTile(board, fn: (tile: Tile) => void): void

// --- Index helpers ---
Board.toIndex(board, x, y): number
Board.toXY(board, idx): { x: number; y: number }
```

### 2. Perf Path (solver, serialization, production loops)

Direct array access for reads. No objects created, no function call overhead. All mutations that affect stats go through `processStep` or `Board` mutation methods — callers never do manual stat fixup.

```ts
// Clone: 3x typed array slice + copy primitives + [...stats]
function cloneBoard(board: FlatBoard): FlatBoard

// Read (direct array access — this is the perf win)
const idx = y * board.width + x;
board.types[idx]   // TileType
board.owners[idx]  // playerIndex or -1
board.units[idx]   // unit count

// Mutate: always through processStep or Board API (maintains stats internally)
// Never do raw writes + manual stat fixup — too error-prone.
```

---

## Direction & Navigation Helpers

Moves use the existing `Direction` enum (UP, DOWN, LEFT, RIGHT), not raw offsets. Conversion to index happens at point of use via helpers. All helpers take `board` as first argument.

```ts
// Direction enum → neighbor index, or -1 if out of bounds
Board.neighbor(board, idx, dir): number

// Individual direction helpers (convenience wrappers)
Board.neighborUp(board, idx): number
Board.neighborDown(board, idx): number
Board.neighborLeft(board, idx): number
Board.neighborRight(board, idx): number

// Coord → index
Board.toIndex(board, x, y): number
// Index → coord
Board.toXY(board, idx): { x: number; y: number }

// Check bounds
Board.isValidIndex(board, idx): boolean
Board.isValidCoord(board, x, y): boolean
```

Factory shorthands (e.g., `nb = makeNeighborHelpers(board); nb.U(idx)`) are not part of the core API but can be created locally in call sites like the solver where many neighbor lookups happen in tight blocks.

---

## processStep

Operates on the perf path. Takes board + tick + move, mutates board in place.

```ts
function processStep(
  board: FlatBoard,
  move: FlatMove | null,
  tick: number,
  timing: TimingConfig,
): void {
  // 1. Validate + apply move
  if (move) {
    validateAndApplyMove(board, move);
  }

  // 2. Production (scan flat arrays, increment units, fixup stats)
  applyProduction(board, tick, timing);
}
```

### applyMove internals

Handles the same cases as current `engine.ts`. All mutations done as direct array writes. Stats are maintained internally by `applyMove` — callers never adjust stats.

1. **Dest is mountain** — rejected by validation (invalid move)
2. **Dest is blank** — convert to ARMY, transfer units, `landCount++`
3. **Dest is friendly** — merge units (stats unchanged, just redistribution)
4. **Dest is enemy, defender wins** — reduce attacker, reduce defender, adjust `armyCounts`
5. **Dest is enemy, attacker wins** — capture tile, transfer ownership, adjust land/army stats
6. **Dest is enemy general** — capture, convert to PLAYER_CITY, transfer all defeated player's tiles, adjust all stats

Note: NEUTRAL_CITY is not handled in the initial implementation (see Type Constants section).

### applyProduction internals

Scans flat arrays. On general/city production tick: `units++` for GENERAL and PLAYER_CITY tiles. On land production tick: `units++` for all player-owned tiles. Stats adjusted accordingly.

---

## Incremental Stats

`stats.landCounts[playerIndex]` and `stats.armyCounts[playerIndex]` are updated on every mutation:

| Operation | landCount | armyCount |
|---|---|---|
| Capture blank | +1 | +(units placed) |
| Move to friendly | — | — (redistribution) |
| Attack enemy, lose | — | -(units lost) for attacker |
| Attack enemy, win | +1 attacker, -1 defender | adjusted for both |
| General capture | +N (all defeated tiles) | adjusted |
| Production (city/general) | — | +1 per producing tile |
| Production (all land) | — | +landCount for that player |

---

## FlatMove

```ts
type FlatMove = {
  src: number;        // flat index of source tile
  dir: Direction;     // Direction enum (UP/DOWN/LEFT/RIGHT)
} | null;             // null = wait
```

Direction is the portable enum, not a raw offset. Converted to a destination index via helpers at point of use.

---

## Serialization (future)

Not implemented now, but the representation is designed for it:

```ts
Board.serialize(board): ArrayBuffer     // concat typed arrays + small header
Board.deserialize(buf): FlatBoard

Board.diff(prev, next): TileDelta[]     // changed indices only
Board.applyDiff(board, deltas): void
```

For a 20x20 board: ~1.2KB binary vs ~10-20KB JSON currently.

---

## Conversion (migration bridge)

For incremental adoption alongside existing code:

```ts
Board.fromGameState(gs: GameState): FlatBoard
Board.toGameState(board: FlatBoard): GameState
```

Used by the solver to convert the initial board, and to convert results back for output/scoring that still uses `GameState`.

---

## Clone

```ts
function cloneBoard(board: FlatBoard): FlatBoard {
  return {
    types: board.types.slice(),
    owners: board.owners.slice(),
    units: board.units.slice(),
    width: board.width,
    height: board.height,
    stats: {
      landCounts: [...board.stats.landCounts],
      armyCounts: [...board.stats.armyCounts],
    },
  };
}
```

Three typed array `.slice()` calls (~250 bytes for 7x7) + two small `number[]` spreads. This is the core perf win — replaces `structuredClone` of the entire object graph.

---

## File Structure

```
packages/algos/src/core-next/
  flat-board.ts        — FlatBoard type, TileType, clone, Board namespace (ergonomic + nav API)
  process-step.ts      — processStep, applyMove, applyProduction
  convert.ts           — GameState <-> FlatBoard conversion bridge
```

---

## Correctness Strategy

Smoke tests comparing flat `processStep` output against existing core `processStep`:
- Run identical sequences of moves through both implementations
- Compare resulting board state (tile-by-tile) and player stats
- Start with basic cases: movement to blank, friendly merge, production ticks

More thorough test coverage later, potentially re-using existing core test cases.

---

## Decisions Made (from design review)

- **No manual stat fixup** — `processStep` and `Board` mutation methods own all stat maintenance. Callers never write stats directly. The perf path's advantage is direct array *reads*, not writes.
- **Int32Array for units** — Avoids silent overflow on large boards / long games. Extra ~100 bytes per clone on 7x7, negligible.
- **NEUTRAL_CITY deferred** — Not in initial impl. Value 2 reserved. Needs capture semantics (garrison mechanic) before adding.
- **Stats are `number[]`** — Cloned with `[...arr]`. Tiny arrays (2-8 elements), typed array consistency not worth the ergonomic cost.
- **No helper factories in core API** — `Board.neighbor(board, idx, dir)` takes board as arg. Solver can create local shorthands if needed.

## Open Questions

- **Stats on board vs separate:** Convenient for solver (clone copies them). May want a different home in game code where stats serve multiple purposes (UI display, scoring, win condition checks). Revisit during port.
- **Tile view object shape:** Current design returns `{ type, owner, units, x, y, idx }`. Might want type narrowing (player tile vs neutral tile) like the current discriminated union. Could add a `isPlayerTile()` type guard that narrows. Not needed yet.
- **Naming:** `FlatBoard` is a working name. Would likely become `BoardState` if/when this replaces the current implementation in `@core`.
