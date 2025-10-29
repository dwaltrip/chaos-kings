# Games & Gameplay Backend Integration - Session Notes

**Date:** 2025-10-29
**Status:** Complete
**Commits:** 7c009f7, b610609, e95aee0
**Related Docs:**
- 10-29-[1]-game-gameplay-backend-integration-plan.md
- 10-28-[1]-backend-domain-integration-notes.md

---

## Summary

Successfully completed full integration of games and gameplay domains into v2 backend architecture. This was the final major domain integration, completing the migration pattern established by user/chat/matchmaking domains.

Three-phase approach:
1. Port core actions with branded types
2. Implement room lifecycle (join/leave game)
3. Delete obsolete v1 files

All gameplay handlers now functional with proper gameId resolution, clean domain boundaries, and consistent architectural patterns.

---

## Key Architectural Decisions

### 1. In-Memory Maps Keep Branded Types

**Decision:** Don't serialize/deserialize branded types for in-memory data structures (Maps, Sets).

**Rationale:**
- Only serialize at true persistence boundaries (DB, Redis)
- In-memory structures have no serialization cost
- Cleaner, simpler code
- Consistent type safety throughout call stack

**Impact:** Establishes pattern for all future in-memory state management. Applied to:
- `GameCoordinator.games`: `Map<GameId, GameServer>`
- `userGameMapping`: `Map<UserId, GameId>`

**Contrast with:** MatchmakingService still serializes for Redis (correct - that's a real boundary).

---

### 2. Explicit GameId in Message Payloads

**Decision:** Pass `gameId` explicitly in protocol message payloads instead of parsing from room slugs.

**Rationale:**
- Avoids string parsing complexity
- More robust (no format coupling)
- Clearer intent in protocol
- Easier to validate/debug

**Impact:** Sets precedent for all gameplay messages. Deleted `parseGameRoomId` helper.

**Example:**
```ts
'gameplay:join-game': { gameId: number }
'gameplay:leave-game': { gameId: number }
'gameplay:undo-move': { gameId: number }
```

**Note:** Could theoretically parse gameId from room strings (`gameplay:game-123`), but prefer explicit over implicit.

---

### 3. Thin Handlers + Fat Actions Pattern

**Decision:** Handlers only do type conversion and delegation. Actions coordinate cross-domain concerns.

**Rationale:**
- Handlers are pure message routers (no business logic)
- Actions own coordination between domains (system + gameplay)
- Easier to test actions independently
- Clear separation of concerns

**Example:**
```ts
// Handler (thin)
'gameplay:join-game': ({ gameId }, ctx) => {
  onPlayerJoined(GameId(gameId), UserId(ctx.userId), ctx.connectionId);
}

// Action (coordinates system + gameplay)
function onPlayerJoined(gameId, userId, connectionId) {
  systemActions.joinRoom({ roomId, userId, connectionId }); // transport
  gameServer.onPlayerJoinedRoom(userId); // game logic
}
```

**Impact:** This pattern now consistent across all domains. Matchmaking follows same pattern.

**Trade-off Noted:** Passing `connectionId` into gameplay actions feels slightly off (transport concern leaking into domain logic). Documented with TODO. Acceptable for now, but may revisit with middleware/orchestration layer.

---

### 4. Action Files Over Single actions.ts Object

**Decision:** Use individual action files in `actions/` folder with barrel export, not single `actions.ts` with object.

**Rationale:**
- Matches pattern from chat/matchmaking domains
- Better file organization
- Easier to locate specific action logic
- Natural growth path (add new file vs editing large object)

**Implementation:**
- Renamed `actions-v0.1/` → `actions/`
- Updated existing actions rather than rewriting
- Deleted stubbed `actions.ts` object file

---

### 5. Domain Messages vs System Messages for Room Operations

**Decision:** Create domain-specific messages (`gameplay:join-game`) instead of relying solely on generic `system:join-room`.

**Rationale:**
- Domain messages express intent clearly ("joining a game" vs "joining a room")
- Allows domain-specific coordination logic
- Frontend makes single meaningful call
- Handler coordinates system (transport) + domain (logic)

**Impact:** Each domain can define room lifecycle semantics that make sense for that domain. System domain stays generic/reusable.

**Alternative Considered:** Frontend calls both `system:join-room` and `gameplay:notify-joined` (rejected - too many round trips, leaks coordination to client).

---

### 6. User↔Game Mapping Remains In-Memory

**Decision:** Keep temporary in-memory `Map<UserId, GameId>` for now, don't build persistent lookup.

**Rationale:**
- Unblocks integration work
- Requirements unclear (single server vs distributed, TTL, cleanup strategy)
- Can revisit after migration complete

**Impact:**
- Single-process limitation accepted
- Volatile on restart (acceptable for alpha)
- Documented in code with TODOs

**Future:** May use DB-backed lookup, Redis, or system domain membership tracker once requirements clearer.

---

## Import Ordering Convention Reinforced

**Pattern:** Most generic to most specific
1. Third-party (React, Redis)
2. Kernel (`@kernel/ids`)
3. Core, Common, Platform (`@core`, `@common`, `@platform`)
4. App-level (`@/domains`, `@/utils`)

**Key insight:** Kernel comes before Core/Common/Platform (it's more foundational).

**Impact:** Consistent import ordering makes code more scannable, reduces merge conflicts.

---

## Deferred Work & Rationale

### GameServer.onPlayerLeftRoom
**Reason:** Leave logic needs careful design (countdown cancellation, move queue cleanup, defeat vs disconnect). Not blocking current integration.

### ConnectionId in Gameplay Actions
**Reason:** Architectural smell (transport concern leaking into domain), but no clear alternative yet. Documented with TODO for future refactor (middleware, orchestration layer, etc.).

### HTTP Routes (game-routes.ts)
**Reason:** Still using v1 Fastify setup. Defer until websocket integration complete to avoid blocking gameplay work.

### User↔Game Persistent Lookup
**Reason:** Requirements unclear. In-memory Map sufficient for alpha. Revisit post-migration.

---

## Lessons Learned

### Pattern Consistency Pays Off
Following the same integration pattern for all domains (user → chat → matchmaking → gameplay) made this work straightforward. No major surprises.

### Rename vs Rewrite
Renaming `actions-v0.1/` to `actions/` and updating signatures was faster than reimplementing. Stub files created in early scaffolding were mostly unused.

### Type Boundaries Are Clear
Branded types make it obvious where conversions happen:
- Handlers: primitives → branded
- Actions: branded throughout
- Services/DB: branded → primitives (only at real persistence boundaries)

### Early Design Discussion Worth It
Spending time discussing the join-game message design (generic vs domain-specific) saved rework. Original v1 issue was naming/intent, not having a gameplay-specific message.

---

## Migration Status

**Backend Domains Complete:**
- ✅ User
- ✅ Chat
- ✅ Matchmaking
- ✅ Games
- ✅ Gameplay
- ✅ System (foundational, used by all)

**Remaining Backend Work:**
- Infrastructure code (non-domain)
- Miscellaneous utilities
- Small fixes/adjustments

**Next Steps:**
- Continue with remaining backend infrastructure
- Frontend integration (use new gameplay messages)
- Testing end-to-end flow

---

## Code Quality Wins

- **-163 lines** (Phase 1): Deleted stubs, consolidated logic
- **-99 lines** (Phase 3): Removed obsolete v1 files
- **Zero TypeScript errors** in migrated code
- **Consistent patterns** across all domains
- **Well-documented tradeoffs** (TODOs capture architectural tensions)

---

## Files Modified/Created

**Phase 1 (7c009f7):**
- Renamed: `actions-v0.1/` → `actions/`
- Updated: 4 action files, handlers, game-coordinator, matchmaking spawn
- Created: `register-players-for-game.ts`
- Deleted: Stubbed `actions.ts`

**Phase 2 (b610609):**
- Protocol: Added `gameplay:join-game`, `gameplay:leave-game`
- Created: `on-player-joined.ts`, `on-player-left.ts`
- Updated: Handlers, platform helpers
- Deleted: `parseGameRoomId` (prefer explicit gameId)

**Phase 3 (e95aee0):**
- Deleted: `gameplay-ws-api.ts`, `ws-effects-v0.1.ts`

---

## Broader Implications

### For Other Domains
The patterns established here (thin handlers, branded types, explicit payloads, action coordination) should be followed by any future domains.

### For Frontend
Frontend will use new `gameplay:join-game` message with explicit gameId. Clearer than old `join-room` pattern.

### For System Design
ConnectionId in actions reveals potential need for orchestration/middleware layer in future. Document and revisit when implementing more complex cross-domain flows.

### For Testing
Actions are now easily testable in isolation (no handler context needed). Consider adding action-level tests for complex coordination logic.
