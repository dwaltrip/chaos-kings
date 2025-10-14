# [WIP] WebSocket Architecture Patterns

This document explains the WebSocket architecture we validated in the demo repository and records how to reproduce it inside the real monorepo. The notes are reference material for the upcoming refactor: they highlight the boundaries we care about, describe how the pieces collaborate, and double-check that the patterns map cleanly onto the target folder layout. Examples use lightweight demo domains purely to ground the discussion. When the time comes to implement the architecture in production, substitute the real domains while keeping the same relationships between protocol definitions, adapters, stores, and effects.

The design emphasizes a few outcomes:
- **Type safety** across the full stack
- **Easy extensibility** when adding new message types
- **Clean separation** between transport and domain logic
- **Ergonomic APIs** for sending and handling messages

## Module Structure

The monorepo keeps responsibilities explicit so transport code never leaks into domain code and vice versa:

- **`packages/kernel/`** – Minimal primitives (branded IDs, timestamps) shared everywhere else.
- **`packages/protocol/`** – Wire types, message definitions, DTOs. Only describes what goes over the wire.
- **`packages/platform/`** – Shared domain types, entities, value objects used by both backend and frontend.
- **`packages/core/`** – Game-specific domain logic
- **`packages/utils/`** – Generic helper functions and utilities. No business logic.
- **`apps/backend/`** – Server adapters: handlers, actions, persistence, mapping.
- **`apps/frontend/`** – Client adapters: hooks, stores, components, UI logic.

Protocol depends only on `kernel` primitives. Platform/core have no knowledge of protocol. Apps bridge between protocol (wire) and domain (platform/core).

In each app and package, where relevant, domain code will be in named sub-folders of `domains`. Example:

* `apps/backend/domains/chat`
* `apps/frontend/domains/chat`
* `packages/protocol/domains/chat`
* `packages/platform/domains/chat`

### Why platform and protocol stay separate

`@platform` captures the canonical domain vocabulary—entities, value objects, validation helpers, and shared rules that both runtime targets care about. These types stay pure: no transport metadata, no persistence adapters, just the business language of the app. `@protocol`, by contrast, owns the exact shapes that cross the wire: “snapshots” tailored for clients, DTOs designed for backward compatibility, codecs for validation. The two layers rarely match one-to-one, and that is by design. When a domain entity evolves (new moderation flags, optional metadata), we update `@platform` and the small mapping helpers at the app edge. Only when the transport surface needs to change do we also adjust `@protocol`. This extra seam prevents incidental coupling and lets the frontend/backend choose the projection that best fits their use case without rewriting the contract every time the domain grows.

Reference, see following doc more more details: dev-notes/2025-10/2025-10-11-[01]-codebase-arch-proposal-v2.md

## Core Type System

### The MessageUnion Pattern

All messages follow a discriminated union pattern built from a payload map:

```typescript
// Define a map of message types to their payloads (client -> server)
// (These specific messages are just illustrative examples)
type ChatClientPayloadMap = {
  'chat:send': { roomId: string; text: string };
  'chat:typing': { roomId: string; isTyping: boolean };
};

// Generic utility type - Convert to a discriminated union
type MessageUnion<TMap extends Record<string, unknown>> = {
  [TType in keyof TMap]: {
    type: TType extends string ? TType : never;
    payload: TMap[TType];
  }
}[keyof TMap];

// Use `MessageUnion` with `ChatClientPayloadMap` to get discrimated union
// of all Chat message types the client will send
type ChatClientMessage = MessageUnion<ChatClientPayloadMap>;
// Results in:
//   | { type: 'chat:send', payload: { roomId: string; text: string } }
//   | { type: 'chat:typing', payload: { roomId: string; isTyping: boolean } }
```

**Why this pattern?**
- Single source of truth: payload map defines everything
- TypeScript can extract exact payload types for each message
- Easy to add new messages: just add to the map
- Works with discriminated union narrowing

### Type Utilities

```typescript
// Extract specific message type
type ExtractMsg<TUnion, TType> = Extract<TUnion, { type: TType }>;

// Get payload for a specific message type
type PayloadFor<TUnion, TType> = Extract<TUnion, { type: TType }>['payload'];

// Handler map that enforces correct payload types
type HandlerMap<TUnion extends { type: string; payload: unknown }> = {
  [TType in TUnion['type']]: (payload: PayloadFor<TUnion, TType>) => void;
};

// Handler map with context parameter
type HandlerMapWithCtx<TUnion, TCtx> = {
  [TType in TUnion['type']]: (payload: PayloadFor<TUnion, TType>, ctx: TCtx) => void;
};
```

## Message Organization

### Domain-Scoped Message Files

Each domain has separate files for client and server messages in the protocol package:

```
packages/protocol/
  domains/chat/
    client-messages.ts    # client -> server: Messages FROM client TO server
    server-messages.ts    # server -> client: Messages FROM server TO client
  domains/timer/
    client-messages.ts
    server-messages.ts
  utils/
    message-helpers.ts    # Core type utilities for message unions
```

Domain types (entities, value objects) live in platform, if re-used between frontend and backend. App-specific projections of domain objects will be in a similar location in that app.

```
# Shared types and helpers in platform
packages/platform/domains/
  chat/
    entities.ts          # Chat domain entities (shared by apps)
    helpers.ts           # Pure domain utilities (ID factories, validation)
    
# 
apps/backend/domains/
  chat/ 
    chat.db.ts # Type for DB table
    types.ts # Backend-specific projection of chat message objects / models
```

An entity example kept in `@platform/chat/entities.ts`:

```typescript
import type {
  ChatMessageId,
  ChatRoomId,
  UserId,
  UnixMs,
} from '@kernel/primitives';

interface ChatMessageEntity {
  id: ChatMessageId;
  roomId: ChatRoomId;
  authorId: UserId;
  text: string;
  createdAt: UnixMs;
  moderated: boolean;
}
```

### Message File Structure

**Client Messages** (`packages/protocol/chat/client-messages.ts`):
```typescript
import type { MessageUnion } from '../utils/message-helpers';

// 1. Define payload map
type ChatClientPayloadMap = {
  'chat:send': { roomId: string; text: string };
  'chat:typing': { roomId: string; isTyping: boolean };
};

// 2. Create message union
type ChatClientMessage = MessageUnion<ChatClientPayloadMap>;

// 3. Create message creator functions
const MsgCreators = {
  createSendMessage: (roomId: string, text: string) => ({
    type: 'chat:send',
    payload: { roomId, text },
  }),

  createTypingMessage: (roomId: string, isTyping: boolean) => ({
    type: 'chat:typing',
    payload: { roomId, isTyping },
  }),
} as const;

// 4. Export everything
export type { ChatClientPayloadMap, ChatClientMessage };
export { MsgCreators };
```

**Protocol Types** (`packages/protocol/chat/types.ts`):
```typescript
import type {
  ChatMessageId,
  ChatRoomId,
  UserId,
  UnixMs,
} from '@kernel/primitives';

interface ChatMessageSnapshot {
  id: ChatMessageId;
  roomId: ChatRoomId;
  authorId: UserId;
  text: string;
  sentAt: UnixMs;
}

interface ChatTypingSnapshot {
  roomId: ChatRoomId;
  userIds: UserId[];
}

export type { ChatMessageSnapshot, ChatTypingSnapshot }
```

**Server Messages** (`packages/protocol/chat/server-messages.ts`):
```typescript
import type { MessageUnion } from '../utils/message-helpers';
import type { ChatMessageSnapshot, ChatTypingSnapshot } from './types';

type ChatServerPayloadMap = {
  'chat:message': ChatMessageSnapshot;
  'chat:is-typing-in-room': ChatTypingSnapshot;
};

type ChatServerMessage = MessageUnion<ChatServerPayloadMap>;

const MsgCreators = {
  createMessageBroadcast(message: ChatMessageSnapshot) {
    return { type: 'chat:message', payload: message };
  },

  createTypingBroadcast(snapshot: ChatTypingSnapshot) {
    return { type: 'chat:is-typing-in-room', payload: snapshot };
  },
} as const;

export type { ChatServerPayloadMap, ChatServerMessage };
export { MsgCreators };
```

**Note**: Protocol snapshot types live inside the protocol package and depend only on kernel primitives.

### Bridging entities to snapshots

Domain entities stored in services or state machines often carry more fields than a client needs. Rather than sharing a single jumbo type, each adapter module introduces a mapper that turns the platform entity into the protocol snapshot (and vice versa for client commands). These mappers are intentionally tiny and colocated with the adapter that uses them. When the entity grows—say we add moderation flags—we update the mapper and, only if necessary, the snapshot type. The client renders the snapshot immediately, while backend workflows continue using the richer entity. This pattern keeps responsibilities aligned: platform owns the business view, protocol owns the transport view, and apps mediate the exchange.

### Composing All Messages

In `packages/protocol/messages.ts`, combine all domain messages:

```typescript
import type { MessageUnion } from './utils/message-helpers';
import type { ChatClientPayloadMap } from './chat/client-messages';
import type { ChatServerPayloadMap } from './chat/server-messages';
import type { SystemClientPayloadMap } from './system/client-messages';
import type { SystemServerPayloadMap } from './system/server-messages';
// ... other domains

// Merge all client payload maps
type ClientMessageMap =
  & ChatClientPayloadMap
  & SystemClientPayloadMap
  & TimerClientPayloadMap
  & GameClientPayloadMap;

// Merge all server payload maps
type ServerMessageMap =
  & ChatServerPayloadMap
  & SystemServerPayloadMap
  & TimerServerPayloadMap
  & GameServerPayloadMap;

// Create unions
type ClientMessage = MessageUnion<ClientMessageMap>;
type ServerMessage = MessageUnion<ServerMessageMap>;

export type { ClientMessageMap, ServerMessageMap, ClientMessage, ServerMessage };
```

### System Domain

The `system` domain owns cross-cutting connection flows that sit alongside ordinary product domains. It coordinates room join/leave lifecycle, tracks connection heartbeat + latency metrics, and exposes shared helpers the generic WS bridge uses to grant other domains convenient room membership APIs. Adapters integrate with it slightly differently: the bridge/server/client layers wire in its helpers directly so other domains can lean on `wsBridge.rooms.*` utilities without reimplementing membership bookkeeping. Otherwise it follows the same message-map conventions as every other domain.

**Benefits:**
- Each domain owns its messages
- Type-safe at the edges (full client/server message unions)
- Adding a domain means adding 2 lines to this file
- Protocol package has no business logic, only wire contracts

## Backend Architecture

### Handler Pattern

Handlers are pure functions that receive payload + context, then call domain actions:

**File**: `apps/backend/domains/chat/handlers.ts`

```typescript
import type { ChatClientMessage } from '@protocol/messages';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { HandlerContext } from '@src/ws/types';
import { chatActions } from './actions';

const chatHandlers = {
  'chat:send': ({ roomId, text }, ctx) => {
    chatActions.sendMessage(roomId, text, { userId: ctx.userId });
  },

  'chat:typing': ({ roomId, isTyping }, ctx) => {
    chatActions.setTypingState(roomId, isTyping, { userId: ctx.userId });
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, HandlerContext>;

export { chatHandlers };
```

**Key points:**
- Handlers are fully type-safe (payload types auto-inferred)
- Handlers don't send WebSocket messages directly
- Context provides per-connection state (userId, etc.)
- Handlers delegate to domain actions
- Handlers live in `apps/backend` (adapter layer)

### Domain Actions

Actions contain business logic and trigger side effects via the bridge:

**File**: `apps/backend/domains/chat/actions.ts`
```typescript
import type { ChatMessageEntity } from '@platform/chat/entities';
import { chatIds } from '@platform/chat/helpers';
import type { ChatTypingSnapshot, ChatMessageSnapshot } from '@protocol/chat/types';
import { chatStore } from '@src/db/chat-store';
import { wsBridge } from '@src/ws/bridge';
import { MsgCreators } from '@protocol/chat/server-messages';

function toSnapshot(entity: ChatMessageEntity): ChatMessageSnapshot {
  return {
    id: entity.id,
    roomId: entity.roomId,
    authorId: entity.authorId,
    text: entity.text,
    sentAt: entity.createdAt,
  };
}

const chatActions = {
  sendMessage(roomId: string, text: string, meta: { userId: string }) {
    const entity: ChatMessageEntity = {
      id: chatIds.create(),
      roomId,
      authorId: meta.userId,
      text,
      createdAt: Date.now(),
      moderated: false,
    };

    chatStore.save(entity);

    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createMessageBroadcast(toSnapshot(entity))
    );
  },

  setTypingState(roomId: string, isTyping: boolean, meta: { userId: string }) {
    chatStore.setTyping(roomId, meta.userId, isTyping);

    const typingSnapshot: ChatTypingSnapshot = {
      roomId,
      userIds: Array.from(chatStore.getTyping(roomId)),
    };

    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createTypingBroadcast(typingSnapshot),
      { excludeUserId: meta.userId },
    );
  },
};

export { chatActions };
```

### WebSocket Effects (Server-Initiated Messages)

Some messages are triggered by server events, not client messages:

**File**: `apps/backend/domains/timer/ws-effects.ts`
```typescript
import type { TimerStateSnapshot } from '@protocol/timer/types';
import { wsBridge } from '@src/ws/bridge';
import { MsgCreators } from '@protocol/timer/server-messages';

const timerWsEffects = {
  broadcastStateChange(roomId: string, snapshot: TimerStateSnapshot) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createStateChangedBroadcast(snapshot)
    );
  },
};

export { timerWsEffects };
```

### The WS Bridge (Server)

The bridge abstracts WebSocket transport from domain logic:

**File**: `apps/backend/ws/server-bridge.ts`

```typescript
import type { ServerMessage } from '@protocol/messages';

type BroadcastOptions = { excludeUserId?: string };

interface WsTransport<TMessage extends { type: string; payload: unknown }> {
  broadcast(message: TMessage, opts?: BroadcastOptions): void;
  broadcastToRoom(roomId: string, message: TMessage, opts?: BroadcastOptions): void;
  sendToUser(userId: string, message: TMessage): void;
  rooms: RoomMembershipAdapter;
}

function createWsBridge<TMessage>() {
  let transport: WsTransport<TMessage> | null = null;

  function requireTransport() {
    if (!transport) throw new Error('WS bridge not initialized');
    return transport;
  }

  return {
    init(impl: WsTransport<TMessage>) {
      transport = impl;
    },
    broadcast(message: TMessage, opts?: BroadcastOptions) {
      requireTransport().broadcast(message, opts);
    },
    broadcastToRoom(roomId: string, message: TMessage, opts?: BroadcastOptions) {
      requireTransport().broadcastToRoom(roomId, message, opts);
    },
    sendToUser(userId: string, message: TMessage) {
      requireTransport().sendToUser(userId, message);
    },
    get rooms() {
      return requireTransport().rooms;
    },
  };
}

const wsBridge = createWsBridge<ServerMessage>();

export { wsBridge };
```

**Benefits:**
- Domain code doesn't depend on WebSocket library
- Easy to test (mock the bridge)
- Type-safe: only accepts valid ServerMessage types from protocol package

### Server Setup

**File**: `apps/backend/server.ts`
```typescript
import type { ClientMessage, ServerMessage } from '@protocol/messages';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';

import type { HandlerContext } from '@src/ws/types';
import { wsBridge } from '@src/ws/server-bridge.ts';
import { chatHandlers } from '@src/domains/chat/handlers';
import { systemHandlers } from '@src/domains/system/handlers';
import { timerHandlers } from '@src/domains/timer/handlers';

const handlers = {
  ...chatHandlers,
  ...systemHandlers,
  ...timerHandlers,
} satisfies HandlerMapWithCtx<ClientMessage, HandlerContext>;

const server = createWSServer<ClientMessage, ServerMessage, HandlerContext>({
  port: 3000,
  handlers,
  onConnection: (sendForSocket) => {
    const user = createUser();
    sendForSocket(systemServerMsgCreators.createUserInfoBroadcast(user));
    return user.userId;
  },
  createContext: (userId) => ({ userId }),
  getUserId: (ctx) => ctx.userId,
  onDisconnect: (userId) => {
    removeUser(userId);
  },
});

// Initialize bridge with server transport
wsBridge.init(server);
```

**Key points:**
- All handlers merged at root
- Type-checked: TypeScript ensures all ClientMessage types have handlers
- Connection lifecycle hooks for user management
- Bridge initialized after server creation

## Frontend Architecture

### Client Bridge

Similar to server, but simpler (client only sends, doesn't route):

**File**: `apps/frontend/ws/client-bridge.ts`

```typescript
import type { ClientMessage } from '@protocol/messages';
import type { AppWsClient } from '@src/ws/types';

function createWsBridge<TMessage extends ClientMessage>() {
  let client: AppWsClient | null = null;

  function requireClient() {
    if (!client) throw new Error('wsBridge not initialized');
    return client;
  }

  return {
    send(message: TMessage): void {
      requireClient().send(message);
    },

    init(wsClient: AppWsClient): void {
      client = wsClient;
    },

    reset(): void {
      client = null;
    },
  };
}

const wsBridge = createWsBridge<ClientMessage>();

export { wsBridge };
```

### Using the Bridge in Components/Hooks

**File**: `apps/frontend/domains/chat/use-chat-actions.ts`
```typescript
import { MsgCreators } from '@protocol/chat/client-messages';
import { wsBridge } from '@src/ws/client-bridge';

function useChatActions(roomId: string) {
  const sendMessage = (text: string) => {
    wsBridge.send(MsgCreators.createSendMessage(roomId, text));
  };

  const setTyping = (isTyping: boolean) => {
    wsBridge.send(MsgCreators.createTypingMessage(roomId, isTyping));
  };

  return { sendMessage, setTyping };
}
```

## Adding a New Message Type (Checklist)

Example: adding new message for "deleting a chat message".

### 1. Define in Protocol

Add to the appropriate domain's payload map:

```typescript
// packages/protocol/chat/client-messages.ts
type ChatClientPayloadMap = {
  'chat:send': { roomId: string; text: string };
  'chat:typing': { roomId: string; isTyping: boolean };
  'chat:delete': { roomId: string; messageId: string };  // NEW
};

// Add message creator
const MsgCreators = {
  // ... existing
  createDeleteMessage: (roomId: string, messageId: string) => ({
    type: 'chat:delete',
    payload: { roomId, messageId },
  }),
};
```

### 2. Add Handler (Backend)
```typescript
// apps/backend/domains/chat/handlers.ts
export const chatHandlers = {
  // ... existing handlers
  'chat:delete': ({ roomId, messageId }, ctx) => {
    chatActions.deleteMessage(roomId, messageId, { userId: ctx.userId });
  },
};
```

### 3. Implement Action (Backend)
```typescript
// apps/backend/domains/chat/actions.ts
import { MsgCreators } from '@protocol/chat/server-messages';

export const chatActions = {
  // ... existing actions
  deleteMessage(roomId: string, messageId: string, meta: { userId: string }) {
    const deleted = chatStore.deleteMessage(roomId, messageId, meta.userId);
    if (deleted) {
      wsBridge.broadcastToRoom(
        roomId,
        MsgCreators.createMessageDeletedBroadcast(roomId, messageId)
      );
    }
  },
};
```

### 4. Use in Frontend
```typescript
// apps/frontend/domains/chat/use-chat-actions.ts
import { MsgCreators } from '@protocol/chat/client-messages';
import { wsBridge } from '@src/ws/client-bridge';

function useChatActions(roomId: string) {
  const deleteMessage = (messageId: string) => {
    wsBridge.send(MsgCreators.createDeleteMessage(roomId, messageId));
  };

  return { deleteMessage, /* ... */ };
}
```

**That's it!** TypeScript enforces that:
- Handler exists for the new message type
- Payload types are correct everywhere
- Message creators match the payload map

## Key Architecture Principles

### 1. Separation of Concerns
- **Protocol**: Wire types only (DTOs, message shapes). No business logic.
- **Platform**: Shared domain types (entities, value objects). No I/O; these models are intentionally neutral, not “backend first” or “frontend first.”
- **Backend Handlers**: Thin routing layer (validate, extract, delegate)
- **Backend Actions**: Business logic, persistence, side effects
- **Backend WS Effects**: Server-initiated broadcasts
- **Frontend Hooks**: Call site for sending messages
- **Frontend Stores**: State management for received messages

### 2. Dependency Boundaries
- **Protocol** may only import `@kernel` (branded primitives)
- **Platform/Core** may import `@kernel`, `@utils` - never `@protocol`
- **Apps** may import everything; bridge protocol ↔ domain at the edges
- Domain types flow: platform → apps (both backend/frontend)
- Wire types flow: protocol → apps (adapter layer only)

### 3. Type Safety
- Single source of truth (payload maps in protocol)
- Discriminated unions for exhaustive checking
- No `any` types in message handling
- TypeScript enforces handler coverage
- Protocol publishes snapshots; apps map from platform entities when crossing the wire

### 4. Testability
- Handlers are pure functions (easy to test)
- Bridge can be mocked
- Actions can be tested without WebSockets
- Message creators ensure valid message shape
- Domain logic (platform) testable without transport concerns

### 5. Extensibility
- Adding message: 4 touchpoints (protocol, handler, action, frontend use)
- Adding domain: Copy existing domain structure
- Type system catches missing handlers
- Protocol remains stable as domain evolves
