# WebSocket Architecture & Monorepo Refactor - Progress

## Doc Purpose
This doc tracks active status and work for the epic. It's a living tracker updated frequently as work progresses. For strategic vision, architecture principles, and foundational decisions, see [STRATEGY].md.

---

## Current Status

**Current Phase:** Phase 1 Complete ✅

**Last Updated:** 2025-10-18

**Just Completed:**
- Fixed ws-effects gap in frontend domain scaffold
- All initial domain scaffolding (handlers, ws-effects, stubbed actions)
- Branded types implementation across all domains
- TypeScript infrastructure setup

**What's Next:**
TBD - Need to plan Phase 2 (WS infrastructure):
- ws-client, ws-server
- ws-bridge (frontend + backend)
- Migration strategy for v1 app logic

**Notes:**
- Phase 1 delivered complete 3-layer architecture (handlers → actions → ws-effects)
- Both frontend and backend now use stubbed wsBridge
- Ready to implement real WS infrastructure in Phase 2

---

## Progress Tracker

**⚠️ TODO: Refactor this section to be milestone-focused (not task-focused)**
- Keep high-level completed milestones with dates
- Keep current milestone + next 2-3 major milestones only
- Remove granular task lists (those belong in tactical docs or [TODOS].md)
- Tactical docs contain planned work; [TODOS].md is for discovered/unplanned items
- This section should be strategic overview only

---

### Completed

- ✅ [2025-10-13] Protocol message definitions (chat, matchmaking, gameplay) in `packages/protocol`
  - Created initial pass of `client-messages.ts` and `server-messages.ts` for each domain
  - Implemented discriminated union pattern with message creators
  - Using types from `@core` and `@kernel` where appropriate
- ✅ [2025-10-13] Chat domain v2 structure in `apps/backend` and `apps/frontend`
  - Backend: `handlers.ts`, `actions/` (stubbed), `ws-effects.ts`, `types.ts`
  - Frontend: `handlers.ts`, `actions.ts` (stubbed)
  - Follows new architectural pattern
- ✅ [2025-10-15] Matchmaking domain scaffolding (see: `10-15-[1]-matchmaking-implementation-planning.md`)
  - Backend/frontend handlers, actions (stubbed), ws-effects
  - System domain stubs (joinRoom/leaveRoom)
  - `MATCHMAKING_ROOM_ID` constant in platform
- ✅ [2025-10-15] Gameplay domain scaffolding (see: `10-15-[2]-gameplay-implementation-planning.md`)
  - Backend/frontend handlers, actions (stubbed), ws-effects
  - Room ID helpers in `@platform/domains/gameplay` (buildGameRoomId, parseGameRoomId)
  - Flagged system domain integration concerns for future discussion
- ✅ [2025-10-17] Branded types implementation (see: `10-17-[1]-branded-types-implementation.md`)
  - Kernel: UserId, GameId, RoomId types with constructors + conversion helpers
  - Full implementation in system and matchmaking domains (backend + frontend)
- ✅ [2025-10-17] Branded types implementation complete - all domains (see: `10-17-[2]-branded-types-chat-gameplay.md`)
  - ChatMessageId added, conversions at all app boundaries
- ✅ [2025-10-17] TypeScript infrastructure for v2 apps
  - package.json + typecheck scripts, all type errors resolved

### In Progress
- None currently

### Next Steps (TBD)
Need to carefully plan approach for WS infrastructure (ws-client, ws-server, ws-bridge for both sides) and migrating bulk of v1 app code. Will break into smaller manageable steps.

### Upcoming
- ⏳ System domain implementation (room membership, etc.)
- ⏳ WS bridge implementation (backend + frontend)
- ⏳ WS server/client implementation
- ⏳ Business logic migration (unstub actions)
- ⏳ Core and common reorganization
- ⏳ V1 code removal

---

## Known Issues / Things to Revisit Later

Issues and concerns flagged during implementation that don't block current work but should be addressed in future phases.

**[2025-10-18] Frontend ws-effects layer missing:**
- Frontend currently has 2-layer pattern: handlers → actions (bidirectional)
- Should mirror backend: handlers → actions → ws-effects (3 layers)
- ws-effects should provide clean interface for domain-specific WebSocket operations
- Actions should focus on domain logic, ws-effects handle message sending
- Affects all domains: chat, matchmaking, gameplay, system

**[2025-10-15] Gameplay domain flags:**
- **v1 get-user-mapping pattern:** Current v1 pattern for mapping userId → gameId is suboptimal. Documented in TODOs but not refactoring during Phase 1 scaffolding.
- **Room membership message ownership:** Gameplay domain currently has dedicated message types (`gameplay:join-room`, `gameplay:leave-room`), but system domain should own room membership patterns. The backend handlers correctly call system domain actions, so the logic is in the right place, but we should clarify ownership and ideally remove these gameplay-specific message types in favor of generic system domain messages.
