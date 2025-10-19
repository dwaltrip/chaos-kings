# WebSocket Infrastructure Integration Plan

**Date:** 2025-10-18
**Phase:** Phase 2 - WS Infrastructure
**Status:** Planning

---

## Overview

This doc analyzes the existing v1 WebSocket infrastructure and the demo v2 implementation, then proposes an integration strategy to create the final v2 WS infrastructure that powers our domain-based architecture.

**Context:** Phase 1 is complete - all domains have handlers, actions (stubbed), and ws-effects with stubbed `wsBridge`. Now we need to implement the real WS infrastructure that connects everything.

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
4. **Production-tested** - V1 is working code, battle-tested in the codebase
5. **Scoped Logging** - V1 has detailed per-client logging via `ScopedLogger`
6. **UUID-based Client IDs** - V1 generates unique client IDs for tracking

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
3. **Keep v1's room manager** (or adapt v2's, TBD based on needs)
4. **Create new bootstrap** that wires to v2 domain handlers
5. **Implement wsBridge** matching the interface Phase 1 domains expect

**Frontend:**
1. **Start with v2 demo client** (reconnection, queuing, types)
2. **Add v1's zustand store integration** for connection state
3. **Keep v2's bootstrap pattern** but adapt to our app structure
4. **Implement wsBridge** matching Phase 1 ws-effects interface

---

## Detailed Integration Plan

### Phase 2.1: Backend Bridge & Server

**Goal:** Implement backend WS infrastructure that v2 domains can use.

#### Step 1: Create Type-Safe Server (`apps/backend/src/ws/`)

**New Files:**
- `ws/types.ts` - Import/adapt types from demo, match v2 protocol
- `ws/server.ts` - Adapt `createWSServer` for Fastify integration
- `ws/room-manager.ts` - Start with v1's room manager, may swap in v2's later
- `ws/bridge.ts` - Create `wsBridge` matching demo interface
- `ws/bootstrap.ts` - Server initialization, wire up domain handlers

**Key Decisions:**

1. **Fastify Integration:**
   - Keep v1's `WebSocketManager.handleConnection(connection, req)` pattern
   - Extract `req.currentUser` for auth (v1 approach)
   - But internally use v2's typed message handling

2. **Handler Wiring:**
   - Import all domain handlers from `apps/backend/src/domains/*/handlers.ts`
   - Merge into single `HandlerMapWithCtx<ClientMessage, HandlerContext>`
   - Use v2 pattern: `{ 'chat:send-message': (payload, ctx) => ... }`

3. **Context:**
   - `HandlerContext = { userId: UserId }` (already defined in v2 domains)
   - Extract from authenticated user on connection

4. **Bridge Interface:**
   ```ts
   interface WsBridge {
     broadcast(message: ServerMessage, opts?: BroadcastOptions): void;
     broadcastToRoom(roomId: string, message: ServerMessage, opts?: BroadcastOptions): void;
     sendToUser(userId: string, message: ServerMessage): void;
     rooms: RoomMembershipAdapter;
   }
   ```

5. **Migration Path:**
   - V1 `WebSocketManager` stays in place (keep v1 code working)
   - New v2 server in `apps/backend/src/ws/`
   - Bootstrap can choose which to use (flag/env var?)
   - Gradually migrate v1 domains to v2 pattern

#### Step 2: Wire Backend Bridge to Domains

**Changes to Domain Files:**
- `apps/backend/src/domains/*/ws-effects.ts` - Replace stub with real bridge import
  ```ts
  // Before:
  const wsBridge: any = {};

  // After:
  import { wsBridge } from '@/ws/bridge';
  ```

**No other changes needed** - ws-effects interface already matches!

---

### Phase 2.2: Frontend Bridge & Client

**Goal:** Implement frontend WS client that v2 domains can use.

#### Step 1: Create Type-Safe Client (`apps/frontend/src/ws/`)

**New Files:**
- `ws/types.ts` - App-specific message types
- `ws/client.ts` - Adapt v2 demo `WSClient` class
- `ws/client-bridge.ts` - Frontend `wsBridge` implementation
- `ws/bootstrap.ts` - Client initialization with all domain handlers
- `ws/connection-store.ts` - Zustand store for connection state (adapt v1)

**Key Decisions:**

1. **Connection State Management:**
   - Keep v1's zustand store pattern
   - But populate from v2 client's internal state
   - Expose: `isConnected`, `isConnecting`, `readyState`

2. **Handler Wiring:**
   - Import all domain handlers from `apps/frontend/src/domains/*/handlers.ts`
   - Merge into `HandlerMap<ServerMessage>`
   - Bootstrap creates client with all handlers upfront (v2 pattern)

3. **React Integration:**
   - Provide `useInitializeWsApp()` hook (from v2 demo)
   - Call once in root `App.tsx`
   - Returns connection state

4. **Bridge Interface:**
   ```ts
   interface WsBridge {
     send(message: ClientMessage): void;
   }
   ```

5. **Reconnection & Queuing:**
   - Use v2 demo's auto-reconnection (exponential backoff)
   - Use v2 demo's message queuing
   - Configure retry attempts via env/config

#### Step 2: Wire Frontend Bridge to Domains

**Changes to Domain Files:**
- `apps/frontend/src/domains/*/ws-effects.ts` - Replace stub with real bridge
  ```ts
  // Before:
  const wsBridge: any = {};

  // After:
  import { wsBridge } from '@/ws/bridge';
  ```

---

### Phase 2.3: Integration & Testing

**Goal:** Wire everything together end-to-end.

#### Backend Integration
1. Update `apps/backend/src/server.ts`:
   - Import new `setupWebsocketV2()` from `ws/bootstrap.ts`
   - Either replace v1 or run both (feature flag)
   - Wire Fastify `/ws` route to v2 server

2. Test each domain's WebSocket flow:
   - Chat: send message, receive broadcast
   - Matchmaking: join queue, receive match
   - Gameplay: join room, receive game state updates

#### Frontend Integration
1. Update `apps/frontend/src/App.tsx`:
   - Call `useInitializeWsApp()` at root
   - Wait for connection before rendering app?

2. Test each domain's WebSocket flow:
   - Chat: send message, receive others' messages
   - Matchmaking: join queue, see queue updates
   - Gameplay: join game, see board updates

#### End-to-End Smoke Tests
- Full chat flow
- Full matchmaking → game creation flow
- Multi-client game (two browser windows)

---

## Open Questions & Decisions Needed

### 1. Room Manager Implementation
**Question:** Use v1's `WebSocketManager` room logic or v2 demo's `RoomManager`?

**Options:**
- **A)** Keep v1's room management (embedded in `WebSocketManager`)
  - ✅ Already working, tested
  - ❌ Tightly coupled to manager class

- **B)** Extract v1's room logic into separate class (like v2)
  - ✅ Better separation of concerns
  - ✅ Matches v2 pattern
  - ⚠️ Refactoring work

- **C)** Use v2 demo's `RoomManager` as-is
  - ✅ Clean, simple implementation
  - ⚠️ Marked "for demo purposes" - may need hardening
  - ⚠️ Different API surface than v1

**Recommendation:** Start with **Option A** (keep v1's room management), migrate to **Option B** later if needed. Don't block on this.

---

### 2. Migration Strategy
**Question:** Run v1 and v2 WS servers in parallel, or cut over all at once?

**Options:**
- **A)** Parallel - Feature flag to choose which server to use
  - ✅ Safe, can test v2 without breaking v1
  - ✅ Easy rollback
  - ❌ More code to maintain temporarily
  - ❌ Client needs to connect to right endpoint

- **B)** Cut over - Replace v1 with v2 in one change
  - ✅ Cleaner, less code
  - ❌ Riskier - if v2 breaks, entire app broken
  - ❌ Harder to debug issues

**Recommendation:** **Option A** initially - run in parallel with env flag. Once v2 proven stable, delete v1 code.

---

### 3. Authentication Flow
**Question:** How does v2 server get authenticated user for WebSocket connections?

**Context:** V1 uses Fastify's `req.currentUser` which is populated by auth middleware that validates cookies.

**Options:**
- **A)** Keep Fastify auth exactly as-is
  - Use v1's pattern: extract `req.currentUser` on connection
  - V2 server `onConnection` hook receives userId from this

- **B)** Token-based auth (send token in first WS message)
  - Client sends auth token after connecting
  - Server validates and associates connection with user
  - More complex, may not be needed

**Recommendation:** **Option A** - keep Fastify auth. V2 server adapts to Fastify, not the other way around.

---

### 4. Message Envelope Format
**Question:** Do we keep the `{ domain, type, payload }` envelope or flatten it?

**Context:**
- V1 uses: `{ domain: 'chat', type: 'send-message', payload: {...} }`
- V2 demo uses flat: `{ type: 'chat:send-message', payload: {...} }`
- Our Phase 1 protocol uses namespaced types: `'chat:send-message'`

**Implication:** The `domain` field is redundant if type is namespaced.

**Options:**
- **A)** Keep domain field (v1 approach)
  - ✅ Explicit domain routing
  - ❌ Redundant with namespaced type

- **B)** Remove domain field, parse from type (v2 approach)
  - ✅ Cleaner, less redundancy
  - ✅ Matches v2 demo pattern
  - ⚠️ Need to parse `domain` from `type` for routing

**Recommendation:** **Option B** - remove `domain` field. Parse domain from message type (`type.split(':')[0]`). Cleaner long-term.

---

### 5. Global vs Injected Dependencies
**Question:** Keep v1's global manager pattern or use v2's dependency injection?

**Context:**
- V1: `getGlobalWebSocketManager()` - accessible from anywhere
- V2: `wsBridge.init(transport)` - injected at startup

**For domain code:**
- ws-effects already use `wsBridge` (good!)
- Backend actions may need to trigger broadcasts (e.g., timer ticks)

**Options:**
- **A)** Global bridge
  - Backend: `getWsBridge()` - accessible anywhere
  - ❌ Makes testing harder
  - ✅ Convenient for actions, timers, etc.

- **B)** Injected bridge
  - Pass bridge to actions that need it
  - ✅ Better for testing
  - ⚠️ More boilerplate

**Recommendation:** Hybrid - `wsBridge` is a **module-level singleton** (like demo), but lazy-initialized. Effectively global but with explicit init. Good enough for now.

---

## Implementation Checklist

### Backend
- [ ] Create `apps/backend/src/ws/types.ts` with core types
- [ ] Implement `apps/backend/src/ws/room-manager.ts` (or adapt v1's)
- [ ] Implement `apps/backend/src/ws/server.ts` with Fastify integration
- [ ] Implement `apps/backend/src/ws/bridge.ts` matching expected interface
- [ ] Implement `apps/backend/src/ws/bootstrap.ts` to wire all domain handlers
- [ ] Update `apps/backend/src/server.ts` to initialize v2 WS server
- [ ] Replace stubbed `wsBridge` in all `domains/*/ws-effects.ts`
- [ ] Test each domain's WebSocket flow

### Frontend
- [ ] Create `apps/frontend/src/ws/types.ts` with app message types
- [ ] Implement `apps/frontend/src/ws/client.ts` (adapt v2 demo)
- [ ] Implement `apps/frontend/src/ws/connection-store.ts` (zustand)
- [ ] Implement `apps/frontend/src/ws/client-bridge.ts`
- [ ] Implement `apps/frontend/src/ws/bootstrap.ts` with all domain handlers
- [ ] Export `useInitializeWsApp()` hook from `ws/index.ts`
- [ ] Update `apps/frontend/src/App.tsx` to initialize WS
- [ ] Replace stubbed `wsBridge` in all `domains/*/ws-effects.ts`
- [ ] Test each domain's WebSocket flow

### Integration
- [ ] End-to-end smoke test: chat
- [ ] End-to-end smoke test: matchmaking
- [ ] End-to-end smoke test: gameplay
- [ ] Multi-client test (two browsers)
- [ ] Connection state reflected in UI
- [ ] Reconnection works after disconnect
- [ ] Message queuing works when offline

### Cleanup (Later)
- [ ] Remove v1 `backend/src/websocket/` directory
- [ ] Remove v1 `frontend/src/services/websocket-service.ts`
- [ ] Remove demo files from epic folder
- [ ] Update documentation

---

## File Structure (Final v2)

### Backend
```
apps/backend/src/
├── ws/
│   ├── types.ts              # HandlerContext, DomainHandler, etc.
│   ├── server.ts             # createWSServer (Fastify-adapted)
│   ├── room-manager.ts       # Room membership tracking
│   ├── bridge.ts             # wsBridge singleton
│   ├── bootstrap.ts          # setupWebsocket() - wire all domains
│   └── index.ts              # Public exports
├── domains/
│   ├── chat/
│   │   ├── handlers.ts       # Uses wsBridge (real)
│   │   ├── actions.ts
│   │   └── ws-effects.ts
│   ├── matchmaking/...
│   ├── gameplay/...
│   └── system/...
└── server.ts                 # Fastify app (calls setupWebsocket)
```

### Frontend
```
apps/frontend/src/
├── ws/
│   ├── types.ts              # AppIncomingMessage, AppOutgoingMessage
│   ├── client.ts             # WSClient class
│   ├── client-bridge.ts      # wsBridge singleton
│   ├── connection-store.ts   # Zustand store
│   ├── bootstrap.ts          # initializeWsApp(), useInitializeWsApp()
│   └── index.ts              # Public exports
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

1. **Review this doc** - Confirm strategy makes sense
2. **Decide on open questions** - Especially room manager approach
3. **Create implementation session prompt** - Detailed step-by-step for Phase 2.1
4. **Implement Phase 2.1** - Backend bridge & server
5. **Implement Phase 2.2** - Frontend bridge & client
6. **Implement Phase 2.3** - Integration & testing

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

- V2: `(payload: Payload, ctx: HandlerContext) => void`
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

---

## Success Criteria

Phase 2 is complete when:
- [ ] All domain handlers receive properly typed messages
- [ ] All domain ws-effects can send messages via `wsBridge`
- [ ] Backend can broadcast to rooms and individual users
- [ ] Frontend auto-reconnects after disconnect
- [ ] Frontend queues messages when offline
- [ ] Connection state exposed to React components
- [ ] At least one domain works end-to-end (suggest: chat)
- [ ] No `any` types in WS infrastructure
- [ ] All domain handlers use `satisfies HandlerMap<...>` pattern
