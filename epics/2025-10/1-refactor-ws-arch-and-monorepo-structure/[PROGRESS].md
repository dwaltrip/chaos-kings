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
- System domain baseline implementation (backend + frontend scaffolding, centralized room membership)

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

This section tracks major milestones only. See tactical docs for detailed implementation plans and [TODOS].md for discovered/unplanned work.

---

### Completed Milestones

**Phase 1: Domain Structure & Scaffolding** (Oct 13-17, 2025)
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

---

### Current Milestone

**None** - Ready to begin next phase

---

### Next Milestones

**Phase 2.2: Frontend WebSocket Infrastructure** (Next Up)
- WS client with auto-reconnection and message queuing
- Zustand connection store for React integration
- Client bridge for frontend domains
- Bootstrap and useInitializeWsApp() hook
- Wire frontend ws-effects to real infrastructure
- See tactical doc: 10-19-[3]-ws-infra-frontend-implementation.md

**System Domain Follow-ups** (Queued)
- Frontend listener/state integration once WS client pub/sub lands
- Decide on persistence strategy for membership tracker (in-memory vs Redis)
- Implement heartbeat & lifecycle handling
- See tactical doc: 10-20-[3]-system-domain-implementation-plan.md

**Phase 2.3: Integration Testing** (Future)
- End-to-end WS message flows
- Multi-client testing scenarios
- Connection resilience verification
- See tactical doc: 10-19-[4]-ws-infra-integration-testing.md

---

### Longer-Term Roadmap

These are future phases, not yet scoped in detail:
- Business logic migration (unstub all domain actions)
- Core and common package reorganization
- V1 code removal and cleanup

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
- **Room membership message ownership:** ✅ Addressed. System domain now owns join/leave transport. Follow-up: ensure gameplay UI migrates to new system-domain helpers where applicable.
