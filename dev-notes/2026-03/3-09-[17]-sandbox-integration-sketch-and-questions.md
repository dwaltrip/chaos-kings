## High-Level Integration Sketch

**Mechanical swap (bulk of the work):**
- All sandbox actions replace `useBoardSessionStore` reads/writes with board-store equivalents (`boardStore.state`, `applyTick`, `addQueuedMove`, `setSelectedTile`, etc.)
- `handleSessionStarted` → `initBoard([], 0, board)` + `applyTick(0, board, [], [])` + meta store setters
- `handleStateUpdate` → `applyTick(tick, board, moveQueue, [])` + cache/meta updates
- `queueMove` → identical to puzzles version (drop `getTileStore` / `addQueuedDirection`)
- `startSandbox` / `endSandbox` → `boardStore.reset()` + meta store reset (+ cache clear for end)
- SandboxTile → `useTileData` + `toTileRendererProps` + `TileRenderer` (identical to PuzzleTile)
- SandboxPage / SandboxControlBar / playback hook → swap store reads to `useBoardState(boardStore)` / `boardStore.state`

**Timeline-adjacent changes:**
- `stepForward` rewires to use `applyTick()` instead of `applyBoardState()`, keeps the `processStep` optimistic logic
- `clearMoves` rewires its `lastExecutedMove` read
- `moveHistoryCache` moves out of `board-session-store.ts` to a new home
- `step-back`, `play`, `pause`, `reset` — WS-only, no board-store involvement, just drop the old store imports if any

**Cleanup:**
- `applyBoardState` becomes dead code, delete it
- Audit whether `boardSessionStore` / tile orchestrator / tile registry have any remaining consumers (gameplay). If not, delete.

---

## Open Questions

### 1. Where does `moveHistoryCache` live?

- Currently in `board-session-store.ts`, which gets deleted
- It's sandbox-specific (and maybe future replay-edit)
- Options: (a) its own tiny module in sandbox (`sandbox/move-history-cache.ts`), (b) inline in sandbox meta store file alongside the store but not in the store, (c) co-locate with `stepForward` since that's the primary consumer
- Consumed by `stepForward`, populated by `handleStateUpdate`, cleared by `endSandbox` — three touchpoints

### 2. Where does `lastExecutedMove` live?

- Currently in `boardSessionStore` (Zustand) — read by `clearMoves` for post-clear tile selection
- Also cached in `moveHistoryCache` (keyed by tick) — read by `stepForward`
- After migration, the Zustand store is gone. `clearMoves` needs it from somewhere.
- Options: (a) add to sandbox meta store, (b) read from `moveHistoryCache` using current tick as key, (c) keep a simple module-level variable alongside `moveHistoryCache`
- It doesn't drive renders — `clearMoves` reads it imperatively

### 3. `stepForward` players array

- The TODO says "use real players array when boardSessionStore tracks it"
- Board-store has `players` in `BoardSourceState`, but those are frontend `Player` objects
- `processStep` needs `CorePlayer[]` (`{ status, armyCount, landCount }`)
- Options: (a) keep the hardcoded single-player stub (sandbox is always single-player anyway), (b) derive `CorePlayer[]` from board state at step time, (c) store `GameState.players` separately in sandbox
- Is this even worth fixing now, or is the stub fine for sandbox's single-player context?

### 4. Can `applyBoardState` and old infra be deleted immediately?

- After sandbox migrates, `applyBoardState` has zero consumers
- `boardSessionStore`, `tile-orchestrator`, `tile-store-registry`, `use-tile-store-state`, `tile-selection-helpers` — need to verify gameplay doesn't use them
- Delete now vs leave for gameplay integration session?
