# Common Package Cleanup - Inventory & Analysis

**Date:** 2025-11-22
**Status:** ✅ Partial Migration Complete - Non-Type Files Migrated
**Goal:** Document all code importing from `@common` to plan the package's removal

## ✅ Completed Migrations (2025-11-22)

Successfully migrated all non-type files from `@common`:

1. ✅ **Deleted** `common/utils/backend/debugging.ts` (unused - 0 imports)
2. ✅ **Moved** `common/constants/matchmaking.ts` → `@platform/domains/matchmaking/constants.ts`
   - Updated 2 imports (1 backend, 1 frontend)
3. ✅ **Created** `@utils` package and moved `common/utils/invariant.ts` → `@utils/assertions/invariant.ts`
   - Updated 1 import (core package)
   - Added `@utils/*` path mapping to all tsconfig files and vite.config
4. ✅ **Moved** `common/validation/username.ts` → `backend/src/domains/users/validation/username.ts`
   - Updated 2 imports (both backend)

**Remaining in common:**
- `common/types/` (games, player, user, gameplay) - 31+ imports - requires type architecture decision
- `common/utils/room-key.ts` - 1 import - deferred per user request

---

## Context

The `@common` package was a temporary shared space during v1 development. With the v2 refactor establishing clear package boundaries (`@protocol`, `@platform`, `@core`, `@utils`), we can now migrate everything out of `@common` and delete it.

This doc inventories all `@common` imports and proposes where each piece should move.

---

## What's Currently in @common

### Files & Content

```
packages/common/
├── types/
│   ├── games.ts          - Game, GameWithPlayers, GameStatus, API response types
│   ├── player.ts         - Player, PlayerIndex, GamePlayerStatus
│   ├── user.ts           - User interface
│   └── gameplay.ts       - GAMEPLAY_DOMAIN, Movement, PlayerQueuesMap, PlayerIndex
├── constants/
│   └── matchmaking.ts    - FFA_NUM_PLAYERS_MAX, MATCHMAKING_ROOM_NAME
├── utils/
│   ├── invariant.ts      - invariant() assertion helper
│   ├── room-key.ts       - roomKey() domain:room string builder
│   └── backend/
│       └── debugging.ts  - getFilteredStackTrace() debugging utility
└── validation/
    └── username.ts       - validateUsername() + UsernameValidationResult
```

---

## Import Analysis by Package

### Backend Imports (apps/backend)

**Total Import Sites:** 14

**By Category:**

1. **User Types** (3 imports)
   - `ws/server-bridge-bootstrap.ts` - User type
   - `ws/server-bootstrap.ts` - User type
   - `types/fastify.d.ts` - User type for Fastify extension

2. **Game Types** (3 imports)
   - `domains/games/actions/get-game.ts` - GameWithPlayers
   - `domains/games/actions/end-game.ts` - GameWithPlayers
   - `domains/gameplay/game-coordinator.ts` - GameWithPlayers

3. **Gameplay Types & Constants** (5 imports)
   - `domains/gameplay/ws-effects.ts` - PlayerQueuesMap, GameWithPlayers
   - `domains/gameplay/game-server.ts` - GAMEPLAY_DOMAIN, GameWithPlayers, roomKey()
   - `domains/gameplay/actions/on-player-joined.ts` - GAMEPLAY_DOMAIN
   - `domains/gameplay/actions/on-player-left.ts` - GAMEPLAY_DOMAIN

4. **Matchmaking Constants** (1 import)
   - `domains/matchmaking/matchmaking-service.ts` - FFA_NUM_PLAYERS_MAX

5. **Validation** (2 imports)
   - `domains/users/actions/create-user.ts` - validateUsername()
   - `domains/users/actions/update-username.ts` - validateUsername()

### Frontend Imports (apps/frontend)

**Total Import Sites:** 17

**By Category:**

1. **Game Types** (8 imports)
   - `pages/gameplay/components/gameplay-status-info.tsx` - GameWithPlayers
   - `pages/gameplay/components/player-colors.tsx` - GameWithPlayers
   - `pages/gameplay/components/gameplay-header.tsx` - GameWithPlayers
   - `pages/games-list/game-list-page.tsx` - GameWithPlayers, ListGamesResponse
   - `domains/games/games-api.ts` - GameWithPlayers, GetGameResponse
   - `domains/gameplay/stores/game-metadata-store.ts` - GameWithPlayers
   - `domains/gameplay/stores/gameplay-store-v2.ts` - GameWithPlayers
   - `domains/chat/components/game-chat.tsx` - Game

2. **Player Types** (5 imports)
   - `pages/games-list/game-list-player-info.tsx` - Player
   - `utils/player-colors.ts` - Player
   - `domains/gameplay/actions/update-for-game-ended.ts` - PlayerIndex, GameStatus
   - `domains/gameplay/actions/update-for-game-start.ts` - PlayerIndex
   - `domains/gameplay/stores/game-metadata-store.ts` - PlayerIndex
   - `domains/gameplay/stores/gameplay-store-v2.ts` - PlayerIndex

3. **Gameplay Types** (2 imports)
   - `domains/gameplay/actions/update-gameplay-state.ts` - Movement, PlayerQueuesMap
   - `domains/gameplay/stores/gameplay-store-v2.ts` - Movement

4. **Matchmaking Constants** (1 import)
   - `pages/join-game/join-game-page.tsx` - FFA_NUM_PLAYERS_MAX

5. **Game Status** (1 import)
   - `domains/gameplay/actions/update-for-game-ended.ts` - GameStatus

### Core Package Imports (packages/core)

**Total Import Sites:** 2

1. **Utils** (1 import)
   - `src/board.ts` - invariant()

2. **Game Types** (2 imports)
   - `src/game.ts` - GameStatus, Game
   - `src/game/get-current-player-index.ts` - GameWithPlayers

### Protocol Package Imports (packages/protocol)

**Total Import Sites:** 2

1. **Gameplay Types** (2 imports)
   - `domains/gameplay/server-messages.ts` - GameWithPlayers, PlayerQueuesMap

### Common Package Internal Imports

**Self-Dependency:**
- `common/types/games.ts` imports `Player` from `common/types/player.ts`

---

## Migration Plan by Category

### 1. Game & Player Types → @core

**Rationale:** These are core game domain types that should live with the game engine.

**Files to migrate:**
- `common/types/games.ts` → `core/src/types/game-types.ts` or `core/src/db-types.ts`
- `common/types/player.ts` → `core/src/types/player-types.ts` or `core/src/db-types.ts`

**Note:** There's a TODO comment in `games.ts` acknowledging this:
```typescript
// TODO: this is duplicated on backend.
// Also all of this should be in core.
// I want common to be game-agnostic
```

**Imports affected:** 31 total (Backend: 6, Frontend: 14, Core: 2, Protocol: 2, Common: 1)

**Issues to resolve:**
- `Game` interface has `created_at/updated_at` as `Date | string` (db vs. serialized)
- Consider splitting into DB types vs. API types
- Duplicate with backend `GamesTable` interface needs reconciliation

### 2. User Types → Backend DB Types

**Rationale:** User is primarily a backend/DB concept. Frontend gets user data via protocol messages.

**Files to migrate:**
- `common/types/user.ts` → `backend/src/domains/users/types.ts` or `backend/src/db/types.ts`

**Imports affected:** 3 (all backend)

**Alternative:** Could move to `@core` if we consider User a cross-cutting domain entity, but currently it's backend-specific.

### 3. Gameplay Types & Constants → @platform/domains/gameplay

**Rationale:** Domain-specific constants and types belong in platform packages per v2 architecture.

**Files to migrate:**
- `common/types/gameplay.ts` → `platform/domains/gameplay/types.ts` or `platform/domains/gameplay/constants.ts`
  - Split `GAMEPLAY_DOMAIN` constant to `constants.ts`
  - Move `Movement`, `PlayerQueuesMap`, `PlayerIndex` types to `types.ts`

**Imports affected:** 9 total (Backend: 5, Frontend: 2, Protocol: 2)

**Note:** `PlayerIndex` is duplicated in both `common/types/player.ts` and `common/types/gameplay.ts`

### 4. Matchmaking Constants → @platform/domains/matchmaking

**Rationale:** Domain-specific constants belong with their domain in platform.

**Files to migrate:**
- `common/constants/matchmaking.ts` → `platform/domains/matchmaking/constants.ts`

**Good news:** This file already exists! We just need to move the constants.

**Imports affected:** 2 (Backend: 1, Frontend: 1)

### 5. Username Validation → @utils (new package)

**Rationale:** Shared validation logic that runs on both BE + FE should live in a utils package.

**Files to migrate:**
- `common/validation/username.ts` → `utils/validation/username.ts`

**Imports affected:** 2 (both backend)

**Note:** This is currently only used by backend, but validation logic is typically shared. Consider if frontend should also validate before sending to backend.

### 6. Utility Functions → @utils (new package)

**Rationale:** Generic utilities should live in a shared utils package.

**Files to migrate:**
- `common/utils/invariant.ts` → `utils/assertions/invariant.ts`
- `common/utils/room-key.ts` → `utils/room-key.ts` OR `platform/domains/system/helpers.ts`
- `common/utils/backend/debugging.ts` → `backend/src/utils/debugging.ts`

**Imports affected:**
- `invariant()`: 1 (core package)
- `roomKey()`: 1 (backend gameplay)
- `debugging.ts`: 0 (not currently imported anywhere!)

**Decisions needed:**
- Should `roomKey()` be in utils or system domain? It's domain-aware (takes domain string).
- `debugging.ts` appears unused - verify before migrating or just delete?

---

## Migration Order Recommendation

**Phase 1: Low-Risk Domain Moves**
1. ✅ Matchmaking constants → `@platform/domains/matchmaking` (already has constants.ts)
2. ✅ Gameplay types → `@platform/domains/gameplay/types.ts`

**Phase 2: Core Type Consolidation**
3. ⚠️ Game & Player types → `@core/src/db-types.ts` or new `@core/src/types/entities.ts`
   - Requires resolving `Date | string` inconsistency
   - Requires reconciling with backend `GamesTable` duplicate

**Phase 3: Backend-Specific Moves**
4. ✅ User types → `@backend/src/domains/users/types.ts`
5. ✅ Username validation → `@utils/validation/username.ts` (or keep in backend if FE doesn't need)
6. ✅ Backend debugging util → `@backend/src/utils/debugging.ts`

**Phase 4: Generic Utilities**
7. ✅ `invariant()` → `@utils/assertions/invariant.ts`
8. ⚠️ `roomKey()` → Decision needed (utils vs. system domain)

**Phase 5: Cleanup**
9. Delete `packages/common` entirely
10. Update any remaining references in docs/markdown files

---

## Open Questions & Decisions Needed

### 1. Should we create a `@utils` package?

**Current State:** No shared utils package exists yet.

**Options:**
- **A)** Create `packages/utils` for truly generic utilities (`invariant`, `validateUsername`)
- **B)** Put backend-only utils in backend, FE-only in FE, and minimize sharing
- **C)** Put shared utilities in `@core` (conflates game engine with generic utils)

**Recommendation:** Option A - create `@utils` for generic, non-game-specific helpers.

### 2. How should we handle DB types vs. API types?

**Current Issue:** Types like `Game` and `Player` have:
- DB representation (e.g., `created_at: Date`)
- Serialized/API representation (e.g., `created_at: string`)
- Current workaround: `created_at: Date | string` (not type-safe)

**Options:**
- **A)** Separate types: `GameEntity` (DB) vs. `Game` (API/serialized)
- **B)** Use type transformations/mappers between layers
- **C)** Accept `Date | string` as pragmatic (current approach)

**Recommendation:** Option A for better type safety, especially as codebase grows.

### 3. Where should `roomKey()` live?

**Context:** `roomKey(domain, room)` creates a string key like `"gameplay:game-123"`.

**Options:**
- **A)** `@utils/room-key.ts` - it's just a string helper
- **B)** `@platform/domains/system/helpers.ts` - system domain owns room management
- **C)** `@backend/src/ws/helpers.ts` - only backend uses it

**Current usage:** Only 1 import in `backend/src/domains/gameplay/game-server.ts`

**Recommendation:** Option C (backend ws helpers) since it's only used there and closely tied to WS room management.

### 4. What to do with `PlayerIndex` duplication?

**Current State:** `PlayerIndex` type appears in both:
- `common/types/player.ts` as `type PlayerIndex = number`
- `common/types/gameplay.ts` as `type PlayerIndex = number`

**Recommendation:** Consolidate into a single location in `@core/src/types/` as it's a core game concept.

### 5. Should we use branded types for Game/Player IDs?

**Context:** We've already implemented branded types for `UserId`, `GameId`, `RoomId`, `ChatMessageId` in v2.

**Current State:** `common` types use raw numbers:
```typescript
interface Game {
  id: number;  // Should be GameId branded type
}
interface Player {
  id: number;      // Should be PlayerId branded type?
  game_id: number; // Should be GameId branded type
  user_id: number; // Should be UserId branded type
}
```

**Recommendation:** Update to use branded types during migration for consistency with v2 patterns.

---

## Next Steps

1. **Get decisions on open questions** (especially utils package creation, DB vs API types)
2. **Start with Phase 1** (low-risk domain moves) to validate migration process
3. **Create migration tactical doc for each phase** as needed
4. **Update import paths incrementally** (can be done in parallel with functional work)
5. **Delete `@common` when all migrations complete**

---

## Import Summary Stats

**Total import sites analyzed:** ~35 (excluding markdown docs)

**By consuming package:**
- Backend: 14 imports
- Frontend: 17 imports
- Core: 2 imports
- Protocol: 2 imports
- Common (self): 1 import

**By content type:**
- Game/Player types: 31 imports (biggest migration)
- Gameplay types: 9 imports
- User types: 3 imports
- Matchmaking constants: 2 imports
- Validation: 2 imports
- Utils: 2 imports

**Files in common:** 9 total files

---

## Notes

- The `debugging.ts` utility appears to have **zero imports** - may be dead code
- Several TODOs in `common/types/games.ts` acknowledge these types should move to core
- `GameStatus` constant object is noted as duplicated on backend
- Import path aliases are working: `@common/*` resolves correctly across packages
