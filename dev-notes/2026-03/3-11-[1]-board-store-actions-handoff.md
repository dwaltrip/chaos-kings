# Board Store Actions — Handoff

## What was done

Moved `queueMoveOnBoard` and `cancelQueuedMoves` into `board-store/actions.ts` as raw actions (pure state mutations). Added `userSelectTile` to distinguish user clicks from programmatic selection. Added `store.mutate()` to `createStore` for inline state mutations (used in tests). Widened `makeAction` to preserve return types.

### Key design decisions

- **`setSelectedTile` vs `userSelectTile`**: Both set `selectedTile`. `setSelectedTile` resets `hasUserSelectedSinceLastQueue` to false (programmatic). `userSelectTile` sets it to true (user click). This flag drives cancel snap-back behavior.
- **Cancel snap-back logic**: On cancel, if the user hasn't manually selected a tile since the last queued move, snap selection to `queuedMoves[0].sourceCoord` (where execution reached). If they have, leave selection alone.
- **`store.mutate()`**: Inline anonymous action on `createStore`. TODO comment to throw on state writes outside of `mutate`/`makeAction`.

## What remains

### 1. Migrate callers of `board/actions/` to use board-store directly

The old `board/actions/` files still exist. Domain callers need to switch imports:

- `gameplay/actions/queue-move.ts` — imports `queueMoveOnBoard` from `board/actions`
- `sandbox/actions/queue-move.ts` — same
- `puzzles/actions/queue-move.ts` — same

These should import from `@/domains/games/board-store` instead. The domain wrappers stay (they add ws-effects), just change the import source.

### 2. Wire up `cancelQueuedMoves` in domain actions

- **`gameplay/actions/cancel-queued-moves.ts`** — currently calls `setQueuedMoves([])` directly. Should use the new `cancelQueuedMoves` from board-store + `gameplayWsEffects.sendCancelMoves()`.
- **`sandbox/actions/clear-moves.ts`** — has its own snap-back logic using `lastExecutedMove`. Open question: can `cancelQueuedMoves` replace it? `queuedMoves[0].sourceCoord` should equal `lastExecutedMove` destination, but needs verification.

### 3. Wire up `userSelectTile` in remaining call sites

Already done for the 3 board UI files (game-board, puzzle-board, sandbox-board). Check if any other places call `setSelectedTile` that should be `userSelectTile`:
- `sandbox/pages/sandbox-page.tsx` — calls `setSelectedTile(null)` — this is programmatic (page logic), keep as-is
- `gameplay/actions/update-for-game-ended.ts` — calls `setSelectedTile(null)` — programmatic, keep as-is
- `puzzles/actions/handle-puzzle-end.ts` — imports as `setBoardSelectedTile` — programmatic, keep as-is

### 4. Delete `board/actions/` directory

Once all callers are migrated:
- Delete `board/actions/queue-move.ts`
- Delete `board/actions/cancel-queued-moves.ts`
- Delete `board/actions/index.ts`

### 5. Export new actions from board-store index

`queueMoveOnBoard` and `cancelQueuedMoves` need to be wrapped via `makeAction` and exported from `board-store/index.ts` (like the other actions). `userSelectTile` is already exported.

### 6. Open question from earlier

> Can sandbox's `clearMoves` use `cancelQueuedMoves` instead of its own snap-back logic? Is `queuedMoves[0].sourceCoord` always equivalent to `lastExecutedMove` destination?

Deferred — come back to this after the migration.
