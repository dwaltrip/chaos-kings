# BoardStore Implementation Plan

Detailed step-by-step plan for implementing the BoardStore.

---

## File Order

1. `types.ts` — all type definitions
2. `tile-data.ts` — `computeTileData`, `tilesEqual`, `toTileRendererProps`
3. `frame-computation.ts` — `computeDerivedState`, `computeFrameAndDiff`
4. `board-store.ts` — `BoardStore` class + singleton
5. `react-bridge.ts` — `useTileData`, `useBoardSourceState`, `BoardTile`

Tests written first (TDD), then implementation files in order above.

---

## Step 1: types.ts

All type definitions. No logic, no imports from `@core` types beyond re-use.

```ts
// Imports needed:
import type { BoardState, Coord, CorePlayerState, Direction, Movement, PlayerIndex, SquareType } from '@core/types';
import type { Player } from '@platform/domains/games/types';

interface BoardSourceState {
  board: BoardState | null;
  tick: number;
  status: 'active' | 'ended';
  players: Player[];
  currentPlayerIndex: PlayerIndex | null;
  queuedMoves: Movement[];
  playerStats: CorePlayerState[];
  winner: PlayerIndex | null;
}

interface UIState {
  selectedTile: Coord | null;
}

interface DerivedState {
  visibleSquares: Set<string>;
  allVisible: boolean;
}

interface FrameInputs {
  source: BoardSourceState;
  ui: UIState;
  derived: DerivedState;
}

interface TileData {
  coord: Coord;
  type: SquareType;
  playerIndex: number;       // -1 for unowned
  armyCount: number;         // 0 for none
  isVisible: boolean;
  neighborVisTop: boolean;
  neighborVisLeft: boolean;
  isSelected: boolean;
  isSelectable: boolean;
  isValidMove: boolean;
  hasTopBorder: boolean;
  hasLeftBorder: boolean;
  queuedDirections: Set<Direction>;
}

interface TileChange {
  coord: Coord;
  index: number;
  data: TileData;
}

type FrameDiff = TileChange[];
```

**Notes:**
- `playerIndex: number` with -1 for unowned (neutral squares). Avoids `playerIndex | null` which adds null checks everywhere.
- `armyCount: number` with 0 for neutral squares (they have no `units` field).
- `queuedDirections: Set<Direction>` — empty set for no queued moves. Reference equality for diffing (reuse same empty set when unchanged).

---

## Step 2: tile-data.ts

Three functions:

### `computeTileData(inputs: FrameInputs, coord: Coord): TileData`

Logic:
1. Get square from board: `Board.getSquare(inputs.source.board, coord)`
2. Determine visibility:
   - `isVisible = derived.allVisible || derived.visibleSquares.has(serializeCoord(coord))`
3. Neighbor visibility (for borders):
   - `neighborVisTop = coord.y > 0 && (derived.allVisible || derived.visibleSquares.has(serializeCoord({x: coord.x, y: coord.y - 1})))`
   - `neighborVisLeft = coord.x > 0 && (derived.allVisible || derived.visibleSquares.has(serializeCoord({x: coord.x - 1, y: coord.y})))`
4. Selection:
   - `isSelected = areCoordsEqual(ui.selectedTile, coord)`
5. `isSelectable`:
   - `!isSelected && source.status !== 'ended' && isPlayerSquare(square) && square.playerIndex === source.currentPlayerIndex`
   - Note: design doc says `isPlayerSquare(square)` but we also need to check it's the current player's square. Only the current player can select their own tiles.
   - Wait — design doc says just `isPlayerSquare(square)`. Let me re-read... The design doc says: `isSelectable = !isSelected && status !== 'ended' && isPlayerSquare(square)`. The review (1b) noted gameplay has different logic. The design doc chose the puzzle/sandbox behavior as correct. So: `isPlayerSquare(square)` only, no playerIndex check.
   - Actually, thinking more: in gameplay you can only select YOUR tiles. This is inherently correct because `isPlayerSquare` checks if it's owned by any player — but you'd only want to select tiles you own. The currentPlayerIndex check makes sense for gameplay. But the design doc explicitly says no... Let me follow the design doc: `!isSelected && status !== 'ended' && isPlayerSquare(square)`.
6. `isValidMove`:
   - `ui.selectedTile !== null && isAdjacentTo(ui.selectedTile, coord) && !isMountainSquare(square)`
7. Borders:
   - `hasTopBorder = isVisible || neighborVisTop`
   - `hasLeftBorder = isVisible || neighborVisLeft`
8. `queuedDirections`:
   - Filter `source.queuedMoves` for moves where `areCoordsEqual(move.sourceCoord, coord)`, collect directions into a Set.
   - Optimization: reuse `EMPTY_DIRECTIONS` set when no queued moves match (enables reference equality in `tilesEqual`).

**Imports needed:**
- `Board` from `@core/board` (for `getSquare`, `isPlayerSquare`)
- `isMountainSquare` from `@core/square`
- `serializeCoord`, `areCoordsEqual` from `@core/utils/coordinate-utils`
- `isAdjacentTo` from `@/domains/gameplay/utils/tile-utils`
- Types from `./types`

### `tilesEqual(a: TileData, b: TileData): boolean`

Field-by-field `===` comparison. 12 comparisons. `queuedDirections` uses reference equality.

### `toTileRendererProps(tile: TileData): TileRendererProps`

Bridges `TileData` → `TileRendererProps` format. The main difference: `TileRendererProps` takes a `square: Square` object. Construct the square from TileData fields:

```ts
function toTileRendererProps(tile: TileData): Omit<TileRendererProps, 'onClick'> {
  const square = tile.playerIndex >= 0
    ? { coord: tile.coord, type: tile.type as PlayerSquareType, playerIndex: tile.playerIndex, units: tile.armyCount }
    : { coord: tile.coord, type: tile.type as NeutralSquareType };
  return {
    coord: tile.coord,
    square,
    isVisible: tile.isVisible,
    hasTopBorder: tile.hasTopBorder,
    hasLeftBorder: tile.hasLeftBorder,
    isSelected: tile.isSelected,
    isSelectable: tile.isSelectable,
    isValidMove: tile.isValidMove,
    queuedDirections: tile.queuedDirections.size > 0 ? tile.queuedDirections : undefined,
  };
}
```

Note: Omits `onClick` since that's wired in the React bridge.

---

## Step 3: frame-computation.ts

### `computeDerivedState(source: BoardSourceState, ui: UIState): DerivedState`

```ts
function computeDerivedState(source: BoardSourceState, ui: UIState): DerivedState {
  const allVisible = source.status === 'ended' || source.currentPlayerIndex === null;
  const visibleSquares = allVisible || !source.board
    ? new Set<string>()
    : Board.getVisibleSquares(source.board, source.currentPlayerIndex!);
  return { visibleSquares, allVisible };
}
```

### `computeFrameAndDiff(inputs, frame, width, height): FrameDiff`

```ts
function computeFrameAndDiff(
  inputs: FrameInputs,
  frame: TileData[],
  width: number,
  height: number,
): FrameDiff {
  const changes: TileChange[] = [];
  const board = inputs.source.board!; // caller guarantees non-null

  Board.forEachCoord(board, (coord, _square) => {
    const index = coord.y * width + coord.x;
    const newTile = computeTileData(inputs, coord);
    const oldTile = frame[index];

    if (!oldTile || !tilesEqual(oldTile, newTile)) {
      changes.push({ coord, index, data: newTile });
      frame[index] = newTile;
    }
  });

  return changes;
}
```

**Key note:** `forEachCoord` gives `(coord, square)` not `(coord, index)`. We compute the flat index as `coord.y * width + coord.x`.

---

## Step 4: board-store.ts

### Constructor / initial state

```ts
class BoardStore {
  source: BoardSourceState;
  ui: UIState;
  derived: DerivedState;
  width: number;
  height: number;
  frame: TileData[];
  private tileDataCache: Map<string, TileData>;
  private tileSubscribers: Map<string, Set<() => void>>;
  private boardSubscribers: Set<() => void>;

  constructor() {
    this.source = createDefaultSourceState();
    this.ui = { selectedTile: null };
    this.derived = { visibleSquares: new Set(), allVisible: false };
    this.width = 0;
    this.height = 0;
    this.frame = [];
    this.tileDataCache = new Map();
    this.tileSubscribers = new Map();
    this.boardSubscribers = new Set();
  }
}
```

`createDefaultSourceState()` returns the zero-value BoardSourceState (null board, tick 0, etc.).

### Public API

**init(players, currentPlayerIndex, board?)**
- Set `source.players`, `source.currentPlayerIndex`
- If board provided: set `source.board`, `width`, `height`, reset frame array
- Call `applyUpdate()` and return diff

**applyTick(tick, board, queuedMoves, playerStats, winner?)**
- Update source fields
- Call `applyUpdate()` and return diff

**setStatus(status)**
- `this.source.status = status`
- Call `applyUpdate()` and return diff

**setSelectedTile(coord | null)**
- `this.ui.selectedTile = coord`
- Call `applyUpdate()` and return diff

**addQueuedMove(move)**
- `this.source.queuedMoves = [...this.source.queuedMoves, move]`
- Call `applyUpdate()` and return diff

**setQueuedMoves(moves)**
- `this.source.queuedMoves = moves`
- Call `applyUpdate()` and return diff

**undoLastQueuedMove()**
- `this.source.queuedMoves = this.source.queuedMoves.slice(0, -1)`
- Call `applyUpdate()` and return diff

**reset()**
- Reset all state to defaults, clear frame, clear caches, clear all subscriber maps

### Private methods

**applyUpdate(): FrameDiff**
- If `!this.source.board` return `[]`
- Recompute derived state
- Call `computeFrameAndDiff`
- Update tileDataCache for changed tiles
- Notify changed tile subscribers
- Notify board subscribers
- Return diff

**updateTileDataCache(diff: FrameDiff)**
- For each change in diff: `this.tileDataCache.set(serializeCoord(change.coord), change.data)`

**notifyChangedTiles(diff: FrameDiff)**
- For each change in diff: get subscribers for `serializeCoord(change.coord)`, call each

**notifyBoardSubscribers()**
- Call each callback in `this.boardSubscribers`

### Subscription API

**subscribeTile(coord, callback): () => void**
- Add callback to `tileSubscribers` map under `serializeCoord(coord)`
- Return unsubscribe function that removes it

**subscribe(callback): () => void**
- Add to `boardSubscribers`
- Return unsubscribe function

**getTileData(coord): TileData**
- Return `this.tileDataCache.get(serializeCoord(coord))` or a default "empty" TileData

### Module singleton

```ts
const boardStore = new BoardStore();
export { BoardStore, boardStore };
```

---

## Step 5: react-bridge.ts

Thin React glue. No tests in this session.

### `useTileData(store, coord)`
```ts
function useTileData(store: BoardStore, coord: Coord): TileData {
  return useSyncExternalStore(
    (cb) => store.subscribeTile(coord, cb),
    () => store.getTileData(coord),
  );
}
```

### `useBoardSourceState(store)`
```ts
function useBoardSourceState(store: BoardStore): BoardSourceState {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.source,
  );
}
```

### `BoardTile` component
```tsx
function BoardTile({ store, coord }: { store: BoardStore; coord: Coord }) {
  const tile = useTileData(store, coord);
  const onClick = tile.isSelectable ? () => store.setSelectedTile(coord) : undefined;
  return <TileRenderer {...toTileRendererProps(tile)} onClick={onClick} />;
}
```

---

## Test Plan (Phase 1)

Tests live in `apps/frontend/src/domains/games/board-store/__tests__/board-store.test.ts`.

### Test helper: `createTestBoard(width, height, squares?)`
Creates a `BoardState` with a grid of blank squares, optionally overriding specific squares. This avoids repetitive board setup in every test.

### Test helper: `createTestInputs(overrides?)`
Creates a default `FrameInputs` with sensible defaults, allowing partial overrides.

### Test categories:

**A. `computeTileData` (via integration through `computeFrameAndDiff`)**
1. Blank tile in fog → correct default values (not visible, no selection, etc.)
2. Player tile that's visible → correct playerIndex, armyCount, isVisible
3. Selected tile → isSelected true, isSelectable false
4. Tile adjacent to selected (non-mountain) → isValidMove true
5. Mountain adjacent to selected → isValidMove false
6. Tile with queued move → queuedDirections contains correct direction(s)
7. Border computation: visible tile with visible neighbor → borders true
8. Border computation: fog tile with no visible neighbors → borders false
9. `isSelectable` logic: player tile, not selected, game active → true
10. `isSelectable` logic: neutral tile → false
11. `isSelectable` logic: game ended → false

**B. `tilesEqual`**
1. Identical tiles → true
2. Different armyCount → false
3. Different queuedDirections reference → false
4. Same queuedDirections reference → true

**C. `computeDerivedState`**
1. Active game with currentPlayerIndex → visibleSquares computed, allVisible false
2. Ended game → allVisible true, visibleSquares empty
3. Spectator (currentPlayerIndex null) → allVisible true

**D. `computeFrameAndDiff`**
1. First frame (empty frame array) → all tiles in diff
2. No changes between frames → empty diff
3. Army count changes on one tile → only that tile in diff

**E. BoardStore integration**
1. `init` with board → all tiles in first diff
2. `applyTick` with changed board → correct tiles in diff
3. `setSelectedTile` → selection-related tiles in diff (old selected, new selected, adjacent tiles)
4. `setSelectedTile(null)` → previously selected tile changes
5. `addQueuedMove` → source tile gets queuedDirections
6. `undoLastQueuedMove` → source tile loses queuedDirections
7. `reset` → clears all state

**F. Subscriber notifications**
1. Tile subscriber only called for changed tiles
2. Board subscriber called on every update
3. Unsubscribe works (callback no longer called)
4. `reset` clears subscribers

**G. Snapshot stability (`getTileData`)**
1. `getTileData` returns same reference when tile unchanged
2. `getTileData` returns new reference when tile changed

---

## Implementation Order Summary

1. Write tests (all failing — TDD)
2. Implement `types.ts`
3. Implement `tile-data.ts` → some tests pass
4. Implement `frame-computation.ts` → more tests pass
5. Implement `board-store.ts` → all tests pass
6. Implement `react-bridge.ts` (no tests)
7. Code review + fix
8. Build + test verification
