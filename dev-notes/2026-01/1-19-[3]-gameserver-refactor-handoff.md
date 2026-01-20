# GameServer Refactor Handoff

**Date:** 2026-01-19
**Status:** ✅ Complete
**Branch:** `puzzles-pt-2`

---

## Summary

This session implemented a significant refactor to move player state tracking into core's `GameState`. The goal was to make GameServer a thin orchestration layer that delegates game logic to core.

**Key commits:**
1. `75ee8fd` - Initial refactor: `activePlayers` set, `Board.getPlayerStats()`, `processStep` returns `newlyDefeatedPlayers`
2. `ad098b0` - Full player state in core: `CorePlayerState`, `GameEvent`, capture info from `applyMovement`
3. `4ef29f5` - Update replay to use GameState from core (ReplayFrame embeds GameState)
4. `7281182` - Clean up GameServer: remove stale TODOs and redundant type conversions

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

## Completed Fixes

### Frontend Replay Feature ✅

`ReplayFrame` now embeds `GameState` instead of separate `board`/`step` fields:
- `replay-store.ts` - Updated type
- `load-replay.ts` - Uses `createGameState` for initial frame
- `jump-to-step.ts` - Uses new `processStep` signature, `deepCloneGameState`
- `replay-page.tsx` - Accesses `currentFrame.gameState.board`

This enables future player stats display in replays.

### GameServer Cleanup ✅

- Removed stale TODO about "double broadcast" (code was already correct)
- Removed redundant `GameId()` wrappers (game.id is already GameId type)
- Updated remaining TODO to accurately describe the Player type issue
- Removed unused `GameId` import

---

## Remaining TODOs (Lower Priority)

1. **Game startup state machine** (lines 89-92): Multiple boolean flags (`countdownActive`, `gameStarted`, `initialized`, `gameEnded`) could be consolidated into a single `GamePhase` enum

2. **Fallback timer gives up** (lines 305-330): Currently loops forever if < 2 players. Should have a max wait time and mark game as "failed_to_start"

3. **Player type branded IDs**: `Player.user_id` and `Player.game_id` use plain `number` instead of `UserId`/`GameId`. Cross-cutting refactor needed.

---

## Design Decisions Made

1. **Player stats live in `CorePlayerState`** - reduces data munging, single source of truth

2. **`processStep` mutates `GameState`** - tick, player status, and stats are updated in place

3. **`gameEvents` replaces `newlyDefeatedPlayers`** - richer event info including `capturedBy` and `tick`

4. **`createGameState` helper** - ensures consistent initialization with stats calculated

5. **Core knows about player status** - active/defeated is game logic, belongs in core

6. **Backend informs core of external events** - disconnections would be handled by backend calling into core (future work)

---

## Files Changed

| File | Status | Notes |
|------|--------|-------|
| `packages/core/src/types.ts` | ✅ | New types added |
| `packages/core/src/engine.ts` | ✅ | `MoveResult` return type |
| `packages/core/src/step-processor.ts` | ✅ | New signature, `createGameState` |
| `packages/core/src/board.ts` | ✅ | `getPlayerStats` added |
| `packages/core/src/step-processor-ordering.test.ts` | ✅ | Updated to new signature |
| `apps/backend/src/domains/gameplay/game-server.ts` | ✅ | Uses new APIs, cleanup done |
| `apps/backend/src/domains/puzzles/puzzle-manager.ts` | ✅ | Uses new APIs |
| `packages/core/src/puzzles/best-start/create.ts` | ✅ | Uses `createGameState` |
| `apps/frontend/src/domains/replay/actions/jump-to-step.ts` | ✅ | Uses new signature, embeds GameState |
| `apps/frontend/src/domains/replay/actions/load-replay.ts` | ✅ | Uses `createGameState` |
| `apps/frontend/src/domains/replay/stores/replay-store.ts` | ✅ | ReplayFrame embeds GameState |
| `apps/frontend/src/domains/replay/pages/replay-page.tsx` | ✅ | Updated access pattern |

---

## Original Context

This refactor was driven by notes in:
`dev-notes/2026-01/1-11-[3]-gameserver-refactor-notes.md`

The goal: GameServer should be a thin orchestration layer that handles timing, queues, and broadcasting. All game logic (player stats, defeat detection, validation) should live in core.
