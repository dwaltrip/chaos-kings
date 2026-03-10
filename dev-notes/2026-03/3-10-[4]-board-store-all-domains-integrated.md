# Board Store — All Domains Integrated

First pass of board-store integration is complete across all three domains (puzzles, sandbox, gameplay). Old tile infra is deleted. This doc captures findings from all three integrations and catalogs the cross-domain cleanup work ahead.

See also: `3-09-[8]-board-store-integration-questions.md` (pre-integration questions, most now answered).

---

## Per-domain findings

### Puzzles

- `handleStateUpdate` collapsed from 10 lines to 2: `applyTick()` + `setStatus('playing')`.
- `handlePuzzleEnd` went to 6 lines (3 board-store calls + 2 puzzle store setters + async loadUserStats).
- `PuzzleTile` collapsed from 40+ lines (7 hooks) to ~10 lines (`useTileData` + `toTileRendererProps` + `TileRenderer`).
- `initBoard` timing: must call `initBoard([], 0)` in `startPuzzle()` after `boardStore.reset()` to set `currentPlayerIndex = 0` before the first `applyTick`. Otherwise `deriveBoardState` sets `allVisible = true`.

### Sandbox

- `handleStateUpdate` confirmed same trivially-thin pattern as puzzles.
- `moveHistoryCache` + `lastExecutedMove` extracted cleanly to `sandbox/move-history-cache.ts`. Non-reactive state consumed by actions.
- `stepForward` optimistic path works naturally with `applyTick`.
- `applyBoardState` + `board-session/` directory deleted (zero consumers after sandbox migrated).

### Gameplay

- `gameplayStoreV2` shrank from 235 lines to ~90 lines. Removed 10 actions and 7 selectors. Remaining: `game`, `gameplayReady`, player lookups.
- `queueMove` signature simplified — no longer needs `board` param (reads from `boardStore.state.game.board`).
- `GameTile` eliminated the module-level `setSelectedTileV2` extraction anti-pattern.
- `ArmyInfo` now reads from two stores: `playerStats` from board-store, player identity from gameplay store.
- `boardStore.reset()` added to `loadGameplayPage` (before load) and `resetGameplayPage` (unmount).

---

## Fixes applied during integration

**`isSelectable` now checks `currentPlayerIndex`:** Added `square.playerIndex === currentPlayerIndex` to `getIsSelectable()`. Prevents enemy tiles appearing selectable. Spectator mode (`currentPlayerIndex === null`) makes nothing selectable naturally.

**`undoLastQueuedMove` includes selection revert:** Moved selection-revert-to-source logic from gameplay's action into board-store. All domains get consistent undo + selection behavior. Single pipeline run.

---

## Old infrastructure — DELETED

All consumers gone. Deleted 5 files (275 lines):
- `games/stores/board-session-store.ts`
- `games/stores/tile-store-registry.ts`
- `games/stores/tile-orchestrator.ts`
- `games/hooks/use-tile-store-state.ts`
- `games/utils/tile-selection-helpers.ts`
- `games/board-session/` — deleted during sandbox integration

---

## Gameplay-specific design decisions

**`currentPlayerIndex` duplication:** Lives in both gameplay store (player identity — "You" label in sidebar) and board-store (visibility/selectability). Different purposes, same value. Fine.

**`gameplayReady` gate:** Stays in the action layer. Board-store doesn't need to know about domain-level readiness.

**Cross-store subscription:** `gameplayPageStore → gameplayStoreV2` syncing `game` field stays as-is. Orthogonal to board-store.

---

## Cross-domain patterns confirmed (3/3)

### `queueMove` is identical across all three
All three: `addQueuedMove()` + `setSelectedTile()` + `domainWsEffects.sendMoveRequest()`. Only domain-specific part is the ws-effects call.

### Tile components are identical across all three
All three: `useTileData(boardStore, coord)` + `toTileRendererProps(tile)` + `TileRenderer` with click handler `setSelectedTile(coord)` when selectable.

### Tick handlers are trivially thin across all three
All reduce to `applyTick()` + domain-specific setters. Handler → action boundary still worth keeping for consistency.

### `initBoard` timing
Each domain has its own initialization point — natural, not a problem:
- Puzzles: `initBoard([], 0)` in `startPuzzle`
- Sandbox: `initBoard([], 0)` in `startSandbox`
- Gameplay: `initBoard(players, currentPlayerIndex)` in `setupGameState`

---

## Cross-domain cleanup — TODO

These are the refactors to review and execute now that all three domains are on board-store.

### Shared tile component
All three tile components are identical. Collapse into shared `BoardTile` with `React.memo`. Current `BoardTile` in board-store is not memoized.

### Shared `queueMove`
All three versions identical except WS send. Extract to `games/actions/queue-move.ts` with the WS send function as a parameter.

### Move rendering concerns out of board-store
`toTileRendererProps`, `BoardTile`, and `TileRenderer` are rendering layer, not state management. Options:
- Option A: `games/board-ui/` — sibling to `board-store/`
- Option B: `games/board/store/` + `games/board/ui/` — single `board/` domain
- Option C: Move `TileRenderer` out of `gameplay/ui/` into shared location

### WS effects deduplication
`sendMoveRequest`, `sendUndoMove`, `sendCancelMoves` exist in all three domains' ws-effects. Check if the protocol messages are actually different or just prefixed differently.

### Shrunk domain stores
Puzzle store = status, result, userStats. Sandbox meta store = status, isPaused, config, maxTickReached. Gameplay store = game, gameplayReady, player lookups. All small, each serves a distinct purpose — keep as separate stores.

---

## Performance notes to watch

### `useBoardState` granularity
Page components re-render on every board-store action (including `addQueuedMove`, `setSelectedTile`). For puzzles this is fine (~1 tick/sec). For gameplay with keyboard repeat at ~50ms, page re-renders ~20x/sec from selection changes alone. Likely still fine, but profile if sluggish.

### Multiple pipeline runs per logical operation
`queueMove` runs the pipeline twice per keypress (addQueuedMove + setSelectedTile). At keyboard repeat rates: ~40 pipeline runs/sec, each iterating all tiles. Options if needed:
- Action batching (`batch(() => { ... })`)
- Combined action (`queueMoveAndSelect(move, coord)`)
- Dirty regions (only recompute affected tiles)

### `ArmyInfo` sidebar re-renders during keyboard repeat
`GameplayArmyInfo` uses `useBoardState` to read `playerStats`, re-renders on every board-store action (~40x/sec during keyboard repeat). Render is cheap but worth profiling. Fix: `playerStats`-specific selector or keep `playerStats` in gameplay store.
