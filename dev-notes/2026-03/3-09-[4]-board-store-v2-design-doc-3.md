# BoardStore v2 — Design Doc 3: createStore + Centralized Pipeline

Third design iteration. Builds on the analysis of Docs 1 and 2, taking the strongest ideas from each: the generic `createStore` primitive for mutation lifecycle, and a centralized `onChange` pipeline for tile computation. No `KeyedStore` abstraction — tile caching and subscriptions are managed directly by BoardStore.

---

## Design Principles

1. **One generic primitive** — `createStore` owns mutation → onChange → version → notify. That's it.
2. **Centralized pipeline** — one function (`runPipeline`) iterates all tiles, diffs, caches, and notifies. One place to debug, profile, and optimize.
3. **Domain code owns domain infrastructure** — tile cache, tile subscribers, and derived state live in BoardStore, not in the generic lib.
4. **Pure actions** — state mutations are plain functions with no store knowledge.
5. **Framework-agnostic core** — React integration is a thin hook layer. The store has no React dependency.

---

## Why This Design

### What we learned from Docs 1 and 2

**Doc 1** (onChange + KeyedStore) had the right pipeline shape but introduced `KeyedStore` as a generic abstraction with no second use case. Speculative generality.

**Doc 2** (selector-based subscriptions) had a clean unified subscription model, but distributed tile computation across 400+ independent selectors. Harder to debug and optimize — you can't add dirty-region skipping or spatial culling when each subscriber runs in isolation.

### Why centralized pipeline wins

When you control the iteration, you can skip work. Concrete optimization paths that a centralized pipeline enables:

- **Dirty regions** — `setSelectedTile` affects ~10 tiles. Recompute only those, not all 400.
- **Spatial culling** — large scrollable maps or multi-layer boards can skip off-screen tiles entirely.
- **Direct buffer output** — for canvas/WebGL rendering, the pipeline can write directly to a render buffer instead of producing intermediate `TileData` objects.

None of these optimizations are needed now. But the centralized pipeline makes them additive — you don't need to rearchitect to add them.

### Why no KeyedStore

The only consumer of per-key subscriptions is tiles. A `Map<string, TileData>` cache and a `Map<string, Set<() => void>>` subscriber map do the job directly. If a second per-key use case appears (per-player stats, per-territory aggregates), we can extract the pattern then with a real use case to guide the API.

---

## Architecture Overview

```
+--------------------------------------+
|  Pure actions (no store knowledge)   |  — "what changes"
+------------------+-------------------+
                   | mutates
+------------------v-------------------+
|  BoardState  { source, ui }          |  — the data
+------------------+-------------------+
                   | triggers
+------------------v-------------------+
|  createStore lifecycle               |  — "when to propagate"
|  (mutate → onChange → version++      |
|   → board subscribers)               |
+------------------+-------------------+
                   | onChange calls
+------------------v-------------------+
|  runPipeline (centralized)           |  — "what's affected"
|  derive → iterate tiles → diff      |
|  → cache → notify per-tile subs     |
+------------------+-------------------+
                   | notifies
+------------------v-------------------+
|  React hooks / UI / future canvas    |  — "render it"
+--------------------------------------+
```

### Update Cycle (per action)

```
1. Caller invokes wrapped action        (e.g. setSelectedTile({x:1, y:1}))
2. Pure action mutates BoardState        (state.ui.selectedTile = coord)
3. createStore calls onChange             (runPipeline)
   a. Compute derived state              (visibility, queuedMovesMap)
   b. Early exit if no board
   c. For each tile coord:
      - computeTileData(state, derived, coord)
      - diff against tileCache
      - if changed: update cache, notify tile subscribers
4. createStore bumps version
5. createStore notifies board-level subscribers
```

Tile subscribers always see fresh data before board-level subscribers fire.

---

## Generic Store

`createStore` — ~30 lines, no domain knowledge. Owns the mutation lifecycle.

```ts
interface StoreConfig<State> {
  initialState: State;
  onChange?: (state: State) => void;
  onReset?: () => void;
}

function createStore<State>(config: StoreConfig<State>) {
  let state = config.initialState;
  let version = 0;
  const subscribers = new Set<() => void>();

  function makeAction<Args extends unknown[]>(
    fn: (state: State, ...args: Args) => void,
  ): (...args: Args) => void {
    return (...args: Args) => {
      fn(state, ...args);
      config.onChange?.(state);
      version++;
      for (const cb of subscribers) cb();
    };
  }

  function subscribe(cb: () => void): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  function reset(newState: State): void {
    state = newState;
    config.onReset?.();
    config.onChange?.(state);
    version = 0;
    for (const cb of subscribers) cb();
  }

  return {
    get state() { return state; },
    get version() { return version; },
    makeAction,
    subscribe,
    reset,
  };
}
```

### What createStore does

- Wraps pure action functions via `makeAction` — mutation triggers the full lifecycle automatically.
- Calls `onChange` after every mutation, before bumping version and notifying subscribers. This is where the board pipeline runs.
- Manages board-level subscribers (for `useSyncExternalStore`).
- `reset` replaces state, runs cleanup, then re-runs the full lifecycle.

### What createStore does NOT do

- No domain knowledge (tiles, boards, visibility).
- No derived state management — that's BoardStore's concern.
- No per-key subscriptions — that's BoardStore's concern.

### Design decisions

**State is mutated in place.** No immutability requirement. The diff function — not reference equality — determines what changed. This avoids the `Object.is` brittleness that caused the original Zustand problems.

**`onChange` runs before subscribers.** Tiles are computed and cached before board-level React components re-render. This guarantees consistency — a component that reads `boardStore.state` and then calls `boardStore.getTileData()` sees data from the same action.

**Version counter for board-level snapshots.** Used as the `useSyncExternalStore` snapshot for board-level hooks. Simple but may have tearing implications with React concurrent features — see Open Questions.

---

## Board-Specific Layer

### BoardState

Single state object with two buckets:

```ts
interface BoardState {
  source: BoardSourceState;
  ui: UIState;
}

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
```

### DerivedState

Computed inside `runPipeline` before tile iteration. Not part of BoardState — actions never see or touch it.

```ts
interface DerivedState {
  visibleSquares: Set<string>;
  allVisible: boolean;
  queuedMovesMap: Map<string, QueuedDirs>;
}

function deriveBoardState(state: BoardState): DerivedState {
  const { source } = state;
  const allVisible = source.status === 'ended' || source.currentPlayerIndex === null;
  const visibleSquares = allVisible || !source.board
    ? new Set<string>()
    : Board.getVisibleSquares(source.board, source.currentPlayerIndex!);
  const queuedMovesMap = buildQueuedMovesMap(source.queuedMoves);
  return { visibleSquares, allVisible, queuedMovesMap };
}
```

`queuedMovesMap` moves into derived state (from `computeFrameAndDiff` in the current code). It was always a shared precomputation step — derived state is its natural home.

### Pure Actions

Mutate BoardState in place. No store knowledge, no subscriptions, no return values.

```ts
function setStatus(state: BoardState, status: 'active' | 'ended'): void {
  state.source.status = status;
}

function setSelectedTile(state: BoardState, coord: Coord | null): void {
  state.ui.selectedTile = coord;
}

function addQueuedMove(state: BoardState, move: Movement): void {
  state.source.queuedMoves = [...state.source.queuedMoves, move];
}

function undoLastQueuedMove(state: BoardState): void {
  state.source.queuedMoves = state.source.queuedMoves.slice(0, -1);
}

function setQueuedMoves(state: BoardState, moves: Movement[]): void {
  state.source.queuedMoves = moves;
}

function applyTick(
  state: BoardState,
  tick: number,
  board: BoardState,
  queuedMoves: Movement[],
  playerStats: CorePlayerState[],
  winner?: PlayerIndex,
): void {
  state.source.tick = tick;
  state.source.board = board;
  state.source.queuedMoves = queuedMoves;
  state.source.playerStats = playerStats;
  if (winner != null) state.source.winner = winner;
}

function initBoard(
  state: BoardState,
  players: Player[],
  currentPlayerIndex: PlayerIndex | null,
  board: BoardState,
): void {
  state.source.players = players;
  state.source.currentPlayerIndex = currentPlayerIndex;
  state.source.board = board;
}
```

### createBoardStore

Composes the generic store with tile infrastructure and the centralized pipeline.

```ts
function createBoardStore() {
  let derived: DerivedState = createDefaultDerived();
  const tileCache = new Map<string, TileData>();
  const tileSubs = new Map<string, Set<() => void>>();

  function runPipeline(state: BoardState): void {
    derived = deriveBoardState(state);
    if (!state.source.board) return;

    Board.forEachCoord(state.source.board, (coord) => {
      const key = serializeCoord(coord);
      const next = computeTileData(state, derived, coord);
      const prev = tileCache.get(key);

      if (!prev || !tilesEqual(prev, next)) {
        tileCache.set(key, next);
        const subs = tileSubs.get(key);
        if (subs) for (const cb of subs) cb();
      }
    });
  }

  const store = createStore<BoardState>({
    initialState: createDefaultBoardState(),
    onChange: runPipeline,
    onReset: () => {
      derived = createDefaultDerived();
      tileCache.clear();
      tileSubs.clear();
    },
  });

  return {
    get state() { return store.state; },
    get derived() { return derived; },
    get version() { return store.version; },

    makeAction: store.makeAction,
    subscribe: store.subscribe,

    subscribeTile(coord: Coord, cb: () => void): () => void {
      const key = serializeCoord(coord);
      let subs = tileSubs.get(key);
      if (!subs) {
        subs = new Set();
        tileSubs.set(key, subs);
      }
      subs.add(cb);
      return () => { subs!.delete(cb); };
    },

    getTileData(coord: Coord): TileData {
      return tileCache.get(serializeCoord(coord)) ?? createDefaultTileData(coord);
    },

    reset() {
      store.reset(createDefaultBoardState());
    },
  };
}
```

### Module-Level Wiring

```ts
const boardStore = createBoardStore();

const setStatus = boardStore.makeAction(actions.setStatus);
const setSelectedTile = boardStore.makeAction(actions.setSelectedTile);
const addQueuedMove = boardStore.makeAction(actions.addQueuedMove);
const undoLastQueuedMove = boardStore.makeAction(actions.undoLastQueuedMove);
const setQueuedMoves = boardStore.makeAction(actions.setQueuedMoves);
const applyTick = boardStore.makeAction(actions.applyTick);
const initBoard = boardStore.makeAction(actions.initBoard);
```

---

## React Integration

### useTileData

```ts
function useTileData(coord: Coord): TileData {
  const subscribe = useCallback(
    (cb: () => void) => boardStore.subscribeTile(coord, cb),
    [coord.x, coord.y],
  );
  const getSnapshot = useCallback(
    () => boardStore.getTileData(coord),
    [coord.x, coord.y],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}
```

Per-tile reactivity: component only re-renders when that tile's data changes. `getTileData` returns the cached `TileData` object — referentially stable when unchanged.

### useBoardState

```ts
function useBoardState(): BoardState {
  const subscribe = useCallback(
    (cb: () => void) => boardStore.subscribe(cb),
    [],
  );
  const getSnapshot = useCallback(
    () => boardStore.version,
    [],
  );
  useSyncExternalStore(subscribe, getSnapshot);
  return boardStore.state;
}
```

Triggers re-render on any action. Used for game chrome (stats, tick display, status).

### BoardTile

Unchanged — calls `useTileData`, converts via `toTileRendererProps`, renders `TileRenderer`.

---

## Tile Computation

### computeTileData

Unchanged from current code. Takes `(state, derived, coord)` and returns a flat `TileData` struct with all 16 fields. Called once per tile per pipeline run.

The function signature changes slightly from the current code:
- **Current:** `computeTileData(inputs: FrameInputs, coord, queuedMovesMap)`
- **New:** `computeTileData(state: BoardState, derived: DerivedState, coord)`

`queuedMovesMap` moves into `DerivedState`, so it's accessed via `derived.queuedMovesMap` inside the function.

### tilesEqual

Unchanged. Field-by-field comparison of all 16 `TileData` fields. This is the diff function — if it returns true, the tile is skipped (no cache update, no notification).

### toTileRendererProps

Unchanged. Converts `TileData` to `TileRenderer` props.

---

## What Changes from Current Code

| Current | New |
|---|---|
| `BoardStore` class with methods (`applyTick`, `setSelectedTile`, etc.) | Pure action functions + `makeAction` wrapping |
| `applyUpdate()` private method (derive + compute + diff + cache + notify) | `runPipeline` as `onChange` callback — same work, called by the lib |
| `this.source`, `this.ui`, `this.derived` as class fields | `BoardState { source, ui }` as createStore's state; `derived` in closure |
| `this.frame: TileData[]` flat array | Dropped — `tileCache` Map is sufficient |
| `computeFrameAndDiff` builds `queuedMovesMap` internally | `queuedMovesMap` moves to `deriveBoardState` |
| `FrameDiff` return value from every method | No return value — pipeline notifies subscribers directly |
| `this.source = { ...this.source }` for snapshot detection | `version` counter instead |
| `width`, `height` as class fields | Read from `state.source.board.size` when needed |

### What stays the same

- `TileData` — same 16-field flat struct
- `tilesEqual` — same field-by-field comparison
- `computeTileData` — same per-tile computation (minor signature change)
- `toTileRendererProps` — unchanged
- `useTileData` / `useBoardSourceState` hooks — same pattern, minor simplification
- `BoardTile` component — unchanged
- Per-tile subscriber model — same `Map<string, Set<() => void>>`

---

## File Structure

```
board-store/
  lib/
    create-store.ts            — createStore<State> (~30 lines, generic)
  types.ts                     — BoardState, BoardSourceState, UIState, DerivedState, TileData
  actions.ts                   — pure state mutation functions
  derived.ts                   — deriveBoardState (visibility, queuedMovesMap)
  tile-derived-state.ts        — computeTileData + per-field helpers (getIsVisible, etc.)
  tile-data.ts                 — tilesEqual, toTileRendererProps
  board-store.ts               — createBoardStore factory (pipeline + tile infra)
  index.ts                     — module singleton, wrapped actions, exports
  hooks.ts                     — useTileData, useBoardState
  board-tile.tsx               — BoardTile component
  __tests__/
    create-store.test.ts       — generic store tests
    board-store.test.ts        — board-specific tests (existing, updated)
```

---

## Forward-Looking Considerations

### Optimization paths (not needed now, additive later)

**Dirty regions.** `runPipeline` currently iterates all tiles. To add dirty-region optimization: before the action mutates state, snapshot the fields that affect tile locality (e.g. `selectedTile`). After mutation, compute the set of affected coords and only iterate those. The rest of the pipeline is unchanged. This is additive — you modify `runPipeline`, nothing else.

**Spatial culling / viewport.** For large scrollable maps, `runPipeline` could accept a viewport bounds and skip tiles outside it. Tiles that scroll into view would need a full recompute on viewport change. Additive — new parameter to `runPipeline`, no structural changes.

**Multi-layer maps.** Each layer could be a separate `createBoardStore()` instance with its own pipeline, or a single store with layer-aware tile iteration. The factory pattern supports both. The centralized pipeline makes layer-conditional computation trivial (skip inactive layers).

### Action batching

Each wrapped action triggers the full cycle. For most actions this is fine — `applyTick` sets everything in one call. If a user interaction ever needs multiple mutations in one cycle:

```ts
// Future: batch() on createStore
batch(() => {
  addQueuedMove(move);
  setSelectedTile(nextCoord);
}); // one pipeline run, one version bump, one board notification
```

This is a small additive change to `createStore` — suppress onChange/notify during the batch, run once at the end. Doesn't affect the rest of the design.

### Non-React rendering

The store and pipeline have no React dependency. For canvas/WebGL rendering:

1. Subscribe to board-level changes (or add a dedicated render callback).
2. In the callback, iterate `tileCache` (or the future frame array) and draw.
3. Or: modify `runPipeline` to write directly to a render buffer alongside (or instead of) `TileData` objects.

The centralized pipeline is the key enabler — it's a single place where "state changed, now update the visual representation" happens. Whether that representation is `TileData` objects for React, pixel data for canvas, or vertex attributes for WebGL is a matter of what `runPipeline` writes to.

### Adding the frame array back

The current design drops the `frame: TileData[]` flat array. The `tileCache` Map handles lookup and caching. If canvas rendering needs contiguous ordered iteration (draw top-to-bottom, left-to-right), a parallel frame array can be reintroduced inside `runPipeline` without changing any external API. It would be written alongside `tileCache` in the same loop.

### Derived state promotion

`derived` currently lives in a closure variable managed by BoardStore. If a use case emerges for exposing derived state through the generic lib (other stores wanting automatic derived computation), `createStore` can be extended with a `derive` config option. This is a backward-compatible addition.

---

## Open Questions

### Version counter as useSyncExternalStore snapshot

Using `version` as the snapshot works for triggering re-renders but doesn't fully match React's tearing protection contract (the snapshot should be the data itself, not a proxy for it). In practice this likely works fine because board-level components read `boardStore.state` synchronously after the re-render trigger. If tearing issues appear, the fallback is assigning a new state container reference after each action (similar to the current `this.source = { ...this.source }` pattern). Verify in practice before complicating.

### Reset behavior with mounted components

`reset()` clears tile cache and tile subscribers. This assumes reset happens during navigation when components have already unmounted (their `useEffect` cleanup calls unsubscribe). If a "play again" flow needs to reset while the board is mounted, the design would need to either: (a) keep tile subscribers across reset and let the pipeline recompute all tiles, or (b) unmount and remount the board component. Determine when wiring up actual game flow — this is a usage question, not an architectural one.
