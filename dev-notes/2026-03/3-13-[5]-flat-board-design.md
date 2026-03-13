# Flat Board Design — `core-v2`

## Motivation

The perfect-start solver's beam search clones game state ~50k times per run. `structuredClone` on the current `Square[][]` object graph (49 Square objects + Coord objects + 7 row arrays + grid array) is 80-98% of runtime. We need a representation that clones cheaply.

Beyond solver perf, this representation unlocks:
- **Compact binary serialization** for WebSocket (flat arrays *are* the wire format)
- **Cheap delta updates** (diff two arrays, send only changed indices)
- **Efficient fog of war** (bitmask over flat array)
- **Instant snapshots** for replay (`slice()` / `set()`)

This design is intended to eventually port back to the main game code. We're building it in `packages/algos/src/core-v2/` first, proving it in the solver context, then migrating.

---

## Data Structure

```ts
interface FlatBoard {
  types:  Uint8Array;   // TileType enum per cell
  owners: Int8Array;    // playerIndex or NO_OWNER (-1)
  units:  Int16Array;   // unit count (0 for non-player non-city tiles)
  width:  number;
  height: number;
  // Maintained incrementally by mutation API
  // NOTE: re-evaluate whether stats belong on the board during port to main game.
  // For solver context this is convenient; for game code, a separate concern might be cleaner.
  stats: {
    landCounts: number[];   // per player
    armyCounts: number[];   // per player
  };
}
```

Array length is always `width * height`. Cell at `(x, y)` is at index `y * width + x`.

### Type Constants

```ts
const TileType = {
  BLANK: 0,
  MOUNTAIN: 1,
  NEUTRAL_CITY: 2,
  ARMY: 3,
  GENERAL: 4,
  PLAYER_CITY: 5,
} as const;
type TileType = (typeof TileType)[keyof typeof TileType];

const NO_OWNER = -1;
```

These numeric values are a protocol — they show up in the wire format, the accessor layer, and the mutation API. Keep them stable.

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
Board.forEachTile(board, fn: (tile: Tile) => void): void

// --- Index helpers ---
Board.toIndex(board, x, y): number
Board.toXY(board, idx): { x: number; y: number }
```

### 2. Perf Path (solver, serialization, production loops)

Direct array access. No objects created, no function call overhead for reads. For mutations, callers are responsible for stat fixup.

```ts
// Clone: 3x typed array slice + copy primitives
function cloneBoard(board: FlatBoard): FlatBoard

// Read
const idx = y * board.width + x;
board.types[idx]   // TileType
board.owners[idx]  // playerIndex or -1
board.units[idx]   // unit count

// Mutate + manual stat fixup
board.units[srcIdx] = 1;
board.units[destIdx] = srcUnits - 1;
board.types[destIdx] = TileType.ARMY;
board.owners[destIdx] = playerIndex;
board.stats.landCounts[playerIndex]++;
```

---

## Direction & Navigation Helpers

Moves use the existing `Direction` enum (UP, DOWN, LEFT, RIGHT), not raw offsets. Conversion to index happens at point of use via helpers.

### Helper factories (closure over board)

```ts
// Index-based neighbors: given a flat index, return neighbor index or -1 if out of bounds
function makeNeighborHelpers(board: FlatBoard) {
  const { width, height } = board;
  const n = width * height;
  return {
    U: (idx: number) => idx >= width ? idx - width : -1,
    D: (idx: number) => idx + width < n ? idx + width : -1,
    L: (idx: number) => idx % width > 0 ? idx - 1 : -1,
    R: (idx: number) => idx % width < width - 1 ? idx + 1 : -1,
  };
}

// Coord-based: given (x, y), return flat index or -1
function makeMoveHelpers(board: FlatBoard) {
  const { width, height } = board;
  return {
    U: (x: number, y: number) => y > 0 ? (y - 1) * width + x : -1,
    D: (x: number, y: number) => y < height - 1 ? (y + 1) * width + x : -1,
    L: (x: number, y: number) => x > 0 ? y * width + (x - 1) : -1,
    R: (x: number, y: number) => x < width - 1 ? y * width + (x + 1) : -1,
  };
}

// Direction enum → neighbor index
function applyDirection(board: FlatBoard, idx: number, dir: Direction): number
```

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

Handles the same cases as current `engine.ts`:
1. **Dest is blank** — convert to ARMY, transfer units, `landCount++`
2. **Dest is friendly** — merge units
3. **Dest is enemy, defender wins** — reduce attacker, reduce defender
4. **Dest is enemy, attacker wins** — capture tile, transfer ownership
5. **Dest is enemy general** — capture, convert to PLAYER_CITY, transfer all defeated player's tiles

All mutations done as direct array writes + stat fixup.

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

## File Structure

```
packages/algos/src/core-v2/
  flat-board.ts        — FlatBoard type, TileType, clone, Board namespace (ergonomic API)
  process-step.ts      — processStep, validateAndApplyMove, applyProduction
  convert.ts           — GameState <-> FlatBoard
  helpers.ts           — makeNeighborHelpers, makeMoveHelpers, applyDirection
```

---

## Correctness Strategy

Smoke tests comparing flat `processStep` output against existing core `processStep`:
- Run identical sequences of moves through both implementations
- Compare resulting board state (tile-by-tile) and player stats
- Start with basic cases: movement to blank, friendly merge, production ticks

More thorough test coverage later, potentially re-using existing core test cases.

---

## Open Questions

- **Stats on board vs separate:** Convenient for solver (clone copies them). May want a different home in game code where stats serve multiple purposes (UI display, scoring, win condition checks). Revisit during port.
- **Tile view object shape:** Current design returns `{ type, owner, units, x, y, idx }`. Might want type narrowing (player tile vs neutral tile) like the current discriminated union. Could add a `isPlayerTile()` type guard that narrows.
- **Naming:** `FlatBoard` is a working name. Would likely become `BoardState` if/when this replaces the current implementation in `@core`.
