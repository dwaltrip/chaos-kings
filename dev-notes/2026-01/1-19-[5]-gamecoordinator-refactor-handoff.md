# GameCoordinator Refactor Handoff

**Date:** 2026-01-19
**Branch:** `real-mvp`

---

## What Changed

Refactored user↔game mapping so GameCoordinator is the single source of truth.

**Commit:** `70c82a3` - Refactor user-game mapping into GameCoordinator

**Key changes:**
- GameCoordinator now has `userSessions: Map<UserId, { gameId, playerIndex }>`
- Auto-registers players in `addGame()`, auto-cleans up in `removeGame()`
- New method: `getGameContextForUser(userId)` returns `{ gameServer, playerIndex }`
- GameServer methods (`queueMove`, `clearMoves`, `undoMove`) now take `PlayerIndex` directly
- Removed `playerMapping` from GameServer, replaced with `expectedPlayers: Set<UserId>`
- Deleted `user-game-mapping.ts` and `register-players-for-game.ts`
- Protocol: `gameplay:undo-move` is now `EmptyPayload` (no gameId needed)

---

## Remaining Work

### 1. Player Branded IDs

`Player` type still uses plain `number`:

```typescript
// packages/platform/domains/games/types.ts
interface Player {
  id: number;        // should be branded
  game_id: number;   // should be GameId
  user_id: number;   // should be UserId
  ...
}
```

**Approach:**
- Update Player interface to use branded types
- Add `deserializePlayer()` in game-repository.ts
- Keep `Player` in DTO types as `number` for wire format

### 2. Game Startup Flow (game-server.ts:88-89)

tick() has overlapping checks that could be simplified:
```typescript
if (this.countdownInterval.isActive() || !this.gameStarted) { ... }
if (!this.initialized || this.gameEnded) { ... }
```

Consider consolidating to one source of truth for game lifecycle state.

### 3. Broadcast Failure (game-server.ts:299)

When game fails to start, should notify connected players. Currently just a TODO.

---

## Files Reference

| File | Notes |
|------|-------|
| `game-coordinator.ts` | Now owns userSessions |
| `game-server.ts` | Simplified, takes PlayerIndex |
| `platform/domains/games/types.ts` | Player type to update |
| `game-repository.ts` | Add deserializePlayer |
