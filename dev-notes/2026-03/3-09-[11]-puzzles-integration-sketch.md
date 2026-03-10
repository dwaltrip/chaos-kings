# Puzzles Integration — Design Sketch

High-level sketch of how board-store replaces the old tile orchestrator / per-tile Zustand stores in the puzzles domain.

---

## New Data Flow

### Before
- `usePuzzleStore` holds: status, board, tick, moveQueue, visibleSquares, result, userStats, selectedTile
- Per-tile Zustand stores (via `tile-store-registry`) hold: square, queuedDirections
- `tileOrchestrator` batch-updates per-tile stores
- Visibility computed manually via `Board.getVisibleSquares(board, 0)`
- Actions orchestrate 5–10 setter calls per tick

### After
- `usePuzzleStore` holds: status, result, userStats (puzzle-specific only)
- `boardStore` holds: board, tick, queuedMoves, selectedTile, players, currentPlayerIndex
- `boardStore.derived` auto-computes: visibleSquares, allVisible, queuedMovesMap
- Actions call 1–2 board-store functions per tick
- Per-tile rendering driven by `useTileData(boardStore, coord)` — board-store's internal pipeline + cache handles diffing

---

## Action-by-Action

### `startPuzzle()`
```
puzzleStore.reset()
boardStore.reset()
initBoard([], 0)            ← sets currentPlayerIndex=0 for visibility
puzzlesWsEffects.sendStartPlaying()
```
Note: `initBoard` runs pipeline but returns early (no board yet). The `currentPlayerIndex=0` is stored for when the first `applyTick` arrives.

### `handleStateUpdate(tick, board, moveQueue)`
```
applyTick(tick, board, moveQueue, [])    ← one call replaces 10 lines
puzzleStore.setStatus('playing')
```
Pipeline auto-computes visibility for player 0, builds queuedMovesMap, diffs all tiles.

### `handlePuzzleEnd(tick, result, finalBoard)`
```
applyTick(tick, finalBoard, [], [])
setBoardStatus('ended')                  ← triggers allVisible=true in derived
setBoardSelectedTile(null)
puzzleStore.setStatus('ended')
puzzleStore.setResult(result)
loadUserStats()                          ← fire-and-forget
```
No manual "make all visible" computation — `deriveBoardState` sets `allVisible=true` when `status==='ended'`.

### `queueMove(source, direction)`
```
board = boardStore.state.game.board
if (!board || !Board.canMove(board, source, direction)) return
addQueuedMove({ sourceCoord: source, direction })
setSelectedTile(Board.applyDirection(source, direction))
puzzlesWsEffects.sendMoveRequest(source, direction)
```
Two pipeline runs (addQueuedMove + setSelectedTile). Fine for now.

### `clearMoves()` / `undoMove()`
No changes — WS-only, no local state.

### `loadUserStats()`
No changes — puzzle-store only.

---

## Puzzle Store Changes

### Remove
- State: `board`, `tick`, `moveQueue`, `visibleSquares`, `selectedTile`
- Setters: `setTick`, `setBoard`, `setMoveQueue`, `setVisibleSquares`, `setSelectedTile`, `addQueuedMove`
- Selectors: `selectBoard`, `selectTick`, `selectMoveQueue`, `selectSelectedTile`, `selectVisibleSquares`
- Parameterized selectors: `selectIsTileSelected`, `selectIsAdjacentToSelected`, `selectIsVisible`, `selectNeighborVisibility`
- Imports: `tile-selection-helpers`, `BoardState`, `Coord`, `Movement`, `useShallow`

### Keep
- State: `status`, `result`, `userStats`
- Setters: `setStatus`, `setResult`, `setUserStats`, `reset`
- Selectors: `selectStatus`, `selectResult`, `selectUserStats`, `selectActions`, `selectIsPuzzleEnded`

### `reset()` simplifies
Only clears: status → 'idle', result → null (userStats intentionally kept across resets).

---

## Tile Component

### Before (PuzzleTile — 7 hooks + manual computation)
```
useTileSquare(coord)                    ← per-tile store
useTileQueuedDirections(coord)          ← per-tile store
selectIsTileSelected(coord)             ← puzzle store
selectIsAdjacentToSelected(coord)       ← puzzle store
selectIsPuzzleEnded                     ← puzzle store
selectIsVisible(coord)                  ← puzzle store
selectNeighborVisibility(coord)         ← puzzle store
→ manual isMountain, isSelectable, isValidMove, borders computation
→ TileRenderer
```

### After (PuzzleTile — 1 hook + adapter)
```
useTileData(boardStore, coord)          ← board-store (all 16 fields computed by pipeline)
toTileRendererProps(tile)               ← adapter to TileRenderer props
→ TileRenderer with onClick when isSelectable
```

Keep `PuzzleTile` as a React.memo wrapper (prevents 400 re-renders per tick when parent re-renders). `BoardTile` isn't memoized, so using it directly would be a perf regression.

---

## Page Component

### `BestStartPlayPageContent` reads change
```
status       ← stays in puzzle store (selectStatus)
result       ← stays in puzzle store (selectResult)
board        ← useBoardState(boardStore) → .game.board
tick         ← useBoardState(boardStore) → .game.tick
selectedTile ← useBoardState(boardStore) → .ui.selectedTile
```

`PuzzleBoard` keeps its `boardState` prop — receives board from the page.

---

## Reset / Subscription Lifecycle

Concern: `boardStore.reset()` clears `tileSubs`. If tiles are still mounted, they lose subscriptions.

Resolution: Not an issue. The page conditionally renders `PuzzleBoard` only when `board !== null`. After reset, board is null → PuzzleBoard unmounts → tiles unmount → subs cleaned up. When first `handleStateUpdate` sets the board → PuzzleBoard mounts → tiles mount → fresh subs. Natural lifecycle.

---

## Files to Delete (after integration)

- `apps/frontend/src/domains/puzzles/utils/visibility-cache.ts` — unused, never imported

Files in `games/` shared infra are NOT deleted yet — sandbox and gameplay still use them. Delete after all three domains migrate.

---

## Naming Collisions

`setStatus` exists in both board-store and puzzle store. In actions:
- Board-store: import as `setBoardStatus` (or use the module import name)
- Puzzle store: destructure from `getState().actions` (already namespaced)

`setSelectedTile` also exists in both, but puzzle store's version gets removed. No collision after migration.

---

## Open Notes for Future Sessions

1. `BoardTile` should probably get `React.memo` — without it, using it directly forces all 400 tiles to re-render when the board component re-renders (even though useSyncExternalStore prevents unnecessary DOM updates, the function calls still happen).

2. `PuzzleTile`, `SandboxTile`, `GameTile` are nearly identical after migration — all just `useTileData` + `toTileRendererProps` + TileRenderer with domain-specific click handler. Could collapse into shared component or memoized `BoardTile`.

3. `toTileRendererProps` and `BoardTile` probably don't belong in `board-store/` long-term — they're rendering concerns, not state management. Fine for now.
