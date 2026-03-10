# Session Prompt: Puzzles Domain — Board-Store Integration

## Goal

Replace the puzzles domain's use of Zustand stores (`usePuzzleStore` board fields + per-tile stores via `tileOrchestrator`) with the new `board-store` module. This is the first integration of board-store into an actual app page.

## Context

Read these docs first (in order):
1. **Board-store README** — `apps/frontend/src/domains/games/board-store/README.md` (API, files, types)
2. **Integration survey** — `dev-notes/2026-03/3-09-[9]-board-store-integration-survey.md` (focus on "Puzzles Domain" section and "Shared Infrastructure Being Replaced")
3. **Integration questions** — `dev-notes/2026-03/3-09-[8]-board-store-integration-questions.md` (keep in mind, don't need to solve all upfront)
4. **Background** — `dev-notes/2026-03/3-09-[7]-board-store-v2-background.md` (skim if needed for "why" context)

## What Changes

### Actions (the main work)

**`handle-state-update.ts`** — currently ~10 lines of orchestrator calls, visibility recomputation, 5 store setters. Should become roughly: `applyTick(tick, board, moveQueue, [], null)` plus setting puzzle-specific status.

**`handle-puzzle-end.ts`** — similar orchestrator dance + making all tiles visible. Should become: `applyTick(tick, finalBoard, [], [], null)` + `setStatus('ended')` + set result in puzzle store.

**`queue-move.ts`** — currently validates, adds to store, updates per-tile store, moves selection, sends WS. Replace store/orchestrator calls with: `addQueuedMove()` + `setSelectedTile()`.

**`start-puzzle.ts`** — currently calls `reset()` on puzzle store. Add `boardStore.reset()`.

### Puzzle Store

Remove board-related fields that move to board-store: `board`, `tick`, `moveQueue`, `visibleSquares`, `selectedTile`.

Keep puzzle-specific fields: `status` ('idle'|'playing'|'ended'), `result`, `userStats`.

Remove parameterized selectors that board-store's `TileData` now handles: `selectIsTileSelected`, `selectIsAdjacentToSelected`, `selectIsVisible`, `selectNeighborVisibility`.

### Tile Component

`puzzle-tile.tsx` currently reads from 7 hooks/selectors, computes derived flags, passes to `TileRenderer`. Replace with `useTileData(boardStore, coord)` + `toTileRendererProps(tile)`. Consider using `BoardTile` directly if the only difference is the click handler.

Note: `BoardTile` and `toTileRendererProps` currently live in board-store but probably shouldn't long-term (see questions doc). Fine to use them from there for now.

### Page Components

`best-start-play-page.tsx` reads `selectBoard`, `selectSelectedTile` etc. from puzzle store. These reads need to come from board-store instead (via `useBoardState(boardStore)` or direct `boardStore.state` access).

## Key Mapping

| Puzzle store field | Board-store equivalent |
|---|---|
| `board` | `boardStore.state.game.board` |
| `tick` | `boardStore.state.game.tick` |
| `moveQueue` | `boardStore.state.game.queuedMoves` |
| `selectedTile` | `boardStore.state.ui.selectedTile` |
| `visibleSquares` | `boardStore.derived.visibleSquares` (auto-computed) |

Puzzles always uses player index 0 — set via `initBoard(players, 0, board)`.

## Things to Watch For

- **`status` mapping:** Puzzle store has `'idle' | 'playing' | 'ended'`. Board-store has `'active' | 'ended'`. The `'idle'` and `'playing'` states stay in puzzle store. Call `setStatus('ended')` on board-store when puzzle ends.
- **`playerStats`:** Board-store's `applyTick` takes playerStats — puzzles can pass `[]`.
- **Board-store is a module singleton** — `boardStore.reset()` should be called when starting a new puzzle.
- **Two pipeline runs for `queueMove`:** `addQueuedMove()` and `setSelectedTile()` each run the full pipeline. Fine for now — action batching is a deferred optimization.
- **Build check:** Run `bash tools/build-all.sh` after changes. Run `bash tools/test-all.sh` for tests.

## Approach

### Phase 1: Design

1. **High-level sketch + architectural brainstorm** — How do the pieces fit together? What's the new data flow for each action? Where do reads come from now? Sketch the new puzzle-tile component shape. Surface any awkward spots or open questions.

2. **Opus sub-agent review** — Focus on architecture and code patterns. Are the boundaries right? Any concerns about the interaction between puzzle store and board-store? Does the proposed approach set a good precedent for sandbox and gameplay? Address review comments before moving on.

3. **Implementation plan** — Concrete file-by-file plan with ordering and dependencies. Which files change, what changes in each, what sequence avoids broken intermediate states.

Save each phase as a dev-note (sketch, review + revisions, implementation plan) before moving on to the next.

### Phase 2: Implementation

4. Start with the puzzle store changes (remove fields, keep puzzle-specific)
5. Update actions one by one (handle-state-update, handle-puzzle-end, queue-move, start-puzzle)
6. Update the tile component
7. Update page components for any read-path changes
8. Build + test after each meaningful chunk
9. Commit when working

This is the first board-store integration — it sets the pattern for sandbox and gameplay. Expect to discover things that need small adjustments to the board-store API or patterns. Note those for the later sessions.
