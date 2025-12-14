# Open Questions & Future Work

**Last Updated:** 2025-12-13

This document tracks architectural questions, loose ends, and areas needing decisions or cleanup after the v2 WebSocket refactor. These items don't block current functionality but should be addressed as the codebase evolves.

---

## Type Architecture

### Game/Player Types Need Proper Home

**Current state:** Types like `Game`, `Player`, `GameWithPlayers` live in `@platform/domains/games/types.ts` as a temporary solution. They were hastily moved from the deleted `@common` package to complete the refactor.

**Problem:**
- These types represent both DB entities AND API/protocol types
- Current workaround: `created_at: Date | string` (not type-safe)
- Unclear if these belong in `@platform`, `@core`, or should be split

**Options:**
1. **Split types:** `GameEntity` (DB layer) vs. `Game` (API/serialized layer)
2. **Move to @core:** Treat as core game domain types
3. **Keep in @platform:** Accept as shared types between apps
4. **Duplicate:** Backend and frontend maintain their own projections

**Recommendation:** Option 1 (split types) for better type safety. DB layer uses `Date`, API layer uses `string`, with explicit conversion at boundaries.

**Affected files:**
- `packages/platform/domains/games/types.ts` - Current temporary home
- `packages/core/src/game/types.ts` - Has some overlap
- 20+ import sites across backend and frontend

**Note from file:**
```typescript
// packages/platform/domains/games/types.ts
// NOTE: This was moved from @common to @platform so we could finish
// deleting common entirely. I didn't really refactor these types yet.
//
// TODO: Look into refactoring these types. Probably something like DB entities
// vs. types specific to the backend and frontend apps.
```

---

## Platform Package Strategy

### What Should Live in @platform?

**Original vision:** `@platform` would hold shared domain types, constants, and light domain logic used by both backend and frontend.

**Current reality:**
- `@platform/domains/games/types.ts` - Temporary type dumping ground (see above)
- `@platform/domains/matchmaking/constants.ts` - Working well (FFA_NUM_PLAYERS_MAX, etc.)
- `@platform/domains/gameplay/types.ts` - Gameplay-specific types
- Other domains - Various states of organization

**Open questions:**
1. **Threshold for extraction:** When should we extract types to platform vs. keep in apps?
2. **Divergence patterns:** When do backend/frontend need different types vs. shared?

**Current approach:** Wait for duplication pain before extracting. Easy to extract later, harder to undo premature abstraction.

**Decision needed:** Formalize platform package guidelines or accept it as a pragmatic shared space.

**Note on protocol dependencies:** ✅ **RESOLVED (2025-11-28)** - Protocol package may import type definitions from `@core` and `@platform` when those types represent shared vocabulary. See docs/architecture.md for details.

---

## Domain Boundaries

### Cross-Domain Action Patterns

**Current state:** Some domains call into other domains' actions. Example:

- `matchmaking/actions/spawn-game-action.ts` calls `GameCoordinator` and `addUserToGame` (gameplay/games domain work)

**Questions:**
1. Is this a code smell or acceptable pattern?
2. Should matchmaking call gameplay/games actions instead of owning spawn logic?
3. How do we establish clear boundaries when domains naturally interact?

**Note:** This works but feels like a boundary violation. Needs design discussion for clarity.

---

## WebSocket Infrastructure

### Error Handling

**Current state:** No consistent pattern for sending error messages to clients.

**Problems:**
- Handlers can fail silently
- Clients don't know if their message was rejected or why
- No standard error message format

**Deferred work:** See tactical doc `epics/.../10-31-[2]-ws-error-messages-to-client.md` for proposed solution.

**Needs:**
- Standard error message type in protocol
- Handler error boundaries
- Client-side error handling patterns

### ws-lib Polish Items

From investigation doc `10-31-[1]`, Finding #5:

- [ ] Replace connection ID generator with UUID library (currently uses timestamp + random)
- [ ] Use branded `RoomId` in RoomManager (requires idToString conversions)
- [ ] Use branded `UserId` in HandlerContext (affects all handler signatures)

**Trade-off:** These improve type safety but require touching many files. Defer until next major refactor.

---

## State Management Patterns

### Store Access in Actions

**Current state:** Inconsistent across domains.

**Pattern A - Pure actions (receive all data as arguments):**
```typescript
export async function doSomething(userId: UserId, currentState: SomeState) {
  // Use currentState passed in
}
```

**Pattern B - Actions call stores directly:**
```typescript
export async function doSomething(userId: UserId) {
  const currentState = domainStore.getState();
  // Use currentState from store
}
```

**Both patterns exist.** Need to decide and document preferred approach.

**Trade-offs:**
- Pattern A: More testable (pure functions), but verbose callsites
- Pattern B: More concise, but couples actions to store implementation

---

## Data Enrichment Strategy

### When to Populate Extra Fields in WS Messages

**Current approach:** Mixed patterns.

**Example - Chat messages:**
- Protocol sends `userId` only
- Backend enriches with `username` before broadcasting
- Frontend receives complete data without extra fetch

**Questions:**
1. When should we add extra fields to payloads (e.g., username)?
2. When should we include complete entities instead of IDs?
3. When should clients fetch additional data separately?

**Trade-offs:**
- **Enrich payloads:** Simpler client code, but protocol grows complex
- **Send IDs only:** Clean protocol, but requires multiple roundtrips or client-side joins
- **Send full entities:** Complete data, but can be wasteful if client doesn't need everything

**Current assessment:** Chat username enrichment works for now, but may not scale if more User fields are needed. Need patterns for complex scenarios.

---

## Testing Strategy

### What and When to Test

**Current state:** Minimal tests.
- `packages/core/` has unit tests (game engine logic)
- Apps have very few tests
- No integration tests for WebSocket flows

**Questions:**
1. When to add tests during development?
2. What level of test coverage is appropriate?
3. Unit tests for domain actions? Integration tests for WS flows?
4. How to test WebSocket infrastructure without brittle tests?

**Challenges:**
- Real-time WebSocket testing is complex
- Zustand stores complicate frontend testing
- Database state management for backend tests

**Needs:** Testing strategy doc and examples.

---

## Code Cleanup Items

### Room Naming / Identification

**Current pattern:** Constants like `MATCHMAKING_ROOM_ID` for well-known rooms.

**Questions:**
1. Is this the long-term pattern or temporary?
2. Should we formalize room naming conventions?
3. How to handle dynamic room IDs (e.g., `gameplay:game-123`)?

**Current helper:** `roomKey(domain, id)` creates `"domain:id"` strings. Lives in backend ws code.

### Legacy Code Removal

**Status:** v1 code mostly removed during refactor.

**Remaining considerations:**
- Old patterns may still exist in some files
- Some v1-style code organization lingers
- Import/export patterns not yet fixed everywhere (see AGENTS.md)

**Approach:** Clean up incrementally as we touch files, not in dedicated cleanup passes.

---

## Future Architecture Considerations

### System Domain

**Current state:** Basic room management and connection tracking.

**Deferred features:**
- Heartbeat mechanism for connection health
- `system:room-status-update` message type for room membership changes
- Persistence strategy for membership tracker (Redis vs in-memory)

**See:** Tactical doc `epics/.../10-20-[3]-system-domain-implementation-plan.md`

### Matchmaking Improvements

**Known issues:**
- Uses `window.location.href` for navigation instead of React Router (`actions.ts:52`)
- Doesn't clear matchmaking state on game ready (`actions.ts:48`)

**Low priority** - works but could be cleaner.

### V1 MatchmakingService Migration

**Status:** v1 `MatchmakingService` still exists with some logic not yet migrated to v2 actions.

**Needs:** Identify remaining v1 logic and migrate to v2 backend actions.

---

## Notes on Loose Ends

### Common Package Cleanup

**Status:** ✅ Deleted as of commit `0a48368` (Nov 2025).

**What happened:**
- Non-type files migrated to proper locations (utils, platform, backend)
- Type files hastily moved to `@platform/domains/games/types.ts` to finish deletion
- See "Type Architecture" section above for remaining work

**Context:** See epic doc `11-22-[1]-common-cleanup-inventory.md` for full migration details.

---

## How to Use This Doc

This document tracks **known unknowns** - things we're aware need decisions or work but don't block current development.

**When to add items:**
- Add items when you discover something that needs future work
- Link to tactical docs for detailed analysis

**When questions are resolved:**
1. Move the content to **docs/open-questions-history.md**
2. Restructure as historical context (what was decided, when, why)
3. Remove from this document
4. Keep context on what the question was and how it was resolved

**This is NOT a backlog.** It's a reference for architectural discussions and future planning.
