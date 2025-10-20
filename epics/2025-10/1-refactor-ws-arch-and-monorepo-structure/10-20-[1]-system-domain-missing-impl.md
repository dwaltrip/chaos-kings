# System Domain Not Yet Implemented

**Date:** 2025-10-20
**Status:** Discovery - Needs Planning
**Context:** Identified during Phase 2.1 backend implementation

---

## Current State

**System domain structure:**
-  Has `actions.ts` with stubbed `joinRoom()` and `leaveRoom()`
- L No `handlers.ts` file
- L No protocol messages (`packages/protocol/domains/system/` doesn't exist)
- L Not registered in bootstrap (no handlers to register)

**Current room management flow:**
- Gameplay domain has its own `gameplay:join-room` and `gameplay:leave-room` message types
- Gameplay handlers receive these messages and delegate to system actions
- System actions are stubbed (need to call `wsBridge.rooms.join/leave`)

---

## Issues Identified

1. **Missing system message types and backend handlers**
2. **Stubbed actions:** System actions need to call `wsBridge.rooms.join(roomId, connectionId)`
3. 

---

## Implementation Approach

### Option A: Explicit System Messages
Create system domain protocol:
```typescript
// packages/protocol/domains/system/client-messages.ts
type SystemClientPayloadMap = {
  'system:join-room': { roomId: string };
  'system:leave-room': { roomId: string };
};
```

- Add system handlers that call system actions
- System actions call `wsBridge.rooms.join(roomId, ctx.connectionId)`
- Remove `gameplay:join-room` / `gameplay:leave-room` messages
- Gameplay uses system domain for room management

---

## Open Questions

1. Do we need **server-to-client system messages** (e.g., `system:room-joined` confirmation)?
3. Should system domain handle **all room operations** or just provide **primitives**?

---

## Next Steps

- Create implementation plan

---

## Related Docs / References

- There are several related notes and comments in [PROGRESS].md and [TODOS].md
- Room membership message ownership flagged during Phase 1
- System actions currently stubbed with TODOs
