# Frontend WS Infrastructure Implementation

**Date:** 2025-10-19 (Updated: 2025-10-20)
**Phase:** Phase 2.2 - Frontend WS Client
**Status:** Ready for Implementation

**Architecture Note:**
This doc has been updated to reflect the `ws-lib/` vs `ws/` split pattern (mirroring the backend refactor):
- Generic WS infrastructure → `ws-lib/` (fully reusable, no app dependencies)
- App-specific bootstrap/glue → `ws/` (imports from `ws-lib/`)
- `ClientBridge` made generic over `<TMessage>`
- Domain code imports from `/ws`, not `/ws-lib`

This separation ensures the infrastructure is reusable and properly decoupled from app-specific concerns.

---

## Context & Goal

**Where we are:** Phase 1 complete - all frontend domains have handlers, actions (stubbed), and ws-effects with stubbed `wsBridge`. Backend WS infrastructure is complete and working.

**What we're building:** The frontend WebSocket client that will connect to our backend:
- Type-safe client with auto-reconnection and message queuing
- Zustand store for connection state (accessible to React components)
- Client bridge that domain ws-effects will use
- Bootstrap with React integration hook
- Wire all frontend domain ws-effects

**Planning reference:** See `10-19-[1]-ws-infra-planning.md` for full v1/v2 analysis and architecture decisions.

---

## Dependencies

**Backend infrastructure must be complete** (Phase 2.1) - Frontend needs something to connect to.

---

## Scope

### What We're Building

**Generic WS Infrastructure (`ws-lib/`):**
- `apps/frontend/src/ws-lib/types.ts` - Generic WS types
- `apps/frontend/src/ws-lib/client.ts` - WSClient class with reconnection/queuing
- `apps/frontend/src/ws-lib/connection-store.ts` - Zustand store for connection state
- `apps/frontend/src/ws-lib/client-bridge.ts` - Generic ClientBridge class
- `apps/frontend/src/ws-lib/index.ts` - Public exports

**App-Specific Bootstrap (`ws/`):**
- `apps/frontend/src/ws/message-types.ts` - App-specific message type definitions
- `apps/frontend/src/ws/client-bridge-bootstrap.ts` - Instantiate bridge with app types
- `apps/frontend/src/ws/client-bootstrap.ts` - Client initialization + React hook
- `apps/frontend/src/ws/index.ts` - App-specific exports
- Update `apps/frontend/src/App.tsx` - Initialize WS client

**Note:** This mirrors the backend's `ws-lib/` vs `ws/` split for proper separation of concerns.

### What We're Wiring
- Replace stubbed `wsBridge` in all frontend domain ws-effects:
  - `domains/chat/ws-effects.ts`
  - `domains/matchmaking/ws-effects.ts`
  - `domains/gameplay/ws-effects.ts`
  - `domains/system/ws-effects.ts`

### What's NOT in Scope
- Migrating business logic into actions (actions remain stubbed)
- Integration testing (that's Phase 2.3)
- Removing v1 code (happens much later)

---

## Relevant Architecture Decisions

These decisions from the planning doc guide this implementation:

### 1. Message Format → Flat Envelope
- Use `{ type: 'domain:message-type', payload: {...} }` format
- Matches backend message format

### 2. Dependencies → Module Singleton
- wsBridge is module-level singleton with lazy initialization
- Domain code imports directly: `import { wsBridge } from '@/ws/client-bridge'`

### 3. Connection State Management
- V1's zustand store pattern (connection state exposed to components)
- Sync from v2 client's internal state via lifecycle callbacks
- Store provides reactive updates for UI (connection indicators, loading states)

### 4. Auto-Reconnection & Message Queuing
- Adopt v2 demo's auto-reconnection with exponential backoff
- Adopt v2 demo's message queuing when disconnected
- These are critical production features v1 lacks

---

## Step-by-Step Implementation

**About the code examples:** The code snippets below provide detailed implementation guidance with complete type definitions, core algorithms, and architectural patterns. TODOs mark areas where you'll make specific choices during implementation (environment variables, config values, connection timeouts, etc.).

---

### Step 1: Create Core Types

**File:** `apps/frontend/src/ws-lib/types.ts`

```ts
// Handler signature for incoming messages (generic)
export type MessageHandler<T extends { type: string; payload: any }> = (
  payload: T['payload']
) => void | Promise<void>;

// Handler map (generic)
export type HandlerMap<TMessage extends { type: string; payload: any }> = {
  [K in TMessage['type']]: MessageHandler<Extract<TMessage, { type: K }>>;
};

// Client config
export type WSClientConfig = {
  url: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onStateChange?: (state: ConnectionState) => void;
};

// Connection states
export enum ConnectionState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

// Bridge interface (generic)
export interface WsBridge<TMessage> {
  send(message: TMessage): void;
}
```

**Key points:**
- Handler signature is simpler than backend (no context needed on frontend)
- Config includes lifecycle callback for state sync
- Bridge interface is very simple (just send)

---

### Step 2: Implement WS Client

**File:** `apps/frontend/src/ws-lib/client.ts`

**Goal:** Create type-safe client with auto-reconnection and message queuing.

**Reference:** Look at v2 demo's `WSClient` class for reconnection/queuing patterns. Also reference v1's `frontend/src/services/websocket-service.ts` for existing patterns.

```ts
import type { HandlerMap, WSClientConfig, ConnectionState } from './types';

export class WSClient<
  TIncoming extends { type: string; payload: any },
  TOutgoing extends { type: string; payload: any }
> {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: HandlerMap<TIncoming>;
  private messageQueue: TOutgoing[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private config: Required<WSClientConfig>;

  constructor(url: string, handlers: HandlerMap<TIncoming>, config?: Partial<WSClientConfig>) {
    this.url = url;
    this.handlers = handlers;
    this.config = {
      url,
      reconnect: config?.reconnect ?? true,
      maxReconnectAttempts: config?.maxReconnectAttempts ?? 10,
      reconnectInterval: config?.reconnectInterval ?? 1000,
      onStateChange: config?.onStateChange ?? (() => {}),
    };

    this.connect();
  }

  private connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.ws = new WebSocket(this.url);
    this.config.onStateChange(ConnectionState.CONNECTING);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.config.onStateChange(ConnectionState.OPEN);

      // Flush queued messages
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as TIncoming;
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.config.onStateChange(ConnectionState.CLOSED);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(message: TIncoming) {
    const handler = this.handlers[message.type];
    if (!handler) {
      console.warn(`No handler for message type: ${message.type}`);
      return;
    }

    try {
      handler(message.payload);
    } catch (error) {
      console.error(`Error in handler for ${message.type}:`, error);
    }
  }

  private attemptReconnect() {
    if (!this.config.reconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    // Exponential backoff
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  send(message: TOutgoing) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      console.log('WebSocket not connected, queueing message');
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  getState(): ConnectionState {
    return this.ws?.readyState ?? ConnectionState.CLOSED;
  }
}
```

**Key characteristics:**
- Auto-reconnection with exponential backoff
- Message queuing when disconnected
- Lifecycle callback for state changes
- Type-safe message handling

**Production considerations:**
- Add max queue size limit (prevent memory issues)
- Add connection timeout handling
- Consider heartbeat/ping-pong for connection health

---

### Step 3: Implement Connection Store

**File:** `apps/frontend/src/ws-lib/connection-store.ts`

**Goal:** Zustand store that exposes connection state to React components.

**Reference:** Look at v1's `wsStore` for existing patterns.

```ts
import { create } from 'zustand';
import { ConnectionState } from './types';

interface WsConnectionStore {
  readyState: ConnectionState;
  reconnectAttempts: number;

  // Derived state
  isConnected: boolean;
  isConnecting: boolean;

  // Actions
  setReadyState: (state: ConnectionState) => void;
  setReconnectAttempts: (attempts: number) => void;
}

export const useWsConnectionStore = create<WsConnectionStore>((set, get) => ({
  readyState: ConnectionState.CLOSED,
  reconnectAttempts: 0,

  // Derived state
  get isConnected() {
    return get().readyState === ConnectionState.OPEN;
  },
  get isConnecting() {
    return get().readyState === ConnectionState.CONNECTING;
  },

  // Actions
  setReadyState: (state) => set({ readyState: state }),
  setReconnectAttempts: (attempts) => set({ reconnectAttempts: attempts }),
}));
```

**Key characteristics:**
- Simple store with connection state
- Derived selectors (isConnected, isConnecting)
- Will be synced from WSClient via callbacks

**Usage in components:**
```tsx
function ConnectionIndicator() {
  const isConnected = useWsConnectionStore((s) => s.isConnected);
  const isConnecting = useWsConnectionStore((s) => s.isConnecting);

  return (
    <div>
      {isConnecting && <span>Connecting...</span>}
      {isConnected && <span>Connected</span>}
      {!isConnected && !isConnecting && <span>Disconnected</span>}
    </div>
  );
}
```

---

### Step 4: Implement Client Bridge

**File:** `apps/frontend/src/ws-lib/client-bridge.ts`

**Goal:** Create the generic ClientBridge class (not instantiated here).

```ts
import type { WsBridge } from './types';
import type { WSClient } from './client';

class ClientBridge<TMessage> implements WsBridge<TMessage> {
  private client: WSClient<any, TMessage> | null = null;

  init(client: WSClient<any, TMessage>) {
    if (this.client) {
      throw new Error('ClientBridge already initialized');
    }
    this.client = client;
  }

  /**
   * Allow tests (or hot reloading) to explicitly clear the underlying client.
   * The main app never calls this; it keeps the singleton alive for the whole session.
   */
  reset() {
    this.client = null;
  }

  private getClient() {
    if (!this.client) {
      throw new Error('ClientBridge not initialized. Call init() first.');
    }
    return this.client;
  }

  send(message: TMessage): void {
    this.getClient().send(message);
  }
}

// Export class, not instance (instantiation happens in app-specific bootstrap)
export { ClientBridge };
```

**Key characteristics:**
- Lazy initialization pattern (throws if used before init)
- Very simple interface (just send)
- Module-level singleton

---

### Step 5: Create Public Exports (ws-lib)

**File:** `apps/frontend/src/ws-lib/index.ts`

```ts
export { WSClient } from './client';
export { ClientBridge } from './client-bridge';
export { useWsConnectionStore } from './connection-store';
export { ConnectionState } from './types';
export type { HandlerMap, MessageHandler, WSClientConfig, WsBridge } from './types';
```

---

### Step 6a: Create Message Types

**File:** `apps/frontend/src/ws/message-types.ts`

**Goal:** Define app-specific message types (re-export from protocol for convenience).

```ts
export type { ClientMessage } from '@protocol/client-messages';
export type { ServerMessage } from '@protocol/server-messages';
```

---

### Step 6b: Create Client Bridge Bootstrap

**File:** `apps/frontend/src/ws/client-bridge-bootstrap.ts`

**Goal:** Instantiate the generic ClientBridge with app-specific message types.

```ts
import { ClientBridge } from '@/ws-lib/client-bridge';
import type { ClientMessage } from './message-types';

// Export singleton instance with app types
const wsBridge = new ClientBridge<ClientMessage>();

export { wsBridge };
```

**Key:** This is where the generic infrastructure meets app-specific types.

---

### Step 6c: Create Client Bootstrap

**File:** `apps/frontend/src/ws/client-bootstrap.ts`

**Goal:** Wire all domain handlers together and provide React integration hook.

```ts
import { useEffect, useState } from 'react';
import { WSClient } from '@/ws-lib/client';
import { useWsConnectionStore } from '@/ws-lib/connection-store';
import type { HandlerMap } from '@/ws-lib/types';
import { wsBridge } from './client-bridge-bootstrap';
import type { ClientMessage, ServerMessage } from './message-types';

// Import all domain handlers
import { handlers as chatHandlers } from './domains/chat/handlers';
import { handlers as matchmakingHandlers } from './domains/matchmaking/handlers';
import { handlers as gameplayHandlers } from './domains/gameplay/handlers';
import { handlers as systemHandlers } from './domains/system/handlers';

// Merge all domain handlers into single map
const mergedHandlers: HandlerMap<ServerMessage> = {
  ...chatHandlers,
  ...matchmakingHandlers,
  ...gameplayHandlers,
  ...systemHandlers,
} satisfies HandlerMap<ServerMessage>;

// Global client instance (initialized once)
let clientInstance: WSClient<ServerMessage, ClientMessage> | null = null;

function initializeWsClient() {
  if (clientInstance) {
    return clientInstance; // Already initialized
  }

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

  clientInstance = new WSClient<ServerMessage, ClientMessage>(
    wsUrl,
    mergedHandlers,
    {
      reconnect: true,
      maxReconnectAttempts: 10,
      reconnectInterval: 1000,
      onStateChange: (state) => {
        // Sync to zustand store
        useWsConnectionStore.getState().setReadyState(state);
      },
    }
  );

  // Initialize bridge
  wsBridge.init(clientInstance);

  return clientInstance;
}

/**
 * React hook to initialize WS client.
 * Call once at app root (App.tsx).
 *
 * We deliberately do not tear the singleton down in this effect. React 18 runs
 * mount effects twice in development (Strict Mode) so that developers can catch
 * unsafe side effects. If we disconnect in the cleanup, the second mount would
 * immediately hit the "already initialized" guard and crash the app. The socket
 * is meant to live for the entire app session anyway, so teardown happens only
 * in explicit test helpers.
 */
export function useInitializeWsApp() {
  const [initialized, setInitialized] = useState(false);
  const connectionState = useWsConnectionStore((s) => s.readyState);

  useEffect(() => {
    initializeWsClient();
    setInitialized(true);
  }, []);

  return {
    initialized,
    connectionState,
  };
}

/**
 * Reset for tests (if needed)
 */
export function resetWsClientForTests() {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
  wsBridge.reset();
}
```

**Key characteristics:**
- Merges all domain handlers upfront
- Uses `satisfies` for compile-time handler completeness
- Wires state changes to zustand store
- Provides React hook for App.tsx
- Includes test reset utility

---

### Step 6d: Create App-Specific Exports

**File:** `apps/frontend/src/ws/index.ts`

```ts
export { wsBridge } from './client-bridge-bootstrap';
export { useInitializeWsApp, resetWsClientForTests } from './client-bootstrap';
export type { ClientMessage, ServerMessage } from './message-types';
```

**Note:** Domain code imports `wsBridge` from `@/ws/client-bridge-bootstrap` (or `@/ws`), NOT from `@/ws-lib`.

---

### Step 7: Update App Entry Point

**File:** `apps/frontend/src/App.tsx`

Update to initialize WS client at app root.

```tsx
import { useInitializeWsApp } from '@/ws/client-bootstrap';
import { useWsConnectionStore } from '@/ws-lib/connection-store';

function App() {
  const { initialized } = useInitializeWsApp();
  const isConnected = useWsConnectionStore((s) => s.isConnected);

  return (
    <div>
      {/* Connection indicator (optional but helpful) */}
      <ConnectionStatus />

      {/* Don't block rendering on connection */}
      {initialized && (
        <>
          {/* Your app content */}
        </>
      )}
    </div>
  );
}

function ConnectionStatus() {
  const isConnected = useWsConnectionStore((s) => s.isConnected);
  const isConnecting = useWsConnectionStore((s) => s.isConnecting);

  if (isConnecting) {
    return <div className="connection-status connecting">Connecting...</div>;
  }

  if (!isConnected) {
    return <div className="connection-status disconnected">Disconnected</div>;
  }

  return null; // Connected - don't show indicator
}
```

**Key points:**
- Call `useInitializeWsApp()` once at root
- Don't block rendering on connection (app should handle disconnected state gracefully)
- Show connection status indicator for user feedback
- Components can use `useWsConnectionStore` to react to connection state

---

### Step 8: Wire Domain WS-Effects

Replace stubbed wsBridge in all frontend domain ws-effects.

**Files to update:**
- `apps/frontend/src/domains/chat/ws-effects.ts`
- `apps/frontend/src/domains/matchmaking/ws-effects.ts`
- `apps/frontend/src/domains/gameplay/ws-effects.ts`
- `apps/frontend/src/domains/system/ws-effects.ts`

**Change:**
```ts
// Before:
const wsBridge: any = {};

// After:
import { wsBridge } from '@/ws/client-bridge-bootstrap';
// or
import { wsBridge } from '@/ws';
```

**No other changes needed** - the ws-effects interface already matches what wsBridge provides!

---

## Testing This Phase

### Tests to Run

1. **Connection & Lifecycle:**
   - App starts → client connects to backend
   - Connection state visible in UI
   - Manual disconnect backend → client attempts reconnect
   - Verify exponential backoff (check console logs)

2. **Message Sending:**
   - Send message while connected → reaches backend
   - Send message while disconnected → queued
   - Reconnect → queued messages flushed

3. **Message Receiving:**
   - Backend sends message → correct handler called
   - Handler receives typed payload
   - Stubbed action is called (proves routing works)

4. **Zustand Store Sync:**
   - Connection state changes reflected in store
   - Components re-render on state changes
   - Multiple components can read same state

5. **React Integration:**
   - `useInitializeWsApp()` initializes once
   - Cleanup on unmount works
   - No double-initialization issues

6. **Type Safety:**
   - Verify no `any` types in ws infrastructure
   - Verify handlers use `satisfies HandlerMap`
   - Verify compile-time errors for missing handlers

### Development Tools

**Browser console:**
- Check for connection logs
- Check for reconnection attempts
- Check for queued message logs

**React DevTools:**
- Inspect zustand store state
- Verify components re-render appropriately

**Network tab:**
- Verify WS connection established
- Monitor messages sent/received

### Known Limitations at This Stage

- Actions are stubbed - no real business logic yet
- Integration testing happens in Phase 2.3
- V1 code still present (will be removed later)

---

## Acceptance Criteria

Frontend WS infrastructure is complete when:

**Generic infrastructure (`ws-lib/`):**
- [ ] Core types created (`ws-lib/types.ts`)
- [ ] Client created (`ws-lib/client.ts`)
- [ ] Connection store created (`ws-lib/connection-store.ts`)
- [ ] Generic bridge created (`ws-lib/client-bridge.ts`)
- [ ] Public exports (`ws-lib/index.ts`)

**App-specific bootstrap (`ws/`):**
- [ ] Message types defined (`ws/message-types.ts`)
- [ ] Bridge instantiated (`ws/client-bridge-bootstrap.ts`)
- [ ] Client bootstrap created (`ws/client-bootstrap.ts`)
- [ ] App exports (`ws/index.ts`)
- [ ] `App.tsx` updated to initialize WS client
- [ ] All frontend domain ws-effects wired to real wsBridge
- [ ] Client connects to backend successfully
- [ ] Messages sent from frontend reach backend handlers
- [ ] Messages sent from backend reach frontend handlers
- [ ] Connection state exposed to React components (via zustand)
- [ ] Auto-reconnection works after disconnect (verify in console)
- [ ] Message queuing works (send while disconnected, verify flush on reconnect)
- [ ] No `any` types in WS infrastructure code
- [ ] All domain handlers use `satisfies HandlerMap<...>`

---

## What's Next

**Integration & Testing** → `10-19-[4]-ws-infra-integration-testing.md`

Once frontend infrastructure is working, proceed to integration testing:
- Verify end-to-end message flows for all domains
- Multi-client testing (multiple browser windows)
- Connection resilience scenarios
- UI integration verification

**Note:** Frontend can be tested independently by inspecting network traffic and console logs. Basic functionality should work before moving to integration phase!
