# WebSocket Architecture & Monorepo Refactor - Progress

## Doc Purpose
This doc tracks active status and work for the epic. It's a living tracker updated frequently as work progresses. For strategic vision, architecture principles, and foundational decisions, see [STRATEGY].md.

---

## Current Status

**Current Phase:** v2 System Activation Complete - Ready for Testing & Cleanup

**Last Updated:** 2025-10-31

**Just Completed:**
- v2 WebSocket system activation (commits 9068370, 2b0786b):
  - Created backend server entry point (server.ts + main.ts orchestration)
  - Wired v2 WS infrastructure with auth flow
  - Deleted v1 backend WebSocket infrastructure
  - Server tested and running on port 3131

**What's Next:**
- End-to-end system testing
- Review remaining TODOs and lingering issues
- Complete room join/leave lifecycle integration (verify status - see tactical doc `10-27-[1]`)
- Backend chat username population (verify if still needed)
- Address any discovered gaps or cleanup items

---

## Progress Tracker

This section tracks major milestones only. See tactical docs for detailed implementation plans and [TODOS].md for discovered/unplanned work.

---

### Completed Milestones

**Phase 1: Domain Structure & Scaffolding** (Oct 13-17, 2025) ✅
- Protocol message definitions for all domains (chat, matchmaking, gameplay)
- Backend/frontend domain scaffolding (handlers, actions, ws-effects) for all domains
- Branded types implementation across all domains (UserId, GameId, RoomId, ChatMessageId)
- TypeScript infrastructure and type checking setup
- See tactical docs: 10-15-[1], 10-15-[2], 10-17-[1], 10-17-[2]

**Phase 2.1: Backend WebSocket Infrastructure** (Oct 19-20, 2025) ✅
- Type-safe WS server with Fastify integration
- RoomManager with multi-connection support
- Server bridge singleton wired to all backend domains
- Backend ws-effects connected to real infrastructure
- See tactical doc: 10-19-[2]-ws-infra-backend-implementation.md

**Phase 2.2: Frontend WebSocket Infrastructure** (Oct 20-21, 2025) ✅
- Type-safe WS client with auto-reconnection and message queuing
- Client bridge singleton + Zustand connection store
- Domain ws-effects wired to the real bridge (chat, matchmaking, gameplay, system)
- React initialization hook + reset utilities for tests
- Transitional shims for React/Zustand types added (replace with real deps later)
- See tactical doc: 10-19-[3]-ws-infra-frontend-implementation.md

**Phase 3.1: First pass migrating Frontend app logic from v1 into v2** (Oct 10-27, 2025)
- Removed legacy v1 handlers and actions files (e.g. game-*-ws-handler.ts, game-*-actions.ts)
- Consolidated v1 actions into v2 actions.ts structure
- Updated handlers to delegate all logic to actions, ensured UI components use v2 actions
- Reorganized v1 files to better fit the new more clearly defined domain-based structure

**Phase 3.2: v2 System Activation** (Oct 31, 2025) ✅
- Created backend server entry point (server.ts exports startServer(), main.ts orchestrates)
- Wired v2 WS server into Fastify with auth flow (commits 9068370, 2b0786b)
- Deleted v1 backend WebSocket infrastructure (websocket-v0.1/, server-v0.1.ts)
- See tactical doc: 10-30-[1]-critical-path-v2-system-activation.md

---

### Next Milestones

**System Testing & Cleanup** (Next)
- End-to-end testing of v2 system
- Review and address remaining TODOs
- Verify room join/leave lifecycle integration status
- Verify chat username population status
- Address any lingering issues or gaps

---

### Longer-Term Roadmap

These are future phases, not yet scoped in detail:
- Core and common package reorganization
- V1 code removal and cleanup 

---

## Known Issues / Things to Revisit Later

Issues and concerns flagged during implementation that don't block current work but should be addressed in future phases.

**[2025-10-15] Gameplay domain flags:**
- **v1 get-user-mapping pattern:** Current v1 pattern for mapping userId → gameId is suboptimal. Documented in TODOs but not refactoring during Phase 1 scaffolding.

---

### Deferred / Low-priority

**System Domain Follow-ups**
- Decide on persistence strategy for membership tracker (Redis vs in-memory)
- Implement heartbeat, ws status info bells and whistles (e.g. msg type `system:room-status-update`)
- See tactical doc: 10-20-[3]-system-domain-implementation-plan.md
