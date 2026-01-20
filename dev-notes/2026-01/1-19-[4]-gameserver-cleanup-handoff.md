# GameServer Cleanup Handoff

**Date:** 2026-01-19
**Status:** Ready for next session
**Branch:** `puzzles-pt-2`

---

## Summary

This session completed the replay feature fix and GameServer timer refactor. Next session should tackle Player branded IDs, repeated pattern cleanup, and a final review of game-server.ts.

**Commits this session:**
- `a3be4fa` - Fix replay feature and clean up GameServer
- `9f4f88b` - Add game start timeout and timer utilities

---

## Remaining Work

### 1. Player Branded IDs

The `Player` type uses plain `number` for IDs instead of branded types:

```typescript
// packages/platform/domains/games/types.ts
interface Player {
  id: number;        // plain number
  game_id: number;   // should be GameId
  user_id: number;   // should be UserId
  ...
}
```

**Current usage in game-server.ts:**
```typescript
// Line 62 - manual conversion required
this.playerMapping.set(UserId(player.user_id), player.player_index);
```

**Fix approach:**
1. Update `Player` interface to use branded types
2. Add `deserializePlayer()` function in game-repository.ts (like `deserializeGame`)
3. Apply in `playersForGameIdQuery` result
4. Remove manual `UserId()` wrapper in game-server.ts

**Considerations:**
- `Player` type is in `@platform` package (shared FE/BE)
- Frontend imports `Player` - verify it doesn't break
- `GameWithPlayersDTO` uses `Player[]` - wire type should keep `number`

---

### 2. Repeated Pattern Cleanup

There's a lot of repeated code like this in game-server.ts:

```typescript
const playerIndex = this.playerMapping.get(userId);
if (playerIndex === undefined) {
  this.log.error(`... unknown user ${userId}`);
  return;
}
```

This appears in:
- `queueMove()` (line ~220)
- `clearMoves()` (line ~254)
- `undoMove()` (line ~268)

**Possible fix:** Extract a helper method:
```typescript
private getPlayerIndex(userId: UserId): PlayerIndex | null {
  const playerIndex = this.playerMapping.get(userId);
  if (playerIndex === undefined) {
    this.log.error(`Unknown user ${userId}`);
    return null;
  }
  return playerIndex;
}
```

Or throw an error if it's truly unexpected.

---

### 3. Final Review of game-server.ts

After completing the above, do a full review of game-server.ts with fresh eyes:

**Things to check:**
- Are there other repeated patterns to extract?
- Is the flow clear and readable?
- Are the remaining TODOs still relevant?
- Any dead code to remove?

**Remaining TODOs in the file:**
- Line 37: Player type uses plain numbers (addressed by #1 above)
- Lines 91-93: "shouldn't check both of these, should have 1 source of truth" - review if still relevant after timer refactor
- Line 332: "broadcast failure to connected players" - implement or remove

---

## Context: What Changed This Session

### Timer Utilities (`apps/backend/src/utils/timers.ts`)
New `Timeout` and `Interval` classes for cleaner timer management:
```typescript
const timer = new Timeout();
timer.start(callback, ms);
timer.cancel();
timer.isActive();
```

### Game Start Timeout
- Single 15s timeout replaces infinite retry loop
- If < 2 players connect within 15s, game status set to `FAILED_TO_START`
- New `handleFailedToStart()` method handles cleanup

### Removed Code
- `countdownActive` boolean - now using `countdownInterval.isActive()`
- `finishCountdown()` method - inlined
- `startFallbackTimer()` / `clearFallbackTimer()` - replaced with single timeout
- Recursive timer loop

### New GameStatus
```typescript
const GameStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED_TO_START: 'failed_to_start',  // NEW
} as const;
```

---

## Files to Review

| File | Notes |
|------|-------|
| `apps/backend/src/domains/gameplay/game-server.ts` | Main file for cleanup |
| `packages/platform/domains/games/types.ts` | Player type to update |
| `apps/backend/src/domains/games/game-repository.ts` | Add deserializePlayer |
| `apps/backend/src/utils/timers.ts` | New utility (done) |

---

## How to Continue

1. **Player branded IDs** - Update Player type and add deserializePlayer
2. **Pattern cleanup** - Extract repeated playerIndex lookup
3. **Final review** - Read through game-server.ts, check TODOs, clean up
4. **Build & test** - `bash tools/build-all.sh && bash tools/test-all.sh`
