# WebSocket Infrastructure - Planning & Analysis

**Date:** 2025-10-19
**Phase:** Phase 2 - WS Infrastructure
**Status:** Planning Complete - See Implementation Docs

---

## Doc Purpose

This is the **planning and reference document** for Phase 2 WS infrastructure work. It contains:
- Analysis of v1 vs v2 demo implementations
- Gap analysis and critical issues
- Architecture decisions and rationale
- Integration strategy
- High-level milestones

**For implementation:** See the focused implementation docs:
- `10-19-[2]-ws-infra-backend-implementation.md` - Backend WS infrastructure
- `10-19-[3]-ws-infra-frontend-implementation.md` - Frontend WS client
- `10-19-[4]-ws-infra-integration-testing.md` - Integration & testing

---

## Overview

This doc analyzes the existing v1 WebSocket infrastructure and the demo v2 implementation, then proposes an integration strategy to create the final v2 WS infrastructure that powers our domain-based architecture.

**Context:** Phase 1 is complete - all domains have handlers, actions (stubbed), and ws-effects with stubbed `wsBridge`. Now we need to implement the real WS infrastructure that connects everything.

**Key outcomes from planning:**
- Critical gaps identified (multi-connection support, Fastify integration details)
- Architecture decisions finalized (room manager extraction, auth flow, message format, etc.)
- Implementation strategy defined (hybrid approach: v2 types + v1 integration patterns)
- Handler context design marked as **[TENTATIVE-PLAN]** for validation during implementation

---

## Architecture Comparison

### Backend WS Infrastructure

#### V1 Implementation (`backend/src/websocket/`)

**Components:**
- **`WebSocketManager`** (`manager.ts`) - Core connection management
  - Manages client connections (socket ↔ user mapping)
  - Handles room membership (join/leave/broadcast)
  - Provides `ClientWsActions` interface to handlers
  - Integrates with Fastify via `@fastify/websocket`
  - Authentication via `req.currentUser` from Fastify request
  - Cleanup on disconnect (auto-leave all rooms)

- **`WsRouter`** (`router.ts`) - Domain-based message routing
  - Routes incoming messages by `domain` field
  - Simple Map-based dispatcher
  - Delegates to domain handlers

- **`DomainAPI`** (`api.ts`) - Alternative routing approach
  - Class-based API for domain registration
  - Routes by domain → message type
  - NOTE: Appears to coexist with `WsRouter` - may be legacy/experimental

- **`setup.ts`** - Bootstrap/initialization
  - Wires up router + manager
  - Registers domain handlers
  - Sets global manager instance

- **`global-manager.ts`** - Global singleton access
  - Provides `getGlobalWebSocketManager()` for actions/effects

**Message Flow (V1):**
```
1. Client connects → WebSocketManager creates WsClient
2. Authenticate via Fastify (req.currentUser)
3. Client sends message → parse as WsClientEnvelope
4. Attach user → WsServerInbound
5. WsRouter.dispatch(data, actions) → domain handler
6. Domain handler receives (data, ClientWsActions)
```

**Key Characteristics:**
- ✅ **Working auth integration** with Fastify
- ✅ **Room management** built-in (join/leave/broadcast)
- ✅ **Domain routing** via simple map
- ✅ **Global manager** pattern for access from actions
- ⚠️ **ClientWsActions interface** - passed to every handler (actions object pattern)
- ⚠️ **Multiple routing mechanisms** - `WsRouter` and `DomainAPI` both exist
- ❌ **Not type-safe** - message types are stringly-typed, lots of `any` casts
- ❌ **No discriminated unions** - payload types not enforced
- ❌ **Direct domain handler invocation** - doesn't use the new handlers → actions pattern

---

#### V2 Demo Implementation (`demo-ws-infra/backend/`)

**Components:**
- **`createWSServer`** (`ws/server.ts`) - Standalone WS server factory
  - Generic over `<TIncoming, TOutgoing, TContext>`
  - Takes `HandlerMapWithCtx` - fully typed handler map
  - Configurable lifecycle hooks (onConnection, onDisconnect, createContext)
  - Built-in `RoomManager` integration
  - Returns `WSServerInstance` with transport methods
  - Uses native `ws` library (not Fastify integration)

- **`wsBridge`** (`ws/bridge.ts`) - Transport abstraction
  - Lazy initialization pattern (`init(transport)`)
  - Clean interface: `broadcast`, `broadcastToRoom`, `sendToUser`, `rooms`
  - Generic over message type
  - Throws if not initialized

- **`RoomManager`** (`ws/room-manager.ts`) - Room membership tracking
  - Simple in-memory Map-based implementation
  - Methods: `join`, `leave`, `getMembers`, `isMember`, `getRoomsForUser`
  - Returns metadata (createdRoom, alreadyMember, roomRemoved)
  - Only supports one room per `userId`
  
- **`server.ts`** - Example bootstrap
  - Merges all domain handlers into single map
  - Creates typed server with full config
  - Initializes `wsBridge` with server transport
  - No Fastify integration shown

**Message Flow (V2 Demo):**
```
1. Client connects → onConnection hook → createContext(userId)
2. Client sends message → decode(raw)
3. Get handler from HandlerMapWithCtx by message.type
4. Call handler(payload, context)
5. Handler calls actions → actions call ws-effects → wsBridge methods
```

**Key Characteristics:**
- ✅ **Fully type-safe** - discriminated unions, generic payload extraction
- ✅ **Clean separation** - bridge abstraction, pluggable transport
- ✅ **Compile-time handler completeness** - `satisfies HandlerMapWithCtx<>`
- ✅ **Simple, focused components** - each does one thing well
- ✅ **Testable** - no global state, dependency injection
- ⚠️ **No Fastify integration** - uses standalone `ws` server
- ⚠️ **No auth shown** - `onConnection` creates userId, no real auth example
- ⚠️ **Simplified room manager** - explicitly marked "for demo purposes"
- ❌ **Only one room per user** - room membership is tracked by userId, not by ws connection

---

### Frontend WS Infrastructure

#### V1 Implementation (`frontend/src/services/websocket-service.ts`)

**Components:**
- **`WebSocketService`** - Singleton class
  - Manages single WebSocket connection
  - Domain-based message routing (handlers by domain)
  - Room tracking (join/leave via special messages)
  - Event listeners (open/close/error)
  - Connection state via zustand store (`wsStore`)
  - Auto-cleanup on `beforeunload`

**Key Characteristics:**

- ✅ **Working connection state management** with zustand
- ✅ **Domain routing** - routes messages by `domain` field
- ✅ **Room membership tracking** (though noted as possibly unused)
- ⚠️ **Singleton pattern** via `getWebSocketService()`
- ⚠️ **Manual handler registration** - `addMessageHandler(domain, handler)`
- ❌ **No type safety** - handlers use `any`, no payload types
- ❌ **No reconnection logic** - connection state tracked but no auto-reconnect
- ❌ **Message queuing TODO** - noted but not implemented

---

#### V2 Demo Implementation (`demo-ws-infra/frontend/`)

**Components:**
- **`WSClient`** (`ws/client.ts`) - Generic WebSocket client
  - Generic over `<TIncoming, TOutgoing>`
  - Typed handler registration via `HandlerMap<TIncoming>`
  - **Auto-reconnection** with exponential backoff
  - **Message queuing** when disconnected
  - Connection state management (connecting/open/closed)
  - Configurable via `WSClientConfig`

- **`wsBridge`** (`ws/client-bridge.ts`) - Client-side bridge
  - Similar pattern to backend bridge
  - Simple `send(message)` interface
  - Lazy init with client instance

- **`bootstrap.ts`** - App initialization
  - Merges all domain handlers upfront
  - Creates client with full handler map
  - Initializes bridge
  - Exports `useInitializeWsApp()` hook for React
  - Test reset utilities

**Key Characteristics:**
- ✅ **Fully type-safe** - discriminated unions throughout
- ✅ **Auto-reconnection** with configurable retry logic
- ✅ **Message queuing** - automatic, no manual TODO
- ✅ **React integration** - `useInitializeWsApp()` hook
- ✅ **Compile-time completeness** - handler map uses `satisfies`
- ✅ **Testable** - explicit init/reset for tests
- ⚠️ **No connection state store** - internal state only, no external store shown
- ⚠️ **No room concept** - client is simpler, rooms managed server-side

---

## Gap Analysis

### What V1 Has That V2 Demo Lacks

**Backend:**
1. **Fastify Integration** - V1 integrates cleanly with Fastify's auth middleware and connection handling
2. **Real Authentication** - Uses `req.currentUser` from Fastify auth plugin
3. **Global Manager Access** - Domain code can access `getGlobalWebSocketManager()` for server-initiated broadcasts
4. **More battle-tested** - V1 is working code that has been tested on the prototype game
5. **Scoped Logging** - V1 has per-client logging via `ScopedLogger`
6. **UUID-based Client IDs** - V1 generates unique client IDs for tracking
7. **Multi-Connection Support** - V1's `ClientStore` maps WebSocket → WsClient, supporting multiple tabs/windows per user

**Frontend:**

1. **Zustand Connection State** - V1 exposes connection state to components via store
2. **Working Integration** - V1 frontend is already wired to existing backend

### What V2 Demo Has That V1 Lacks

**Backend:**

1. **Full Type Safety** - Discriminated unions, generic payload extraction, no `any`
2. **Clean Architecture** - Bridge abstraction, dependency injection, no global state in core
3. **Compile-time Completeness** - `satisfies HandlerMapWithCtx` ensures all message types have handlers
4. **Testable Design** - No global singletons (except bridge), pure functions
5. **Handler Context Pattern** - Clean `(payload, context)` signature vs V1's `(data, actions)` bag
6. **Message Type Helpers** - `MessageType<T>`, `PayloadFor<T, Type>` utilities

**Frontend:**

1. **Auto-reconnection** - With exponential backoff
2. **Message Queuing** - Automatic when disconnected
3. **Full Type Safety** - Same as backend
4. **React Hook** - `useInitializeWsApp()` for component integration
5. **Test Utilities** - `resetWsInitializationForTests()`

---

## Critical Gaps to Address

### Multi-Connection Support (Backend)

**Issue:** V2 demo assumes one connection per userId (`Map<UserId, WebSocket>`), but V1 correctly supports multiple connections per user.

**Real-world impact:** Users often have multiple tabs/windows open. V2 demo's approach would break this - only the last connection would receive messages.

**V1's approach (must preserve):**
- `ClientStore` maps `WebSocket → WsClient` (not `userId → WebSocket`)
- Each connection has unique `clientId` (UUID)
- Rooms track `Set<WsClient>` (not `Set<UserId>`)
- Each `WsClient` tracks its own `rooms: Set<RoomId>` for cleanup on disconnect

**Decision:** MUST FIX, we need to incorporate v1 multi-connection in some way

**Solution:** Extract v1's `ClientStore` and room bookkeeping into new `RoomManager` that preserves multi-connection semantics.

---

## Integration Strategy

### Goal
Build v2 WebSocket infrastructure that:
- Maintains v1's working Fastify integration and auth
- Adopts v2's type safety and clean architecture
- Wires up to Phase 1 domain structure (handlers → actions → ws-effects)
- Minimizes disruption to working v1 code during transition

### Approach: Hybrid Implementation

We'll create a **hybrid** that takes the best of both:

**Backend:**

1. **Start with v2 demo architecture** (types, patterns, clean abstractions)
2. **Adapt Fastify integration from v1** (connection handling, auth)
3. **Extract v1 room management logic**, targeting a more robust version of v2's loose coupling between ws-server and room mgmt
4. **Create new bootstrap** that wires to v2 domain handlers
5. **Implement wsBridge** matching the interface that the v2 domain scaffolding expects (from phase 1 of refactor)

**Frontend:**

1. **Start with v2 demo client** (reconnection, queuing, types)
2. **Add v1's zustand store integration** for connection state
3. **Keep v2's bootstrap pattern** but adapt to our app structure
4. **Implement wsBridge** matching Phase 1 ws-effects interface

**Implementation details:** See the focused implementation docs for step-by-step instructions:
- Backend: `10-19-[2]-ws-infra-backend-implementation.md`
- Frontend: `10-19-[3]-ws-infra-frontend-implementation.md`
- Integration: `10-19-[4]-ws-infra-integration-testing.md`

---

## Architecture Decisions

After review and analysis, these decisions have been made for the v2 WS infrastructure:

### 1. Room Manager Implementation → Pure Data Structure

**Decision:** RoomManager is a pure data structure that tracks room membership only. Server owns client connections separately.

**Rationale:**
- Clean separation: connection lifecycle (server) vs room membership (RoomManager)
- RoomManager has no WebSocket knowledge - just tracks ConnectionIds
- Server handles broadcasting by getting member IDs from RoomManager
- Preserves v1's multi-connection semantics (multiple tabs per user via inverse index)
- Simpler, more testable design

**Implementation:** See detailed plan in Phase 2.1, Step 4 (Room Manager Design)

---

### 2. Authentication Flow → Keep Fastify Auth

**Decision:** Continue using Fastify's `req.currentUser` from auth middleware.

**Rationale:**
- Already working, battle-tested
- Cookie-based auth appropriate for web app
- V2 server adapts to existing infrastructure, not the other way around

**Implementation:**
- Fastify adapter extracts `req.currentUser` on connection
- `createContext` builds `{ userId, connectionId }` for handlers
- `getUserKey` derives a stable identifier (e.g., `user.id`) for transport-level lookups
- Handler context receives only the distilled data; transport stores just the user key

---

### 3. Message Envelope Format → Remove Domain Field

**Decision:** Use flat envelope `{ type: 'chat:send-message', payload: {...} }` - remove separate `domain` field.

**Rationale:**
- Phase 1 protocol already uses namespaced types (`'domain:message-type'`)
- Redundant to have both `domain` field and namespaced type
- Cleaner, less duplication
- Matches v2 demo pattern

**Implementation:**
- Parse domain from message type: `const domain = type.split(':')[0]`
- Router extracts domain for routing to correct handler map
- Protocol types already defined with namespaced format

---

### 4. Global vs Injected Dependencies → Module Singleton (Hybrid)

**Decision:** `wsBridge` is a module-level singleton with lazy initialization (like v2 demo).

**Rationale:**
- Effectively global (accessible from anywhere) but with explicit init
- Good enough for current needs (actions, timers, ws-effects all use bridge)
- Simpler than full dependency injection
- Can refactor to DI later if testing becomes painful

**Implementation:**
- `wsBridge` defined at module level in `apps/backend/src/ws/server-bridge.ts`
- Bootstrap calls `wsBridge.init(transport)` at startup
- Domain code imports and uses directly: `import { wsBridge } from '@/ws/server-bridge'`

---

### 5. Handler Context Shape → Data-Only (TENTATIVE)

**[TENTATIVE-PLAN]** This design needs validation during implementation.

**Recommended Decision:** Keep the handler context simple—`{ userId, connectionId }`—and define it outside the shared `ws/` module.

```ts
type AppHandlerContext = {
  userId: UserId;
  connectionId: ConnectionId;
};
```

**Rationale:**
- Handlers need to join/leave rooms for specific connections (multi-tab support)
- Keep context thin - just data needed by handlers
- Operations stay in ws-effects: `wsBridge.rooms.join(roomId, connectionId)`
- Consistent with architecture: handlers → actions → ws-effects → bridge
- Simpler context creation (no closure binding required)
- Infrastructure package (`apps/backend/src/ws/`) remains framework-agnostic; app code owns `AppHandlerContext`

**Usage pattern:**
```ts
// Handler receives data-only context
handler(payload, context: { userId, connectionId }) {
  actions.makeMove(payload.move, context);
}

// Action passes context to ws-effects
actions.makeMove(move, context) {
  // ... game logic
  wsEffects.broadcastGameUpdate(update, context.connectionId);
}

// ws-effects use bridge with connectionId
wsEffects.broadcastGameUpdate(update, excludeConnectionId) {
  wsBridge.broadcastToRoom(roomId, message, { excludeConnectionId });
}

// For room operations
wsEffects.joinGameRoom(roomId, connectionId) {
  wsBridge.rooms.join(roomId, connectionId);
}
```

**Alternative considered (operations in context):**
```ts
type AppHandlerContext = {
  userId: UserId;
  connection: {
    id: ConnectionId;
    join(roomId: RoomId): void;
    leave(roomId: RoomId): void;
  };
};
```
- Slightly more convenient: `ctx.connection.join(roomId)`
- But mixes data and behavior in context
- Requires careful closure binding to specific WsClient
- Less consistent with domain architecture

**Note:** User data (beyond userId) should be fetched explicitly by handlers that need it, not passed in context. Keeps WS layer decoupled from User shape.

---

## Phase 2 Milestones

High-level goals for WS infrastructure implementation. See implementation docs for detailed task breakdowns.

### Backend Infrastructure
- [ ] **Room Manager** - Multi-connection support, room membership tracking
- [ ] **WS Server** - Type-safe message routing with Fastify integration
- [ ] **Server Bridge** - wsBridge singleton for domain ws-effects
- [ ] **Bootstrap** - Wire all domain handlers, initialize at app startup
- [ ] **Backend domains wired** - Replace stubbed wsBridge in all backend ws-effects

### Frontend Infrastructure
- [ ] **WS Client** - Auto-reconnection, message queuing, type-safe handlers
- [ ] **Connection Store** - Zustand store synced with client state
- [ ] **Client Bridge** - wsBridge singleton for domain ws-effects
- [ ] **Bootstrap & React Integration** - useInitializeWsApp() hook, App.tsx wiring
- [ ] **Frontend domains wired** - Replace stubbed wsBridge in all frontend ws-effects

### Integration & Validation
- [ ] **WS infrastructure working** - Messages route correctly, handlers receive typed payloads
- [ ] **Multi-client support verified** - Multiple tabs/windows per user
- [ ] **Connection resilience** - Reconnection and message queuing working
- [ ] **UI integration** - Connection state visible to React components

**Note:** Domain actions are still stubbed at this point. Business logic migration happens in later phases.

---

## File Structure (Final v2)

### Backend
```
apps/backend/src/
├── ws/
│   ├── types.ts              # ConnectionId, DomainHandler, etc.
│   ├── server.ts             # createWSServer (generic)
│   ├── room-manager.ts       # Room membership tracking
│   ├── server-bridge.ts      # wsBridge singleton
│   └── index.ts              # Public exports
├── ws-handler-context.ts     # AppHandlerContext definition (app-specific)
├── ws-server-bootstrap.ts    # setupWebsocket() - wire all domains (app-specific)
├── domains/
│   ├── chat/
│   │   ├── handlers.ts       # Uses wsBridge (real)
│   │   ├── actions.ts
│   │   └── ws-effects.ts
│   ├── matchmaking/...
│   ├── gameplay/...
│   └── system/...
└── main.ts                   # Entry point (Fastify + WS initialization)
```

### Frontend
```
apps/frontend/src/
├── ws/
│   ├── types.ts              # Generic WS types
│   ├── client.ts             # WSClient class
│   ├── client-bridge.ts      # wsBridge singleton
│   ├── connection-store.ts   # Zustand store
│   └── index.ts              # Public exports
├── ws-client-bootstrap.ts    # initializeWsApp(), useInitializeWsApp() (app-specific)
├── domains/
│   ├── chat/
│   │   ├── handlers.ts
│   │   ├── actions.ts
│   │   └── ws-effects.ts     # Uses wsBridge (real)
│   ├── matchmaking/...
│   ├── gameplay/...
│   └── system/...
└── App.tsx                   # Calls useInitializeWsApp()
```

---

## Next Steps

This planning phase is complete. Proceed with implementation:

1. **Backend Implementation** → `10-19-[2]-ws-infra-backend-implementation.md`
   - Room manager, WS server, server bridge, bootstrap
   - Wire backend domains to real wsBridge

2. **Frontend Implementation** → `10-19-[3]-ws-infra-frontend-implementation.md`
   - WS client, connection store, client bridge, bootstrap
   - Wire frontend domains to real wsBridge

3. **Integration & Testing** → `10-19-[4]-ws-infra-integration-testing.md`
   - End-to-end smoke tests for all domains
   - Multi-client and connection resilience testing

**Note:** Validate TENTATIVE decisions (especially the app-owned handler context shape) during implementation

---

## Notes & Observations

### Type Safety Wins
The v2 demo's type safety is **excellent** and we should absolutely adopt it:
- Compile-time guarantees that all message types have handlers
- Payload types automatically inferred from message type
- No more `any` casts or manual type assertions

### Bridge Pattern
The `wsBridge` abstraction is brilliant:
- Domain code (ws-effects) never imports transport directly
- Makes testing possible (mock the bridge)
- Clean interface for domain authors

### Handler Signature Difference
- V1: `(data: WsServerInbound, actions: ClientWsActions) => void`
  - `data` has entire envelope + user
  - `actions` is bag of methods (join, leave, reply, broadcast)

- V2: `(payload: Payload, ctx: AppHandlerContext) => void`
  - `payload` is just the typed payload
  - `ctx` is just context (userId)
  - Handlers call actions → actions call ws-effects → ws-effects use bridge

**V2 is cleaner** - handlers don't get WS-specific methods, those live in ws-effects where they belong.

### Room Membership
Both v1 and v2 track room membership server-side. Key difference:
- V1: Rooms are part of `WebSocketManager` (tightly coupled)
- V2: `RoomManager` is separate, injected into server

We should eventually extract v1's room logic into a separate class to match v2's cleaner architecture.

### Frontend Reconnection
V1 frontend lacks reconnection logic - this is a **big win** from v2 demo. Auto-reconnection is essential for production resilience.

### Handler Context Design (TENTATIVE)
We currently assume a data-only context (`AppHandlerContext`) and keep room join/leave operations in the ws-effects layer. If this proves limiting, we could explore richer contexts that expose connection-scoped helpers, but that would revisit the concerns about mixing behaviour into the handler context. Other fallback options include:
- System domain message interception (before routing to handlers)
- Pass entire WsClient to system handlers only (special case)
- Move join/leave into ws-effects layer instead of context (current plan)

---

## Success Criteria

Phase 2 (WS Infrastructure) is complete when:
- [ ] All domain handlers receive properly typed messages
- [ ] All domain ws-effects can send messages via `wsBridge`
- [ ] Backend can broadcast to rooms and individual users
- [ ] Multi-connection support works (multiple tabs per user)
- [ ] Frontend auto-reconnects after disconnect
- [ ] Frontend queues messages when offline
- [ ] Connection state exposed to React components
- [ ] Message routing verified (send message → handler called with typed payload)
- [ ] No `any` types in WS infrastructure code
- [ ] All domain handlers use `satisfies HandlerMap<...>` pattern

**Note:** Domain actions remain stubbed. Business logic migration (Phase 3+) will make domains fully functional.
