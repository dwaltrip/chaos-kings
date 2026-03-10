# Gameplay Board-Store Integration — Code Survey & Design Notes

Phase 1 read-through and Phase 2 brainstorm for the gameplay domain board-store integration.

---

## What Was Read

**Stores:**
- `gameplayStoreV2` — monolith with board state + game metadata + player lookups + selectors for visibility/selection. Has cross-store subscription to `gameplayPageStore`.
- `gameplayPageStore` — async store for game entity + countdown. Untouched by this migration.

**Actions touching old infra (7 files):**
- `updateGameplayState` — tick handler, uses `tileOrchestrator` + `getTileStore` + manual visibility
- `queueMove` — uses `getTileStore().addQueuedDirection()` + `gameplayActions().addQueuedMove/setSelectedTileV2`
- `undoLastQueuedMove` — uses `getTileStore().updateQueuedDirections()` + reads `queuedMoves`/`selectedTile` from store
- `cancelQueuedMoves` — uses `tileOrchestrator.updateQueuedDirections(new Map())`
- `setupGameState` — sets player data, gameplayReady, calls `updateGameplayState` if board exists
- `updateForGameStart` — manual `updateBoard` + `Board.getVisibleSquares`
- `updateForGameEnded` — manual `updateBoard` + visibility clear + winner

**UI:**
- `GameTile` — classic 7-hook pattern, module-level `setSelectedTileV2` extraction
- `GameUI` — reads `board`, `selectedTile`, `game` from `gameplayStoreV2`
- `GameBoard` — receives `boardState` as prop
- `GameplayPage` — reads `winner` and `tick` from `gameplayStoreV2`
- `ArmyInfo` — reads `players`, `playersByIndex`, `playerStats`, `currentPlayerIndex`

---

## Design Decisions

### `isSelectable` fix (pre-task)

`getIsSelectable` in `tile-derived-state.ts` checks `isPlayerSquare(square)` but not `square.playerIndex === currentPlayerIndex`. Enemy tiles would appear selectable in gameplay. Fix: add `currentPlayerIndex` to the check. Do this first before any gameplay wiring.

### `gameplayStoreV2` after migration

Shrinks to: `game`, `gameplayReady`, player lookups (`players`, `playersByIndex`, `playersByUserId`, `currentPlayer`, `currentPlayerIndex`).

Still worth a Zustand store — multiple UI components subscribe (`GameplayPage`, `GameHeader`, `ArmyInfo`), plus the cross-store subscription and `gameplayReady` gate are real concerns.

### `currentPlayerIndex` duplication

Lives in both gameplay store (player identity lookups — who is "You" in sidebar) and board-store (visibility/selectability). Different purposes, same value set once. Fine.

### Cross-store subscription

`gameplayPageStore → gameplayStoreV2` syncing `game` field. Still needed after migration — leave as-is.

### `gameplayReady` gate

Stays at the action level in `updateGameplayState`. Board-store doesn't need to know about it.

### `undoLastQueuedMove` — local optimistic undo

With board-store: read `queuedMoves` from `boardStore.state.game.queuedMoves` to get last move (for selection revert), call `undoLastQueuedMove()` (pipeline recomputes tile arrows), call `setSelectedTile(lastMove.sourceCoord)` if needed, send WS. Per-tile store manipulation eliminated.

Key: must read `queuedMoves` *before* calling `undoLastQueuedMove()` to know which move was undone.

---

## Mechanical vs Needs Thought

### Mechanical (follows puzzles/sandbox patterns exactly)

- `GameTile` → `useTileData(boardStore, coord)` + `toTileRendererProps` + `TileRenderer`
- `updateGameplayState` → gate check + `applyTick(tick, board, moves, playerStats)`
- `queueMove` → `addQueuedMove()` + `setSelectedTile()` + WS send
- `cancelQueuedMoves` → `setQueuedMoves([])` + WS send
- `setupGameState` → `initBoard(players, currentPlayerIndex)` + gameplay-specific setup
- `updateForGameEnded` → `applyTick()` + `setStatus('ended')` + `setSelectedTile(null)`
- `updateForGameStart` → `applyTick()` + page store updates
- `GameUI` → read board from `boardStore` via `useBoardState`
- `GameplayPage` → read `tick`/`winner` from `boardStore`

### Needs thought

- `undoLastQueuedMove` — read-before-mutate ordering (minor)
- `ArmyInfo` — reads `playerStats` (moves to board-store) + `players`/`playersByIndex`/`currentPlayerIndex` (stay in gameplay store). Will need to read from both stores.
- `gameplayStoreV2` cleanup — removing old board fields, selectors, tile orchestrator import
