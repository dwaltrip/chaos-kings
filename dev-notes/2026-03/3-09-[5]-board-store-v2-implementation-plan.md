# BoardStore v2 — Implementation Plan

Based on Design Doc 3 (`3-09-[4]`). The board store is not wired into any pages yet, so we can refactor freely — the only consumers are the test file.

---

## Before Implemention: TDD - Write Tests

Write failing tests for the two new pieces before implementing anything. This locks in the contracts.

### Step 1: `__tests__/create-store.test.ts` — Generic store primitive

Sketch of new tests fo `createStore`:

```
describe('createStore')

  makeAction
    - mutates state via the action function
    - recomputes derived before calling onChange
    - calls onChange with merged state & derived object
    - notifies all subscribers after onChange
    - increments version after each action, and correctly increments after multiple actiions.

  derive
    - derived values accessible via store.derived after action
    - warns (dev-mode) if derived keys collide with state keys

  ordering
    - onChange fires before subscribers
    - subscriber sees updated version (not stale)

  subscribe / unsubscribe
    - returns unsubscribe function that prevents future callbacks
    - multiple subscribers all receive notifications

  reset
    - replaces state with new value
    - calls onReset before onChange
    - calls onChange with new state
    - resets version to 0
    - notifies subscribers after reset
```

### Step 2: `__tests__/board-store.test.ts` — Tile cache preventing unnecessary notifications

Write the new board-store tile caching tests — fail against current API (that's fine, they target the new API).


Add to group 5 in existing tests. (Subscriptions and snapshot stability):

```
  tile subscriber does NOT fire when tile data unchanged
    - subscribe to tile, apply action that doesn't affect that tile
    - subscriber should not be called
    (partially covered by existing "fires only for changed tiles" test,
     but worth an explicit no-op case: same board, same tick, same everything)

  no-op action: tile subscribers silent, board subscriber still fires
    - subscribe to a tile AND to board-level
    - call setSelectedTile with the already-selected coord
    - tile subscriber: not called (diff catches the no-op)
    - board subscriber: called (version bumps regardless)

  `derived` is accessible and correct (e.g. `derived.allVisible` true after `setStatus('ended')`)

  reset → re-init full cycle: init, mutate, reset, init again, verify fresh state and working subscriptions
```

### Step 3: Adapt existing tests

The existing 40 tests cover:

- **Group 1: Pure functions** (tilesEqual, toTileRendererProps) — unchanged
- **Group 2: Init and lifecycle** — adapt from `new BoardStore()` + method calls to `createBoardStore()` + wrapped actions
- **Group 3: Tile computation** — same assertions, different setup
- **Group 4: State mutations and diffing** — remove `FrameDiff` return assertions, check tile cache directly instead
- **Group 5: Subscriptions and snapshot stability** — same assertions, different API

Key test changes:
- `store.init(players, idx, board)` → `initBoard(players, idx, board)` (wrapped action)
- `store.applyTick(...)` → `applyTick(...)` (wrapped action)
- `store.setSelectedTile(...)` → `setSelectedTile(...)` (wrapped action)
- `const diff = store.xxx(...)` → remove diff assertions, check tile state directly
- `store.width`, `store.height` → read from `store.state.source.board.size`
- `store.source.xxx` → `store.state.source.xxx`
- `store.frame` → removed (check `tileCache` behavior through `getTileData`)

---

## Current File Inventory

```
board-store/
  board-store.ts          — BoardStore class (will be rewritten)
  types.ts                — type definitions (will be updated)
  frame-computation.ts    — computeDerivedState, computeFrameAndDiff (will be split/absorbed)
  tile-derived-state.ts   — computeTileData + helpers (minor signature change)
  tile-data.ts            — tilesEqual, toTileRendererProps (unchanged)
  hooks.ts                — useTileData, useBoardSourceState (minor updates)
  board-tile.tsx          — BoardTile component (minor updates)
  __tests__/
    board-store.test.ts   — 40 tests (will be adapted to new API)
```

---

## Implementation Steps

### Step 1: Create `lib/create-store.ts`

The generic store primitive. ~35 lines. No domain knowledge.

- `createStore<State, Derived>(config)` with `derive`, `onChange`, `onReset`
- `derive(state) => Derived` — called automatically after every mutation
- `onChange(merged)` — receives `State & Derived` merged object. Helper warns in dev mode if derived keys overwrite state keys.
- `makeAction`, `subscribe`, `reset`
- Exposes `store.state`, `store.derived`, `store.version`
- Write basic unit tests for the generic store (`__tests__/create-store.test.ts`)

### Step 2: Create `actions.ts`

Pure action functions. Extract mutations from current BoardStore class methods.

- `setStatus`, `setSelectedTile`, `addQueuedMove`, `undoLastQueuedMove`, `setQueuedMoves`, `applyTick`, `initBoard`
- Each is `(state: BoardState, ...args) => void`
- No tests needed — these are trivial assignments, tested through board-store integration tests

### Step 3: Create `derived.ts`

Move `computeDerivedState` from `frame-computation.ts`. Add `queuedMovesMap` computation (currently inline in `computeFrameAndDiff`).

- `deriveBoardState(state: BoardState) => DerivedState`
- `buildQueuedMovesMap(moves: Movement[]) => Map<string, QueuedDirs>`
- Update `DerivedState` type to include `queuedMovesMap`

### Step 4: Update `types.ts`

- Add `BoardState` wrapper type (`{ source: BoardSourceState, ui: UIState }`)
- Add `queuedMovesMap` to `DerivedState`
- Remove `FrameInputs`, `TileChange`, `FrameDiff` (no longer needed)

### Step 5: Update `tile-derived-state.ts`

Change `computeTileData` signature:
- **Current:** `(inputs: FrameInputs, coord: Coord, queuedMovesMap: Map) => TileData`
- **New:** `(state: BoardState, derived: DerivedState, coord: Coord) => TileData`

Interior logic unchanged — just reads from different parameter shapes. `queuedMovesMap` comes from `derived.queuedMovesMap` instead of a separate parameter.

### Step 6: Rewrite `board-store.ts`

Replace the `BoardStore` class with `createBoardStore` factory function.

- `runPipeline` as the `onChange` callback
- `tileCache` Map + `tileSubs` Map (managed directly, no abstraction)
- `derived` in closure
- Returns object with: `state`, `derived`, `version`, `makeAction`, `subscribe`, `subscribeTile`, `getTileData`, `reset`

### Step 7: Create `index.ts`

Module singleton + wrapped actions.

- `const boardStore = createBoardStore()`
- Wrap each action via `boardStore.makeAction(actions.xxx)`
- Export the store, wrapped actions, and types

### Step 8: Update `hooks.ts`

- Remove `store` parameter from hooks (use module singleton import)
- Or keep `store` parameter for testability — decide during implementation
- Minor simplification: `useCallback` deps may change slightly

### Step 9: Update `board-tile.tsx`

- May remove `store` prop if hooks use module singleton
- Or keep it for testability / multiple instance support

### Step 10: Delete `frame-computation.ts`

Its two functions are now split:
- `computeDerivedState` → `derived.ts` (as `deriveBoardState`, extended)
- `computeFrameAndDiff` → absorbed into `runPipeline` in `board-store.ts`

### Step 11: Build check + final review

- `npm run build` in frontend for TS errors
- `npm test` in frontend for test results
- Review file structure matches design doc

---

## Final File Structure

```
board-store/
  lib/
    create-store.ts              — generic store primitive (~30 lines)
  types.ts                       — BoardState, BoardSourceState, UIState, DerivedState, TileData
  actions.ts                     — pure state mutation functions
  derived.ts                     — deriveBoardState (visibility, queuedMovesMap)
  tile-derived-state.ts          — computeTileData + per-field helpers
  tile-data.ts                   — tilesEqual, toTileRendererProps (unchanged)
  board-store.ts                 — createBoardStore factory
  index.ts                       — module singleton, wrapped actions, exports
  hooks.ts                       — useTileData, useBoardState
  board-tile.tsx                 — BoardTile component
  __tests__/
    create-store.test.ts         — generic store tests
    board-store.test.ts          — board-specific tests (adapted)
```

---

## Code Comments / NOTEs for Implementation

Add these as brief comments at the relevant points in the code. They document decisions we've made and future hooks.

### In `lib/create-store.ts`

```ts
// NOTE: Action batching. Currently each makeAction call triggers the full
// cycle (onChange → version++ → notify). If a user interaction needs
// multiple mutations in one cycle, add a batch() function here that
// suppresses onChange/notify during the batch and runs once at the end.
```

```ts
// NOTE: `derive` as a lib concept. Currently thin — calls a function and
// stores the result, guaranteeing it runs before onChange. May evolve or
// move out if the needs for managing dependencies between data values change
// (e.g. derived state that depends on other derived state, conditional
// derivation, etc.).
```

### In `board-store.ts` — version counter

```ts
// NOTE: Version counter as useSyncExternalStore snapshot.
// Using `version` as the snapshot works for triggering re-renders but
// doesn't fully match React's tearing protection contract. In practice
// this is fine — actions run on the main thread between React work units.
// Fallback if needed: shallow-copy the state container after each action
// so the reference itself serves as the snapshot.
```

### In `board-store.ts` — reset

```ts
// NOTE: Reset clears tile subscribers. This assumes components have
// unmounted before reset (e.g. page navigation). For a future "play again"
// flow where the board stays mounted, use a React key on the board
// component (<GameBoard key={gameId} />) to force unmount/remount.
```

### In `board-store.ts` — tile caching

```ts
// NOTE: Tile cache + tile subscribers are managed directly here rather
// than extracted into a generic abstraction. If a second per-key
// subscription use case appears (per-player stats, per-territory
// aggregates), extract the pattern then with a real use case to
// guide the API.
```

### In `board-store.ts` — runPipeline

```ts
// NOTE: Pipeline optimization. Currently iterates all tiles on every
// action. Future optimization paths (all additive, no rearchitecting):
// - Dirty regions: snapshot selectedTile before mutation, only recompute
//   affected tiles
// - Spatial culling: skip tiles outside viewport for large/scrollable maps
// - Direct buffer output: write to canvas/WebGL render buffer instead of
//   (or alongside) TileData objects
```
