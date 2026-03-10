# Puzzles Integration — Implementation Plan

Concrete file-by-file plan. Order chosen to avoid broken intermediate states.

---

## Step 1: Update puzzle store (remove board-related fields)

**File:** `puzzles/stores/puzzle-store.ts`

- Remove state fields: `board`, `tick`, `moveQueue`, `visibleSquares`, `selectedTile`
- Remove setters: `setTick`, `setBoard`, `setMoveQueue`, `setVisibleSquares`, `setSelectedTile`, `addQueuedMove`
- Remove selectors: `selectBoard`, `selectTick`, `selectMoveQueue`, `selectSelectedTile`, `selectVisibleSquares`, `selectIsTileSelected`, `selectIsAdjacentToSelected`, `selectIsVisible`, `selectNeighborVisibility`
- Remove imports: `BoardState`, `Coord`, `Movement` from `@core/types`; `useShallow` from zustand; `tile-selection-helpers`
- Simplify `reset()`: only reset `status`, `result` (keep `userStats`)
- Keep: `status`, `result`, `userStats`, `selectStatus`, `selectResult`, `selectUserStats`, `selectActions`, `selectIsPuzzleEnded`

This will cause TS errors in files that import removed selectors — fixed in subsequent steps.

## Step 2: Update actions (one by one)

### 2a: `start-puzzle.ts`
- Add imports: `boardStore`, `initBoard` from board-store
- Add: `boardStore.reset()` + `initBoard([], 0)` after puzzle store reset

### 2b: `handle-state-update.ts`
- Remove imports: `Board` from `@core/board`, `getTileStore`, `tileOrchestrator`
- Add imports: `applyTick` from board-store
- Body: `applyTick(tick, board, moveQueue, [])` + `setStatus('playing')`
- Remove unused type imports (`BoardState` — keep if still needed for param type, but it's passed through from handler so signature stays)

### 2c: `handle-puzzle-end.ts`
- Remove imports: `Board`, `serializeCoord`, `tileOrchestrator`
- Add imports: `applyTick`, `setStatus` as `setBoardStatus`, `setSelectedTile` as `setBoardSelectedTile` from board-store
- Body: `applyTick(tick, finalBoard, [], [])` + `setBoardStatus('ended')` + `setBoardSelectedTile(null)` + puzzle store `setStatus('ended')` + `setResult(result)` + `loadUserStats()`
- Remove: `setTick`, `setBoard`, `setVisibleSquares`, `setSelectedTile` from puzzle store destructure

### 2d: `queue-move.ts`
- Remove imports: `getTileStore`, `usePuzzleStore`
- Add imports: `boardStore`, `addQueuedMove`, `setSelectedTile` from board-store
- Read board from `boardStore.state.game.board` instead of puzzle store
- Call `addQueuedMove({ sourceCoord: source, direction })` + `setSelectedTile(newSelected)` instead of puzzle store actions + tile store updates

## Step 3: Update tile component

**File:** `puzzles/ui/puzzle-tile.tsx`

- Remove all old imports (per-tile hooks, puzzle store selectors)
- Add imports: `boardStore`, `setSelectedTile` from board-store; `useTileData` from board-store hooks; `toTileRendererProps` from board-store tile-data; `TileRenderer`
- Body: `useTileData(boardStore, coord)` → `toTileRendererProps(tile)` → `TileRenderer`
- Keep React.memo with coord equality comparator
- Click handler: `onClick={tile.isSelectable ? () => setSelectedTile(coord) : undefined}`

## Step 4: Update page component

**File:** `puzzles/pages/best-start-play/best-start-play-page.tsx`

- Remove imports: `selectBoard`, `selectTick`, `selectSelectedTile` from puzzle store
- Add imports: `boardStore` from board-store; `useBoardState` from board-store hooks
- Read `board`, `tick`, `selectedTile` from `useBoardState(boardStore)` instead of puzzle store
- Keep puzzle store reads for `status` and `result`

## Step 5: Delete dead code

- Delete `puzzles/utils/visibility-cache.ts` (never imported)

## Step 6: Build + test

- `bash tools/build-all.sh`
- `bash tools/test-all.sh`
- Fix any errors

## Step 7: Commit
