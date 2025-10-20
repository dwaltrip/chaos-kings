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
- Architecture decisions finalized (room manager extraction, auth flow, message format, etc.)
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
- `ws-server-bootstrap.ts` - Server initialization, wire up domain handlers (app-specific, outside ws/)

**createWSServer Approach:**

The v2 demo's `createWSServer` is a standalone WebSocket server. We need to adapt it for Fastify's plugin-based WebSocket handling.

**Key insight:** `createWSServer` contains valuable logic (typed message routing, handler dispatch, error handling), but needs to work with Fastify's connection model instead of creating its own server.

**Approach:**
```ts
// Generic server factory - framework agnostic
export function createWSServer<
  TIncoming,
  TOutgoing,
  TContext,
  TConnectionContext  // What the framework provides (e.g., User from auth)
>(config: {
  handlers: HandlerMapWithCtx<TIncoming, TContext>;
  createContext: (connectionContext: TConnectionContext, ws: WebSocket) => TContext;
  onDisconnect?: (context: TContext) => void;
  encode?: (msg: TOutgoing) => string;
  decode?: (raw: string) => TIncoming;
}) {
  const clients = new Map<ConnectionId, WsClient>();
  const roomManager = new RoomManager();

  return {
    // Fastify calls this on each connection
    handleConnection(ws: WebSocket, connectionContext: TConnectionContext) {
      const context = createContext(connectionContext, ws);
      // ... message routing, handler dispatch, cleanup
    },
    broadcast,
    broadcastToRoom,
    sendToUser,
    rooms,
  };
}
```

**Usage in Fastify:**
```ts
// main.ts
const wsServer = createWSServer<
  ClientMessage,
  ServerMessage,
  HandlerContext,
  User  // Fastify provides User from req.currentUser
>({
  handlers: mergedHandlers,
  createContext: (user, ws) => ({
    userId: user.id,
    connectionId: generateConnectionId(),
  }),
});

// Fastify route
fastify.get('/ws', { websocket: true }, (connection, req) => {
  wsServer.handleConnection(connection, req.currentUser);
});
```

**[QUESTION - Simplify Generic Parameters]:** Can we eliminate the 4th generic `TConnectionContext` and/or the `createContext` function? Possibilities:
- App code provides context directly to `handleConnection`
- May require simplifying HandlerContext to data-only (no operations)
- Consider other alternatives as well
- Evaluate during implementation to find the cleanest approach.

---

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
   
4. **Room Manager Design:**

   - **RoomManager is a pure data structure** - tracks room membership only, no WebSocket sending
   - **Server owns client connections** - separates connection lifecycle from room membership
   - **Preserve multi-connection semantics:**
     - Server maintains `clients: Map<ConnectionId, WsClient>`
     - `WsClient` shape: `{ id: ConnectionId, ws: WebSocket, user: User, log: ScopedLogger }`
     - RoomManager tracks membership by ConnectionId (not WsClient objects)
   - **RoomManager interface:**
     ```ts
     class RoomManager {
       // Pure membership tracking - no WebSocket knowledge
       join(connectionId: ConnectionId, roomId: RoomId): void;
       leave(connectionId: ConnectionId, roomId: RoomId): void;
       getMembers(roomId: RoomId): Set<ConnectionId>;
       getRoomsForConnection(connectionId: ConnectionId): Set<RoomId>;
       removeAllRooms(connectionId: ConnectionId): void;  // Cleanup on disconnect
     }
     ```
   - **Internal structure:**
     ```ts
     private rooms = new Map<RoomId, Set<ConnectionId>>;  // Which connections in which rooms
     private roomsForConnection = new Map<ConnectionId, Set<RoomId>>;  // Inverse index for cleanup
     ```
   - **Server handles broadcasting** - gets member IDs from RoomManager, looks up WsClients, sends messages
   - **Preserve v1's scoped logging:** Each client gets unique logger with connection ID prefix
   - **Add runtime validation:** Message envelope validation (type, payload present), graceful error handling
   
5. **Bridge Interface:**

   ```ts
   // Broadcast options - exclude specific connection (for multi-tab support)
   type BroadcastOptions = {
     excludeConnectionId?: ConnectionId;
   };

   interface WsBridge {
     broadcast(message: ServerMessage, opts?: BroadcastOptions): void;
     broadcastToRoom(roomId: string, message: ServerMessage, opts?: BroadcastOptions): void;
     sendToUser(userId: string, message: ServerMessage): void;
     rooms: RoomMembershipAdapter;
   }
   ```

   **Note on multi-tab support:** When a user sends a message (e.g., makes a move in a game), we want to:
   - Broadcast to all OTHER connections in the room
   - Exclude the SPECIFIC tab that sent the message (not all of the user's tabs)
   - Example: User has 3 tabs open in same game room. Tab A sends a move. We broadcast to Tab B, Tab C, and all other players - but NOT back to Tab A.
   - This is why we exclude by `ConnectionId` (specific tab) not `UserId` (all tabs).

6. **Key Types:**

   - **ConnectionId** - Unique identifier for each WebSocket connection
     ```ts
     // In apps/backend/src/ws/types.ts

     // Connection identifier (generated by server via UUID)
     // NOTE: Consider making this a branded type for additional type safety
     type ConnectionId = string;
     ```
   - Generated by server when client connects: `client-${uuidv4()}`
   - Not exposed to kernel/domain layer - purely WS infrastructure
   - Used for scoped logging, room membership tracking, and multi-tab support
   - Stored in `WsClient.id` and used throughout RoomManager

7. **Fastify Integration Details:**
   - **Adapter responsibilities:**
     1. Extract `req.currentUser` from Fastify auth middleware
     2. Create WsClient: `{ id: uuidv4(), ws: socket, user, log: createScopedLogger() }`
     3. Add to server's clients Map: `clients.set(client.id, client)`
     4. On incoming message: decode → route to typed handler → pass `{ userId, connectionId }` context
     5. On close/error: cleanup rooms (`roomManager.removeAllRooms(client.id)`) + remove client (`clients.delete(client.id)`)
   - **createWSServer adaptation:**
     - Not a standalone ws.WebSocketServer - adapts to Fastify's websocket plugin
     - Wraps v2 demo's typed handler patterns around Fastify's connection handling
     - Server owns clients Map, RoomManager tracks membership only

8. **Implementation Approach:**
   - Implement v2 in `apps/backend/src/ws/`
   - Update `main.ts` to use v2 WebSocket server
   - Keep v1 code (`backend/src/websocket/`) temporarily as reference
   - Delete v1 code once v2 is working and tested

#### Step 2: Wire Backend Bridge to Domains

**Changes to Domain Files:**
- `apps/backend/src/domains/*/ws-effects.ts` - Replace stub with real bridge import
  ```ts
  // Before:
  const wsBridge: any = {};

  // After:
  import { wsBridge } from '@/ws/server-bridge';
  ```

**No other changes needed** - ws-effects interface already matches!

---

### Phase 2.2: Frontend Bridge & Client

**Goal:** Implement frontend WS client that v2 domains can use.

#### Step 1: Create Type-Safe Client (`apps/frontend/src/ws/`)

**New Files:**
- `ws/types.ts` - Generic WS types (HandlerMap, etc.)
- `ws/client.ts` - Adapt v2 demo `WSClient` class
- `ws/client-bridge.ts` - Frontend `wsBridge` implementation
- `ws/connection-store.ts` - Zustand store for connection state (adapt v1)
- `ws-client-bootstrap.ts` - Client initialization with all domain handlers (app-specific, outside ws/)

**Key Decisions:**

1. **Connection State Management:**
   - Keep v1's zustand store pattern (`ws/connection-store.ts`)
   - Sync from v2 client's internal state via lifecycle callbacks
   - **Sync mechanism:**
     - WSClient maintains internal state (connecting/open/closed)
     - WSClient exposes optional lifecycle callbacks (onStateChange)
     - Bootstrap wires callbacks → zustand store updates
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
  import { wsBridge } from '@/ws/client-bridge';
  ```

---

### Phase 2.3: Integration & Testing

**Goal:** Wire everything together end-to-end.

#### Backend Integration
1. Update `apps/backend/src/main.ts`:
   - Import new `setupWebsocketV2()` from `ws/bootstrap.ts`
   - Replace v1 with v2 WebSocket server
   - Wire Fastify `/ws` route to v2 server

2. Test each domain's WebSocket flow:
   - Chat: send message, receive broadcast
   - Matchmaking: join queue, receive match
   - Gameplay: join room, receive game state updates

#### Frontend Integration
1. Update `apps/frontend/src/App.tsx`:
   - Call `useInitializeWsApp()` at root (don't block rendering)
   - Show connection status indicator in UI
   - Components handle disconnected state gracefully

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
- Passes to `roomManager.addClient(socket, user, log)`
- Handler context receives `userId` extracted from user

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

**Recommended Decision:** Keep HandlerContext simple - data only, no operations.

```ts
type HandlerContext = {
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
type HandlerContext = {
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

## Implementation Checklist

### Backend
- [ ] Create `apps/backend/src/ws/types.ts` with core types
- [ ] Implement `apps/backend/src/ws/room-manager.ts` - extract from v1, preserve multi-connection support
- [ ] Add scoped logging to room manager (per-client logger with connection ID)
- [ ] Add runtime message validation (envelope structure, type guards for critical fields)
- [ ] Implement `apps/backend/src/ws/server.ts` with Fastify integration
- [ ] Implement `apps/backend/src/ws/server-bridge.ts` matching expected interface
- [ ] Implement `apps/backend/src/ws-server-bootstrap.ts` to wire all domain handlers
- [ ] Update `apps/backend/src/main.ts` to initialize v2 WS server
- [ ] Replace stubbed `wsBridge` in all `domains/*/ws-effects.ts`
- [ ] Test multi-connection support (multiple tabs per user)
- [ ] Test each domain's WebSocket flow

### Frontend
- [ ] Create `apps/frontend/src/ws/types.ts` with app message types
- [ ] Implement `apps/frontend/src/ws/client.ts` (adapt v2 demo)
- [ ] Implement `apps/frontend/src/ws/connection-store.ts` (zustand)
- [ ] Wire WSClient state changes → zustand store (lifecycle callbacks)
- [ ] Implement `apps/frontend/src/ws/client-bridge.ts`
- [ ] Implement `apps/frontend/src/ws-client-bootstrap.ts` with all domain handlers
- [ ] Export `useInitializeWsApp()` hook from `ws-client-bootstrap.ts`
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
│   ├── server.ts             # createWSServer (generic)
│   ├── room-manager.ts       # Room membership tracking
│   ├── server-bridge.ts      # wsBridge singleton
│   └── index.ts              # Public exports
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
