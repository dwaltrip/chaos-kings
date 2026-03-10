# Puzzles Integration — Architecture Review

Review of `3-09-[11]-puzzles-integration-sketch.md`.

## Verdict: Solid — proceed to implementation

No blockers. A few items to track for future sessions.

## Key Findings

### 1. `isSelectable` doesn't filter by `currentPlayerIndex`
`getIsSelectable()` in `tile-derived-state.ts` checks `isPlayerSquare(square)` but NOT `square.playerIndex === currentPlayerIndex`. For puzzles this is fine (single player, all player squares are player 0). For gameplay, enemy tiles would appear selectable. **Fix needed before gameplay integration.**

### 2. Three pipeline runs in `handlePuzzleEnd`
`applyTick` + `setBoardStatus('ended')` + `setBoardSelectedTile(null)` each run the full pipeline. Three iterations over 400 tiles for a one-time event — not a performance concern. But for gameplay's per-tick handler, this pattern could add up. Suggests gameplay should consider batched mutations or a combined `applyTick` that also accepts status.

### 3. `useBoardState` is coarser than per-field Zustand selectors
The page component will re-render on every board-store action (including `addQueuedMove`, `setSelectedTile`). Current code only re-renders when the specific field changes. Unlikely to matter in practice — page render is cheap — but worth watching.

### 4. Import paths for hooks
`useTileData` and `useBoardState` are exported from `board-store/hooks.ts`, not re-exported from `board-store/index.ts`. Consumers import from the specific file. This is the intended pattern.

### 5. Reset lifecycle confirmed correct
After `boardStore.reset()`, board becomes null → page re-renders → PuzzleBoard unmounts → tiles unmount → subs cleaned up naturally. When first `handleStateUpdate` arrives, board is non-null → PuzzleBoard mounts → tiles mount with fresh subscriptions. `initBoard` between reset and first tick runs the lifecycle (derive + notify) but pipeline returns early (no board). Version resets to 0, which triggers page re-render. All correct.

## No Design Changes Needed

Sketch is implemented as-is. Notes captured for future sessions.
