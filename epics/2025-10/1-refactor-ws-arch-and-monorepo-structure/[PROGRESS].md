# WebSocket Architecture & Monorepo Refactor - Progress

## Doc Purpose
This doc tracks active status and work for the epic. It's a living tracker updated frequently as work progresses. For strategic vision, architecture principles, and foundational decisions, see [STRATEGY].md.

---

## Current Status

**Current Phase:** Phase 2 - WS Infrastructure (Backend Complete ✅)

**Last Updated:** 2025-10-20

**Just Completed:**
- Backend WS infrastructure implementation (Phase 2.1)
- Type-safe WS server with multi-connection support
- Server bridge singleton wired to all backend domains (through ws-effects)

**What's Next:**
Phase 2.2 - Frontend WS infrastructure:
- WS client with auto-reconnection and message queuing
- Connection store integration with React
- Client bridge for frontend domains
- Bootstrap and useInitializeWsApp() hook

**Notes:**
- Backend infrastructure complete, TypeScript passing
- Main.ts stub created for future v1/v2 integration
- Frontend implementation ready to begin

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
- ✅ [2025-10-20] Backend WS Infrastructure - Phase 2.1 (see: `10-19-[2]-ws-infra-backend-implementation.md`)
  - Created type-safe WS server, designed for easy Fastify integration
  - Implemented RoomManager with multi-connection support (multiple tabs per user)
  - Built server bridge singleton and use in all domain ws-effects 
  - Main.ts stub created for future v1/v2 integration

### In Progress
- None currently

### Next Steps
Phase 2.2 - Frontend WS infrastructure (see: `10-19-[3]-ws-infra-frontend-implementation.md`):
- WS client with auto-reconnection and message queuing
- Connection store integration with React
- Client bridge for frontend domains
- Bootstrap and useInitializeWsApp() hook

### Upcoming
- ⏳ System domain implementation (room membership, etc.)
- ✅ WS bridge implementation (backend) ← DONE
- ✅ WS server implementation (backend) ← DONE
- ⏳ WS client implementation (frontend) ← NEXT
- ⏳ WS bridge implementation (frontend) ← NEXT
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
