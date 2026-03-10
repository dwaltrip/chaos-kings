# Board Store — Post-Integration Notes

Observations from the puzzles integration. Focus: what will matter for cross-domain synthesis after all three domains (puzzles, sandbox, gameplay) are on board-store.

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
- Sandbox: `initBoard([], 0, board)` in `handleSessionStarted`
- Gameplay: `initBoard(players, currentPlayerIndex, board)` in `setupGameState`

This is natural — each domain knows its own setup flow. Not a problem, just a pattern to be aware of.

---

## Things to fix before or during gameplay integration

### `isSelectable` needs `currentPlayerIndex` filtering

`getIsSelectable()` in `tile-derived-state.ts` checks `isPlayerSquare(square)` but doesn't verify `square.playerIndex === currentPlayerIndex`. For puzzles this is harmless (single player). For gameplay, enemy tiles would appear selectable.

Fix: add `currentPlayerIndex` to the check. Something like:
```ts
function getIsSelectable(square, isSelected, status, currentPlayerIndex) {
  return !isSelected && status !== 'ended'
    && isPlayerSquare(square)
    && square.playerIndex === currentPlayerIndex;
}
```

Spectator mode (`currentPlayerIndex === null`) should make nothing selectable — this check handles that naturally.

---

## Cross-domain cleanup opportunities (after all 3 integrate)

### Delete old infrastructure
- `games/stores/board-session-store.ts` (sandbox uses this)
- `games/stores/tile-store-registry.ts`
- `games/stores/tile-orchestrator.ts`
- `games/hooks/use-tile-store-state.ts`
- `games/utils/tile-selection-helpers.ts`

### Shared tile component
If all three tile components (PuzzleTile, SandboxTile, GameTile) end up as the same `useTileData` + `toTileRendererProps` + `TileRenderer` pattern with identical click handlers, collapse into one shared `BoardTile` with `React.memo`. Current `BoardTile` in board-store is not memoized — either add memo there or create a new shared version.

### Move rendering concerns out of board-store
`toTileRendererProps`, `BoardTile`, and `TileRenderer` are rendering layer, not state management. They don't belong in `board-store/`. After integration reveals the right grouping:
- Option A: `games/board-ui/` — sibling to `board-store/`
- Option B: `games/board/store/` + `games/board/ui/` — single `board/` domain
- Option C: Move `TileRenderer` out of `gameplay/ui/` into shared location, keep adapters nearby

### Shared `queueMove`
If all three versions are identical except for the WS send, extract to `games/actions/queue-move.ts` with the WS send function passed as a parameter.

### WS effects deduplication
`sendMoveRequest`, `sendUndoMove`, `sendCancelMoves` exist in all three domains' ws-effects. Check if the protocol messages are actually different or just prefixed differently. If same shape, could share.

### Shrunk domain stores
After migration, puzzle store is just: status, result, userStats. Sandbox meta store would be: status, isPaused, config, maxTickReached. Gameplay store would be: game, gameplayReady, player lookups. All are small but each serves a distinct purpose — probably still worth keeping as separate stores.

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
