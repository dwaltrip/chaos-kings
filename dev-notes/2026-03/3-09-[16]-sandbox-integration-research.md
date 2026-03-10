# Sandbox Board-Store Integration — Phase 1 Research

Research findings before designing the sandbox integration. Covers timeline infrastructure, how sandbox currently uses it, and what matters for the board-store migration.

---

## Timeline Infrastructure in `packages/core/`

### TimelineEngine (`packages/core/src/timeline/timeline-engine.ts`)

Full-featured timeline manager. Backend `SandboxSession` wraps this.

**API:**
- `tick(moves: MoveInput[]): ProcessStepResult` — advance one tick, record moves, create checkpoints at intervals
- `jumpToTick(target)` — navigate to any visited tick (finds nearest checkpoint, replays forward)
- `reset()` — back to initial state, clears history + checkpoints
- `getState(): GameState` — current board/tick/players
- `getCurrentTick()` / `getMaxTick()` — timeline position and extent
- `getLastExecutedMove(): Movement | null` — the last move that was applied (cleared on jump/reset)

**Key details:**
- Checkpoints every 25 ticks (configurable) for efficient scrubbing
- `moveHistory: (MoveEvent[] | null)[]` — indexed by tick, records applied events
- Branching: if you `tick()` while `currentTick < maxTick`, truncates future history
- Deterministic: moves sorted by playerIndex before application

### processStep (`packages/core/src/step-processor.ts`)

Single-tick game logic execution. Takes `GameState` + `MoveEvent[]` + `TimingConfig`, mutates game state in place, returns `ProcessStepResult` with applied events and game events.

Both the backend `TimelineEngine.tick()` and the frontend `stepForward()` use this.

### Replay infrastructure (`packages/core/src/replay/`)

Generator-based `replayFrames()` for iterating through completed game history. Separate from TimelineEngine — used for post-game replay viewer, not live sandbox. Not relevant to this integration.

---

## How Sandbox Uses Timeline Concepts Today

### Backend flow

`SandboxSession` wraps `TimelineEngine`. On every state change (tick, step, jump, reset), it broadcasts: `{ tick, board, moveQueue, isPaused, maxTickReached, lastExecutedMove }`.

The frontend is mostly a thin client — play/pause/step-back/reset are WS-only, the server does the work and sends back the new state.

### The one exception: optimistic `stepForward`

`stepForward()` is the only action that computes state locally:
1. Check `tick < maxTickReached` (guard against stepping past known history)
2. Send WS message (keeps server in sync regardless)
3. Look up `moveHistoryCache.get(nextTick)` — was a move executed at this tick?
4. On cache hit: build a `GameState`, run `processStep()`, apply result via `applyBoardState()`
5. On cache miss: return early, let server response handle it via `handleStateUpdate()`

This optimistic path exists for responsiveness — stepping forward shouldn't have to round-trip to the server when we already know the move history.

### `moveHistoryCache` — where it comes from and what it does

- `Map<number, Movement | null>` — lives at module level in `board-session-store.ts`
- Populated by `handleStateUpdate()`: when the server sends `lastExecutedMove`, cache it at `moveHistoryCache.set(tick, lastExecutedMove)`
- Consumed by `stepForward()` for optimistic computation
- Cleared by `endSandbox()`

The cache accumulates as the server sends state updates. Once you've seen a tick's move, you can replay it locally without waiting for the server.

### `lastExecutedMove` — current dual storage

Currently stored in two places:
1. **`moveHistoryCache`** (Map, module-level) — used by `stepForward()` optimistic path
2. **`boardSessionStore.lastExecutedMove`** (Zustand) — used by `clearMoves()` to determine what tile to select after clearing the queue

`clearMoves()` reads `lastExecutedMove` from the store to compute the post-clear selection:
- If there was a last executed move → select its destination
- Otherwise → select the first queued move's source

---

## What's Mechanical vs What Needs Thought

### Mechanical (same as puzzles)

**SandboxTile → `useTileData` pattern:**
Current SandboxTile has the same 7-hook pattern as old PuzzleTile. Identical migration to `useTileData(boardStore, coord)` + `toTileRendererProps()`.

**`queueMove` → board-store actions:**
Currently uses `boardSessionStore.addQueuedMove()` + `getTileStore().addQueuedDirection()` + `boardSessionStore.setSelectedTile()`. Becomes `addQueuedMove()` + `setSelectedTile()` (same as puzzles).

**`handleSessionStarted` → `initBoard` + `applyTick`:**
Currently does orchestrator dance + manual visibility + 5 store setters. Becomes `initBoard([], 0, board)` + `applyTick(0, board, [], [])` + sandbox meta setters.

**`handleStateUpdate` → `applyTick`:**
Currently calls `applyBoardState()` + sandbox-specific setters. Becomes `applyTick()` + sandbox-specific setters.

**`startSandbox` → `boardStore.reset()`:**
Same pattern as puzzles.

**`endSandbox` → `boardStore.reset()`:**
Same pattern, plus `moveHistoryCache.clear()`.

**Page component → `useBoardState(boardStore)`:**
SandboxPage reads `board` and `selectedTile` from `boardSessionStore`. Becomes `useBoardState(boardStore)`.

**Control bar → mixed reads:**
Reads `tick` from `boardSessionStore` → becomes `useBoardState(boardStore).game.tick`. `isPaused` and `maxTickReached` stay in sandbox meta store.

**Playback hook → reads tick from board-store:**
`useSandboxPlaybackControls` reads `tick` via `useBoardSessionStore.getState().tick` (imperative, not reactive). Becomes `boardStore.state.game.tick`.

### Needs thought

**`stepForward` — optimistic computation:**
- Currently reads `tick` and `board` from `boardSessionStore`, reads `config` from sandbox meta
- Calls `processStep()` to compute next state
- Applies via `applyBoardState()` → becomes `applyTick(nextTick, gameState.board, [], [])`
- The TODO says "use real players array when boardSessionStore tracks it" — board-store has `players` in `BoardSourceState`, so this can be resolved
- But `players` in board-store are frontend player objects, while `processStep` needs `CorePlayer[]` (status + armyCount + landCount from `GameState.players`). These are different types.

**`moveHistoryCache` — where does it live after migration?**
- Currently in `board-session-store.ts` which is being replaced
- It's sandbox-specific (and future replay-edit). Doesn't belong in board-store.
- Natural home: sandbox-specific module, or inline in sandbox actions

**`lastExecutedMove` — dual storage cleanup:**
- Currently in `boardSessionStore` (Zustand, drives `clearMoves` read) AND `moveHistoryCache` (Map, drives `stepForward` read)
- After migration, `boardSessionStore` goes away. `clearMoves` needs to read it from somewhere.
- Options: (a) store in sandbox meta store, (b) read from `moveHistoryCache`, (c) compute from board-store state

**`applyBoardState` — dead code after sandbox migrates?**
- Only consumers are sandbox's `handleStateUpdate` and `stepForward`
- After sandbox migrates, `applyBoardState` has zero consumers → dead code
- The whole `board-session/actions/` directory can be deleted

---

## `boardSessionStore` consumer audit

After sandbox migrates, who still uses `boardSessionStore`?

- **Sandbox actions** — all migrating to board-store ✓
- **Sandbox UI** (tile, board, control bar, page) — all migrating ✓
- **Sandbox hook** (`useSandboxPlaybackControls`) — migrating ✓
- **Gameplay** — uses its own `gameplayStoreV2`, not `boardSessionStore`

**Conclusion:** After sandbox migrates, `boardSessionStore` has no consumers. It can be deleted along with `tile-orchestrator`, `tile-store-registry`, `use-tile-store-state`, and `tile-selection-helpers` — assuming gameplay doesn't use them either. Need to verify gameplay's tile infra usage before deleting.

---

## Existing TODO in sandbox-meta-store

Line 5 of `sandbox-meta-store.ts`:
> `// TODO: isPaused and maxTickReached are timeline concepts, not sandbox-specific.`
> `// When replay-edit mode is added, these should move to a shared timeline store`

This is a forward-looking note. For now, keeping these in sandbox meta store is fine. If/when replay-edit mode exists, timeline state can be extracted. Not blocking for this integration.
