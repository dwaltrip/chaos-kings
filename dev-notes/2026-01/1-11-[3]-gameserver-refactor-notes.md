# GameServer Refactor Notes

**Date:** 2026-01-11
**Status:** Notes for future refactor
**File:** `apps/backend/src/domains/gameplay/game-server.ts`

---

## Principle

GameServer should be a thin orchestration layer with minimal knowledge of game rules. It handles infrastructure (timing, queues, broadcasting, connections) and delegates all game logic to `@core`.

---

## What GameServer Should Own (Orchestration)

- **Tick loop timing** - when to advance the game
- **Move queues** - `queueMove`, `clearMoves`, `undoMove`, queue storage
- **`activePlayers` tracking** - who to accept/process moves from (not "defeated" - just active vs inactive)
- **Broadcasting** - send state updates to clients via ws-effects
- **Timers/countdown** - pre-game countdown, fallback timers
- **Lifecycle flags** - `started`, `ended`, `initialized`
- **Glue code** - format translation between layers (e.g., `QueuedMove` → `MoveEvent`)

---

## What Should Move to @core

### 1. `calculatePlayerStats()` (lines 242-260)

**Current:** GameServer iterates board to count `armyCount`/`landCount` per player.

**Change:** Move to `@core` as `Board.getPlayerStats(board)` or similar. Single pass, returns stats for all players.

**Note:** Design core's API to be efficient (one pass returns everything needed) to avoid backend needing to work around naive implementations.

### 2. `getPlayersWithGenerals()` (lines 169-177)

**Current:** GameServer scans board to find which players have generals.

**Change:** Remove entirely. Defeat detection should come from `processStep` return value.

### 3. Defeated player detection (lines 139-150)

**Current:** GameServer compares generals before/after step, maintains `defeatedPlayers` Set, clears queues.

**Change:**
- `coreProcessStep()` returns `newlyDefeatedPlayers: PlayerIndex[]`
- GameServer receives this list, doesn't compute it
- Core knows *why* (general captured), GameServer just knows *that*

### 4. Move validation in `queueMove()` (line 278)

**Current:** `Board.isCoordValid(this.gameState.board, source)` - only checks bounds.

**Change:** Call `isMoveValid(board, source, direction, playerIndex)` in `@core`. Core owns all validation rules (bounds, ownership, direction validity, future rules).

---

## Refactored Concepts

### `activePlayers` instead of `defeatedPlayers`

**Current:** `defeatedPlayers: Set<number>` tracks who lost their general.

**Better:** `activePlayers: Set<PlayerIndex>` - players GameServer should accept moves from.

- Start with all players active
- When anyone becomes inactive (core defeat, disconnect, timeout, resignation), remove from set
- GameServer doesn't know or care *why* - just "should I process moves from this player?"

Multiple sources can deactivate a player:
- Core returns `newlyDefeatedPlayers` (game rule: general captured)
- Backend detects disconnect/timeout (infrastructure)
- Future: resignation, etc.

All flow through: `gameServer.deactivatePlayer(playerIndex)`

---

## Boundary Between Core and Backend

**Core:** Game rules, agnostic to technical implementation (no knowledge of websockets, connections, servers)

**Backend:** Infrastructure concerns (connections, timeouts, persistence)

Examples:
- "Player lost because general captured" → Core decides, returns in `processStep`
- "Player lost because disconnected" → Backend decides, calls `deactivatePlayer`
- "What happens when defeated" (can't move, land converts, etc.) → Core handles

GameServer may pass through *why* someone was defeated (for UI/logging) but doesn't contain logic for determining game-rule defeats.

---

## What's Fine As-Is

- **Building `MoveEvent` in `tick()`** (lines 110-121) - Glue code translating GameServer's queue format to core's event format. Acceptable orchestration.

---

## Summary

The goal: GameServer asks "what happened?" and "is it done?" but doesn't know *how* any game logic works. All rules, validation, stats, defeat detection live in `@core`. GameServer is a dumb loop that coordinates timing, collects inputs, and distributes outputs.
