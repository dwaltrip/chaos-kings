# Board Store Integration Survey

Survey of the existing code that board-store replaces, and how each domain maps to the new architecture. For board-store API reference see the [board-store README](../../apps/frontend/src/domains/games/board-store/README.md).

---

## Shared Infrastructure Being Replaced

These files in `games/` are used by puzzles and sandbox (not gameplay — see note below):

### `board-session-store.ts` (Zustand)
State: `board`, `tick`, `selectedTile`, `visibleSquares: Set<string>`, `queuedMoves: Movement[]`, `lastExecutedMove`, `isEnded`

All simple setters. Parameterized selectors for per-tile queries: `selectIsTileSelected(coord)`, `selectIsAdjacentToSelected(coord)`, `selectIsVisible(coord)`, `selectNeighborVisibility(coord)`.

### `tile-store-registry.ts`
Per-coordinate Zustand stores created on demand via `getTileStore(coord)`. Each store holds `square: Square` and `queuedDirections: Set<Direction>` with simple setters.

### `tile-orchestrator.ts`
Batch operations over the tile registry:
- `updateTileSquares(board)` — iterates all coords, pushes square to each tile store
- `clearAllQueuedDirections(board)` — sets all tile stores' queuedDirections to empty Set
- `updateQueuedDirections(map)` — updates multiple tiles from a coord→directions map

### `tile-selection-helpers.ts`
Pure functions: `isTileSelected()`, `isTileAdjacentToSelected()`, `isTileVisible()`, `getNeighborVisibility()`. Called by store selectors and tile components.

### `use-tile-store-state.ts`
Hooks: `useTileSquare(coord)` and `useTileQueuedDirections(coord)`. Read from per-tile stores via `getTileStore(coord)`.

### How board-store replaces all of this
- `boardSessionStore` state → `BoardSourceState` + `UIState` in board-store
- `tile-store-registry` + `tile-orchestrator` → board-store's internal `tileCache` + `runPipeline`
- `tile-selection-helpers` → logic baked into `computeTileData` in `tile-derived-state.ts`
- `use-tile-store-state` hooks → `useTileData(store, coord)` from board-store
- Visibility computation (manual `Board.getVisibleSquares()` calls in actions) → automatic via `deriveBoardState`

---

## Puzzles Domain

### Current Stores
- **`usePuzzleStore`** — `status` ('idle'|'playing'|'ended'), `board`, `tick`, `moveQueue`, `visibleSquares`, `result`, `userStats`, `selectedTile`. All simple setters.
- **Per-tile stores** via `getTileStore(coord)` from games/ shared infra

### Action-by-Action Mapping

**`startPuzzle()`** — resets puzzle store, sends WS
→ `boardStore.reset()` + reset puzzle-specific fields (result, userStats)

**`handleStateUpdate(tick, board, moveQueue)`** — WS handler, most complex action
Currently does:
1. `tileOrchestrator.updateTileSquares(board)`
2. `tileOrchestrator.clearAllQueuedDirections(board)`
3. Loop: `getTileStore(move.sourceCoord).addQueuedDirection(move.direction)`
4. `Board.getVisibleSquares(board, 0)` — manual visibility
5. Set status, tick, board, moveQueue, visibleSquares

→ Becomes: `applyTick(tick, board, moveQueue, [], null)` — one call, pipeline handles the rest

**`queueMove(source, direction)`** — user click / keyboard
Currently: validate, `addQueuedMove()`, `getTileStore(source).addQueuedDirection()`, move selection, send WS
→ `addQueuedMove({sourceCoord, direction})` + `setSelectedTile(destination)` + send WS

**`handlePuzzleEnd(tick, result, finalBoard)`** — WS handler
Currently: update tile stores, clear queued dirs, make all visible, set status/result
→ `applyTick(tick, finalBoard, [], [], null)` + `setStatus('ended')` + set result in puzzle store

**`clearMoves()`** / **`undoMove()`** — WS-only, no local state changes. No board-store involvement.

**`loadUserStats()`** — REST API call, stays entirely in puzzle store.

### What Stays in Puzzle Store
- `status: 'idle' | 'playing' | 'ended'` — the `'idle'` state is puzzle-specific (board-store only knows `'active' | 'ended'`)
- `result: BestStartResult | null` — puzzle scoring
- `userStats: UserPuzzleStats | null` — player statistics

### What Moves to Board-Store
`board`, `tick`, `moveQueue`, `visibleSquares` (now derived), `selectedTile`

### Tile Component
`PuzzleTile` reads from 7 hooks/selectors (2 per-tile store, 5 parameterized selectors from puzzle store), computes derived flags, passes to `TileRenderer`.
→ Collapses to `useTileData(boardStore, coord)` + `toTileRendererProps(tile)`. Could use `BoardTile` directly with a click handler.

---

## Sandbox Domain

### Current Stores
- **`useBoardSessionStore`** — shared store from games/ (see above)
- **`useSandboxMetaStore`** — `status` ('idle'|'active'), `isPaused`, `config: SandboxConfig`, `maxTickReached`
- **Per-tile stores** via `getTileStore(coord)` from games/ shared infra
- **`moveHistoryCache`** — external `Map<number, Movement | null>`, not in any store

### Action-by-Action Mapping

**`startSandbox()`** — resets both stores, sends WS
→ `boardStore.reset()` + reset sandbox meta store

**`handleSessionStarted(board, config)`** — WS handler
Currently: orchestrator updates, visibility, set board/tick/visibleSquares/queuedMoves/isEnded, set status/isPaused/config
→ `initBoard([], 0, board)` + `applyTick(0, board, [], [], null)` + set meta store fields

**`handleStateUpdate(tick, board, moveQueue, isPaused, maxTickReached, lastExecutedMove)`** — WS handler
Currently: `applyBoardState()` (same orchestrator dance as puzzles), cache move, set meta fields
→ `applyTick(tick, board, moveQueue, [], null)` + `moveHistoryCache.set(tick, lastExecutedMove)` + set isPaused/maxTickReached

**`stepForward()`** — keyboard/button, optimistic
Currently: check bounds, look up `moveHistoryCache`, send WS always, if cache hit: `processStep()` locally then `applyBoardState()`
→ Same logic, but apply result via `applyTick(nextTick, computedBoard, [], [], null)` instead of `applyBoardState()`

**`stepBack()`** / **`play()`** / **`pause()`** / **`reset()`** — WS-only, no local state changes.

**`queueMove(selectedTile, direction)`** — same pattern as puzzles
→ `addQueuedMove()` + `setSelectedTile()` + send WS

**`clearMoves()`** — reads queuedMoves/lastExecutedMove to compute new selection, sends WS
→ Reads from `boardStore.state.game.queuedMoves`, calls `setSelectedTile()`, sends WS

**`undoMove()`** — WS-only.

**`endSandbox()`** — resets stores, clears moveHistoryCache
→ `boardStore.reset()` + reset meta store + `moveHistoryCache.clear()`

### What Stays in Sandbox Meta Store
- `status: 'idle' | 'active'` — sandbox lifecycle
- `isPaused` — timeline control
- `config: SandboxConfig` — sandbox configuration
- `maxTickReached` — timeline bounds

### What Stays External
- `moveHistoryCache: Map<number, Movement | null>` — optimistic step-forward cache

### What Moves to Board-Store
Everything currently in `boardSessionStore`: `board`, `tick`, `selectedTile`, `visibleSquares` (now derived), `queuedMoves`, `isEnded` (now `status`)

### Tile Component
`SandboxTile` — identical pattern to `PuzzleTile`. Same 7 hook/selector calls, same derived flags, same `TileRenderer` output. Same migration path.

---

## Gameplay Domain

### Important Context
Gameplay is the **original** domain — it predates `boardSessionStore`. It has its own `gameplayStoreV2` with board state mixed in alongside game metadata. `boardSessionStore` was built later as a cleaner shared layer for puzzles/sandbox, with the plan to eventually migrate gameplay onto it. Board-store now leapfrogs that plan.

### Current Stores
- **`gameplayStoreV2`** — everything in one store: `game: GameWithPlayers`, `boardState`, `tick`, `selectedTile`, `visibleSquares`, `queuedMoves`, `playerStats`, `winner`, `players`, `playersByIndex`, `playersByUserId`, `currentPlayer`, `currentPlayerIndex`, `gameplayReady`
- **`gameplayPageStore`** — async store for game entity + countdown: `data: GameWithPlayers`, `countdownActive`, `countdownSeconds`
- **Cross-store subscription** — `gameplayStoreV2` subscribes to `gameplayPageStore` and syncs the `game` field
- **Per-tile stores** via `getTileStore(coord)` from games/ shared infra

### Action-by-Action Mapping

**`setupGameState(game)`** — page load
Currently: sets players, playersByIndex, currentPlayerIndex, gameplayReady, calls `updateGameplayState()` if board exists
→ `initBoard(players, currentPlayerIndex, board)` + keep `gameplayReady` and player lookups in gameplay store

**`updateGameplayState(tick, board, moves, playerStats)`** — WS handler (gated by `gameplayReady`)
Currently: setTick, `updateBoard()` (which calls `tileOrchestrator.updateTileSquares()`), setVisibleSquares, clear+re-add queued directions via orchestrator, setQueuedMoves, setPlayerStats
→ `applyTick(tick, board, moves, playerStats)` — one call

**`queueMove(direction, selectedTile, board)`** — keyboard with repeat
Currently: validate, addQueuedMove, `getTileStore(source).addQueuedDirection()`, setSelectedTileV2, send WS
→ `addQueuedMove()` + `setSelectedTile()` + send WS

**`cancelQueuedMoves()`**
Currently: `tileOrchestrator.updateQueuedDirections(new Map())` + `setQueuedMoves([])`+ send WS
→ `setQueuedMoves([])` + send WS

**`undoLastQueuedMove()`** — local optimistic undo
Currently: compute remaining directions for source tile, update tile store, revert selection if needed, setQueuedMoves(sliced), send WS
→ `undoLastQueuedMove()` + possibly `setSelectedTile()` + send WS

**`updateForGameStart(game, boardState)`** — WS handler
Currently: set countdown off, set game, updateBoard, setVisibleSquares
→ `initBoard(...)` + `applyTick(...)` + update page store countdown

**`updateForGameStarting(countdownSeconds)`** — WS handler
Currently: set countdown active/seconds in page store
→ No board-store involvement. Stays in page store.

**`updateForGameEnded(finalBoard, winner)`** — WS handler
Currently: update page store game status, updateBoard, setWinner, clear visibility, clearSelectedTile
→ `applyTick(tick, finalBoard, [], playerStats, winner)` + `setStatus('ended')` + `setSelectedTile(null)`

### What Stays in Gameplay Stores

**gameplayStoreV2 (shrinks to):**
- `game: GameWithPlayers` — full game metadata
- `gameplayReady: boolean` — gates tick processing
- `players`, `playersByIndex`, `playersByUserId`, `currentPlayer`, `currentPlayerIndex` — player lookups

**gameplayPageStore (unchanged):**
- `countdownActive`, `countdownSeconds` — pre-game UI
- `data: GameWithPlayers` — async-loaded game entity

**Cross-store subscription** — may still be needed for syncing game metadata

### What Moves to Board-Store
`boardState`, `tick`, `selectedTile`, `visibleSquares` (now derived), `queuedMoves`, `playerStats`, `winner`

### Tile Component
`GameTile` — same pattern as puzzles/sandbox. Also extracts `setSelectedTileV2` at module level (the stale-reference anti-pattern noted in the original problem docs). Migration eliminates this.

### Spectator Mode
`currentPlayerIndex === null` means spectator — all tiles visible, no moves allowed. Board-store handles this: `deriveBoardState` sets `allVisible = true` when `currentPlayerIndex === null`.

### Keyboard Repeat Performance
`queueMove` fires at ~50ms intervals during key repeat. Currently triggers 3+ store mutations per call. With board-store: 2 action calls (`addQueuedMove` + `setSelectedTile`), each running the pipeline. Worth monitoring but likely fine at current board sizes.

---

## Cross-Domain Patterns

### The Tick Update Dance (identical in all three)
```
tileOrchestrator.updateTileSquares(board)
tileOrchestrator.clearAllQueuedDirections(board)
for each move: getTileStore(move.sourceCoord).addQueuedDirection(move.direction)
Board.getVisibleSquares(board, playerIndex)
set board, tick, queuedMoves, visibleSquares
```
All replaced by: `applyTick(tick, board, queuedMoves, playerStats, winner)`

### The Tile Component Pattern (identical in all three)
```
useTileSquare(coord)                           → from per-tile store
useTileQueuedDirections(coord)                 → from per-tile store
selectIsTileSelected(coord)                    → from board/puzzle/gameplay store
selectIsAdjacentToSelected(coord)              → from board/puzzle/gameplay store
selectIsVisible(coord)                         → from board/puzzle/gameplay store
selectNeighborVisibility(coord)                → from board/puzzle/gameplay store
isEnded                                        → from domain store
compute isSelectable, isValidMove, borders
pass to TileRenderer
```
All replaced by: `useTileData(boardStore, coord)` → `toTileRendererProps(tile)` → `TileRenderer`

### The queueMove Pattern (identical in all three)
```
Board.canMove(board, source, direction)
addQueuedMove({ sourceCoord, direction })
getTileStore(source).addQueuedDirection(direction)
setSelectedTile(Board.applyDirection(source, direction))
domainWsEffects.sendMoveRequest(source, direction)
```
With board-store, the middle three lines become:
```
addQueuedMove({ sourceCoord, direction })
setSelectedTile(Board.applyDirection(source, direction))
```

---

## Key Discoveries

1. **Gameplay hasn't diverged — it's the original.** `boardSessionStore` was the newer, cleaner shared layer built for puzzles/sandbox. Board-store now replaces both.

2. **`status` mapping:** Puzzles uses `'idle' | 'playing' | 'ended'`, sandbox uses `'idle' | 'active'`, gameplay has no explicit status field (derives from game object). Board-store uses `'active' | 'ended'`. The `'idle'` concept stays domain-specific.

3. **`lastExecutedMove`** is sandbox-only (for optimistic step-forward). Keep it in sandbox code, not board-store.

4. **`gameplayReady`** is a domain-level gate, not board state. Stays in gameplay.

5. **`playerStats`** exists in board-store's `BoardSourceState`. Puzzles and sandbox can pass `[]` since they don't track it. Gameplay passes the real values.

6. **Puzzles hardcodes player index 0.** Board-store's `currentPlayerIndex` handles this — puzzles sets it to `0` via `initBoard`.

7. **The cross-store subscription** in gameplay (pageStore → storeV2) syncs game metadata. This is orthogonal to board-store — it can stay as-is or be simplified separately.

---

## Related Docs

- [Board-store README](../../apps/frontend/src/domains/games/board-store/README.md) — API reference
- [Board-store background](3-09-[7]-board-store-v2-background.md) — design decisions
- [Integration questions](3-09-[8]-board-store-integration-questions.md) — open questions for during/after implementation
