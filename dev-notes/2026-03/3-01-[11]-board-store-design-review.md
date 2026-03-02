# BoardStore Design Doc — Critical Review

## 1. Gaps

### 1a. `onClick` / interaction callbacks are missing from `TileRenderProps`

The current `TileRendererProps` has `onClick?: () => void`. The design doc's `TileRenderProps` doesn't. The `BoardStore` is framework-agnostic so it shouldn't own click handlers, but the doc doesn't specify where `onClick` wiring happens. Right now each tile component (GameTile, SandboxTile, PuzzleTile) computes `onClick` by combining `isSelectable` with a `setSelectedTile` call. The React bridge section needs to show where this gets wired — presumably in a `BoardTile` wrapper component that uses `useTileRenderData` and adds the click handler. Without this, someone implementing would have to figure it out.

### 1b. `isSelectable` logic differs across modes — not addressed

This is a significant gap. The three tile components compute `isSelectable` differently:

- **GameTile:** `!isGameEnded && !(isMountain || isSelected)` — any non-mountain, non-selected tile is selectable
- **PuzzleTile/SandboxTile:** `!isSelected && !isPuzzleEnded && isPlayerSquare(square)` — only player-owned tiles are selectable

The design doc puts `IsSelectable` in the `TileDataTuple` (field 8) but `computeTileData` is a single pure function. How does it know which selectability logic to use? Options:
- A mode/config parameter passed to `computeFrame`
- A selectability strategy function injected into `BoardStore`
- Mode-specific subclasses/factory

This needs a decision before implementation.

### 1c. `lastExecutedMove` missing from state

`BoardSessionStore` tracks `lastExecutedMove: Movement | null` and it's used by sandbox actions (`handle-state-update.ts`, `clear-moves.ts`). Not present in `BoardSourceState`. Is this intentionally dropped, or an oversight?

### 1d. `moveHistoryCache` not mentioned

The current `board-session-store.ts` has a `moveHistoryCache: Map<number, Movement | null>` outside Zustand, used by sandbox for optimistic step-forward. Where does this live in the new world? It's not per-tile data so it doesn't belong in the frame pipeline, but the design doc should acknowledge it. Probably just lives alongside the `BoardStore` instance as a separate concern — but say so.

### 1e. `gameplayReady` guard not covered

`update-gameplay-state.ts:23` gates on `gameplayReady` and `currentPlayerIndex !== null` before processing ticks. The design doc's `applyTick` has no such guard. Where does this gate move to? Presumably into the gameplay action that calls `applyTick`, but worth calling out since it's a critical race condition guard (WS messages arriving before game setup completes).

### 1f. Spectator mode visibility

`gameplay-store-v2.ts:199` has `if (state.currentPlayerIndex === null) return true` — spectators see everything. The design doc's `computeDerivedState` mentions "all visible if status === 'ended'" but doesn't mention the spectator case (`currentPlayerIndex === null`). Need to handle this in `computeDerivedState`.

### 1g. `game` / `GameWithPlayers` / player lookup maps

`gameplay-store-v2` holds `game`, `playersByIndex`, `playersByUserId`, `currentPlayer`. These aren't in `BoardSourceState`. Presumably intentional (page-level state), but the design doc should explicitly say "these stay in a separate store/context" so implementers know.

## 2. Inconsistencies

### 2a. `TileRenderProps` vs current `TileRendererProps` — missing `isAdjacentToSelected`

The design doc's `TileRenderProps` has `isAdjacentToSelected` as a field (line 157). But the current `TileRendererProps` does NOT have it — `TileRenderer` doesn't use it for rendering. It's only used in the tile wrapper components to compute `isValidMove`. So either:
- It doesn't belong in `TileRenderProps` (it's intermediate computation, not render data), or
- You're planning to change `TileRenderer` to use it

Looking at the `TileDataTuple`, you have both `IsAdjacentToSelected` (field 7) and `IsValidMove` (field 9). `IsValidMove` = `isAdjacentToSelected && !isMountain`. Since `isValidMove` is what the renderer actually uses, `isAdjacentToSelected` in `TileRenderProps` seems unnecessary — it's only useful as an intermediate value. Consider dropping it from both the tuple and render props, or explain why it's needed.

### 2b. Border computation differs from current code

Design doc: `HasTopBorder` and `HasLeftBorder` are fields in `TileDataTuple`.
Current code: `hasTopBorder = isVisible || neighborVisibility.top`.

The current formula means the border shows if *either* the current tile or its neighbor is visible. The doc's `computeTileData` would need to replicate this, including reading neighbor visibility from the `visibleSquares` set. This is fine but means `computeTileData` needs access to neighbor tiles' visibility, not just the current tile. The doc's function signature `computeTileData(inputs: FrameInputs, coord: Coord)` supports this (it has the full `FrameInputs`), so this works — just noting it.

## 3. Risks

### 3a. `useSyncExternalStore` snapshot identity — potential infinite re-render loop

This is the most critical risk. `useSyncExternalStore` requires that `getSnapshot` returns a **referentially stable** value when nothing has changed. If `getTileRenderData(coord)` creates a new object every time it's called (which the naive implementation would), React will think the value changed and re-render infinitely.

The design says "React only re-renders this tile when its subscriber is notified." But that's not how `useSyncExternalStore` works — React calls `getSnapshot` during render and on every store notification. If `getSnapshot` returns a new object, React detects a change and re-renders, which calls `getSnapshot` again, which returns a new object... infinite loop.

**Fix options:**
1. **Cache the render data** — store a `Map<string, TileRenderProps>` that's only updated when a tile is in the `FrameDiff`. `getTileRenderData` returns the cached object. This is the cleanest approach.
2. **Return the raw tuple** and let the hook memoize the conversion. But then you lose the "conversion only for changed tiles" benefit.

This is a known Zustand gotcha (documented in your own DEBUGGING-GUIDE.md likely), and it would be ironic to reintroduce it in the replacement system. The doc should explicitly address snapshot caching.

### 3b. Board-level subscriber fires on every update

`applyUpdate()` always calls `notifyBoardSubscribers()`. The `useBoardSourceState` hook returns `store.source`. If `source` is mutated in place (which the doc's `applyTick` does: `this.source.tick = tick`), then `getSnapshot` returns the same object reference every time, and React won't detect changes. If you create a new `source` object, every HUD component re-renders on every tick even if the field it cares about didn't change.

You need either:
- Granular board-level subscriptions (subscribe to specific fields)
- Selector-based hooks like `useBoardField(store, s => s.source.tick)`
- Or accept that HUD components re-render on every tick (probably fine — there are few of them)

The doc should pick one and say so.

### 3c. Memory: two full frames in memory

`currentFrame` and `previousFrame` each hold `width * height` `TileDataTuple` arrays. For a 20x20 board that's 400 tiles × 13 numbers × 2 frames = 10,400 numbers. Totally fine. For larger boards this is still trivial. Not a real concern — just noting the doc should confirm the previous frame is needed (for diffing) and that swap-on-update is the strategy.

### 3d. `diffFrames` on board size change

When `init()` is called, there's no previous frame (or it's a different size). The doc should specify that `init` either skips diffing (treat all tiles as changed) or initializes `previousFrame` to an empty/zeroed array. The `applyUpdate` flow would break if `previousFrame.length !== currentFrame.length`.

## 4. Open Questions

### 4a. Who creates and owns `BoardStore` instances?

The doc describes the class but not its lifecycle. Questions:
- Is there one global instance (like current Zustand stores)?
- Or one per page/session (created on mount, destroyed on unmount)?
- How does the React tree access it? Context? Module-level singleton? Prop drilling?

For a module-level singleton, cleanup between games is critical (the `reset()` method) — subscriber maps from the previous game must be cleared. For context-based, need to ensure the instance is stable across re-renders.

### 4b. How do domain actions access the `BoardStore`?

Current pattern: actions import the Zustand store directly (`useGameplayStoreV2.getState()`). With `BoardStore`, how do actions like `queue-move.ts` or `undo-last-queued-move.ts` get a reference? Module import? If the store is in React context, actions outside React can't access it.

### 4c. Keyboard/interaction handlers

`game-ui.tsx` sets up arrow key handlers that call `setSelectedTile`, `queueMove`, etc. These currently import from Zustand stores. How do they get a `BoardStore` reference?

## 5. Simplification Opportunities

### 5a. `isAdjacentToSelected` can be dropped

As noted in 2a, it's only used to compute `isValidMove = isAdjacentToSelected && !isMountain`. You could compute `isValidMove` directly in `computeTileData` and drop `isAdjacentToSelected` from both the tuple and render props. That's 12 fields instead of 13, and one less concept for consumers to think about.

### 5b. Two-format tile data may be premature

The doc introduces `TileDataTuple` (flat numbers for fast diffing) and `TileRenderProps` (nice format for UI). The justification is fast diffing, but diffing 13 struct fields with `===` is just as fast as diffing 13 array slots. A typed interface with boolean/enum fields would be equally fast to diff and eliminate the entire tuple-to-render conversion layer.

The flat number format has a future benefit for wire protocol alignment, but that's speculative. Consider starting with a single `TileData` interface for both diffing and rendering, and only introducing the flat format when/if the wire protocol optimization actually happens. This would eliminate `TileField` constants, `createTileData`, `toTileRenderData`, and the entire concept of "two representations."

Counter-argument: if you're confident the wire format optimization will happen, the flat format is worth keeping. But the doc should justify this tradeoff explicitly rather than presenting it as a given.

### 5c. `previousFrame` can be replaced by in-place comparison

Instead of keeping two full frame arrays and swapping them, you could keep one frame array and diff *before* overwriting each tile. In `computeFrame`, for each tile: compute new data, compare against `currentFrame[index]`, if different add to diff and update in place. This halves memory usage and removes the swap step. Same result, simpler code.

## 6. Missing Details

### 6a. `Coord` serialization for subscriber keys

The subscriber map is `Map<string, Set<() => void>>` keyed by serialized coord. The doc should specify the serialization format (probably `serializeCoord` from `@core`). This must match between `subscribeTile`, `notifyChangedTiles`, and `getTileRenderData`.

### 6b. Initial state / null board

`BoardSourceState.board` is `BoardState | null`. What happens when `board` is null? Does `computeFrame` return an empty array? Does `applyUpdate` skip entirely? The `init` method takes `board?` (optional) — what if called without a board? Current code handles this (guards on `boardState !== null`), the design should too.

### 6c. `queuedDirBitmask` encoding

The doc says "4 bits for NESW" but doesn't specify which bit is which. This matters for the `toTileRenderData` conversion to `Set<Direction>`. Minor but should be pinned down before implementation.

### 6d. Thread of control during `applyUpdate`

`applyUpdate` calls `notifyChangedTiles` which fires subscriber callbacks synchronously. If a subscriber (e.g., a React `useSyncExternalStore` subscription) triggers a state update that calls back into `BoardStore`, you get re-entrancy. The doc should state whether re-entrancy is possible and how it's handled (probably: it's not possible because React batches, but a code comment should note it).

### 6e. `subscribe()` board-level callback — what's the contract?

`subscribe(callback)` — when is `callback` called? Every `applyUpdate`? Only when source state changes? The doc says `notifyBoardSubscribers()` is called in `applyUpdate`, implying every update. But the callback takes no args — so the consumer has to call `store.source` to get the new state. This is the `useSyncExternalStore` pattern, which works, but the contract should be explicit.

---

## Summary — Priority Items Before Implementation

1. **Snapshot caching for `getTileRenderData`** (risk 3a) — without this, `useSyncExternalStore` will infinite-loop. Must be addressed in the design.
2. **`isSelectable` mode variance** (gap 1b) — needs a concrete mechanism (config, strategy, factory).
3. **Store instance lifecycle and access pattern** (question 4a/4b) — module singleton vs context, and how actions/handlers access it.
4. **Spectator visibility** (gap 1f) — add to `computeDerivedState` spec.
5. **Null board / init / size-change handling** (question 6b, risk 3d) — edge cases that will bite during implementation.

The design is solid overall — the core data flow (compute → diff → notify) is clean and well-motivated. The main risks are at the React integration boundary (snapshot identity) and at the mode-variance boundary (different selectability rules). Everything else is minor or deferrable.
