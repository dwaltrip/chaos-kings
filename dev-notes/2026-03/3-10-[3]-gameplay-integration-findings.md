# Gameplay Board-Store Integration — Findings

Third and final board-store integration. Puzzles and sandbox were done first.

---

## What changed

### Board-store enhancements (pre-integration)

**`isSelectable` fix:** Added `currentPlayerIndex` check to `getIsSelectable()` in `tile-derived-state.ts`. Without this, enemy tiles appeared selectable in gameplay. Spectator mode (`currentPlayerIndex === null`) naturally makes nothing selectable.

**`undoLastQueuedMove` now handles selection revert:** Moved the selection-revert-to-source logic from gameplay's action into board-store's `undoLastQueuedMove` action. This way any domain that calls it gets consistent undo + selection behavior. Single pipeline run instead of read-then-two-mutations.

### Actions migrated (7 files)

- `updateGameplayState` — collapsed from 3 functions (60 lines) to 1 function (15 lines). Gate check + `applyTick()`.
- `queueMove` — dropped `getTileStore` manipulation. Now: `addQueuedMove()` + `setSelectedTile()` + WS send. Signature simplified (no longer needs `board` param).
- `undoLastQueuedMove` — collapsed from 2 functions (45 lines) to 5 lines. Reads `queuedMoves` for empty check, then `boardUndoLastQueuedMove()` + WS send.
- `cancelQueuedMoves` — collapsed from tileOrchestrator call + setter to `setQueuedMoves([])` + WS send.
- `setupGameState` — added `initBoard(players, currentPlayerIndex)` call after `setPlayerData`.
- `updateForGameStart` — replaced manual `updateBoard` + `Board.getVisibleSquares` with `initBoard()` + `applyTick()`.
- `updateForGameEnded` — replaced manual board/visibility/winner updates with `applyTick(tick, board, [], playerStats, winner)` + `setStatus('ended')` + `setSelectedTile(null)`.

### UI migrated

- `GameTile` — collapsed from 7 hooks + manual derived computation (74 lines) to `useTileData` + `toTileRendererProps` + `TileRenderer` (30 lines). Eliminated module-level action extraction anti-pattern.
- `GameUI` — reads board/selectedTile from `useBoardState(boardStore)` instead of `gameplayStoreV2`.
- `GameplayPage` — reads `winner`/`tick` from `useBoardState(boardStore).game`.
- `ArmyInfo` — reads `playerStats` from board-store, player identity data stays in gameplay store.

### `gameplayStoreV2` cleanup

Removed: `boardState`, `tick`, `selectedTile`, `visibleSquares`, `queuedMoves`, `playerStats`, `winner`, and all their setters/selectors. Store went from 235 lines to ~90 lines. Remaining: `game`, `gameplayReady`, player lookups.

### Old infra deleted

All consumers gone — deleted 5 files (275 lines):
- `games/stores/board-session-store.ts`
- `games/stores/tile-store-registry.ts`
- `games/stores/tile-orchestrator.ts`
- `games/hooks/use-tile-store-state.ts`
- `games/utils/tile-selection-helpers.ts`

---

## Confirmed patterns (all 3 domains)

### `queueMove` is identical across all three

All three: `addQueuedMove()` + `setSelectedTile()` + `domainWsEffects.sendMoveRequest()`. Ready to extract to shared function.

### Tile components are identical across all three

All three: `useTileData(boardStore, coord)` + `toTileRendererProps(tile)` + `TileRenderer` with click handler `setSelectedTile(coord)` when selectable. Ready to collapse into shared `BoardTile`.

### Tick handlers are trivially thin across all three

All reduce to `applyTick()` + domain-specific setters.

---

## Design decisions

**`currentPlayerIndex` duplication:** Lives in both gameplay store (player identity — "You" label in sidebar) and board-store (visibility/selectability). Different purposes, same value. Fine.

**`gameplayReady` gate:** Stays in the action layer. Board-store doesn't need to know about domain-level readiness.

**Cross-store subscription:** `gameplayPageStore → gameplayStoreV2` syncing `game` field stays as-is. Orthogonal to board-store migration.

**`ArmyInfo` perf:** Uses `useBoardState` for `playerStats` which re-renders on every board-store action (including keyboard repeat). Added TODO to profile. Likely fine but worth watching.

---

## `boardStore.reset()` placement

Added `boardStore.reset()` in `loadGameplayPage` (before loading new game) and `resetGameplayPage` (page unmount). Same pattern as puzzles (`startPuzzle`) and sandbox (`startSandbox`/`endSandbox`).
