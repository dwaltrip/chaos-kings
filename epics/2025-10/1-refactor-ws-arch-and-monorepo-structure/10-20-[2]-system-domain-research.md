# System Domain Research

**Date:** 2025-10-20
**Purpose:** Document how v1 and demo v2 handle room management and system domain concerns

---

## Research Questions

1. How does the demo v2 code implement the system domain?
2. How does existing v1 code handle room management?
3. How does our current v2 gameplay domain use join/leave?
4. Should room joins be initiated from backend or frontend?
5. Should domains have their own join/leave message types?

---

## Demo V2 Implementation

**Location:** `epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/demo-ws-infra/`

### Architecture Pattern

**System domain owns ALL room membership:**
- Protocol messages: `system:room-join`, `system:room-leave` (client → server)
- Broadcast messages: `system:users-for-room`, `system:user-info` (server → client)
- **Other domains (chat, timer) do NOT have their own join/leave message types**

**Message Flow (Frontend-Initiated Join):**
1. Frontend: `chatActions.joinGeneralRoom()`:
   - Calls `systemWsEffects.joinRoom('general')` → sends `system:room-join` message
   - Updates `chatStore.currentRoom = 'general'` (domain-specific state)
2. Backend handler: receives message → calls `systemActions.joinRoom(roomId, ctx)`
3. Backend action:
   - Calls `wsBridge.rooms.join(roomId, userId)` (actual room join via RoomManager)
   - Fetches all members in room
   - Broadcasts `system:users-for-room` to all room members
4. Frontend handler: receives `system:users-for-room` → updates `systemStore.usersByRoom[roomId]`

**How Other Domains Use Rooms (Chat & Timer):**
- **Frontend**: Domain actions call `systemWsEffects.joinRoom()` + update their own domain stores
- **Backend**: All domain messages include `roomId` parameter (e.g., `chat:send { roomId, text }`)
- **Broadcasting**: Domains call `wsBridge.broadcastToRoom(roomId, message)` to scope delivery
- **No direct RoomManager access**: Domains never touch room membership - system domain owns it

**Key Characteristics:**
- System domain is a **proper domain** with full protocol/handlers/actions/ws-effects structure
- Client-initiated joins (frontend sends explicit message)
- Room membership centralized in `RoomManager` singleton (backend only)
- User list synchronization after every join/leave via snapshots
- Room IDs normalized and validated
- No room namespacing (roomId is just a string)
- Domains do domain-specific work in their own actions, then delegate to system for room join

---

## V1 Implementation

**Location:** `backend/src/` and `frontend/src/`

### Architecture Pattern

**Generic `join-room` message type, domain-specific handlers:**
- Message type: `'join-room'` (not namespaced, e.g., NOT `'gameplay:join-room'`)
- Message envelope: `{ domain: 'gameplay', type: 'join-room', payload: { room } }`
- Each domain has its own handler for the generic `'join-room'` type

**Message Flow (Frontend-Initiated Join):**
1. Frontend: `wsService.joinRoom(GAMEPLAY_DOMAIN, room)` → sends `{ domain: 'gameplay', type: 'join-room', payload: { room } }`
2. Backend routing: `DomainAPI` routes to `handleGameplayMessage()` based on domain
3. Domain handler: Switch on message type:
   ```ts
   case 'join-room':
     effects.joinGameplayRoom(room);  // Calls wsActions.join(roomKey(GAMEPLAY_DOMAIN, room))
     gameServer.onPlayerJoinedRoom(userId);  // Domain-specific logic!
   ```
4. `ClientWsActions.join()` → `WebSocketManager.joinRoom()` (actual room join)

**Key Insight:** Each domain handles `'join-room'` separately and can add domain-specific logic beyond just joining the WS room.

**Key Characteristics:**
- Generic `'join-room'` message TYPE, but each domain has its own HANDLER
- Backend provides `ClientWsActions` interface to domain handlers (join/leave/broadcast/reply)
- Room keys are namespaced: `roomKey(domain, room)` → `"gameplay:room-123"`
- Frontend has `useWebsocket(domain, handler, room?)` hook that auto-joins on mount
- No explicit system domain - room management is infrastructure-level
- `WebSocketManager` owns room state (generic across all domains)

---

## Current V2 State (Our Implementation)

**Location:** `apps/backend/src/domains/` and `apps/frontend/src/domains/`

### Architecture Pattern

**Gameplay domain has its own join/leave messages (marked with TODOs):**
- Protocol messages: `gameplay:join-room`, `gameplay:leave-room`
- Handlers call gameplay actions which delegate to stubbed system actions
- TODOs in code questioning whether gameplay should have dedicated room management messages

**System domain is minimal:**
- Just stubbed `joinRoom()` / `leaveRoom()` actions with TODOs
- No protocol messages (`packages/protocol/domains/system/` doesn't exist)
- No handlers (`handlers.ts` doesn't exist)
- Not registered in bootstrap

**Key Characteristics:**
- Backend WS infrastructure is complete (`wsBridge.rooms.join/leave` works)
- Frontend WS infrastructure not yet implemented (Phase 2.2 pending)
- Follows v2 architecture patterns (handlers → actions → ws-effects)
- Uses branded types (RoomId, UserId, GameId)

---

## Key Differences & Insights

### Three Different Approaches

**Demo V2:** Centralized system domain, domain delegation pattern
- System domain owns all room membership state (RoomManager singleton)
- Other domains call `systemWsEffects.joinRoom()` - no domain-specific join messages
- Frontend domains do domain-specific work in their actions before/after system join
- Backend domains receive `roomId` in messages, use `wsBridge.broadcastToRoom(roomId)`
- Clean separation: system owns membership, domains own their business logic

**V1:** Generic message type, domain-specific handlers on backend
- `'join-room'` is a generic message type (not namespaced)
- Each domain has its own handler that does room join + domain-specific logic together
- Message envelope includes domain: `{ domain: 'gameplay', type: 'join-room' }`
- Backend handler does both: `joinGameplayRoom()` AND `gameServer.onPlayerJoinedRoom()`
- Room keys namespaced to avoid collisions: `roomKey(GAMEPLAY_DOMAIN, room)`

**Current V2:** Domain-specific messages (to be refactored)
- Each domain has its own `domain:join-room` message type (e.g., `gameplay:join-room`)
- Handlers delegate to stubbed system actions
- **Will be refactored to follow demo v2 pattern** (see Design Decisions below)

### Key Architectural Difference

**V1 approach:** Each domain has its own `'join-room'` handler that does both room join AND domain-specific work:
```typescript
case 'join-room':
  effects.joinGameplayRoom(room);           // Joins room
  gameServer.onPlayerJoinedRoom(userId);    // Domain-specific logic
```

**Demo v2 approach (CHOSEN):** Domains delegate to system domain for room join, handle domain-specific work via separate messages:
```typescript
// Frontend: chatActions.joinGeneralRoom()
systemWsEffects.joinRoom('general');   // Delegates to system domain
chatStore.currentRoom = 'general';     // Domain-specific state update
```

Backend domains receive messages with `roomId` and use `wsBridge.broadcastToRoom(roomId)` for scoped delivery. System domain owns all room join/leave logic.

---

## Design Decisions

**We will follow the demo v2 architecture with these principles:**

### 1. Centralized Room Management

**Frontend:**
- ALL room join/leave requests go through `systemWsEffects.joinRoom(roomId)` / `leaveRoom(roomId)`
- Domain actions call system ws-effects + update their own domain stores
- NO domain-specific join/leave message types (no `gameplay:join-room`, `chat:join-room`, etc.)

**Backend:**
- System domain owns RoomManager access
- ALL code needing room join/leave calls `systemActions.joinRoom(roomId, userId)` / `leaveRoom()`
- System actions can be called from:
  - System handlers (via `system:room-join` messages)
  - Other backend domain code (direct function calls - e.g., matchmaking auto-joining players)
- Other domains use `wsBridge.broadcastToRoom(roomId, ...)` for scoped messaging

### 2. Decoupled Room Membership from Domain Logic

- Room membership = pure transport/infrastructure concern (system domain)
- Domain participation = business/application concern (domain-specific messages)
- Example: Gameplay can send `gameplay:enter-game` or `gameplay:player-ready` separately from room join
- Clean separation keeps both layers simple and reusable

### 3. Room Naming Convention

- Prefix room IDs with domain to prevent collisions
- Use helper: `roomKey(domain, id)` → e.g., `'gameplay:game-123'`, `'chat:general'`
- Exact implementation details deferred to implementation phase

### 4. Implementation Details (Deferred)

**User list broadcasting:**
- Demo v2 broadcasts `system:users-for-room` after every join
- Decision deferred - implement if/when needed

**Room ID validation:**
- Demo v2 validates and normalizes (trim, check non-empty)
- Decision deferred - start simple, add validation as needed

---

## File References

**Demo V2:**
- Domains: `epics/.../demo-ws-infra/{backend,frontend,common}/src/domains/{system,chat,timer}/`
- Infrastructure: See `references/v2-demo-app-room-join-architecture.md` for detailed flow diagrams

**V1:**
- Backend: `backend/src/websocket/manager.ts`, `backend/src/gameplay/gameplay-ws-api.ts`
- Frontend: `frontend/src/services/websocket-service.ts`
- Common: `common/websockets/message-types.ts`, `common/types/gameplay.ts`

**Current V2:**
- Backend: `apps/backend/src/domains/{gameplay,system}/`
- Protocol: `packages/protocol/domains/gameplay/client-messages.ts`

---

## Deferred Decisions

**To review in later refactor phases:**

### Room Membership vs Domain Messages Coupling

**Current decision:** Keep room membership (system domain) decoupled from domain-specific messages.

**Rationale:** Clean separation works well in demo v2. System stays simple, domains stay focused.

**TODO:** Revisit this decision when migrating actual domain logic (Phase 3+). If we discover strong coupling needs during gameplay/matchmaking implementation, reconsider whether some domains need integrated join handlers. For now, assume decoupled approach until we hit a concrete problem.

**When to review:** During Phase 3 (business logic migration) when unstubbing gameplay actions, particularly:
- Game start countdown logic (currently in v1 `gameServer.onPlayerJoinedRoom()`)
- Player reconnection handling
- Matchmaking flow integration
