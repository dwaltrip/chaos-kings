# BoardStore v2 — Generic Slice-Based Store Design

A redesign of BoardStore built on a generic `Store<State, Derived>` primitive. The key idea: subscribers declare the slice of state they care about and how to detect changes. The lib handles the rest — derive, select, diff, cache, notify.

---

## Motivation

The current BoardStore mixes three concerns:

1. **Domain state** — board data, UI selection, queued moves
2. **Compute pipeline** — derived state, per-tile computation, frame diffing
3. **Subscription plumbing** — per-tile caches, subscriber maps, notification loops

The compute pipeline and subscription plumbing are tightly coupled inside `applyUpdate()`. Adding a new state bucket or derived field requires touching many files, and the flow from mutation to notification is hard to follow.

### Goals

- Separate generic store machinery from board-specific domain logic
- Make derived state a first-class lib concept (not manually called by app code)
- Unify board-level and tile-level subscriptions under one pattern
- Make it easy to extend state in the future without touching the lib internals

---

## Core Concept: Selector-Based Subscriptions

Instead of the lib knowing about tiles, frames, or the compute pipeline, each subscriber declares:

- **What slice of state it cares about** (a selector function)
- **How to detect changes** (an equality function)
- **What to do when it changes** (a notify callback)

The lib's job after every action: mutate state → recompute derived → run each subscriber's selector → compare with cached value → notify if changed.

Board-level and tile-level subscriptions are the same mechanism — they just use different selectors and equality functions.

---

## Generic Store

### `Store<State, Derived>`

```ts
interface StoreConfig<State, Derived> {
  initialState: State;
  derive: (state: State) => Derived;
}
```

The store holds:

- `state: State` — mutated in place by actions
- `derived: Derived` — recomputed by the lib after every action
- `version: number` — incremented after every action

### Actions

Pure functions that mutate state in place. No store knowledge, no return value.

```ts
function setStatus(state: BoardState, status: 'active' | 'ended'): void {
  state.source.status = status;
}
```

`makeAction` wraps a pure function into a callable that triggers the update cycle:

```ts
const setStatus = store.makeAction(actions.setStatus);

// Calling setStatus('ended') does:
//   1. actions.setStatus(store.state, 'ended')  — mutates state
//   2. store.derived = derive(store.state)       — recomputes derived
//   3. for each subscriber: select → diff → maybe notify
//   4. version++
```

### Subscription Handles

`store.subscribe()` returns a handle — a first-class object that bundles the selector, equality check, cached value, and notification callback.

```ts
interface SubscribeOptions<State, Derived, V> {
  select: (state: State, derived: Derived) => V;
  hasChanged: (prev: V, curr: V) => boolean;
  notify: () => void;
}

interface SubscriptionHandle<V> {
  get(): V;               // returns cached value from last select
  setNotify(cb: () => void): void;  // swap the notify callback
  unsubscribe(): void;
}
```

On subscribe, the lib immediately runs `select` to populate the initial cached value. After every action, the lib runs each handle's selector, compares with the cached value, updates the cache if changed, and calls notify.

### Update Cycle

```
action called
  → mutate state in place
  → derived = derive(state)
  → for each subscription handle:
      curr = handle.select(state, derived)
      if handle.hasChanged(handle.cached, curr):
        handle.cached = curr
        handle.notify()
  → version++
```

### Reset

```ts
store.reset(newInitialState);
```

Replaces state, recomputes derived, clears all subscription handles, resets version to 0.

### Store API Summary

```ts
class Store<State, Derived> {
  state: State;
  derived: Derived;
  version: number;

  constructor(config: StoreConfig<State, Derived>);

  makeAction<Args>(fn: (state: State, ...args: Args) => void): (...args: Args) => void;

  subscribe<V>(options: SubscribeOptions<State, Derived, V>): SubscriptionHandle<V>;

  reset(initialState: State): void;
}
```

---

## Board-Specific Layer

### BoardState

Two top-level buckets, unified into one state object:

```ts
interface BoardState {
  source: BoardSourceState;  // from server / game engine
  ui: UIState;               // from user interaction
}
```

`width` and `height` move into `BoardSourceState` (they're board data, not store infrastructure).

`BoardSourceState` and `UIState` are unchanged from today.

### DerivedState

Computed by the lib after every action. Includes visibility AND precomputed data shared across tile selectors:

```ts
interface DerivedState {
  visibleSquares: Set<string>;
  allVisible: boolean;
  queuedMovesMap: Map<string, QueuedDirs>;
}

function deriveBoardState(state: BoardState): DerivedState {
  const allVisible = state.source.status === 'ended'
    || state.source.currentPlayerIndex === null;
  const visibleSquares = allVisible || !state.source.board
    ? new Set<string>()
    : Board.getVisibleSquares(state.source.board, state.source.currentPlayerIndex!);
  const queuedMovesMap = buildQueuedMovesMap(state.source.queuedMoves);
  return { visibleSquares, allVisible, queuedMovesMap };
}
```

`queuedMovesMap` moves here from `computeFrameAndDiff`. It was always a shared precomputation step — derived state is its natural home.

### BoardStore

A thin domain shell. Creates the generic store, provides convenience methods for tile subscriptions.

```ts
class BoardStore {
  private store: Store<BoardState, DerivedState>;

  constructor() {
    this.store = new Store({
      initialState: createDefaultBoardState(),
      derive: deriveBoardState,
    });
  }

  // Expose store state for direct reads
  get state() { return this.store.state; }
  get derived() { return this.store.derived; }
  get version() { return this.store.version; }

  // Delegate to generic store
  makeAction<Args>(fn) { return this.store.makeAction(fn); }
  subscribe(options) { return this.store.subscribe(options); }
  reset() { this.store.reset(createDefaultBoardState()); }

  // Domain convenience: tile subscription
  subscribeTile(coord: Coord, notify: () => void): SubscriptionHandle<TileData> {
    return this.store.subscribe({
      select: (state, derived) => computeTileData(state, derived, coord),
      hasChanged: (prev, curr) => !tilesEqual(prev, curr),
      notify,
    });
  }

  // Domain convenience: board-level subscription
  subscribeBoardState(notify: () => void): SubscriptionHandle<BoardState> {
    return this.store.subscribe({
      select: (state) => state,
      hasChanged: () => true,  // always notify — board-level is coarse
      notify,
    });
  }
}
```

### Actions

Pure functions in a separate file. No store knowledge.

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

### Wiring

At module level, the store is created and actions are wrapped:

```ts
const boardStore = new BoardStore();

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

### `useTileData`

```ts
function useTileData(store: BoardStore, coord: Coord): TileData {
  const handle = useMemo(
    () => store.subscribeTile(coord, () => {}),  // placeholder notify
    [store, coord.x, coord.y],
  );

  useEffect(() => {
    return () => handle.unsubscribe();
  }, [handle]);

  return useSyncExternalStore(
    (cb) => { handle.setNotify(cb); return () => {}; },
    () => handle.get(),
  );
}
```

How this works:

- `useMemo` creates the subscription handle once (stable across renders).
- The handle's `get()` returns the cached `TileData` — referentially stable when unchanged.
- `useSyncExternalStore` receives React's callback via `setNotify`. When the lib detects a change, it calls this callback, React calls `get()`, gets a new cached value, re-renders.
- Cleanup unsubscribes via the handle.

### `useBoardState`

```ts
function useBoardState(store: BoardStore): BoardState {
  const handle = useMemo(
    () => store.subscribeBoardState(() => {}),
    [store],
  );

  useEffect(() => {
    return () => handle.unsubscribe();
  }, [handle]);

  // TODO: version counter approach — verify no tearing issues with
  // concurrent React. May need to revisit snapshot strategy.
  useSyncExternalStore(
    (cb) => { handle.setNotify(cb); return () => {}; },
    () => store.version,
  );
  return store.state;
}
```

### `BoardTile`

Unchanged from current design — uses `useTileData` and renders `TileRenderer`.

---

## Tile Computation

`computeTileData` becomes a selector function. It takes `(state, derived, coord)` and returns a `TileData`. No frame, no diffing — the lib handles caching and comparison.

```ts
function computeTileData(
  state: BoardState,
  derived: DerivedState,
  coord: Coord,
): TileData {
  const board = state.source.board!;
  const square = Board.getSquare(board, coord);
  const coordKey = serializeCoord(coord);

  const isVisible = getIsVisible(coordKey, derived);
  const neighborVis = getNeighborVis(coord, derived.visibleSquares, derived.allVisible);
  const isSelected = getIsSelected(coord, state.ui.selectedTile);
  const isSelectable = getIsSelectable(square, isSelected, state.source.status);
  const isValidMove = getIsValidMove(coord, square, state.ui.selectedTile);
  const borders = getBorders(isVisible, neighborVis);

  const queued = derived.queuedMovesMap.get(coordKey) ?? NO_QUEUED;
  const playerIndex = isPlayerSquare(square) ? square.playerIndex : -1;
  const armyCount = isPlayerSquare(square) ? square.units : 0;

  return {
    coord,
    type: square.type,
    playerIndex,
    armyCount,
    isVisible,
    neighborVisTop: neighborVis.top,
    neighborVisLeft: neighborVis.left,
    isSelected,
    isSelectable,
    isValidMove,
    hasTopBorder: borders.hasTopBorder,
    hasLeftBorder: borders.hasLeftBorder,
    queuedUp: queued.up,
    queuedDown: queued.down,
    queuedLeft: queued.left,
    queuedRight: queued.right,
  };
}
```

`tilesEqual` stays as the field-by-field equality check, used as the `hasChanged` function for tile subscriptions.

---

## What Goes Away

| Old concept | Replaced by |
|---|---|
| `frame: TileData[]` | Subscription handles cache their own values |
| `tileDataCache: Map` | Same — cached inside handles |
| `tileSubscribers: Map` | Generic store subscriber list |
| `boardSubscribers: Set` | Generic store subscriber list |
| `computeFrameAndDiff` | Store's subscriber loop (select → diff → notify) |
| `notifyChangedTiles` | Store's subscriber loop |
| `notifyBoardSubscribers` | Store's subscriber loop |
| `updateTileDataCache` | Store's subscriber loop |
| `applyUpdate` (private method doing everything) | Store's update cycle |

---

## File Structure

```
board-store/
├── lib/
│   └── store.ts               // Store<State, Derived>, SubscriptionHandle
├── types.ts                   // BoardState, BoardSourceState, UIState, DerivedState, TileData
├── actions.ts                 // pure state mutation functions
├── derived.ts                 // deriveBoardState (visibility, queuedMovesMap)
├── tile-data.ts               // computeTileData, tilesEqual, toTileRendererProps
├── tile-derived-state.ts      // per-tile derived value helpers (getIsVisible, etc.)
├── board-store.ts             // BoardStore (thin shell around Store)
├── index.ts                   // wiring: create store, wrap actions, export
├── hooks.ts                   // useTileData, useBoardState
├── board-tile.tsx             // BoardTile component
└── __tests__/
```

---

## Open Questions

### Board-level snapshot strategy

Using `store.version` as the `useSyncExternalStore` snapshot works for triggering re-renders but may have tearing issues with React concurrent features. The version changes but `store.state` is read separately. Needs verification. Fallback: shallow-copy state after each action (`this.state = { ...this.state }`).

### Reset and mounted components

`reset()` clears all subscriptions. If React components are still mounted (e.g. during a game transition), their subscription handles become invalid. Need to ensure reset happens during navigation (components unmount first) or that handles gracefully no-op after unsubscribe.

### Subscription creation timing in hooks

The `useMemo` + `useSyncExternalStore` + `useEffect` (cleanup) pattern in `useTileData` needs careful verification. The handle must be created before `useSyncExternalStore` reads from it, and cleaned up on unmount. `useMemo` runs during render (before effects) so the ordering should be correct, but this is subtle.

### Init as an action

`initBoard` is currently an action like any other. It sets state fields including `width`/`height`. Unlike the old design, there's no frame to allocate — the subscription system doesn't need it. This should just work, but needs testing to confirm the first tile subscriptions get correct initial values.

### Performance at scale

The store iterates all subscribers on every action. For a 20x20 board (400 tiles) at ~1 tick/second, this is ~400 selector evaluations per tick. Each runs `computeTileData` which does visibility checks, border computation, etc. This is the same per-tile work as the current `computeFrameAndDiff` loop. The overhead of the subscriber machinery (function calls, cache comparison) is negligible at this scale. For significantly larger boards, profiling would determine if optimization is needed.
