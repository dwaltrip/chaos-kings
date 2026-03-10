# Board Store — Post-Integration Notes

Observations from all three integrations (puzzles, sandbox, gameplay). All three domains are now on board-store. See also `3-10-[3]-gameplay-integration-findings.md` for gameplay-specific details.

See also: `3-09-[8]-board-store-integration-questions.md` (pre-integration questions, some now answered).

---

## Concrete findings from puzzles

### Actions became trivially thin

`handleStateUpdate` went from 10 lines to 2:
```ts
applyTick(tick, board, moveQueue, []);
setStatus('playing');
```

`handlePuzzleEnd` went from 12 lines to 6 (3 board-store calls + 2 puzzle store setters + loadUserStats). Still justifies a file because it coordinates two stores + has the async loadUserStats call.

If sandbox and gameplay `handleStateUpdate` are similarly thin, the action file feels like ceremony. But the handler → action boundary is a project convention worth keeping for consistency, even if the action is small. Revisit if all three domains confirm the pattern.

### `queueMove` is ready to be shared

Post-migration, puzzles `queueMove` is:
```ts
const board = boardStore.state.game.board;
if (!board || !Board.canMove(board, source, direction)) return;
addQueuedMove({ sourceCoord: source, direction });
setSelectedTile(Board.applyDirection(source, direction));
puzzlesWsEffects.sendMoveRequest(source, direction);
```

The only domain-specific part is `puzzlesWsEffects.sendMoveRequest`. If sandbox and gameplay look the same, a shared `queueMove(source, direction, sendFn)` in `games/` would eliminate 3 nearly-identical files. Or even simpler: a shared function that takes just the ws-effects object.

### Tile components collapsed to ~10 lines each

PuzzleTile went from 40+ lines (7 hooks, manual derived computation) to:
```tsx
const tile = useTileData(boardStore, coord);
const rendererProps = toTileRendererProps(tile);
return <TileRenderer {...rendererProps} onClick={...} />;
```

If SandboxTile and GameTile end up the same shape, all three could be a single shared component. The only difference is the click handler — and even that might be the same (`setSelectedTile(coord)`).

### `initBoard` timing matters

Had to call `initBoard([], 0)` in `startPuzzle()` after `boardStore.reset()` to set `currentPlayerIndex = 0` before the first `applyTick`. Without this, `deriveBoardState` sees `currentPlayerIndex === null` → sets `allVisible = true` → first tick shows all tiles (wrong for puzzles).

Each domain needs its own initialization point:
- Puzzles: `initBoard([], 0)` in `startPuzzle`
- Sandbox: `initBoard([], 0)` in `startSandbox`, then `applyTick(0, board, [], [])` in `handleSessionStarted`
- Gameplay: `initBoard(players, currentPlayerIndex, board)` in `setupGameState`

This is natural — each domain knows its own setup flow. Not a problem, just a pattern to be aware of.

---

## Concrete findings from sandbox

### Confirmed: `handleStateUpdate` is trivially thin

Sandbox's `handleStateUpdate` is now `applyTick()` + 3 sandbox-specific setters (lastExecutedMove, isPaused, maxTickReached). Same pattern as puzzles. The handler → action boundary is still worth keeping for consistency.

### `queueMove` confirmed identical to puzzles

Sandbox `queueMove` is the same shape as puzzles — only the ws-effects call differs (`sandboxWsEffects.sendMoveRequest` vs `puzzlesWsEffects.sendMoveRequest`). Shared `queueMove` is now confirmed viable across 2/3 domains.

### SandboxTile collapsed identically to PuzzleTile

Same `useTileData` + `toTileRendererProps` + `TileRenderer` pattern, same click handler (`setSelectedTile(coord)` when selectable). Two out of three tile components are now identical — strong signal for a shared component.

### `moveHistoryCache` + `lastExecutedMove` extracted cleanly

Created `sandbox/move-history-cache.ts` with both the cache Map and the `lastExecutedMove` variable. Both are non-reactive state consumed by actions — they influence what gets written to reactive state but don't drive renders directly. Clean separation from both board-store and sandbox meta store.

Three touchpoints: `handleStateUpdate` populates, `stepForward` + `clearMoves` read, `endSandbox` resets.

### `stepForward` optimistic path unchanged

The `processStep` + `applyTick` flow works naturally. The TODO about "use real players array" stays — sandbox could support multi-player in the future. The single-player stub is correct for now.

### `applyBoardState` deleted

`board-session/actions/apply-state.ts` had zero consumers after sandbox migrated. Deleted along with the containing `board-session/` directory (which only had this file and an obsolete TODO).

---

## Fixes applied during gameplay integration

### `isSelectable` now checks `currentPlayerIndex` — DONE

Added `square.playerIndex === currentPlayerIndex` to `getIsSelectable()`. Spectator mode (`currentPlayerIndex === null`) makes nothing selectable naturally.

### `undoLastQueuedMove` includes selection revert — DONE

Moved selection-revert-to-source logic from gameplay's action into board-store's `undoLastQueuedMove`. All domains get consistent undo behavior. Single pipeline run.

---

## Old infrastructure — DELETED

All consumers gone after gameplay integration. Deleted 5 files (275 lines):
- `games/stores/board-session-store.ts`
- `games/stores/tile-store-registry.ts`
- `games/stores/tile-orchestrator.ts`
- `games/hooks/use-tile-store-state.ts`
- `games/utils/tile-selection-helpers.ts`
- `games/board-session/` — already deleted during sandbox integration

---

## Cross-domain cleanup opportunities (all 3 done — ready to execute)

### Shared tile component — CONFIRMED ready
All three tile components (PuzzleTile, SandboxTile, GameTile) are now the same `useTileData` + `toTileRendererProps` + `TileRenderer` pattern with identical click handler (`setSelectedTile(coord)` when selectable). Collapse into shared `BoardTile` with `React.memo`.

### Move rendering concerns out of board-store
`toTileRendererProps`, `BoardTile`, and `TileRenderer` are rendering layer, not state management. They don't belong in `board-store/`. Options:
- Option A: `games/board-ui/` — sibling to `board-store/`
- Option B: `games/board/store/` + `games/board/ui/` — single `board/` domain
- Option C: Move `TileRenderer` out of `gameplay/ui/` into shared location, keep adapters nearby

### Shared `queueMove` — CONFIRMED ready
All three versions are identical: `addQueuedMove()` + `setSelectedTile()` + `domainWsEffects.sendMoveRequest()`. Extract to `games/actions/queue-move.ts` with the WS send function as a parameter.

### WS effects deduplication
`sendMoveRequest`, `sendUndoMove`, `sendCancelMoves` exist in all three domains' ws-effects. Check if the protocol messages are actually different or just prefixed differently. If same shape, could share.

### Shrunk domain stores
After migration: puzzle store = status, result, userStats. Sandbox meta store = status, isPaused, config, maxTickReached. Gameplay store = game, gameplayReady, player lookups. All small but each serves a distinct purpose — keep as separate stores.

---

## Concrete findings from gameplay

### `gameplayStoreV2` shrank dramatically

Went from 235 lines (board state + game metadata + player lookups + selectors + tile orchestrator) to ~90 lines (game metadata + player lookups). Removed 10 actions and 7 selectors.

### `queueMove` confirmed identical to puzzles + sandbox (3/3)

Gameplay's `queueMove` signature simplified — no longer needs `board` param (reads from `boardStore.state.game.board`). Same `addQueuedMove` + `setSelectedTile` + WS send pattern.

### GameTile collapsed identically to PuzzleTile + SandboxTile (3/3)

Same `useTileData` + `toTileRendererProps` + `TileRenderer` pattern. Eliminated the module-level `setSelectedTileV2` extraction anti-pattern from the old code.

### `ArmyInfo` reads from two stores

`playerStats` from board-store, player identity (`players`, `playersByIndex`, `currentPlayerIndex`) from gameplay store. Uses `useBoardState` which re-renders on every board-store action — potential perf concern during keyboard repeat. Added TODO to profile.

### `boardStore.reset()` in page lifecycle

Added to `loadGameplayPage` (before load) and `resetGameplayPage` (unmount). Same pattern as puzzles/sandbox.

---

## Performance notes to watch

### `useBoardState` granularity
The page component re-renders on every board-store action (including `addQueuedMove`, `setSelectedTile`). Current Zustand selectors are per-field. For puzzles this is fine (cheap page render, ~1 tick/sec). For gameplay with keyboard repeat at ~50ms, the page would re-render ~20x/sec from selection changes alone. Likely still fine, but worth profiling if gameplay feels sluggish.

### Multiple pipeline runs per logical operation
`handlePuzzleEnd` runs the pipeline 3 times (applyTick + setStatus + setSelectedTile). For a one-time event, irrelevant. But `queueMove` runs it twice per keypress. At keyboard repeat rates in gameplay, that's ~40 pipeline runs/sec. Each iterates 400 tiles. Probably fine but if not, options:
- Action batching (`batch(() => { addQueuedMove(); setSelectedTile(); })`)
- Combined action (`queueMoveAndSelect(move, coord)`)
- Dirty regions (only recompute affected tiles)

None needed now — note for if performance becomes an issue.

### `ArmyInfo` sidebar re-renders during keyboard repeat
`GameplayArmyInfo` uses `useBoardState` to read `playerStats`, but `useBoardState` re-renders on every board-store action. During keyboard repeat (~20 queueMove calls/sec, each with 2 actions), the sidebar re-renders ~40x/sec. The render itself is cheap (small table), but worth profiling if gameplay feels sluggish. Fix: add a `playerStats`-specific selector or keep `playerStats` in gameplay store alongside player identity data.
