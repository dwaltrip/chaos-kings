# Matchmaking Domain - v2 Implementation

## Overview

Implement the matchmaking domain in the new v2 architecture following the pattern established with the chat domain. This is the second domain implementation in Phase 1 of the refactor.

**Goal:** Create all necessary ws-related files for the matchmaking domain in both backend and frontend, following the handler → action → ws-effects pattern.

**Approach:** Reference old v1 matchmaking code to understand functionality, but structure everything using the new v2 patterns.

**Status:** Implementation level same as chat - handlers and ws-effects fully implemented, actions stubbed but shaped correctly.

---

## Prerequisites

**Review before starting:**
1. Old v1 matchmaking code:
   - `backend/src/game-matchmaking/` - Understand current matchmaking logic
   - `frontend/src/` (matchmaking-related code) - Understand client-side behavior

2. Protocol messages already defined:
   - `packages/protocol/domains/matchmaking/client-messages.ts`
   - `packages/protocol/domains/matchmaking/server-messages.ts`

3. Reference implementation:
   - Chat domain in `apps/backend/src/domains/chat/`
   - Chat domain in `apps/frontend/src/domains/chat/`

---

## Implementation Checklist

### Step 1: Review & Confirm Protocol Messages
- [ ] Review existing protocol message types in `packages/protocol/domains/matchmaking/`
- [ ] Confirm message type names are appropriate (compare with v1 code)
- [ ] Make any necessary adjustments to message types before proceeding
- [ ] Document any changes to protocol messages

### Step 2: Understand v1 Functionality
- [ ] Review old matchmaking handlers - what messages are handled?
- [ ] Review old matchmaking logic - what actions exist?
- [ ] Review old matchmaking broadcasts - what server-initiated messages are sent?
- [ ] Identify domain entities/types needed (queue state, match data, etc.)
- [ ] Document key behaviors to replicate

### Step 3: Backend Implementation
Create files in `apps/backend/src/domains/matchmaking/`:

- [ ] **types.ts** - Domain entities (MatchEntity, QueueStateEntity, etc.)
  - Use plain strings + TODO comments for branded types
  - Keep focused on backend concerns (DB-shaped)

- [ ] **handlers.ts** - Route client messages to actions
  - Import from `@protocol/domains/matchmaking/client-messages`
  - Use `HandlerMapWithCtx<MatchmakingClientMessage, HandlerContext>`
  - Just `userId` in context for now
  - Each handler: destructure payload, call action

- [ ] **actions.ts** - Domain logic entry points (STUBBED)
  - Shape the function signatures based on v1 code
  - Add TODO comments for business logic
  - Call ws-effects where appropriate (for outgoing messages)
  - One file for all actions

- [ ] **ws-effects.ts** - Server-initiated broadcasts
  - Import from `@protocol/domains/matchmaking/server-messages`
  - Use MsgCreators from protocol
  - Call mocked wsBridge (keep `const wsBridge: any = {}`)
  - Methods like: `broadcastQueueUpdate()`, `notifyMatchFound()`, etc.

### Step 4: Frontend Implementation
Create files in `apps/frontend/src/domains/matchmaking/`:

- [ ] **handlers.ts** - Handle server messages, update state
  - Import from `@protocol/domains/matchmaking/server-messages`
  - Use `HandlerMap<MatchmakingServerMessage>`
  - Each handler: receive payload, update store/state (stubbed for now)

- [ ] **actions.ts** - Outgoing message senders (STUBBED)
  - Import from `@protocol/domains/matchmaking/client-messages`
  - Call wsBridge.send() with MsgCreators
  - Shape functions based on UI needs from v1 code
  - Functions like: `joinQueue()`, `leaveQueue()`, `voteEarlyStart()`

### Step 5: Verify Structure
- [ ] All files follow chat domain pattern
- [ ] Imports use `@/` for local, `@protocol/` for protocol
- [ ] Types properly imported from protocol/core/kernel
- [ ] Handler signatures match pattern from chat
- [ ] Actions properly shaped (even if stubbed)
- [ ] ws-effects use mocked bridge

---

## Files to Create

### Backend (`apps/backend/src/domains/matchmaking/`)
```
matchmaking/
├── types.ts           # Domain entities (backend-specific)
├── handlers.ts        # Client message routing
├── actions.ts         # Domain logic entry points (stubbed)
└── ws-effects.ts      # Server-initiated broadcasts
```

### Frontend (`apps/frontend/src/domains/matchmaking/`)
```
matchmaking/
├── handlers.ts        # Server message handling
└── actions.ts         # Outgoing message senders (stubbed)
```

---

## Pattern Reference

**Follow chat domain structure:**
- Handlers are thin routing layer
- Actions are the domain API (bidirectional)
- ws-effects are broadcasting wrappers
- Types live local to backend (no platform package yet)

**Key conventions:**
- Use `satisfies` for type checking handler maps
- Use `MsgCreators` from protocol for type-safe message creation
- Keep actions stubbed but with correct signatures
- Mock wsBridge until Phase 2

---

## Success Criteria

**Done when:**
- ✅ All 6 files created (4 backend, 2 frontend)
- ✅ Handlers fully implemented and type-safe
- ✅ ws-effects fully implemented with proper message creators
- ✅ Actions stubbed with correct signatures
- ✅ Types defined for domain entities
- ✅ Structure matches chat domain pattern
- ✅ No TypeScript errors (run builds to verify)
- ✅ Ready for gameplay domain implementation (next)

**Not required:**
- ❌ Business logic implementation (actions are stubbed)
- ❌ Real wsBridge (still mocked)
- ❌ Store integration (frontend handlers can be minimal)
- ❌ Tests

---

## Notes

**From Architecture Q&A [2025-10-13]:**
- Actions are bidirectional - called by handlers AND app code
- Reference v1 for functionality, but use v2 structure
- One actions.ts per domain (don't split yet)
- Plain strings + TODO comments for IDs
- Keep thin layers fully implemented, stub the meaty parts

**Protocol message types defined:**
- Client: `join-queue`, `leave-queue`, `early-start-vote`
- Server: (review the server-messages.ts file for full list)
