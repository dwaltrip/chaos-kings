# Session Prompt: Gameplay Domain — Board-Store Integration

## Goal

Replace gameplay's use of `gameplayStoreV2` (board state mixed in with game metadata) + per-tile stores via `tileOrchestrator` with the `board-store` module. This is the third and final board-store integration. Puzzles and sandbox are done and provide clear reference patterns.

## Context

Read these docs first (in order):
1. **Post-integration notes** — `dev-notes/2026-03/3-09-[14]-board-store-post-integration-notes.md` (findings from puzzles + sandbox, known issues, cleanup opportunities)
2. **Integration survey, gameplay section** — `dev-notes/2026-03/3-09-[9]-board-store-integration-survey.md` (focus on "Gameplay Domain" section — action-by-action mapping already sketched)
3. **Board-store README** — `apps/frontend/src/domains/games/board-store/README.md` (API reference, skim if familiar)

Also skim the completed puzzles and sandbox actions for reference — `domains/puzzles/actions/` and `domains/sandbox/actions/` show the post-migration patterns.

## Phase 1: Read Gameplay Code

The board-store patterns are well-established from puzzles and sandbox. What's new here is gameplay's specific store structure and logic. Read these files to understand what's being migrated:

**Stores:**
- `gameplay/stores/gameplay-store-v2.ts` — the big one. Board state + game metadata + player lookups all in one store. Understand what stays vs what moves to board-store.
- `gameplay/stores/gameplay-page-store.ts` — async game entity + countdown. Probably unchanged, but read to understand the cross-store subscription.

**Actions that import old infra:**
- `gameplay/actions/update-gameplay-state.ts` — tick handler
- `gameplay/actions/queue-move.ts` — keyboard repeat at ~50ms
- `gameplay/actions/undo-last-queued-move.ts` — local optimistic undo (more complex than puzzles/sandbox WS-only version)
- `gameplay/actions/cancel-queued-moves.ts`
- `gameplay/actions/setup-game-state.ts` — initialization, player setup
- `gameplay/actions/update-for-game-ended.ts` — end-of-game state
- `gameplay/actions/update-for-game-start.ts` — if it exists

**UI:**
- `gameplay/ui/game-tile.tsx` — same 7-hook pattern as old PuzzleTile/SandboxTile

Also check for any other gameplay actions/UI that read `gameplayStoreV2` fields moving to board-store (board, tick, selectedTile, visibleSquares, queuedMoves, playerStats, winner).

## Phase 2: Collaborative Design Brainstorm

This is a conversation with the user, not a solo design exercise. Surface questions and trade-offs rather than prescribing answers.

Start by sketching the high-level integration approach (like sandbox did), then dig into these gameplay-specific questions one at a time:

### Pre-task: `isSelectable` fix

Before wiring gameplay, fix `getIsSelectable()` in `board-store/tile-derived-state.ts`. Currently checks `isPlayerSquare(square)` but doesn't verify `square.playerIndex === currentPlayerIndex`. Without this, enemy tiles appear selectable. See post-integration notes for the exact change. Discuss whether to do this first or during implementation.

### Extracting board state from `gameplayStoreV2`

Unlike puzzles/sandbox (which used the shared `boardSessionStore`), gameplay has board state mixed into its own domain store. After migration, `gameplayStoreV2` shrinks to:
- `game: GameWithPlayers` — full game metadata
- `gameplayReady: boolean` — gates tick processing
- Player lookups: `players`, `playersByIndex`, `playersByUserId`, `currentPlayer`, `currentPlayerIndex`

Questions:
- Is this still worth a Zustand store, or is it small enough to handle differently?
- `currentPlayerIndex` now exists in both `gameplayStoreV2` and board-store (via `initBoard`). Is that duplication a problem, or fine (one for gameplay logic, one for board-store visibility/selectability)?

### Cross-store subscription

`gameplayStoreV2` subscribes to `gameplayPageStore` to sync the `game` field. After board state moves out, this subscription still syncs game metadata. Questions:
- Does it still make sense as-is?
- Is there a simpler way to handle this now that the store is smaller?
- Could the subscription be removed if `gameplayReady` and player setup are handled differently?

### `gameplayReady` gate

`updateGameplayState` is gated by `gameplayReady` — ticks are ignored until `setupGameState` completes. Questions:
- Does this gate move to the handler level (check before calling the action)?
- Or does board-store need to be aware of it?
- What happens if an `applyTick` arrives before `initBoard`?

### `undoLastQueuedMove` — local optimistic undo

More complex than puzzles/sandbox (which just send a WS message). Gameplay computes remaining queued directions for the source tile and reverts selection. With board-store, `undoLastQueuedMove()` handles the queue, but the selection revert logic might need adjustment.

### What's mechanical vs what needs thought

Separate the straightforward translations from the interesting design work. The mechanical parts should follow puzzles/sandbox patterns exactly:
- `GameTile` → `useTileData` + `toTileRendererProps` + `TileRenderer`
- `updateGameplayState` → `applyTick(tick, board, moves, playerStats)`
- `queueMove` → `addQueuedMove()` + `setSelectedTile()` + WS send
- `cancelQueuedMoves` → `setQueuedMoves([])` + WS send
- `setupGameState` → `initBoard(players, currentPlayerIndex, board)` + gameplay-specific setup
- `updateForGameEnded` → `applyTick()` + `setStatus('ended')` + `setSelectedTile(null)`
- Page/sidebar board reads → `useBoardState(boardStore)`

## Phase 3: Implementation

After the brainstorm lands on an approach, implement it. The mechanical parts follow puzzles/sandbox patterns. The gameplay-specific parts follow Phase 2 decisions.

Build + test after each meaningful chunk. Commit when working.

After integration is working, do a quick manual test of keyboard repeat performance (queueMove at ~50ms). If it feels sluggish, check the performance notes in the post-integration doc for mitigation options. Likely fine, but gameplay is the first domain where this matters.

## Phase 4: Cleanup

After gameplay migrates, ALL consumers of the old infra are gone. Delete:
- `games/stores/board-session-store.ts`
- `games/stores/tile-store-registry.ts`
- `games/stores/tile-orchestrator.ts`
- `games/hooks/use-tile-store-state.ts`
- `games/utils/tile-selection-helpers.ts`

Also evaluate cross-domain cleanup opportunities from the post-integration notes:
- Shared tile component (all three are now identical after migration)
- Shared `queueMove` (confirmed identical across puzzles + sandbox, verify gameplay matches)
- Move rendering concerns (`toTileRendererProps`, `TileRenderer`) out of `board-store/` and `gameplay/ui/`

These cleanups may be a separate session — discuss scope with the user before starting.

## Phase 5: Post-Integration Notes

Update `3-09-[14]-board-store-post-integration-notes.md` with gameplay findings. This completes all three integrations — good checkpoint to finalize the cross-domain synthesis section and decide which cleanup tasks to tackle immediately vs defer.
