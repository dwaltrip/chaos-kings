# Branded Types - Chat & Gameplay Domains

**Date:** 2025-10-17
**Status:** Planning
**Context:** Completing branded types implementation for remaining domains (chat, gameplay)
**Previous work:** `10-17-[1]-branded-types-implementation.md` - System + Matchmaking domains complete

---

## Overview

After completing the first pass of branded types in matchmaking and system domains, two domains remain:
- **Chat domain** (backend + frontend)
- **Gameplay domain** (backend + frontend)

This tactical doc provides detailed analysis of current state and implementation plan for completing branded types across all v2 domains.

---

## Current State Assessment

### ✅ Completed (1st Pass)

**Infrastructure:**
- ✅ Kernel types: `UserId`, `GameId`, `RoomId` with constructors
- ✅ Conversion helpers: `idToNumber()`, `idToString()` in `@kernel/branded-type`
- ✅ `MATCHMAKING_ROOM_ID` constant branded as `RoomId`
- ✅ `HandlerContext.userId` type fixed to `number` (infrastructure primitive)

**Domains:**
- ✅ System domain (backend + frontend) - Fully branded signatures
- ✅ Matchmaking domain (backend + frontend) - **Complete reference implementation**
  - Handlers convert primitives → branded (entry point)
  - Actions work with branded types exclusively
  - WS-effects convert branded → primitives (exit point)

### 🔄 Remaining Work

**Chat Domain:**
- ❌ Missing `MessageId` branded type (needs to be created)
- ❌ Backend `ChatMessageEntity` uses primitive types
- ❌ Backend handlers create messages with primitives (no conversion)
- ❌ Backend actions pass primitives (no branded type usage)
- ❌ Backend ws-effects pass primitives to protocol (no conversion)
- ❌ Frontend handlers don't convert inbound primitives

**Gameplay Domain:**
- ✅ All required kernel types exist (`UserId`, `GameId`, `RoomId`)
- ❌ Backend handlers don't convert to branded types
- ❌ Backend actions use primitive types throughout
- ❌ Backend actions call `systemActions` with wrong types (primitives instead of branded)
- ❌ Backend ws-effects use primitives
- ❌ Frontend handlers don't convert inbound primitives
- ❌ Frontend actions use primitives

---

## Detailed Analysis

### Chat Domain - Current State

#### Files & Issues

**1. `packages/kernel/domains/chat.ts`**
- Status: ❌ **Does not exist** - needs to be created
- Required: `MessageId` branded type

**2. `apps/backend/src/domains/chat/types.ts`**
- Current:
  ```typescript
  interface ChatMessageEntity {
    id: string; // TODO: [BRANDED_TYPES-chatMessageId]
    userId: string; // TODO: [BRANDED_TYPES-userId]
    roomId: string; // TODO: [BRANDED_TYPES-roomId]
    content: string;
    timestamp: number;
  }
  ```
- Issues:
  - All ID fields are primitive types
  - TODO comments flag branded types work

**3. `apps/backend/src/domains/chat/handlers.ts`**
- Current (lines 8-18):
  ```typescript
  'chat:send-message': ({ roomId, content }, ctx) => {
    const message = {
      id: 'fake-message-id', // TODO: id should come from DB
      roomId,
      content,
      userId: ctx.userId,
      timestamp: Date.now(),
    };
    broadcastChatMessage(message, ctx);
  }
  ```
- Issues:
  - Creates message with primitive types
  - Doesn't convert `ctx.userId` to `UserId`
  - Doesn't convert `roomId` to `RoomId`
  - Doesn't create branded `MessageId`

**4. `apps/backend/src/domains/chat/actions/broadcast-chat-message.ts`**
- Current:
  ```typescript
  type UserContext = { userId: string };

  function broadcastChatMessage(message: ChatMessageEntity, ctx: UserContext) {
    chatWsEffects.broadcastNewMessage(message);
  }
  ```
- Issues:
  - `UserContext` uses `userId: string` (should use `HandlerContext`)
  - No branded type conversions

**5. `apps/backend/src/domains/chat/ws-effects.ts`**
- Current (lines 7-14):
  ```typescript
  const chatWsEffects = {
    broadcastNewMessage({ roomId, content, userId, timestamp }: ChatMessageEntity) {
      wsBridge.broadcastToRoom(
        roomId,
        MsgCreators.createBroadcastMessageMessage(roomId, content, userId, timestamp),
      );
    },
  };
  ```
- Issues:
  - Accepts `ChatMessageEntity` with branded types BUT doesn't convert
  - Should convert branded types → primitives for protocol layer
  - Missing conversions: `idToString(roomId)`, `idToString(userId)`, `idToString(messageId)`

**6. `apps/frontend/src/domains/chat/handlers.ts`**
- Current (lines 8-12):
  ```typescript
  export const chatHandlers = {
    'chat:broadcast-message': (payload) => {
      // addReceivedMessage();
    },
  } as const satisfies ChatHandlerMap;
  ```
- Issues:
  - Stubbed, but will need to convert primitives → branded when implemented
  - Should convert: `UserId(payload.userId)`, `RoomId(payload.roomId)`, `MessageId(payload.id)`

**7. `packages/protocol/domains/chat/server-messages.ts`**
- Current (lines 4-13):
  ```typescript
  type ChatServerPayloadMap = {
    'chat:broadcast-message': {
      roomId: string;
      content: string;
      userId: string;
      timestamp: number;
    };
  };
  ```
- Status: ✅ **Correct** - protocol should use primitives (wire format)
- Note: Protocol does NOT include messageId in payload (just roomId, content, userId, timestamp)

**8. `packages/protocol/domains/chat/client-messages.ts`**
- Current (lines 4-11):
  ```typescript
  type ChatClientPayloadMap = {
    'chat:send-message': {
      roomId: string;
      content: string;
    };
  };
  ```
- Status: ✅ **Correct** - protocol should use primitives

#### Chat Domain - ID Usage Summary

| ID Type | Where Used | Status |
|---------|------------|--------|
| `MessageId` | `ChatMessageEntity.id` | ❌ Type doesn't exist |
| `UserId` | `ChatMessageEntity.userId`, `HandlerContext.userId` | ✅ Type exists, ❌ Not used |
| `RoomId` | `ChatMessageEntity.roomId`, handler payload | ✅ Type exists, ❌ Not used |

---

### Gameplay Domain - Current State

#### Files & Issues

**1. Kernel types**
- Status: ✅ All required types exist (`UserId`, `GameId`, `RoomId`)

**2. `apps/backend/src/domains/gameplay/handlers.ts`**
- Current issues (lines 8-45):
  ```typescript
  'gameplay:join-room': ({ room }, ctx) => {
    const gameId = parseGameRoomId(room);
    gameplayActions.joinRoom(room, gameId, ctx); // ❌ Passing primitives
  },

  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    const gameId = -1;
    gameplayActions.queueMove(sourceCoord, direction, gameId, ctx); // ❌ Passing primitives
  },
  ```
- Issues:
  - Doesn't convert primitives → branded types
  - Should convert: `RoomId(room)`, `GameId(gameId)`, `UserId(ctx.userId)`
  - Passes entire `ctx` object to actions (should extract userId and convert)

**3. `apps/backend/src/domains/gameplay/actions.ts`**
- Current issues (lines 8-86):
  ```typescript
  const gameplayActions = {
    joinRoom(room: string, gameId: number, ctx: HandlerContext) {
      systemActions.joinRoom(room, ctx); // ❌ Wrong types!
    },

    leaveRoom(room: string, gameId: number, ctx: HandlerContext) {
      systemActions.leaveRoom(room, ctx); // ❌ Wrong types!
    },

    queueMove(sourceCoord: Coord, direction: Direction, gameId: number, ctx: HandlerContext) {
      // TODO: Implement
    },
    // ... other methods with primitive types
  };
  ```
- Issues:
  - All methods use primitive types (`room: string`, `gameId: number`)
  - Calls `systemActions.joinRoom(room, ctx)` - WRONG!
    - `systemActions.joinRoom` expects `(roomId: RoomId, userId: UserId)`
    - Currently passing `(room: string, ctx: HandlerContext)`
  - Should accept branded types and pass branded types

**4. `apps/backend/src/domains/gameplay/ws-effects.ts`**
- Current issues (lines 14-63):
  ```typescript
  const gameplayWsEffects = {
    broadcastGameState(roomId: string, tick: number, boardState: BoardState, ...) {
      wsBridge.broadcastToRoom(roomId, ...); // ❌ Should accept/convert RoomId
    },

    broadcastGameStarting(roomId: string, gameId: number, countdown: number) {
      // ❌ Should accept branded types, convert to primitives
    },
    // ... other methods
  };
  ```
- Issues:
  - All methods accept primitives instead of branded types
  - Should accept: `RoomId`, `GameId`
  - Should convert to primitives when calling protocol: `idToString(roomId)`, `idToNumber(gameId)`

**5. `apps/frontend/src/domains/gameplay/handlers.ts`**
- Current (lines 6-22):
  ```typescript
  const gameplayHandlers = {
    'gameplay:state-update': (payload) => {
      gameplayActions.handleGameState(payload); // ❌ No conversion
    },

    'gameplay:game-starting': (payload) => {
      gameplayActions.handleGameStarting(payload); // ❌ No conversion for gameId
    },

    'gameplay:game-started': (payload) => {
      gameplayActions.handleGameStarted(payload); // ❌ No conversion for gameId
    },
    // ...
  };
  ```
- Issues:
  - Doesn't convert inbound `gameId` primitives to `GameId`
  - Should convert: `GameId(payload.gameId)` where applicable

**6. `apps/frontend/src/domains/gameplay/actions.ts`**
- Current: Uses primitive types
- Issues:
  - Inbound action handlers should accept branded `GameId`
  - Outbound actions (sending messages) should use branded types internally

**7. `packages/protocol/domains/gameplay/*.ts`**
- Status: ✅ **Correct** - protocol uses primitives (wire format)

#### Gameplay Domain - ID Usage Summary

| ID Type | Where Used | Status |
|---------|------------|--------|
| `GameId` | Handler payloads, actions, ws-effects | ✅ Type exists, ❌ Not used |
| `RoomId` | Handler payloads, actions, ws-effects | ✅ Type exists, ❌ Not used |
| `UserId` | `HandlerContext.userId` | ✅ Type exists, ❌ Not used |

#### Critical Bug in Gameplay Actions

**Current code in `gameplay/actions.ts:14`:**
```typescript
systemActions.joinRoom(room, ctx);
```

**Expected signature from `system/actions.ts:5`:**
```typescript
joinRoom(roomId: RoomId, userId: UserId)
```

**Problem:**
- Passing `room: string` where `RoomId` expected
- Passing `ctx: HandlerContext` where `UserId` expected
- This is a **type error** that should be caught by TypeScript

**Fix required:**
```typescript
systemActions.joinRoom(RoomId(room), UserId(ctx.userId));
```

---

## Decisions

### MessageId Type

**Question:** String-based or number-based?

**Answer:** Number-based for now, flexible for future UUID migration.

**Rationale:**
- User's DB tables currently use number IDs (auto-increment)
- Easy to change to UUID later (just change `Brand<number, T>` → `Brand<string, T>`)
- Consistent with `UserId` and `GameId` patterns

**Definition:**
```typescript
// packages/kernel/domains/chat.ts
type MessageId = Brand<number, 'MessageId'>;
const MessageId = (value: number): MessageId => value as MessageId;
```

### MessageId Generation (Backend Handler)

**Question:** How to generate message IDs in the backend handler?

**Answer:** Leave as TODO comment, use timestamp + random for now.

**Temporary implementation:**
```typescript
const tempId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
const message = {
  id: MessageId(tempId), // TODO: [DB] Get ID from database after insert
  // ...
};
```

**Note:** This is a placeholder. Real implementation will get ID from database after insert.

### Implementation Scope

**Question:** Both domains in one session or separate?

**Answer:** Plan as two separate chunks (can execute in one session if time permits).

**Order:**
1. **Chat domain first** (simpler - fewer files, clear boundaries)
2. **Gameplay domain second** (more files, includes critical bug fix)

---

## Implementation Plan - Phase 1: Chat Domain

### Prerequisite: Create MessageId Type

**File:** `packages/kernel/domains/chat.ts` (NEW FILE)

**Implementation:**
```typescript
import { Brand } from '@kernel/branded-type';

type MessageId = Brand<number, 'MessageId'>;
const MessageId = (value: number): MessageId => value as MessageId;

export type { MessageId };
export { MessageId };
```

**Notes:**
- Follow exact pattern from `user.ts`, `game.ts`, `system.ts`
- Exports at end of file (AGENTS.md compliance)

---

### Step 1: Update ChatMessageEntity Type

**File:** `apps/backend/src/domains/chat/types.ts`

**Current:**
```typescript
interface ChatMessageEntity {
  id: string; // TODO: [BRANDED_TYPES-chatMessageId]
  userId: string; // TODO: [BRANDED_TYPES-userId]
  roomId: string; // TODO: [BRANDED_TYPES-roomId]
  content: string;
  timestamp: number;
}
```

**Updated:**
```typescript
import { MessageId } from '@kernel/domains/chat';
import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';

interface ChatMessageEntity {
  id: MessageId;
  userId: UserId;
  roomId: RoomId;
  content: string;
  timestamp: number; // TODO: [TIMESTAMPS] Standardize timestamp handling
}

export type { ChatMessageEntity };
export { ChatMessageEntity }; // Remove this if only exporting type
```

**Changes:**
- Add imports for branded types
- Change field types to branded
- Remove TODO comments (work complete)
- Update exports to follow AGENTS.md pattern

---

### Step 2: Update Chat Handlers (Backend)

**File:** `apps/backend/src/domains/chat/handlers.ts`

**Current:**
```typescript
const chatHandlers = {
  'chat:send-message': ({ roomId, content }, ctx) => {
    const message = {
      id: 'fake-message-id', // TODO: id should come from DB
      roomId,
      content,
      userId: ctx.userId,
      timestamp: Date.now(),
    };
    broadcastChatMessage(message, ctx);
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, HandlerContext>;
```

**Updated:**
```typescript
import { MessageId } from '@kernel/domains/chat';
import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';

import type { HandlerContext } from '@/ws/types';
import { broadcastChatMessage } from '@/domains/chat/actions';

const chatHandlers = {
  'chat:send-message': ({ roomId, content }, ctx) => {
    // TODO: [DB] Get message ID from database after insert
    const tempId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    const message = {
      id: MessageId(tempId),
      roomId: RoomId(roomId),
      content,
      userId: UserId(ctx.userId),
      timestamp: Date.now(),
    };

    broadcastChatMessage(message);
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, HandlerContext>;

export { chatHandlers };
```

**Changes:**
- Add imports for branded types
- Convert `roomId` → `RoomId(roomId)`
- Convert `ctx.userId` → `UserId(ctx.userId)`
- Generate temporary MessageId with timestamp + random
- Remove `ctx` parameter from `broadcastChatMessage()` call (not needed)
- Follow import order from AGENTS.md

---

### Step 3: Update Chat Actions (Backend)

**File:** `apps/backend/src/domains/chat/actions/broadcast-chat-message.ts`

**Current:**
```typescript
import { ChatMessageEntity } from '@/domains/chat/types';
import { chatWsEffects } from '@/domains/chat/ws-effects';

type UserContext = { userId: string };

function broadcastChatMessage(message: ChatMessageEntity, ctx: UserContext) {
  chatWsEffects.broadcastNewMessage(message);
}

export { broadcastChatMessage };
```

**Updated:**
```typescript
import type { ChatMessageEntity } from '@/domains/chat/types';
import { chatWsEffects } from '@/domains/chat/ws-effects';

function broadcastChatMessage(message: ChatMessageEntity) {
  chatWsEffects.broadcastNewMessage(message);
}

export { broadcastChatMessage };
```

**Changes:**
- Remove `UserContext` type (not needed - userId is in message)
- Remove `ctx` parameter (not used)
- `ChatMessageEntity` now has branded types (from Step 1)

---

### Step 4: Update Chat WS-Effects (Backend)

**File:** `apps/backend/src/domains/chat/ws-effects.ts`

**Current:**
```typescript
import { MsgCreators } from '@protocol/domains/chat/server-messages';

import { ChatMessageEntity } from '@/domains/chat/types';
const wsBridge: any = {};

const chatWsEffects = {
  broadcastNewMessage({ roomId, content, userId, timestamp }: ChatMessageEntity) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createBroadcastMessageMessage(roomId, content, userId, timestamp),
    );
  },
};

export { chatWsEffects };
```

**Updated:**
```typescript
import { idToString, idToNumber } from '@kernel/branded-type';
import { MsgCreators } from '@protocol/domains/chat/server-messages';

import type { ChatMessageEntity } from '@/domains/chat/types';

// TODO: [PHASE-2] Replace with actual wsBridge implementation
const wsBridge: any = {};

const chatWsEffects = {
  broadcastNewMessage({ roomId, content, userId, timestamp }: ChatMessageEntity) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createBroadcastMessageMessage(
        idToString(roomId),
        content,
        idToNumber(userId),
        timestamp,
      ),
    );
  },
};

export { chatWsEffects };
```

**Changes:**
- Add import for conversion helpers
- Convert `roomId` → `idToString(roomId)` (RoomId is string-based)
- Convert `userId` → `idToNumber(userId)` (UserId is number-based)
- Note: MessageId not included in protocol payload (doesn't need conversion)
- Add TODO comment for wsBridge
- Follow import order from AGENTS.md

**Note:** Protocol `createBroadcastMessageMessage` does NOT include messageId parameter. The server message only includes: `roomId, content, userId, timestamp`. The messageId is only used internally in `ChatMessageEntity`.

---

### Step 5: Update Chat Handlers (Frontend)

**File:** `apps/frontend/src/domains/chat/handlers.ts`

**Current:**
```typescript
import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';

type ChatHandlerMap = HandlerMap<ChatServerMessage>;

export const chatHandlers = {
  'chat:broadcast-message': (payload) => {
    // addReceivedMessage();
  },
} as const satisfies ChatHandlerMap;
```

**Updated:**
```typescript
import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';
import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';

import { chatActions } from '@/domains/chat/actions';

type ChatHandlerMap = HandlerMap<ChatServerMessage>;

export const chatHandlers = {
  'chat:broadcast-message': (payload) => {
    // Convert primitives → branded types
    chatActions.handleBroadcastMessage({
      roomId: RoomId(payload.roomId),
      content: payload.content,
      userId: UserId(payload.userId),
      timestamp: payload.timestamp,
    });
  },
} as const satisfies ChatHandlerMap;
```

**Changes:**
- Add imports for branded types
- Convert inbound primitives → branded types
- Call action handler (will need to be created if doesn't exist)
- Note: MessageId not in payload (generated client-side if needed)

---

### Step 6: Update Chat Actions (Frontend)

**File:** `apps/frontend/src/domains/chat/actions.ts`

**Current:** (Need to check if this file exists and what it contains)

**Expected after update:**
```typescript
import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';
import { MsgCreators } from '@protocol/domains/chat/client-messages';

// Mock WebSocket service until Phase 2
const wsService: any = {};

// Outbound action (client → server)
function sendMessage(roomId: RoomId, content: string) {
  wsService.send(MsgCreators.createSendMessageMessage(
    idToString(roomId),
    content,
  ));
}

// Inbound action (server → client)
function handleBroadcastMessage(payload: {
  roomId: RoomId;
  content: string;
  userId: UserId;
  timestamp: number;
}) {
  // TODO: [CHAT_FE] Update store with new message
  // - Add to message list for roomId
  // - Trigger re-render if room is active
}

const chatActions = {
  // Outbound
  sendMessage,
  // Inbound
  handleBroadcastMessage,
};

export { chatActions };
```

**Changes:**
- Accept branded types in both inbound and outbound actions
- Convert branded → primitives when sending to protocol
- Follow matchmaking pattern exactly

---

## Implementation Plan - Phase 2: Gameplay Domain

### Overview

All required kernel types exist. Need to:
1. Update backend handlers to convert primitives → branded
2. Update backend actions to accept branded types
3. **Fix critical bug** in `systemActions.joinRoom/leaveRoom` calls
4. Update backend ws-effects to accept branded types and convert to primitives
5. Update frontend handlers to convert primitives → branded
6. Update frontend actions to accept branded types

---

### Step 1: Update Gameplay Handlers (Backend)

**File:** `apps/backend/src/domains/gameplay/handlers.ts`

**Current:**
```typescript
const gameplayHandlers = {
  'gameplay:join-room': ({ room }, ctx) => {
    const gameId = parseGameRoomId(room);
    if (!gameId) {
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.joinRoom(room, gameId, ctx);
  },

  'gameplay:leave-room': ({ room }, ctx) => {
    const gameId = parseGameRoomId(room);
    if (!gameId) {
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.leaveRoom(room, gameId, ctx);
  },

  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    const gameId = -1;
    gameplayActions.queueMove(sourceCoord, direction, gameId, ctx);
  },

  'gameplay:cancel-moves': (payload, ctx) => {
    const gameId = -1;
    gameplayActions.cancelMoves(gameId, ctx);
  },

  'gameplay:undo-move': ({ gameId }, ctx) => {
    gameplayActions.undoMove(gameId, ctx);
  },
} satisfies HandlerMapWithCtx<GameplayClientMessage, HandlerContext>;
```

**Updated:**
```typescript
import { UserId } from '@kernel/domains/user';
import { GameId } from '@kernel/domains/game';
import { RoomId } from '@kernel/domains/system';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';
import { parseGameRoomId } from '@platform/domains/gameplay/helpers';

import type { HandlerContext } from '@/ws/types';
import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:join-room': ({ room }, ctx) => {
    const gameIdNumber = parseGameRoomId(room);
    if (!gameIdNumber) {
      // TODO: [ERROR-HANDLING] Proper error handling for invalid room ID
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.joinRoom(
      RoomId(room),
      GameId(gameIdNumber),
      UserId(ctx.userId),
    );
  },

  'gameplay:leave-room': ({ room }, ctx) => {
    const gameIdNumber = parseGameRoomId(room);
    if (!gameIdNumber) {
      // TODO: [ERROR-HANDLING] Proper error handling for invalid room ID
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.leaveRoom(
      RoomId(room),
      GameId(gameIdNumber),
      UserId(ctx.userId),
    );
  },

  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    // TODO: [GAMEPLAY] Extract gameId from context (need user-to-game mapping)
    const gameIdNumber = -1;
    gameplayActions.queueMove(
      sourceCoord,
      direction,
      GameId(gameIdNumber),
      UserId(ctx.userId),
    );
  },

  'gameplay:cancel-moves': (payload, ctx) => {
    // TODO: [GAMEPLAY] Extract gameId from context (need user-to-game mapping)
    const gameIdNumber = -1;
    gameplayActions.cancelMoves(GameId(gameIdNumber), UserId(ctx.userId));
  },

  'gameplay:undo-move': ({ gameId }, ctx) => {
    gameplayActions.undoMove(GameId(gameId), UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<GameplayClientMessage, HandlerContext>;

export { gameplayHandlers };
```

**Changes:**
- Add imports for branded types
- Convert all primitives → branded at handler entry:
  - `RoomId(room)`
  - `GameId(gameId)` or `GameId(gameIdNumber)`
  - `UserId(ctx.userId)`
- Stop passing entire `ctx` object - extract and convert userId
- Rename `gameId` variable to `gameIdNumber` where parsing from room name
- Follow import order from AGENTS.md

---

### Step 2: Update Gameplay Actions (Backend) - CRITICAL BUG FIX

**File:** `apps/backend/src/domains/gameplay/actions.ts`

**Current:**
```typescript
import type { Coord, Direction } from '@core/types';

import type { HandlerContext } from '@/ws/types';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';
import { systemActions } from '@/domains/system/actions';

const gameplayActions = {
  joinRoom(room: string, gameId: number, ctx: HandlerContext) {
    // ... comments ...
    systemActions.joinRoom(room, ctx); // ❌ BUG: Wrong types!
  },

  leaveRoom(room: string, gameId: number, ctx: HandlerContext) {
    // ... comments ...
    systemActions.leaveRoom(room, ctx); // ❌ BUG: Wrong types!
  },

  queueMove(sourceCoord: Coord, direction: Direction, gameId: number, ctx: HandlerContext) {
    // TODO: Implement
  },

  cancelMoves(gameId: number, ctx: HandlerContext) {
    // TODO: Implement
  },

  undoMove(gameId: number, ctx: HandlerContext) {
    // TODO: Implement
  },
};
```

**Updated:**
```typescript
import { UserId } from '@kernel/domains/user';
import { GameId } from '@kernel/domains/game';
import { RoomId } from '@kernel/domains/system';
import type { Coord, Direction } from '@core/types';

import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';
import { systemActions } from '@/domains/system/actions';

const gameplayActions = {
  joinRoom(roomId: RoomId, gameId: GameId, userId: UserId) {
    // TODO: [SYSTEM-DOMAIN] gameplay shouldn't own join-room/leave-room messages
    // System domain should handle room membership more generically
    // Consider removing gameplay:join-room/leave-room in favor of system:join-room

    // Join game room for broadcasts - ✅ FIXED: Correct types
    systemActions.joinRoom(roomId, userId);

    // TODO: [GAMEPLAY] Implement join room logic
    // - V1: GameServer.onPlayerJoinedRoom(userId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Track player connection in game instance
    // - Check if enough players connected to start countdown
    // - If yes: Start countdown timer, broadcast game-starting every second (5 → 4 → 3 → 2 → 1)
    // - When countdown reaches 0: Initialize game, update DB status to IN_PROGRESS, broadcast game-started
    // - Handle reconnection case (player was in game before)
  },

  leaveRoom(roomId: RoomId, gameId: GameId, userId: UserId) {
    // TODO: [GAMEPLAY] Implement leave room logic
    // - V1: GameServer.onPlayerLeftRoom(userId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Mark player as disconnected (but not defeated - they can reconnect)
    // - If game not started and player leaves, may need to cancel countdown
    // - Clear player's move queue
    // - Don't end game yet - wait for timeout or defeat

    // Leave game room - ✅ FIXED: Correct types
    systemActions.leaveRoom(roomId, userId);
  },

  queueMove(
    sourceCoord: Coord,
    direction: Direction,
    gameId: GameId,
    userId: UserId,
  ) {
    // TODO: [GAMEPLAY] Implement move queueing logic
    // - V1: GameServer.queueMove(userId, sourceCoord, direction)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Validations:
    //   - Player is in game and not defeated
    //   - Source coordinate is valid and owned by player
    //   - Player's queue size < 200 (MAX_MOVE_QUEUE_SIZE)
    // - Add move to player's queue: { sourceCoord, direction, timestamp }
    // - Move will be processed on next tick (no immediate broadcast)
    // - Return early if validation fails (log error)
    // - TODO: [V1-SUBOPTIMAL] v1 uses get-user-mapping to find game from userId
    //   This pattern is not ideal - consider better approach in v2
  },

  cancelMoves(gameId: GameId, userId: UserId) {
    // TODO: [GAMEPLAY] Implement cancel moves logic
    // - V1: GameServer.clearMoves(userId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Clear all queued moves for the player
    // - No validation needed (always safe to clear own moves)
    // - No immediate broadcast - reflected in next state-update
  },

  undoMove(gameId: GameId, userId: UserId) {
    // TODO: [GAMEPLAY] Implement undo move logic
    // - V1: GameServer.undoMove(userId, gameId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Pop last move from player's queue (LIFO)
    // - If queue empty, do nothing (no error)
    // - gameId used for validation (ensure player is in correct game)
    // - No immediate broadcast - reflected in next state-update
  },

  // TODO: [GAMEPLAY] Add internal helper functions as needed during unstubbing
  // Examples:
  // - startCountdown(gameId, roomId) - countdown timer management
  // - initializeGame(gameId) - game start logic
  // - validateMove(userId, gameId, sourceCoord, direction) - move validation
  // - getGameInstance(gameId) - access to GameServer instance
};

export { gameplayActions };
```

**Changes:**
- Add imports for branded types
- **CRITICAL FIX:** Change `systemActions.joinRoom(room, ctx)` → `systemActions.joinRoom(roomId, userId)`
- **CRITICAL FIX:** Change `systemActions.leaveRoom(room, ctx)` → `systemActions.leaveRoom(roomId, userId)`
- Update all method signatures to use branded types:
  - `room: string` → `roomId: RoomId`
  - `gameId: number` → `gameId: GameId`
  - `ctx: HandlerContext` → `userId: UserId` (extract userId at handler level)
- Follow import order from AGENTS.md

---

### Step 3: Update Gameplay WS-Effects (Backend)

**File:** `apps/backend/src/domains/gameplay/ws-effects.ts`

**Current:**
```typescript
import { MsgCreators } from '@protocol/domains/gameplay/server-messages';
import type { BoardState, PlayerIndex, PlayerMapping } from '@core/types';
import type { PlayerQueuesMap } from '@common/types/gameplay';
import type { GameWithPlayers } from '@common/types/games';

const wsBridge: any = {};

const gameplayWsEffects = {
  broadcastGameState(
    roomId: string,
    tick: number,
    boardState: BoardState,
    playerQueues?: PlayerQueuesMap,
  ) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createStateUpdateMessage(tick, boardState, playerQueues),
    );
  },

  broadcastGameStarting(roomId: string, gameId: number, countdown: number) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createGameStartingMessage(gameId, countdown),
    );
  },

  broadcastGameStarted(
    roomId: string,
    gameId: number,
    playerMapping: PlayerMapping,
    boardState: BoardState,
    game: GameWithPlayers,
  ) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createGameStartedMessage(gameId, playerMapping, boardState, game),
    );
  },

  broadcastGameEnded(roomId: string, winner: PlayerIndex, finalBoardState: BoardState) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createGameEndedMessage(winner, finalBoardState),
    );
  },
};
```

**Updated:**
```typescript
import { idToString, idToNumber } from '@kernel/branded-type';
import { RoomId } from '@kernel/domains/system';
import { GameId } from '@kernel/domains/game';
import { MsgCreators } from '@protocol/domains/gameplay/server-messages';
import type { BoardState, PlayerIndex, PlayerMapping } from '@core/types';
import type { PlayerQueuesMap } from '@common/types/gameplay';
import type { GameWithPlayers } from '@common/types/games';

// TODO: [PHASE-2] Replace with actual wsBridge implementation
const wsBridge: any = {};

const gameplayWsEffects = {
  /**
   * Broadcast game state update (called every tick during active gameplay)
   * V1: GameServer.broadcastGameState()
   */
  broadcastGameState(
    roomId: RoomId,
    tick: number,
    boardState: BoardState,
    playerQueues?: PlayerQueuesMap,
  ) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createStateUpdateMessage(tick, boardState, playerQueues),
    );
  },

  /**
   * Broadcast countdown notification (called every second before game starts)
   * V1: GameServer countdown timer callback
   */
  broadcastGameStarting(roomId: RoomId, gameId: GameId, countdown: number) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createGameStartingMessage(idToNumber(gameId), countdown),
    );
  },

  /**
   * Broadcast game started (called once when countdown reaches 0)
   * V1: GameServer.startGame()
   */
  broadcastGameStarted(
    roomId: RoomId,
    gameId: GameId,
    playerMapping: PlayerMapping,
    boardState: BoardState,
    game: GameWithPlayers,
  ) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createGameStartedMessage(
        idToNumber(gameId),
        playerMapping,
        boardState,
        game,
      ),
    );
  },

  /**
   * Broadcast game ended (called once when game completes)
   * V1: GameServer.endGame()
   */
  broadcastGameEnded(roomId: RoomId, winner: PlayerIndex, finalBoardState: BoardState) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createGameEndedMessage(winner, finalBoardState),
    );
  },
};

export { gameplayWsEffects };
```

**Changes:**
- Add imports for conversion helpers and branded types
- Update all method signatures to accept branded types:
  - `roomId: string` → `roomId: RoomId`
  - `gameId: number` → `gameId: GameId`
- Convert branded → primitives when calling protocol:
  - `idToString(roomId)` for wsBridge (RoomId is string-based)
  - `idToNumber(gameId)` for protocol messages (GameId is number-based)
- Add TODO comment for wsBridge
- Follow import order from AGENTS.md

---

### Step 4: Update Gameplay Handlers (Frontend)

**File:** `apps/frontend/src/domains/gameplay/handlers.ts`

**Current:**
```typescript
import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';

import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:state-update': (payload) => {
    gameplayActions.handleGameState(payload);
  },

  'gameplay:game-starting': (payload) => {
    gameplayActions.handleGameStarting(payload);
  },

  'gameplay:game-started': (payload) => {
    gameplayActions.handleGameStarted(payload);
  },

  'gameplay:game-ended': (payload) => {
    gameplayActions.handleGameEnded(payload);
  },
} satisfies HandlerMap<GameplayServerMessage>;
```

**Updated:**
```typescript
import { GameId } from '@kernel/domains/game';
import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';

import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:state-update': (payload) => {
    // No IDs to convert in this message
    gameplayActions.handleGameState(payload);
  },

  'gameplay:game-starting': (payload) => {
    gameplayActions.handleGameStarting({
      gameId: GameId(payload.gameId),
      countdown: payload.countdown,
    });
  },

  'gameplay:game-started': (payload) => {
    gameplayActions.handleGameStarted({
      gameId: GameId(payload.gameId),
      playerMapping: payload.playerMapping,
      boardState: payload.boardState,
      game: payload.game,
    });
  },

  'gameplay:game-ended': (payload) => {
    // No IDs to convert in this message
    gameplayActions.handleGameEnded(payload);
  },
} satisfies HandlerMap<GameplayServerMessage>;

export { gameplayHandlers };
```

**Changes:**
- Add import for `GameId`
- Convert inbound `gameId` primitives → `GameId(payload.gameId)`
- Messages without IDs (`state-update`, `game-ended`) pass through unchanged
- Follow matchmaking pattern exactly

---

### Step 5: Update Gameplay Actions (Frontend)

**File:** `apps/frontend/src/domains/gameplay/actions.ts`

**Current:** (Need to verify current state)

**Expected structure after update:**
```typescript
import { GameId } from '@kernel/domains/game';
import { RoomId } from '@kernel/domains/system';
import { MsgCreators } from '@protocol/domains/gameplay/client-messages';
import type { Coord, Direction, BoardState, PlayerMapping } from '@core/types';
import type { GameWithPlayers } from '@common/types/games';

// Mock WebSocket service until Phase 2
const wsService: any = {};

// ============================================================================
// OUTBOUND ACTIONS (Client → Server)
// ============================================================================

function joinRoom(roomId: RoomId) {
  wsService.send(MsgCreators.createJoinRoomMessage(idToString(roomId)));
}

function leaveRoom(roomId: RoomId) {
  wsService.send(MsgCreators.createLeaveRoomMessage(idToString(roomId)));
}

function requestMove(sourceCoord: Coord, direction: Direction) {
  wsService.send(MsgCreators.createMoveRequestMessage(sourceCoord, direction));
}

function cancelMoves() {
  wsService.send(MsgCreators.createCancelMovesMessage());
}

function undoMove(gameId: GameId) {
  wsService.send(MsgCreators.createUndoMoveMessage(idToNumber(gameId)));
}

// ============================================================================
// INBOUND ACTIONS (Server → Client)
// ============================================================================

function handleGameState(payload: {
  tick: number;
  boardState: BoardState;
  playerQueues?: any;
}) {
  // TODO: [GAMEPLAY_FE] Update store with game state
}

function handleGameStarting(payload: {
  gameId: GameId;
  countdown: number;
}) {
  // TODO: [GAMEPLAY_FE] Update store with countdown
}

function handleGameStarted(payload: {
  gameId: GameId;
  playerMapping: PlayerMapping;
  boardState: BoardState;
  game: GameWithPlayers;
}) {
  // TODO: [GAMEPLAY_FE] Update store with game start data
}

function handleGameEnded(payload: {
  winner: any;
  finalBoardState: BoardState;
}) {
  // TODO: [GAMEPLAY_FE] Update store with game end data
}

const gameplayActions = {
  // Outbound
  joinRoom,
  leaveRoom,
  requestMove,
  cancelMoves,
  undoMove,
  // Inbound
  handleGameState,
  handleGameStarting,
  handleGameStarted,
  handleGameEnded,
};

export { gameplayActions };
```

**Changes:**
- Add imports for branded types and conversion helpers
- Outbound actions convert branded → primitives when sending
- Inbound actions accept branded types
- Follow matchmaking pattern exactly

---

## Success Criteria

### Chat Domain
- ✅ MessageId type created in `@kernel/domains/chat`
- ✅ ChatMessageEntity uses branded types (MessageId, UserId, RoomId)
- ✅ Backend handlers convert primitives → branded (entry point)
- ✅ Backend actions work with branded types
- ✅ Backend ws-effects convert branded → primitives (exit point)
- ✅ Frontend handlers convert primitives → branded (entry point)
- ✅ Frontend actions work with branded types
- ✅ All TODO comments about branded types removed
- ✅ Import/export patterns follow AGENTS.md

### Gameplay Domain
- ✅ Backend handlers convert primitives → branded (entry point)
- ✅ Backend actions accept branded types
- ✅ **CRITICAL:** systemActions calls use correct types (RoomId, UserId)
- ✅ Backend ws-effects convert branded → primitives (exit point)
- ✅ Frontend handlers convert primitives → branded (entry point)
- ✅ Frontend actions work with branded types
- ✅ Import/export patterns follow AGENTS.md

### Overall
- ✅ Type-safe ID usage across all v2 domains
- ✅ Consistent pattern application (matching matchmaking reference)
- ✅ No type errors in TypeScript compilation
- ✅ Clean boundaries: primitives at edges, branded in domain logic

---

## After Implementation

### Testing
1. Run TypeScript type check on both apps:
   ```bash
   cd apps/backend && npx tsc --noEmit
   cd apps/frontend && npx tsc --noEmit
   ```
2. Verify no type errors related to ID usage
3. Verify systemActions calls compile correctly

### Documentation Updates
1. Add entry to `[STRATEGY-AND-TRACKER].md` completed section
2. Reference this tactical doc in tracker
3. Mark Phase 1 as complete (all domain scaffolding done)

### Next Steps
- Phase 2: WS infrastructure implementation (ws-bridge, ws-client, ws-server)
- Then: Unstub actions with real business logic

---

## Notes

**Critical Bug Fix:**
The gameplay domain had incorrect `systemActions` calls that would cause type errors. This implementation fixes those calls to use the correct branded types.

**MessageId Handling:**
- MessageId is NOT included in chat protocol messages (client or server)
- Server-side only: Used internally in ChatMessageEntity
- Temporary generation uses timestamp + random
- Real implementation will get ID from database

**Pattern Consistency:**
All implementations follow the matchmaking reference pattern:
- Handlers: `primitive → branded` (entry)
- Actions: branded types exclusively
- WS-effects: `branded → primitive` (exit)

**Import Order:**
All files follow AGENTS.md import order:
1. Third-party libraries
2. Shared packages (kernel → protocol → platform)
3. App-level code (infrastructure → domains)
