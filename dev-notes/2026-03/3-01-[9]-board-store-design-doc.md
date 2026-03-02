# BoardStore Design Doc

Detailed design for replacing Zustand-based game state management with a framework-agnostic plain JS state layer.

---

## Core Concept

The state layer produces "here's what each tile looks like right now" as plain data. The renderer just receives that data and draws it. Diffing happens in between.

```
stuff happens (tick arrives, user clicks, etc.)
  → source state updates (plain JS)
  → derived state recomputed (plain JS)
  → per-tile data computed (plain JS)
  → diff against previous frame, in-place (plain JS)
  → notify only changed tiles
  → changed tiles re-render
```

---

## Design Principles

- **Plain JS / framework-agnostic.** All state management, derivation, and diffing is pure JS/TS. Zero React dependencies in the core.
- **One path for everything.** Tick updates and UI changes (selection, etc.) go through the same compute → diff flow. No special fast paths for now.
- **Per-tile diffing.** State layer diffs tile data and only notifies tiles that changed. Renderer doesn't decide what to re-render — the state layer does.
- **Pure functions for computation.** `BoardStore` is a thin manager. The actual computation (derived state, frame building, diffing) lives in pure functions, testable in isolation.
- **Single tile data type.** One `TileData` interface used for both diffing and rendering. No separate internal vs render format.
- **Rendering is declarative.** Tile components receive tile data and draw it. No "should I re-render?" logic in the renderer.

---

## State Architecture

### Three Buckets of State

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
├── visibleSquares: Set<string>    ← f(board, currentPlayerIndex, status)
└── allVisible: boolean            ← true when status === 'ended' or currentPlayerIndex === null
    (future derived values go here)
```

### Data Flow

Each of the types and functions below is detailed in later sections.

```
BoardSourceState + UIState
  → computeDerivedState() → DerivedState
  → computeFrameAndDiff() → updates TileData[] in place, produces FrameDiff
  → notifyChangedTiles() → per-tile subscriber callbacks fire
  → (React bridge) getTileData() → cached TileData for changed tiles only
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
  allVisible: boolean;
}

// Everything needed to compute a frame
interface FrameInputs {
  source: BoardSourceState;
  ui: UIState;
  derived: DerivedState;
}
```

### What's NOT in BoardStore

These concerns stay in separate page-level stores/context — they are not the board store's responsibility:

- `game: GameWithPlayers` — the full game entity
- `playersByIndex`, `playersByUserId`, `currentPlayer` — player lookup maps
- `gameplayReady` — the guard flag that gates tick processing before setup completes. The gameplay action that calls `store.applyTick()` checks this, not the store itself.
- `countdownActive`, `countdownSeconds` — pre-game countdown UI
- `lastExecutedMove`, `moveHistoryCache` — sandbox-specific concerns that live alongside the store as separate state (e.g. a plain `Map` or variable in the sandbox domain)

---

## Tile Data

### TileData Interface

One typed interface used for both diffing and rendering. Field-by-field `===` comparison is just as fast as comparing flat number arrays, so there's no need for a separate internal format.

```ts
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
```

### Design Decisions

- **No `isAdjacentToSelected` field.** `isValidMove` is computed directly in `computeTileData` — it's what the renderer actually uses. Adjacency was only ever an intermediate value.
- **`isSelectable` is uniform across all modes:** `!isSelected && status !== 'ended' && isPlayerSquare(square)`. Gameplay currently has different logic — this is a bug to fix; puzzle/sandbox have the correct behavior.
- **Future compact wire format.** `TileData` could be populated from flat number arrays at the network boundary. The rest of the system wouldn't need to change. Leave a code comment noting this opportunity.

### Conversion to TileRendererProps

`TileData` is close to `TileRendererProps` but not identical — `TileRenderer` takes a `square: Square` object. A thin `toTileRendererProps(tile: TileData): TileRendererProps` function bridges the gap by nesting `type`, `playerIndex`, and `armyCount` into a `square` object.

---

## Frame Computation and Diffing

With the state buckets and tile data shape defined, here's how frames are computed and diffed.

### Pure Functions

```ts
// Recompute derived state from source + UI
function computeDerivedState(source: BoardSourceState, ui: UIState): DerivedState {
  const allVisible = source.status === 'ended' || source.currentPlayerIndex === null;
  const visibleSquares = allVisible
    ? new Set<string>()
    : Board.getVisibleSquares(source.board, source.currentPlayerIndex);
  return { visibleSquares, allVisible };
}

// Compute tile data for a single tile
function computeTileData(inputs: FrameInputs, coord: Coord): TileData {
  // reads square from board, checks visibility, selection, borders, queued dirs
  // isSelectable = !isSelected && status !== 'ended' && isPlayerSquare(square)
  // isValidMove = isAdjacent(selectedTile, coord) && !isMountain(square)
  // isVisible = allVisible || visibleSquares.has(coordKey)
  // hasTopBorder = isVisible || topNeighborIsVisible
  // hasLeftBorder = isVisible || leftNeighborIsVisible
  // queuedDirections = derived from queuedMoves where source coord matches
}

// Fast equality check for two TileData objects
function tilesEqual(a: TileData, b: TileData): boolean {
  return a.type === b.type
    && a.playerIndex === b.playerIndex
    && a.armyCount === b.armyCount
    && a.isVisible === b.isVisible
    && a.neighborVisTop === b.neighborVisTop
    && a.neighborVisLeft === b.neighborVisLeft
    && a.isSelected === b.isSelected
    && a.isSelectable === b.isSelectable
    && a.isValidMove === b.isValidMove
    && a.hasTopBorder === b.hasTopBorder
    && a.hasLeftBorder === b.hasLeftBorder
    && a.queuedDirections === b.queuedDirections;
    // queuedDirections: reference equality works if we reuse the same Set
    // instance when directions haven't changed (see computeTileData)
}
```

### In-Place Frame Computation with Diffing

Instead of keeping two full frame arrays and swapping, we keep one frame and diff before overwriting each tile. For each tile: compute new data, compare against the current frame entry, if different → add to diff and update in place.

```ts
function computeFrameAndDiff(
  inputs: FrameInputs,
  frame: TileData[],         // mutated in place
  width: number,
  height: number,
): FrameDiff {
  const changes: TileChange[] = [];

  Board.forEachCoord(inputs.source.board, (coord, index) => {
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

### Diff Output

```ts
interface TileChange {
  coord: Coord;
  index: number;        // flat index into frame array
  data: TileData;
}

type FrameDiff = TileChange[];
```

### Null Board Handling

When `board` is null (before game setup), `applyUpdate` returns an empty `FrameDiff` and skips computation. On first `init()` with a board, all tiles are treated as changed (no previous frame to compare against — `oldTile` is undefined).

---

## BoardStore Class

The orchestrator. Holds mutable state, runs the update flow, manages subscriptions.

### Instance Lifecycle

Exposed as a **module-level singleton**, like current Zustand stores. Actions, handlers, and keyboard code import it directly.

```ts
// NOTE: Module singleton for now. If we ever need multiple boards on screen
// simultaneously (e.g. replay comparison view), upgrade to a factory/context
// pattern. The class itself supports multiple instances — the singleton is
// just the default access pattern.
const boardStore = new BoardStore();
```

`reset()` clears all state, frames, and subscriber maps. Called on navigation away from a game page, or before `init()` for a new game. Ensures no stale subscribers or state leak between sessions.

### Class Shape

```ts
class BoardStore {
  // State buckets
  source: BoardSourceState;
  ui: UIState;
  derived: DerivedState;

  // Board dimensions
  width: number;
  height: number;

  // Frame state — single array, updated in place
  frame: TileData[];

  // Cached TileData per coord for snapshot stability (see React Bridge section).
  // Only updated for tiles in the FrameDiff. getTileData() returns the cached
  // object, ensuring referential stability when nothing has changed.
  private tileDataCache: Map<string, TileData>;

  // Subscriptions — plain JS, framework-agnostic. Any consumer (React, canvas,
  // debug tools, etc.) can subscribe. Currently React is the only consumer.
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

  subscribeTile(coord, callback): () => void    // returns unsubscribe fn
  subscribe(callback): () => void               // board-level, returns unsubscribe fn

  // --- Public API: Read ---

  getTileData(coord): TileData     // returns cached object (referentially stable)
  // source is directly accessible for HUD/chrome components
}
```

### Internal Update Flow

Every public method that changes state calls the shared `applyUpdate()`:

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

private applyUpdate(): FrameDiff {
  if (!this.source.board) return [];

  this.derived = computeDerivedState(this.source, this.ui);
  const diff = computeFrameAndDiff(
    { source: this.source, ui: this.ui, derived: this.derived },
    this.frame, this.width, this.height,
  );
  this.updateTileDataCache(diff);
  this.notifyChangedTiles(diff);
  this.notifyBoardSubscribers();
  // NOTE: Subscriber callbacks fire synchronously. React batches
  // useSyncExternalStore notifications, so re-entrancy is not expected.
  // Non-React consumers should not call back into BoardStore from a callback.
  return diff;
}
```

### Board-Level Subscriber Contract

`subscribe(callback)` registers a board-level listener. The callback fires on every `applyUpdate()` call. It takes no arguments — the consumer reads `store.source` to get current state. This matches the `useSyncExternalStore` contract.

Per-tile precision matters for the grid (hundreds of tiles). Board-level subscribers are few (HUD, header, stats) and cheap to re-render, so coarse notification is fine here. Granular board-level selectors can be added later if needed.

---

## React Bridge

Uses `useSyncExternalStore` — the standard React API for external stores. Per-tile subscriptions via `BoardStore`'s subscriber map.

### Snapshot Stability (Critical)

`useSyncExternalStore` calls `getSnapshot` during render and on every store notification. If `getSnapshot` returns a new object reference when nothing has changed, React detects a "change" and re-renders, which calls `getSnapshot` again — infinite loop.

To prevent this, `BoardStore` maintains a `tileDataCache` (`Map<string, TileData>`) that is only updated for tiles in the `FrameDiff`. `getTileData(coord)` returns the cached object, which is referentially stable across renders when the tile hasn't changed.

### Per-tile hook

```ts
function useTileData(store: BoardStore, coord: Coord): TileData {
  return useSyncExternalStore(
    (callback) => store.subscribeTile(coord, callback),
    () => store.getTileData(coord),
  );
}
```

- `subscribeTile` registers a callback for that coord
- `getTileData` returns the **cached** `TileData` — referentially stable
- React only re-renders this tile when its subscriber fires (tile was in the `FrameDiff`)
- No React.memo needed — only notified tiles re-evaluate, only changed tiles get new objects

### Board-level hook (for HUD / chrome)

```ts
function useBoardSourceState(store: BoardStore): BoardSourceState {
  return useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.source,
  );
}
```

### Click handler / interaction wiring

`BoardStore` is framework-agnostic and does not own click handlers. The tile wrapper component wires interactions:

```ts
function BoardTile({ store, coord }: { store: BoardStore; coord: Coord }) {
  const tile = useTileData(store, coord);
  const onClick = tile.isSelectable ? () => store.setSelectedTile(coord) : undefined;
  return <TileRenderer {...toTileRendererProps(tile)} onClick={onClick} />;
}
```

This replaces the current `GameTile`/`PuzzleTile`/`SandboxTile` wrappers with a single `BoardTile` that works for all modes.

---

## File Structure

```
apps/frontend/src/domains/games/board-store/
├── board-store.ts          // BoardStore class + module singleton
├── types.ts                // BoardSourceState, UIState, DerivedState, TileData, FrameDiff, etc.
├── tile-data.ts            // TileData helpers, tilesEqual, computeTileData
├── frame-computation.ts    // computeFrameAndDiff, computeDerivedState
└── react-bridge.ts         // useTileData, useBoardSourceState, BoardTile component
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

### Multiple Boards on Screen
If we ever need two boards simultaneously (replay comparison, tutorial overlay, etc.), upgrade the module singleton to a factory/context pattern. The `BoardStore` class already supports multiple instances.

### Anti-Cheat (Server-Side Filtering)
Currently the server sends full board state. Eventually it should only send data the player is allowed to see. This is an upstream concern — `BoardStore` works the same either way.

### Compact Wire Format
`TileData` could be populated from flat number arrays at the network boundary. The conversion would happen once on arrival, and the rest of the system works with typed `TileData` objects.
