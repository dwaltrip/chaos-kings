# Next Session: Sandbox Integration with TimelineEngine

## Branch

`sandbox-history-and-related-refactors`

## Prerequisites

Read the full design doc first: `dev-notes/2026-02/2-7-[1]-timeline-engine-design.md`

## What's Done

- `TimelineEngine` implemented and tested in `packages/core/src/timeline/` (43 tests, all passing)
- `ProcessStepResult` exported from `packages/core/src/step-processor.ts`
- `deepCloneGameState` consolidated in TimelineEngine module
- Frontend `SandboxMetaStore` has `maxTickReached` field + selector (not wired up yet)

## What Needs to Be Done

### 1. Integrate TimelineEngine into sandbox backend

Refactor `apps/backend/src/domains/sandbox/sandbox-manager.ts`:
- Rename `SandboxManager` → `SandboxSession` (rename the file too)
- Replace internal `gameState`, `initialGameState`, `checkpoints`, `deepCloneGameState` with a `TimelineEngine` instance
- `doTick()` should: shift from MoveQueueEngine, build `MoveInput[]`, call `timeline.tick(moves)`
- `stepBack()` / `jumpToTick()` should call `timeline.jumpToTick()` + clear move queue
- `reset()` should call `timeline.reset()` + clear move queue
- `getState()` should include `maxTickReached` from `timeline.getMaxTick()`
- Delete the duplicated `deepCloneGameState` from this file; import from `@core/timeline`
- Update all imports/references to SandboxManager throughout the backend

### 2. Update protocol message

In `packages/protocol/domains/sandbox/server-messages.ts`:
- Add `maxTickReached: number` to `sandbox:state-update` payload

Update `apps/backend/src/domains/sandbox/ws-effects.ts`:
- Pass `maxTickReached` in `broadcastStateUpdate`

### 3. Update frontend

In `apps/frontend/src/domains/sandbox/actions/handle-state-update.ts`:
- Accept `maxTickReached` and call `sandboxMetaActions().updateMaxTick(maxTickReached)`

In `apps/frontend/src/domains/sandbox/ui/sandbox-control-bar.tsx`:
- Import `selectMaxTickReached` from sandbox meta store
- Change `Tick: {tick}` to `{tick} / {maxTickReached}` (or similar display)

In `apps/frontend/src/domains/sandbox/handlers.ts`:
- Pass the new `maxTickReached` field from the message payload to `handleStateUpdate`

### 4. Verify everything works

- Run `bash tools/build-all.sh` — no TS errors
- Run `bash tools/test-all.sh` — all tests pass
- Start dev servers with `bash tools/dev-all.sh`
- Open browser to `http://localhost:5173/sandbox`
- Test: play, pause, step forward, step back, reset — all should work
- Test: play to tick 20, step back to tick 10, step forward — should show `10 / 20` then `11 / 20` etc.
- Test: play to tick 20, step back to tick 10, queue a move, step forward — should branch (show `11 / 11`)

### 5. Commit

Commit with a descriptive message once everything is working.

## Key Design Decisions to Remember

- `tick()` accepts `MoveInput[]` (no `step` field) — engine assigns step internally
- Clear pending move queue on ANY jump through history
- Move history is `(MoveEvent[] | null)[]` — array indexed by tick, truncation via `.length`
- Only applied events (from `processStep().appliedEvents`) get recorded
- Branching happens automatically when `tick()` is called and `currentTick < maxTick`
- `getState()` returns live `Readonly<GameState>` reference — don't hold across ticks

## Codebase Notes

- Patterns are evolving — don't blindly follow existing code. Use the design doc as source of truth.
- Export style: all exports at END of files, types exported separately
- Import order: third-party → shared packages → app-level
- Comments sparingly — only WHY, not WHAT
- Always build-check and test after changes
