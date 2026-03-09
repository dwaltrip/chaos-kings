# BoardStore v2 — Architecture Design Doc

Refactoring the BoardStore to separate pure domain logic from generic reactive store machinery. Follows the v1 BoardStore implementation (see `3-01-[9]` for original design).

---

## Motivation

The v1 BoardStore works but tangles several concerns into one class:
- Generic reactive plumbing (subscriptions, snapshots, versioning)
- Domain-specific state mutations (setStatus, setSelectedTile, etc.)
- The compute pipeline (derived state, tile computation, diffing)
- Per-key tile subscriptions and caching

Goals for v2:
- **Pure action functions** — state mutations separated from store machinery
- **Generic store lib** — reusable reactive store with no board knowledge
- **Composition over inheritance** — factory + closures, no class hierarchy
- **Automatic derived state** — lib owns the derive lifecycle, app dev provides the function
- **Clear layering** — each file has one concern

---

## Architecture Overview

### Layers

```
+-------------------------------------+
|  Pure actions (no store knowledge)   |  -- "what changes"
+------------------+------------------+
                   | mutates
+------------------v------------------+
|  BoardState  { source, ui }         |  -- the data
+------------------+------------------+
                   | triggers
+------------------v------------------+
|  Board-specific pipeline             |  -- "what's affected"
|  (derived state, tile compute, diff) |
+------------------+------------------+
                   | feeds into
+------------------v------------------+
|  Generic store machinery             |  -- "how to propagate"
|  (version, subscribers, KeyedStore)  |
+------------------+------------------+
                   | notifies
+------------------v------------------+
|  React hooks / UI                    |  -- "render it"
+--------------------------------------+
```

### Data Flow (per action invocation)

```
1. Caller invokes a wrapped action (e.g. setSelectedTile({x:1, y:1}))
2. Pure action function mutates BoardState in place
3. Lib calls derive(state) -> DerivedState (automatic, app dev doesn't call this)
4. Lib calls onChange(state, derived) -> board-specific pipeline runs:
   a. Reallocate frame array if dimensions changed
   b. Compute TileData for every tile
   c. Diff each tile against previous frame via tilesEqual
   d. Push changed tiles into KeyedStore (updates cache + notifies per-tile subscribers)
5. Lib bumps version counter
6. Lib notifies top-level (board-level) subscribers
```

---

## Generic Store Lib

Lives in `board-store/lib/`. No domain knowledge. Two pieces:

### `createStore<State, Derived>(config)`

Factory that creates a reactive store.

```ts
interface StoreConfig<State, Derived> {
  initialState: State;
  derive?: (state: State) => Derived;
  onChange?: (state: State, derived: Derived) => void;
  onReset?: () => void;
}

function createStore<State, Derived>(config: StoreConfig<State, Derived>) {
  let state = config.initialState;
  let derived = config.derive?.(state);
  let version = 0;
  const subscribers = new Set<() => void>();

  function makeAction<Args extends unknown[]>(
    fn: (state: State, ...args: Args) => void,
  ): (...args: Args) => void {
    return (...args: Args) => {
      fn(state, ...args);
      derived = config.derive?.(state);
      config.onChange?.(state, derived);
      version++;
      for (const cb of subscribers) cb();
    };
  }

  function subscribe(cb: () => void): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  function reset(initialState: State): void {
    state = initialState;
    derived = config.derive?.(state);
    version = 0;
    subscribers.clear();
    config.onReset?.();
  }

  return {
    get state() { return state; },
    get derived() { return derived; },
    get version() { return version; },
    makeAction,
    subscribe,
    reset,
  };
}
```

**Key decisions:**
- State is mutated in place by actions (no immutability requirement). The diff function — not reference equality — determines what changed.
- `derive` is called automatically after every mutation. App dev provides the function, lib owns the lifecycle.
- `onChange` is the hook for domain-specific work (compute pipeline). Receives `(state, derived)`.
- Version counter bumps on every action for board-level `useSyncExternalStore` compatibility. (TODO: verify this works correctly with React concurrent features / tearing. May need to revisit — shallow-copying the state container is the fallback.)
- `reset` clears subscribers. Intended for page navigation where components unmount.
- Returns getters for `state`, `derived`, `version` so they always reflect current values.

### `KeyedStore<V>`

Per-key subscriptions and snapshot cache. Used for tile-level reactivity.

```ts
class KeyedStore<V> {
  private cache: Map<string, V>;
  private subscribers: Map<string, Set<() => void>>;

  get(key: string): V | undefined;
  subscribe(key: string, cb: () => void): () => void;
  applyChanges(changes: { key: string; value: V }[]): void;
  clear(): void;
}
```

**`applyChanges`** updates cache entries and notifies per-key subscribers for each change. This is the bridge between the domain pipeline (which produces a diff) and the subscription system.

**Snapshot stability:** `get(key)` returns the cached object. Only updated for keys in the changes list. Unchanged keys return the same reference — critical for `useSyncExternalStore`.

---

## Board-Specific Layer

### BoardState

Single state object with two organizational buckets:

```ts
interface BoardState {
  source: BoardSourceState;  // from server / game engine
  ui: UIState;               // from user interaction
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
  width: number;             // moved from store infrastructure
  height: number;
}

interface UIState {
  selectedTile: Coord | null;
}
```

`DerivedState` is NOT part of `BoardState`. It's computed automatically by the lib via the `derive` function and stored internally. Actions never see or touch derived state.

```ts
interface DerivedState {
  visibleSquares: Set<string>;
  allVisible: boolean;
}
```

### Pure Actions

Mutate `BoardState` in place. No store knowledge, no subscriptions, no return value. Each is a plain function: `(state: BoardState, ...args) => void`.

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
  state.source.width = board.size.width;
  state.source.height = board.size.height;
}
```

### Board Store Factory

Composes the generic store with board-specific infrastructure (frame, tiles, compute pipeline).

```ts
function createBoardStore() {
  const tiles = new KeyedStore<TileData>();
  let frame: TileData[] = [];

  const store = createStore<BoardState, DerivedState>({
    initialState: createDefaultBoardState(),

    derive: (state) => computeDerivedState(state.source, state.ui),

    onChange: (state, derived) => {
      if (!state.source.board) return;

      const { width, height } = state.source;
      if (frame.length !== width * height) {
        frame = new Array(width * height);
      }

      const inputs = { source: state.source, ui: state.ui, derived };
      const diff = computeFrameAndDiff(inputs, frame, width, height);

      tiles.applyChanges(
        diff.map(c => ({ key: serializeCoord(c.coord), value: c.data })),
      );
    },

    onReset: () => {
      frame = [];
      tiles.clear();
    },
  });

  return {
    ...store,
    subscribeTile: (coord: Coord, cb: () => void) =>
      tiles.subscribe(serializeCoord(coord), cb),
    getTileData: (coord: Coord) =>
      tiles.get(serializeCoord(coord)) ?? createDefaultTileData(coord),
  };
}
```

### Wiring (module-level)

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

### React Hooks

```ts
function useTileData(coord: Coord): TileData {
  const key = serializeCoord(coord);
  return useSyncExternalStore(
    (cb) => boardStore.subscribeTile(coord, cb),
    () => boardStore.getTileData(coord),
  );
}

// TODO: version counter as snapshot — verify with React concurrent features.
function useBoardState(): BoardState {
  useSyncExternalStore(
    (cb) => boardStore.subscribe(cb),
    () => boardStore.version,
  );
  return boardStore.state;
}
```

---

## File Structure

```
board-store/
  lib/
    store.ts                  -- createStore (generic, no domain knowledge)
    keyed-store.ts            -- KeyedStore (per-key subscriptions + cache)
  types.ts                    -- BoardState, BoardSourceState, UIState, DerivedState, TileData, etc.
  actions.ts                  -- Pure state mutation functions
  board-store.ts              -- createBoardStore factory
  index.ts                    -- Module singleton + wrapped actions
  tile-derived-state.ts       -- computeTileData + per-field derived functions
  tile-data.ts                -- tilesEqual, toTileRendererProps
  frame-computation.ts        -- computeDerivedState, computeFrameAndDiff
  hooks.ts                    -- useTileData, useBoardState
  board-tile.tsx              -- BoardTile component
  __tests__/
    board-store.test.ts       -- Existing tests (update to match new API)
```

---

## Known Tradeoffs and Future Considerations

### Every action runs the full pipeline
`setSelectedTile` affects ~5 tiles but recomputes all 400 and diffs. Fine at current board sizes and tick rates. If this becomes a bottleneck, selective recomputation (action hints, dirty regions) could be added, but would break the clean separation of actions from tile knowledge.

### No-op detection
Setting a value to its current value still runs the full pipeline. Since we mutate in place, there's no cheap "did anything change?" check. The diff catches it (produces empty changes), but the computation still runs.

### `onChange` is the domain hook
All board-specific pipeline logic lives in the `onChange` callback. If this grows significantly (e.g. multiple KeyedStores, conditional pipelines), it may signal a need for the lib to own more of the flow — revisit the subtree/projection pattern discussed in the design session.

### Version counter for board-level snapshots
Using a version number as the `useSyncExternalStore` snapshot is simple but technically doesn't match React's tearing protection contract (snapshot should be the actual data). Fallback: shallow-copy the state container for a new reference. Deferred — verify in practice first.

### `derive` vs first line of `onChange`
`derive` as a lib concept is thin — it calls a function and stores the result. Its value is making the sequencing explicit (derive always runs before onChange) and keeping onChange focused on the pipeline. Could be collapsed into onChange if the separation doesn't prove useful.

### Multiple board instances
The factory pattern supports multiple instances (`createBoardStore()` again). Actions bind to a specific instance via `makeAction`. No shared global state.

### Generic subtree / projection system
Discussed during design but deferred. If a second use case for per-key subscriptions appears (per-player stats, per-territory aggregates, etc.), revisit extracting the KeyedStore integration into a lib-level concept. See discussion notes from this session.
