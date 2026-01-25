# Sandbox Implementation Review

**Date:** 2026-01-25

**Context:** Post-implementation analysis of the sandbox feature, evaluating code quality, architecture decisions, and migration path for puzzles/gameplay.

---

## Implementation Summary

**Files Created:** 45 new files across @core, protocol, backend, and frontend
**Files Modified:** 5 (WebSocket registration, routing, App.tsx)

The implementation follows established patterns well and introduces clean abstractions. All builds and tests pass.

---

## Quality Assessment: Good

### Strengths

1. **MoveQueueEngine** - Clean, focused abstraction for queue operations. Configurable, no domain-specific behavior.

2. **BoardSessionStore** - Follows thin-store pattern correctly. Good parameterized selectors for per-tile subscriptions.

3. **SandboxManager** - Well-structured checkpoint/rewind system. Good separation of concerns.

4. **SandboxTile** - Clean, minimal component that properly delegates to TileRenderer.

### Issues Identified

| Issue | Severity | Location | Notes |
|-------|----------|----------|-------|
| No disconnect handler | Medium | sandbox-actions.ts | Memory leak risk - TODO left in code |
| No idle timeout | Medium | sandbox-actions.ts | Abandoned sessions persist - TODO left in code |
| Silent failures | Low | All sandbox actions | Return silently if session missing, no error feedback |
| Hardcoded player index 0 | Low | handle-state-update.ts | Fine for v1, blocks multiplayer |

### Edge Cases Not Handled
- Browser tab backgrounded (timer continues, frontend may miss updates)
- Rapid play/pause toggling (potential race conditions)
- No guard against very fast tick rates

---

## Comparison to Existing Code

### SandboxManager vs PuzzleManager

| Aspect | SandboxManager | PuzzleManager |
|--------|---------------|---------------|
| Move Queue | Uses `MoveQueueEngine` | Manual `Movement[]` |
| Tick Control | Play/pause/step/rewind | Always running |
| Checkpoints | Yes | No |
| Move History | No | Yes (`executedMoves`) |
| End Condition | None (endless) | `isBestStartComplete()` |

**Shared code that could be extracted:**
- `deepCloneGameState` - duplicated in both files
- Tick processing logic - nearly identical

### Store Comparison

| Field | BoardSessionStore | GameplayStoreV2 | PuzzleStore |
|-------|------------------|-----------------|-------------|
| Board | `board` | `boardState` | `board` |
| Tick | `tick` | `tick` | `tick` |
| Selected | `selectedTile` | `selectedTile` | `selectedTile` |
| Visible | `visibleSquares` | `visibleSquares` | `visibleSquares` |
| Queue | `queuedMoves` | `queuedMoves` | `moveQueue` |

**Issues:**
- Field naming inconsistency (`queuedMoves` vs `moveQueue`)
- Action naming inconsistency (`setSelectedTile` vs `setSelectedTileV2`)
- Different "ended" patterns: boolean vs status vs method

### Tile Comparison

All three tiles (Game, Puzzle, Sandbox) are nearly identical - all delegate to TileRenderer. Main difference is which store they use.

---

## Migration Path Analysis

### Puzzles → Shared Abstractions

**Backend (PuzzleManager):**
- Replace `moveQueue: Movement[]` with `MoveQueueEngine`
- Use engine methods instead of array operations

**Effort:** Low (~1 hour) | **Risk:** Low

**Frontend:**
- Use `BoardSessionStore` for core state
- Create `PuzzleMetaStore` for puzzle-specific state (status, result, userStats)
- Update `PuzzleTile` to use `BoardSessionStore` (same as SandboxTile)

**Effort:** Medium (~2-3 hours) | **Risk:** Medium

**Complications:**
- Need to handle `status === 'ended'` → `isEnded` boolean mapping
- Testing needed for tile visibility

### Gameplay → Shared Abstractions

**Backend (GameServer):**
The complexity is **per-player queues** vs single queue.

**Options:**
1. `Map<PlayerIndex, MoveQueueEngine>` - one engine per player
2. Keep current structure, share validation logic only

**Effort:** Medium (~2-3 hours) | **Risk:** Medium

**Frontend:**
- Use `BoardSessionStore` for board/tile state
- Create `GameplayMetaStore` for game-specific state (players, winner, etc.)
- Update `GameTile` to use `BoardSessionStore`

**Effort:** High (~4-6 hours) | **Risk:** High

**Complications:**
- GameplayStoreV2 has cross-store subscription to gameplayPageStore
- Spectator mode needs special visibility handling (currentPlayerIndex can be null)
- Per-player queue broadcasting differs from single queue
- Backward compatibility with existing replays

---

## Unexpected Findings

### Architectural Issues

1. **Duplicate `deepCloneGameState`**
   - Exists in both SandboxManager and PuzzleManager
   - Should be in @core

2. **TileRenderer in wrong domain**
   - Lives in `gameplay/ui/` but used by all three domains
   - Should be in `games/ui/` (shared)

3. **Naming inconsistency: `movement` vs `direction`**
   - GameServer uses `movement: Direction`
   - Everyone else uses `direction: Direction`

4. **Three different "ended" patterns**
   - BoardSessionStore: `isEnded` boolean
   - PuzzleStore: `status === 'ended'`
   - GameplayStoreV2: `isGameEnded()` method

### Unanticipated Complexities

1. **Checkpoint memory growth** - Full GameState clones could grow large for long sessions
2. **Tick timing drift** - setInterval doesn't guarantee precision over long periods

---

## Recommendations

### Do Now (Low Risk, Quick Wins)

1. **Extract `deepCloneGameState` to @core**
   - Already duplicated, will prevent future drift
   - ~15 min

2. **Move TileRenderer to games domain**
   - Already shared by all three domains
   - Makes dependency direction cleaner
   - ~30 min

3. **Standardize `direction` naming**
   - Update GameServer to use `direction` instead of `movement`
   - Or document the convention
   - ~15 min

### Wait for Follow-up

1. **Migrate PuzzleStore to BoardSessionStore** - Do when next touching puzzle code
2. **Migrate GameplayStoreV2** - Higher risk, wait until gameplay needs changes
3. **Add disconnect/idle cleanup** - Important before public release
4. **Add checkpoint pruning** - Only matters for very long sessions

### Risks to Watch

1. **Store proliferation** - Now have 5+ Zustand stores, need clear ownership
2. **Action pattern inconsistency** - Sandbox uses individual files, some domains use single file
3. **WebSocket payload size** - Sandbox sends full board on every tick (fine for dev tool, not scalable)

---

## Action Pattern Note

The design doc specified a `_actionName` (internal pure) + `actionName` (exported wrapper) pattern. The implementation used the simpler existing pattern instead. This is fine for now but may want to revisit for testability.

---

## Conclusion

The sandbox implementation is **well-executed**. The new abstractions (MoveQueueEngine, BoardSessionStore) are clean and ready for reuse.

**Migration readiness:**
- Puzzles: Ready, low-medium effort
- Gameplay: Needs dedicated effort, higher complexity due to multiplayer

**Recommended next steps:**
1. Quick wins: Extract deepCloneGameState, move TileRenderer
2. When ready: Migrate puzzles to validate the pattern
3. Later: Gameplay migration as a dedicated effort
