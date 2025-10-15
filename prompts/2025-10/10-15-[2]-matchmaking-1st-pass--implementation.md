## Session Prompt: Matchmaking Domain Implementation - Scaffolding

### Objective

Scaffold the matchmaking domain for the v2 architecture following the established chat domain pattern. Everything should be stubbed with clear TODOs - no business logic implementation yet.

### Primary Guide

Read and follow: epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/10-15-[1]-matchmaking-implementation-planning.md

This tactical note contains all decisions, patterns, and the implementation plan. It's your primary source of truth for this session.

### Reference Files (For Pattern Matching)

**Architecture patterns:**
- `dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md` - WebSocket patterns, handler/action conventions

**Chat domain (copy this pattern):**
- `apps/backend/src/domains/chat/handlers.ts` - Backend handler pattern
- `apps/backend/src/domains/chat/ws-effects.ts` - ws-effects with MsgCreators pattern
- `apps/backend/src/domains/chat/actions/` - Action structure (but matchmaking uses single actions.ts)
- `apps/frontend/src/domains/chat/handlers.ts` - Frontend handler pattern (THIN routing only)
- `apps/frontend/src/domains/chat/actions.ts` - Frontend actions pattern

**Protocol (import from these):**
- `packages/protocol/domains/matchmaking/client-messages.ts` - Already defined
- `packages/protocol/domains/matchmaking/server-messages.ts` - Already defined

### Deliverables

1. **`packages/platform/domains/matchmaking/constants.ts`**
   - Export `MATCHMAKING_ROOM_ID` constant (string value: `'matchmaking-queue'`)

2. **System Domain Stubs:**
   - `apps/backend/src/domains/system/actions.ts` - joinRoom/leaveRoom stubs
   - `apps/frontend/src/domains/system/actions.ts` - joinRoom/leaveRoom stubs

3. **Matchmaking Backend** (`apps/backend/src/domains/matchmaking/`):
   - `handlers.ts` - 3 client message handlers (thin routing)
   - `actions.ts` - 3 action functions (stubbed, call ws-effects)
   - `ws-effects.ts` - 3 broadcast functions (use MsgCreators, mocked wsBridge)
   - `types.ts` - Only if needed for shared types

4. **Matchmaking Frontend** (`apps/frontend/src/domains/matchmaking/`):
   - `handlers.ts` - 3 server message handlers (THIN - just route to actions)
   - `actions.ts` - 6 functions: 3 outbound (send messages), 3 inbound (handle responses, stubbed)

### Critical Patterns

**Frontend handlers MUST be thin:**
```ts
// ✅ CORRECT - thin routing
'matchmaking:queue-status': (payload) => {
  matchmakingActions.handleQueueStatus(payload);
}

// ❌ WRONG - logic in handler
'matchmaking:queue-status': (payload) => {
  store.setQueueSize(payload.queueSize); // NO! This goes in action
}
```

**Use MsgCreators from protocol:**
```ts
import { MsgCreators } from '@protocol/domains/matchmaking/server-messages';

wsBridge.broadcastToRoom(
  MATCHMAKING_ROOM_ID,
  MsgCreators.createQueueStatusMessage(queueSize, playersNeeded),
);
```

**Mock wsBridge:**
```ts
const wsBridge: any = {}; // mocked until Phase 2
```

### What NOT To Do

- ❌ Don't implement business logic (keep actions stubbed with TODOs)
- ❌ Don't import v1 services (MatchmakingService, GameCoordinator, etc.)
- ❌ Don't implement store integration (frontend actions stubbed)
- ❌ Don't implement navigation logic (stubbed)
- ❌ Don't write tests
- ❌ Don't create platform entity types (keep domain types local to apps for now)

**Exception:** ✅ DO create the MATCHMAKING_ROOM_ID constant in platform (it's a constant, not a type)

### Verification

After creating all files, check:
1. ✅ All files follow chat domain structure
2. ✅ Imports use correct paths (`@/`, `@protocol/`, etc.)
3. ✅ All TODOs are clearly marked
4. ✅ Handlers use `satisfies` pattern for type safety

**Note:** We don't have package.json/build setup in apps/ yet, so TypeScript verification will come later.

### After Implementation

**Check in with the user** to:
- Review what was created
- Discuss any issues or discoveries
- Decide on next steps (tracker updates, follow-up work, etc.

#### Documentation Tasks

Update [STRATEGY-AND-TRACKER].md:

* [ ] Document progress / what's completed (BE CONCISE!!)

* [ ] Update open questions / decisions (room naming, error handling, etc.)

#### Tasks for later sessions

- [ ] Set up package.json and build configs for apps/backend and apps/frontend
- [ ] Run TypeScript checks to verify imports and types

### Session Workflow

1. Read the tactical note thoroughly
2. Create files in order (constants → system stubs → matchmaking backend → matchmaking frontend)
3. Follow chat domain pattern exactly
4. Keep everything stubbed with clear TODOs
5. Verify structure and patterns
6. Check in with user
