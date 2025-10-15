# Matchmaking Implementation Planning

**Date:** 2025-10-15
**Status:** In Progress
**Session:** Initial planning and architecture review for matchmaking domain in v2

## Purpose

Plan and execute the implementation of the matchmaking domain within the v2 architecture, following the established patterns from the chat domain. This is the second domain implementation in Phase 1.

## Session Goals

1. Review existing v1 matchmaking implementation for feature parity
2. Confirm protocol message types match v1 functionality
3. Address architectural questions and integration points
4. Scaffold backend and frontend domain structure
5. Document dependencies and remaining work

## Architecture Review

### Protocol Types (Already Defined)

**Client → Server (`packages/protocol/domains/matchmaking/client-messages.ts`):**
- `matchmaking:join-queue` (empty payload)
- `matchmaking:leave-queue` (empty payload)
- `matchmaking:early-start-vote` ({ vote: boolean })

**Server → Client (`packages/protocol/domains/matchmaking/server-messages.ts`):**
- `matchmaking:queue-status` ({ queueSize, playersNeeded })
- `matchmaking:early-start-status` ({ voters, queueSize, allVoted })
- `matchmaking:game-ready` ({ gameId })

### V1 Implementation Summary

**Backend (`/backend/src/game-matchmaking/`):**
- `matchmaking-service.ts` - Redis-based queue management
  - Tracks players in sorted set (FIFO)
  - Early start voting with unanimous requirement
  - Auto-starts at 8 players (FFA_NUM_PLAYERS_MAX)
  - Early start at ≥2 players with unanimous votes
  - Creates game in DB and spawns game instance
- Action files: `join-queue`, `leave-queue`, `early-start-vote`, `spawn-game`
- `ws-effects.ts` - Broadcasts queue/vote status, game-ready

**Frontend (`/frontend/src/pages/join-game/`):**
- `game-matchmaking-actions.ts` - Send WS messages (join, leave, vote)
- `game-matchmaking-ws-handler.ts` - Handle server messages, update store
- Updates `join-game-store` with queue info, navigates to game on ready

### V2 Target Structure

**Backend (`apps/backend/src/domains/matchmaking/`):**
- `handlers.ts` - Route incoming messages to actions
- `actions.ts` - Business logic (stubbed with TODOs)
- `ws-effects.ts` - Broadcast functions using wsBridge (mocked)
- `types.ts` - Backend domain types (if needed)

**Frontend (`apps/frontend/src/domains/matchmaking/`):**
- `handlers.ts` - Thin routing, call actions
- `actions.ts` - Business logic for both outbound (send messages) and inbound (handle responses, update stores)

## Key Decisions

### ✅ System Domain Integration (Q1)
**Decision:** Create stub system actions that other domains can import:
- Backend: `systemActions.joinRoom(roomId, ctx)` / `leaveRoom(roomId, ctx)`
- Frontend: `systemWsEffects.joinRoom(roomId)` / `leaveRoom(roomId)`
- Matchmaking can call these directly for room membership
- Add TODO to epic tracker for full system domain implementation

### ✅ Username Access (Q2)
**Decision:** Drop username passing in v2. Use userId only.
- Handlers receive only `userId` in context
- Code that needs username should look up full User record from database
- Simplifies protocol, cleaner separation of concerns

### ✅ V1 Code Reuse (Q3, Q4)
**Decision:** All v1 domain logic will eventually migrate into v2 apps.
- For now, keep actions **stubbed with TODOs**
- Don't import v1 services/functions yet
- Migration/integration happens in later phase when unstubbing

### ✅ Frontend Handler Pattern (Q5)
**Decision:** Frontend handlers must be thin - extract payload, call 1 domain action.
- Handlers: Thin routing only (no store access, no logic)
- Actions: Contain logic (store updates, navigation, side effects)
- Actions are bidirectional: outbound (send messages) + inbound (handle responses)
- Store integration details deferred to unstubbing phase

### ✅ Navigation Pattern (Q6)
**Decision:** Defer to unstubbing phase.
- Add TODO in stubbed action about navigation approach
- Will decide between React Router navigate vs window.location later

### ✅ Room Identifier Pattern (Q7)
**Decision:** Create `MATCHMAKING_ROOM_ID` constant in `packages/platform/domains/matchmaking/constants.ts`
- Use this constant when calling system domain room actions
- Add open question to tracker about long-term room naming strategy

### ✅ Actions File Structure (Q8)
**Decision:** Use single `actions.ts` file for matchmaking.
- Simpler than chat's subdirectory approach
- Can split later if needed

### ✅ Concurrency Handling (Q9)
**Decision:** Not relevant for stubbing phase.
- `isCreatingGame` flag lives in MatchmakingService
- Not touching v1 service code in this phase

### ✅ Error Handling (Q10)
**Decision:** Defer to future cross-domain discussion.
- No error handling in stubs
- Add as open question in tracker

### ✅ Vote Reset Logic (Q12)
**Decision:** Change v1 behavior when unstubbing.
- V1 resets votes on join, leave, and game creation
- V2 should only reset on leave and game creation (not on join)
- Improvement over v1 behavior

### ✅ Empty Payload Type (Q13)
**Decision:** Keep as-is.
- `EmptyPayload` type (`{}`) is fine for messages with no data

### Workflow Note
**Consideration:** Should we add a `[TODOS].md` file for grab-bag TODOs?
- Separate from the bigger-picture `[STRATEGY-AND-TRACKER].md`
- More nimble, less carefully organized
- Quick capture of incomplete work
- **(User to decide)**

## Open Questions (For Tracker)

These broader architectural questions should be added to the epic tracker:

1. **Room Naming Strategy** - What's the long-term pattern for generating room identifiers? Should we have a helper, constants, or something else?

2. **Error Handling Pattern** - Cross-domain concern: How should actions communicate errors to clients? Do we need error message types in protocol?

3. **Frontend State Management** - When we unstub, which store should matchmaking use? Create new v2 store or integrate with v1 store?

## Integration Points

### System Domain Dependencies
- Room membership management (join/leave matchmaking room)
- Need to create system domain stubs before matchmaking implementation
- Backend: `systemActions.joinRoom/leaveRoom`
- Frontend: `systemWsEffects.joinRoom/leaveRoom`

### V1 Code Dependencies
- MatchmakingService (Redis queue management)
- createGame (database function)
- GameCoordinator (game instance management)
- Game spawning logic
- User lookup (for username → userId only now)

### Frontend Dependencies
- Store/state management (which store to use?)
- Navigation (React Router vs window.location)
- UI components in v1 pages

## Implementation Plan

1. **Create `MATCHMAKING_ROOM_ID` constant** in `packages/platform/domains/matchmaking/constants.ts`
2. **Create system domain stubs** (backend + frontend):
   - Backend: `apps/backend/src/domains/system/actions.ts` with joinRoom/leaveRoom stubs
   - Frontend: `apps/frontend/src/domains/system/actions.ts` with joinRoom/leaveRoom stubs
3. **Scaffold matchmaking backend** (`apps/backend/src/domains/matchmaking/`):
   - `handlers.ts` - 3 message handlers (thin routing to actions)
   - `actions.ts` - 3 action functions (stubbed with TODOs)
   - `ws-effects.ts` - broadcast functions using mocked wsBridge and MsgCreators from protocol
   - `types.ts` - minimal types (if needed)
4. **Scaffold matchmaking frontend** (`apps/frontend/src/domains/matchmaking/`):
   - `handlers.ts` - 3 server message handlers (thin routing)
   - `actions.ts` - bidirectional actions (outbound sends + inbound logic, stubbed)
5. **Update epic tracker** with progress, decisions, and open questions

## Pattern Reference

**Key conventions to follow:**
- Use `satisfies HandlerMapWithCtx<>` for backend handlers
- Use `satisfies HandlerMap<>` for frontend handlers
- Use `MsgCreators` from protocol packages for type-safe message creation
- Keep actions stubbed but with correct signatures
- Mock wsBridge: `const wsBridge: any = {}`

**Example ws-effects pattern:**
```ts
import { MsgCreators } from '@protocol/domains/matchmaking/server-messages';

const wsBridge: any = {}; // mocked

const matchmakingWsEffects = {
  broadcastQueueStatus(queueSize: number, playersNeeded: number) {
    wsBridge.broadcastToRoom(
      MATCHMAKING_ROOM_ID,
      MsgCreators.createQueueStatusMessage(queueSize, playersNeeded),
    );
  },
};
```

## Follow-Up Tasks (For Later Phases)

- [ ] Fully implement system domain (room membership, heartbeat, connection lifecycle)
- [ ] Migrate v1 MatchmakingService logic into v2 backend actions
- [ ] Migrate v1 game spawning logic (createGame, GameCoordinator)
- [ ] Unstub frontend actions with store integration and navigation
- [ ] Implement v2 improvement: Only reset votes on leave/game-creation (not on join)
- [ ] Test matchmaking flow end-to-end
- [ ] Define cross-domain error handling patterns
- [ ] Decide on long-term room naming strategy

## References

- [Strategy & Tracker](./[STRATEGY-AND-TRACKER].md)
- [Workflow Guide](./[WORKFLOW-WIP].md)
- [Folder Structure](../../../dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md)
- [WebSocket Architecture](../../../dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md)
- V1 Matchmaking: `/backend/src/game-matchmaking/`
- V1 Frontend: `/frontend/src/pages/join-game/`
