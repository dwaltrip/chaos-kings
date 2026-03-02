# BoardStore Design Doc

Detailed design for replacing Zustand-based game state management with a framework-agnostic plain JS state layer.

---

## Core Concept

The state layer produces "here's what each tile looks like right now" as plain data. The renderer just receives that data and draws it. Diffing happens in between.

```
stuff happens (tick arrives, user clicks, etc.)
  → source state updates (plain JS)
  → derived state recomputed (plain JS)
  → per-tile data computed into internal format (plain JS)
  → diff against previous frame (plain JS)
  → notify only changed tiles
  → changed tiles re-render
```

---

## Design Principles

- **Plain JS / framework-agnostic.** All state management, derivation, and diffing is pure JS/TS. Zero React dependencies in the core.
- **One path for everything.** Tick updates and UI changes (selection, etc.) go through the same compute → diff flow. No special fast paths for now.
- **Per-tile diffing.** State layer diffs tile data and only notifies tiles that changed. Renderer doesn't decide what to re-render — the state layer does.
- **Pure functions for computation.** The `BoardStore` class is a thin manager. The actual computation (derived state, frame building, diffing) is done by pure functions that are testable in isolation.
- **Two tile data representations.** Internal format (flat numbers, optimized for diffing) and render format (ergonomic typed struct for UI components). Conversion only happens for changed tiles.
- **Rendering is declarative.** Tile components receive render data and draw it. No "should I re-render?" logic in the renderer.

---

## State Architecture

### Three Buckets of Source State

```
BoardSourceState (set by external inputs — server ticks, game lifecycle)
├── board: BoardState
├── tick: number
├── status: 'active' | 'ended'
├── players: Player[]
├── currentPlayerIndex: PlayerIndex | null
├── queuedMoves: Movement[]
├── playerStats: CorePlayerState[]
└── winner: PlayerIndex | null

UIState (set by user interaction)
└── selectedTile: Coord | null

DerivedState (computed from source + UI)
└── visibleSquares: Set<string>    ← f(board, currentPlayerIndex, status)
    (future derived values go here)
```

### Data Flow

```
BoardSourceState + UIState
  → computeDerivedState() → DerivedState
  → computeFrame() → TileDataTuple[] (current frame)
  → diffFrames(previous, current) → FrameDiff (list of changed tiles)
  → notifyChangedTiles() → per-tile subscriber callbacks fire
  → (React bridge) getTileRenderData() → TileRenderProps for changed tiles only
```

### Types

```ts
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
}

// Everything needed to compute a frame
interface FrameInputs {
  source: BoardSourceState;
  ui: UIState;
  derived: DerivedState;
}
```

---

## Tile Data

### Internal Format (TileDataTuple)

Flat array of numbers per tile, optimized for fast diffing. 13 fields.

```ts
type TileDataTuple = number[];

const TileField = {
  Type: 0,            // SquareType enum as int
  PlayerIndex: 1,     // -1 for unowned
  ArmyCount: 2,       // 0 for none
  IsVisible: 3,       // 0 | 1
  NeighborVisTop: 4,  // 0 | 1
  NeighborVisLeft: 5, // 0 | 1
  IsSelected: 6,      // 0 | 1
  IsAdjacentToSelected: 7, // 0 | 1
  IsSelectable: 8,    // 0 | 1
  IsValidMove: 9,     // 0 | 1
  HasTopBorder: 10,   // 0 | 1
  HasLeftBorder: 11,  // 0 | 1
  QueuedDirBitmask: 12, // 4 bits for NESW
} as const;

const TILE_FIELDS_COUNT = 13;
```

Typed helpers wrap the raw tuple for ergonomic access:

```ts
function getTileType(tile: TileDataTuple): SquareType { return tile[TileField.Type]; }
function isTileVisible(tile: TileDataTuple): boolean { return tile[TileField.IsVisible] === 1; }
// etc.

function createTileData(
  type: SquareType, playerIndex: number, armyCount: number,
  isVisible: boolean, neighborVisTop: boolean, neighborVisLeft: boolean,
  isSelected: boolean, isAdjacentToSelected: boolean,
  isSelectable: boolean, isValidMove: boolean,
  hasTopBorder: boolean, hasLeftBorder: boolean,
  queuedDirBitmask: number,
): TileDataTuple { ... }
```

### Render Format (TileRenderProps)

The "nice" format passed to UI components. Proper booleans, typed enums, etc. Matches current `TileRendererProps` data fields.

```ts
interface TileRenderProps {
  coord: Coord;
  square: Square;         // { type, playerIndex, armyCount }
  isVisible: boolean;
  hasTopBorder: boolean;
  hasLeftBorder: boolean;
  isSelected: boolean;
  isAdjacentToSelected: boolean;
  isSelectable: boolean;
  isValidMove: boolean;
  queuedDirections: Set<Direction>;
}
```

Conversion from internal → render only happens for changed tiles:

```ts
function toTileRenderData(tile: TileDataTuple, coord: Coord): TileRenderProps { ... }
```

---

## Frame Computation and Diffing

### Pure Functions

```ts
// Recompute derived state from source + UI
function computeDerivedState(source: BoardSourceState, ui: UIState): DerivedState {
  // visibleSquares = Board.getVisibleSquares(board, currentPlayerIndex)
  // (or all visible if status === 'ended')
}

// Build internal tile data for all tiles
function computeFrame(inputs: FrameInputs, width: number, height: number): TileDataTuple[] {
  // iterates all coords, calls computeTileData for each
}

// Compute data for a single tile
function computeTileData(inputs: FrameInputs, coord: Coord): TileDataTuple {
  // reads square from board, checks visibility, selection, borders, queued dirs
  // returns createTileData(...)
}

// Diff two frames, return list of changed tiles
function diffFrames(prev: TileDataTuple[], curr: TileDataTuple[]): FrameDiff {
  // 13 number comparisons per tile, collect changes
}

// Fast equality check for two tile tuples
function tilesEqual(a: TileDataTuple, b: TileDataTuple): boolean {
  for (let i = 0; i < TILE_FIELDS_COUNT; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
```

### Diff Output

```ts
interface TileChange {
  coord: Coord;
  index: number;        // flat index into frame array
  data: TileDataTuple;
}

type FrameDiff = TileChange[];
```

---

## BoardStore Class

The manager. Holds mutable state, orchestrates the update flow, manages subscriptions.

```ts
class BoardStore {
  // State buckets
  source: BoardSourceState;
  ui: UIState;
  derived: DerivedState;

  // Board dimensions
  width: number;
  height: number;

  // Frame state (2D array where each element is a TileDataTuple)
  currentFrame: TileDataTuple[];
  previousFrame: TileDataTuple[];

  // Subscriptions
  private tileSubscribers: Map<string, Set<() => void>>;
  private boardSubscribers: Set<() => void>;

  // --- Public API: Game lifecycle ---

  init(players, currentPlayerIndex, board?): FrameDiff
  applyTick(tick, board, queuedMoves, playerStats, winner?): FrameDiff
  setStatus(status): FrameDiff
  reset(): void

  // --- Public API: User interaction ---

  setSelectedTile(coord | null): FrameDiff
  addQueuedMove(move): FrameDiff
  setQueuedMoves(moves): FrameDiff
  undoLastQueuedMove(): FrameDiff

  // --- Public API: Subscriptions ---

  subscribeTile(coord, callback): () => void    // returns unsubscribe
  subscribe(callback): () => void               // board-level, returns unsubscribe
  // NOTE: subscription mechanism is plain JS — any consumer (React, canvas, etc.)
  // can subscribe. See "Multiple Consumers" note below.

  // --- Public API: Read ---

  getTileRenderData(coord): TileRenderProps
  // source is directly accessible for HUD/chrome components

  // --- Internal ---

  private applyUpdate(): FrameDiff {
    this.derived = computeDerivedState(this.source, this.ui);
    const newFrame = computeFrame(
      { source: this.source, ui: this.ui, derived: this.derived },
      this.width, this.height,
    );
    const diff = diffFrames(this.currentFrame, newFrame);
    this.previousFrame = this.currentFrame;
    this.currentFrame = newFrame;
    this.notifyChangedTiles(diff);
    this.notifyBoardSubscribers();
    return diff;
  }

  private notifyChangedTiles(diff: FrameDiff): void {
    for (const change of diff) {
      const subs = this.tileSubscribers.get(serializeCoord(change.coord));
      subs?.forEach(cb => cb());
    }
  }
}
```

Each public method updates source/UI state, then calls `applyUpdate()`:

```ts
applyTick(tick, board, queuedMoves, playerStats, winner?) {
  this.source.tick = tick;
  this.source.board = board;
  this.source.queuedMoves = queuedMoves;
  this.source.playerStats = playerStats;
  if (winner != null) this.source.winner = winner;
  return this.applyUpdate();
}

setSelectedTile(coord) {
  this.ui.selectedTile = coord;
  return this.applyUpdate();
}
```

---

## React Bridge

Uses `useSyncExternalStore` — the standard React API for external stores. Per-tile subscriptions via the `BoardStore`'s subscriber map.

### Per-tile hook

```ts
function useTileRenderData(store: BoardStore, coord: Coord): TileRenderProps {
  return useSyncExternalStore(
    (callback) => store.subscribeTile(coord, callback),
    () => store.getTileRenderData(coord),
  );
}
```

- `subscribeTile` registers a callback for that coord
- `getTileRenderData` converts the internal `TileDataTuple` → `TileRenderProps`
- React only re-renders this tile when its subscriber is notified (i.e. tile was in the FrameDiff)
- No React.memo needed — only notified tiles re-render

### Board-level hook (for HUD / chrome)

```ts
function useBoardSourceState(store: BoardStore): BoardSourceState {
  return useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.source,
  );
}
```

Or more granular selectors on top as needed.

---

## File Structure

```
apps/frontend/src/domains/games/board-store/
├── board-store.ts          // BoardStore class
├── types.ts                // BoardSourceState, UIState, DerivedState, FrameDiff, etc.
├── tile-data.ts            // TileDataTuple, TileField constants, helpers
├── frame-computation.ts    // computeFrame, computeDerivedState, computeTileData
├── frame-diff.ts           // diffFrames, tilesEqual
└── react-bridge.ts         // useTileRenderData, useBoardSourceState hooks
```

Lives in `domains/games/` since it's shared across gameplay, puzzles, sandbox, replay.

---

## Deferred / Future Work

### Tick Batching / rAF
If network hiccups cause back-to-back ticks, we currently process both immediately. Could queue ticks and apply on rAF boundary. Not needed at current tick rates (~0.5-1s). Leave code comment noting where this could be added.

### Diffing Raw Inputs (Optimization)
Currently we recompute all tile data every update and diff the output. An optimization would be to diff the raw inputs first (which tiles' source data changed?) and only recompute those tiles. Defer for now — compute everything, optimize later.

### Timeline Manipulation (Two Flavors)
Some sessions just receive ticks (gameplay). Others need jumpToTick, stepping backward, checkpoints (sandbox, replay, puzzles). `TimelineEngine` in `@core` handles the latter. The `BoardStore.applyTick()` interface works for both — the caller can push live ticks or jump and push a restored state. May need a `jumpToTick` method eventually.

### Multiple Consumers
The subscription mechanism (`subscribeTile`, `subscribe`) is plain JS. React happens to be the consumer via `useSyncExternalStore`, but a canvas renderer could call the same subscribe methods. Leave a code comment noting where additional consumers would hook in.

### Anti-Cheat (Server-Side Filtering)
Currently the server sends full board state. Eventually it should only send data the player is allowed to see. This is an upstream concern — `BoardStore` would work the same either way, it just receives whatever data arrives.

### Efficient Wire Format
The internal `TileDataTuple` (flat numbers) could align closely with a compact wire format. Currently game state is sent as full JSON. A future optimization: server sends flat number arrays, `BoardStore` slots them in directly. The internal format was designed with this in mind.
