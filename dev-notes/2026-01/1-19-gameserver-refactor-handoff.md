# GameServer Refactor Handoff

**Date:** 2026-01-19
**Status:** In progress - build broken, needs replay fix
**Branch:** `puzzles-pt-2`

---

## Summary

This session implemented a significant refactor to move player state tracking into core's `GameState`. The goal was to make GameServer a thin orchestration layer that delegates game logic to core.

**Key commits:**
1. `75ee8fd` - Initial refactor: `activePlayers` set, `Board.getPlayerStats()`, `processStep` returns `newlyDefeatedPlayers`
2. `ad098b0` - Full player state in core: `CorePlayerState`, `GameEvent`, capture info from `applyMovement`

---

## What Changed

### New Types in Core (`packages/core/src/types.ts`)

```typescript
const CorePlayerStatus = {
  ACTIVE: 'active',
  DEFEATED: 'defeated',
} as const;

interface CorePlayerState {
  status: CorePlayerStatus;
  armyCount: number;
  landCount: number;
}

type GameEvent = {
  type: 'player_defeated';
  tick: number;
  defeated: PlayerIndex;
  capturedBy: PlayerIndex;
};

interface GameState {
  board: BoardState;
  tick: number;
  players: CorePlayerState[];  // NEW - indexed by playerIndex
}
```

### Updated `applyMovement` (`packages/core/src/engine.ts`)

Now returns `MoveResult` with capture info:

```typescript
interface MoveResult {
  capture?: {
    defeated: PlayerIndex;
    capturedBy: PlayerIndex;
  };
}

function applyMovement(board, sourceCoord, movement): MoveResult
```

### Updated `processStep` (`packages/core/src/step-processor.ts`)

**Old signature:**
```typescript
processStep(board, step, events, timing) → { appliedEvents, gameEnded, winnerPlayerIndex, newlyDefeatedPlayers }
```

**New signature:**
```typescript
processStep(gameState, events, timing) → { appliedEvents, gameEvents, gameEnded, winnerPlayerIndex }
```

Key changes:
- Takes full `GameState` instead of just board
- Mutates `gameState.tick` internally (increments by 1)
- Updates `gameState.players[i].status` when defeated
- Updates `gameState.players[i].armyCount/landCount` after each step
- Returns `gameEvents` array instead of `newlyDefeatedPlayers`

### New Helper: `createGameState`

```typescript
function createGameState(board: GameState['board'], playerCount: number): GameState
```

Creates a properly initialized GameState with all players set to ACTIVE and stats calculated.

### GameServer Changes (`apps/backend/src/domains/gameplay/game-server.ts`)

- Removed `activePlayers: Set<PlayerIndex>` - now uses `gameState.players[i].status`
- Uses `createGameState()` in constructor
- Uses new `processStep` signature
- Gets player stats from `gameState.players` directly
- Processes `gameEvents` for defeat logging and queue clearing

### PuzzleManager Changes (`apps/backend/src/domains/puzzles/puzzle-manager.ts`)

- Uses new `processStep` signature
- No longer manually updates `gameState.tick`

---

## What's Broken

### Frontend Replay Feature

**File:** `apps/frontend/src/domains/replay/actions/jump-to-step.ts`

**Error:**
```
src/domains/replay/actions/jump-to-step.ts(66,60): error TS2554: Expected 3 arguments, but got 4.
```

**Problem:** The replay feature simulates game steps forward from checkpoints. It uses the old `processStep` signature:

```typescript
// Line 66 - OLD (broken)
const result = processStep(board, currentStep, events, state.config.timing);
```

**Fix needed:** The replay feature needs to:
1. Maintain a full `GameState` instead of just `BoardState`
2. Use `createGameState` when loading a replay
3. Update `ReplayFrame` type to include player state (or derive it)

**Context:** The replay feature caches board states at checkpoints and simulates forward. It doesn't currently care about player state, just board visualization. Options:
- Create a minimal GameState for replay purposes
- Add a separate `processStepForReplay` that works with just the board
- Update replay to track full GameState

---

## Remaining Cleanup

After fixing the replay feature, there's still a cleanup pass needed for `game-server.ts`:

1. **TODOs to review:**
   - Line 36-37: `GameWithPlayers` doesn't have proper app types
   - Line 92-94: Double broadcast when game ends
   - Lines 97-99: Improve game startup flow, single source of truth
   - Lines 312-317: Revisit startup flow (2 players requirement)
   - Line 381: IDs should already be GameId/RoomId type

2. **Dead code removal:**
   - `Board` import may no longer be needed (check if `isCoordValid` is still used)

---

## Design Decisions Made

1. **Player stats live in `CorePlayerState`** - reduces data munging, single source of truth

2. **`processStep` mutates `GameState`** - tick, player status, and stats are updated in place

3. **`gameEvents` replaces `newlyDefeatedPlayers`** - richer event info including `capturedBy` and `tick`

4. **`createGameState` helper** - ensures consistent initialization with stats calculated

5. **Core knows about player status** - active/defeated is game logic, belongs in core

6. **Backend informs core of external events** - disconnections would be handled by backend calling into core (future work)

---

## Files to Review

| File | Status | Notes |
|------|--------|-------|
| `packages/core/src/types.ts` | Done | New types added |
| `packages/core/src/engine.ts` | Done | `MoveResult` return type |
| `packages/core/src/step-processor.ts` | Done | New signature, `createGameState` |
| `packages/core/src/board.ts` | Done | `getPlayerStats` added (earlier commit) |
| `apps/backend/src/domains/gameplay/game-server.ts` | Done | Uses new APIs |
| `apps/backend/src/domains/puzzles/puzzle-manager.ts` | Done | Uses new APIs |
| `packages/core/src/puzzles/best-start/create.ts` | Done | Uses `createGameState` |
| `apps/frontend/src/domains/replay/actions/jump-to-step.ts` | **BROKEN** | Needs fix |

---

## How to Continue

1. **Fix replay feature** - decide on approach (minimal GameState vs full tracking)
2. **Run build** - `bash tools/build-all.sh`
3. **Run tests** - `bash tools/test-all.sh` (step-processor tests may need updates)
4. **Cleanup pass** - review TODOs, remove dead code
5. **Commit** - small incremental commits preferred

---

## Original Context

This refactor was driven by notes in:
`dev-notes/2026-01/1-11-[3]-gameserver-refactor-notes.md`

The goal: GameServer should be a thin orchestration layer that handles timing, queues, and broadcasting. All game logic (player stats, defeat detection, validation) should live in core.
