# WebSocket Infrastructure Integration Plan

**Date:** 2025-10-18 (Updated after review session)
**Phase:** Phase 2 - WS Infrastructure
**Status:** Planning - Ready for Implementation

---

## Overview

This doc analyzes the existing v1 WebSocket infrastructure and the demo v2 implementation, then proposes an integration strategy to create the final v2 WS infrastructure that powers our domain-based architecture.

**Context:** Phase 1 is complete - all domains have handlers, actions (stubbed), and ws-effects with stubbed `wsBridge`. Now we need to implement the real WS infrastructure that connects everything.

**Update (post-review):** This doc has been updated with:
- Critical gaps identified (multi-connection support, Fastify integration details)
- Architecture decisions finalized (room manager extraction, parallel deployment, auth flow, etc.)
- Detailed implementation plan for room manager, Fastify integration, Zustand sync
- Implementation checklists expanded with logging and validation tasks
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

---

## Detailed Integration Plan

### Phase 2.1: Backend Bridge & Server

**Goal:** Implement backend WS infrastructure that v2 domains can use.

#### Step 1: Create Type-Safe Server (`apps/backend/src`)

**New Files:**

- `main.ts` - backend entry point, in top-level `src/` folder. calls initialization code for ws server as well fastify server
  - This is where the ws server receives actual domain information (via TS type params for message types / maps)
  - IMPORTANT: `ws/*` code is completely agnostic to actual app / domain code, functions as a lib that app code uses
  - See `backend/src/server.ts` from v1 as well as from the demo
  - Renaming to `main.ts` to make it more obvious as entry point, and to distinguish from `ws/server.ts`
- `ws/types.ts` - Import/adapt types from demo, match v2 protocol
- `ws/server.ts` - Adapt `createWSServer` for Fastify integration
- `ws/room-manager.ts` - Start with v1's room manager, may swap in v2's later
- `ws/server-bridge.ts` - Create `wsBridge` matching demo interface
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
   
   - Base: `HandlerContext = { userId: UserId }`
   - Extract userId from authenticated user on connection
   - **[TENTATIVE-PLAN]** Extended with connection-scoped operations:
     ```ts
     type HandlerContext = {
       userId: UserId;
       connection: {
         id: ConnectionId;          // stable per socket/tab
         join(roomId: RoomId): void;
         leave(roomId: RoomId): void;
       };
     };
     ```
   - **Rationale:** Handlers/actions need to join/leave rooms for specific connections (multi-tab support)
   - **Alternative:** System domain intercepts join/leave messages before routing (tighter coupling)
   - **Note:** User data (beyond userId) should be fetched explicitly by handlers that need it, not passed in context
   
4. **Room Manager Extraction:**
   
   - **Extract v1's `ClientStore` and room logic** from `backend/src/websocket/manager.ts` into new `apps/backend/src/ws/room-manager.ts`
   - **Preserve multi-connection semantics:**
     - `ClientStore` maps WebSocket → WsClient (unique client IDs)
     - `rooms: Map<RoomId, Set<WsClient>>` - which connections in which rooms
     - `WsClient.rooms: Set<RoomId>` - inverse tracking for cleanup
     - `WsClient` shape: `{ id: ConnectionId, ws: WebSocket, rooms: Set<RoomId>, user: User, log: ScopedLogger }`
   - **Interface:**
     ```ts
     interface RoomManager {
       addClient(ws: WebSocket, user: User, log: ScopedLogger): WsClient;
       removeClient(client: WsClient): void;
       join(client: WsClient, roomId: RoomId): void;
       leave(client: WsClient, roomId: RoomId): void;
       broadcastToRoom(roomId: RoomId, data: WsServerOutbound, opts?: BroadcastOptions): void;
       serverBroadcastToRoom(roomId: RoomId, data: WsServerOutbound): void;
       sendToUser(userId: UserId, data: WsServerOutbound): void;
     }
     ```
   - **Preserve v1's scoped logging:** Each client gets unique logger with connection ID prefix
   - **Add runtime validation:** Message envelope validation (type, payload present), graceful error handling
   
5. **Bridge Interface:**
   
   ```ts
   interface WsBridge {
     broadcast(message: ServerMessage, opts?: BroadcastOptions): void;
     broadcastToRoom(roomId: string, message: ServerMessage, opts?: BroadcastOptions): void;
     sendToUser(userId: string, message: ServerMessage): void;
     rooms: RoomMembershipAdapter;
   }
   ```

6. **Fastify Integration Details:**
   - **Shared `/ws` route:** Both v1 and v2 can coexist using env flag to choose which initializes
   - **Adapter responsibilities:**
     1. Extract `req.currentUser` from Fastify auth middleware
     2. Create scoped logger for connection
     3. Call `roomManager.addClient(socket, user, log)` → get WsClient
     4. On incoming message: decode → route to typed handler → pass `{ userId, connection }` context
     5. On close/error: call `roomManager.removeClient(client)` → auto-cleanup rooms
   - **Env flag toggle:** `USE_WS_V2=true/false` determines which server initializes
   - **createWSServer adaptation:**
     - Not a standalone ws.WebSocketServer - adapts to Fastify's websocket plugin
     - Wraps v2 demo's typed handler patterns around Fastify's connection handling
     - Delegates connection/room lifecycle to RoomManager

7. **Migration Path:**
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

*Questions:* can / should `ws/types.ts` and `ws/bootstrap.ts` be moved outside `ws` folder to keep `ws` more of a generic lib with no domain / app knowledge?

**Key Decisions:**

1. **Connection State Management:**
   - Keep v1's zustand store pattern (`ws/connection-store.ts`)
   - Sync from v2 client's internal state
   - **Sync mechanism:**
     - WSClient maintains internal state (connecting/open/closed)
     - Bootstrap wires WSClient state changes → zustand store updates
     - Approach: Add optional lifecycle callbacks to WSClient (onStateChange)
     - Or: Poll client.readyState on interval and update store
   - **Store interface:**
     ```ts
     interface WsConnectionStore {
       readyState: number; // WebSocket.CONNECTING | OPEN | CLOSING | CLOSED
       isConnected: boolean;
       isConnecting: boolean;
       reconnectAttempts: number;
       setReadyState(state: number): void;
     }
     ```
   - **Exposed to components:** Via zustand selectors for reactive updates

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

## Architecture Decisions

After review and analysis, these decisions have been made for the v2 WS infrastructure:

### 1. Room Manager Implementation → Extract v1's Logic (Option B)

**Decision:** Extract v1's `ClientStore` and room bookkeeping from `WebSocketManager` into a new `RoomManager` class.

**Rationale:**
- Better separation of concerns (room management vs connection handling)
- Preserves v1's proven multi-connection semantics (multiple tabs per user)
- Matches v2's clean architecture pattern
- Keeps v1's rich features (scoped logging, UUID client IDs, inverse room tracking)

**Implementation:** See detailed plan in Phase 2.1, Step 4 (Room Manager Extraction)

---

### 2. Migration Strategy → Parallel Deployment (Option A)

**Decision:** Run v1 and v2 WS servers in parallel initially, controlled by env flag.

**Rationale:**
- Safe - can test v2 without breaking existing v1 functionality
- Easy rollback if issues discovered
- Gradual confidence building before full cutover

**Implementation:**
- Env flag: `USE_WS_V2=true/false`
- Both servers can share `/ws` route (only one initializes based on flag)
- Delete v1 code once v2 proven stable in production

---

### 3. Authentication Flow → Keep Fastify Auth (Option A)

**Decision:** Continue using Fastify's `req.currentUser` from auth middleware.

**Rationale:**
- Already working, battle-tested
- Cookie-based auth appropriate for web app
- V2 server adapts to existing infrastructure, not the other way around

**Implementation:**
- Fastify adapter extracts `req.currentUser` on connection
- Passes to `roomManager.addClient(socket, user, log)`
- Handler context receives `userId` extracted from user

---

### 4. Message Envelope Format → Remove Domain Field (Option B)

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

### 5. Global vs Injected Dependencies → Module Singleton (Hybrid)

**Decision:** `wsBridge` is a module-level singleton with lazy initialization (like v2 demo).

**Rationale:**
- Effectively global (accessible from anywhere) but with explicit init
- Good enough for current needs (actions, timers, ws-effects all use bridge)
- Simpler than full dependency injection
- Can refactor to DI later if testing becomes painful

**Implementation:**
- `wsBridge` defined at module level in `apps/backend/src/ws/bridge.ts`
- Bootstrap calls `wsBridge.init(transport)` at startup
- Domain code imports and uses directly: `import { wsBridge } from '@/ws/bridge'`

---

### 6. Handler Context Shape → userId + Connection Ops (TENTATIVE)

**[TENTATIVE-PLAN]** This design needs validation during implementation.

**Decision:** Extend `HandlerContext` with connection-scoped operations for multi-tab support.

```ts
type HandlerContext = {
  userId: UserId;
  connection: {
    id: ConnectionId;          // stable per socket/tab
    join(roomId: RoomId): void;
    leave(roomId: RoomId): void;
  };
};
```

**Rationale:**
- Handlers/actions need to join/leave rooms for specific connections (not all tabs of a user)
- Connection-scoped join/leave closures bound to specific WsClient
- Keeps domain code pure - they call actions, actions use `ctx.connection.join(roomId)`
- Server-initiated broadcasts (timers, bots) use `wsBridge` directly (no context)

**Alternatives considered:**
- System domain intercepts join/leave messages (breaks domain-driven flow)
- Special-case system domain with richer context (leaks transport concerns)

**Note:** User data (beyond userId) should be fetched explicitly by handlers that need it, not passed in context. Keeps WS layer decoupled from User shape.

---

## Implementation Checklist

### Backend
- [ ] Create `apps/backend/src/ws/types.ts` with core types
- [ ] Implement `apps/backend/src/ws/room-manager.ts` - extract from v1, preserve multi-connection support
- [ ] Add scoped logging to room manager (per-client logger with connection ID)
- [ ] Add runtime message validation (envelope structure, type guards for critical fields)
- [ ] Implement `apps/backend/src/ws/server.ts` with Fastify integration
- [ ] Implement `apps/backend/src/ws/bridge.ts` matching expected interface
- [ ] Implement `apps/backend/src/ws/bootstrap.ts` to wire all domain handlers
- [ ] Update `apps/backend/src/server.ts` to initialize v2 WS server (env flag toggle)
- [ ] Replace stubbed `wsBridge` in all `domains/*/ws-effects.ts`
- [ ] Test multi-connection support (multiple tabs per user)
- [ ] Test each domain's WebSocket flow

### Frontend
- [ ] Create `apps/frontend/src/ws/types.ts` with app message types
- [ ] Implement `apps/frontend/src/ws/client.ts` (adapt v2 demo)
- [ ] Implement `apps/frontend/src/ws/connection-store.ts` (zustand)
- [ ] Wire WSClient state changes → zustand store (lifecycle callbacks or polling)
- [ ] Implement `apps/frontend/src/ws/client-bridge.ts`
- [ ] Implement `apps/frontend/src/ws/bootstrap.ts` with all domain handlers
- [ ] Export `useInitializeWsApp()` hook from `ws/index.ts`
- [ ] Update `apps/frontend/src/App.tsx` to initialize WS
- [ ] Replace stubbed `wsBridge` in all `domains/*/ws-effects.ts`
- [ ] Verify connection state exposed to React components
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

1. ✅ **Review complete** - Strategy validated, architecture decisions made
2. ✅ **Critical gaps identified** - Multi-connection support, Fastify integration details
3. **Create implementation session prompt** - Detailed step-by-step for Phase 2.1 (backend)
4. **Implement Phase 2.1** - Backend: room-manager, server, bridge, bootstrap
5. **Implement Phase 2.2** - Frontend: client, bridge, zustand sync, bootstrap
6. **Implement Phase 2.3** - Integration & end-to-end testing
7. **Validate TENTATIVE decisions** - Especially handler context shape during implementation

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

### Handler Context Design (TENTATIVE)
The proposed `HandlerContext` with connection-scoped operations (join/leave) is marked **[TENTATIVE-PLAN]** because:
- It's a new pattern not present in either v1 or v2 demo
- Needs validation that the closure-binding approach works cleanly
- May discover simpler alternatives during implementation
- Should be reviewed critically when implementing system domain handlers

If this pattern proves awkward, alternatives include:
- System domain message interception (before routing to handlers)
- Pass entire WsClient to system handlers only (special case)
- Move join/leave into ws-effects layer instead of context

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
