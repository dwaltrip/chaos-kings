# Chat Persistence - Detailed Implementation Plan

## Overview

Implementing persistent game chat with DB storage and REST API for history retrieval.

## Phase 1: Database & Migration

### 1.1 Update Migration - Add Index
**File:** `apps/backend/migrations/1762059440118_create_game_chat_table.ts`

**Note:** This migration already exists but hasn't been shipped yet, so we're editing it directly.

Add index on `game_id` for efficient lookups:
```typescript
.addColumn('game_id', 'integer', (col) => col.notNull())
.addForeignKeyConstraint(...)
.execute();

// Add this:
await db.schema
  .createIndex('game_chat_messages_game_id_idx')
  .on('game_chat_messages')
  .column('game_id')
  .execute();
```

### 1.2 Update Database Types
**File:** `apps/backend/src/types.ts`

Already done - `GameChatMessagesTable` is exported in Database interface.

## Phase 2: Protocol Updates

### 2.1 Update Client Message Protocol
**File:** `packages/protocol/domains/chat/client-messages.ts`

**Remove `roomId`** from payload (server will derive it) and **add `gameId`**:
```typescript
type ChatClientPayloadMap = {
  'chat:send-message': {
    gameId: number;  // ADD - client sends this
    content: string;
    // roomId: string; REMOVE - server derives this from gameId
  };
};
```

Also update the message creator if it exists:
```typescript
// Update signature in MsgCreators
createSendMessageMessage: (gameId: number, content: string) => ({
  type: 'chat:send-message',
  payload: { gameId, content },
})
```

### 2.2 Update Server Message Protocol (REQUIRED for deduplication)
**File:** `packages/protocol/domains/chat/server-messages.ts`

**Add `id` field** to broadcast message for frontend deduplication:
```typescript
type ChatServerPayloadMap = {
  'chat:broadcast-message': {
    id: number;        // ADD - DB-generated message ID
    roomId: string;
    content: string;
    userId: number;
    username: string;
    timestamp: number;
  };
};
```

Update `MsgCreators.createBroadcastMessageMessage()` signature:
```typescript
createBroadcastMessageMessage: (
  id: number,          // ADD first parameter
  roomId: string,
  content: string,
  userId: number,
  username: string,
  timestamp: number,
): BroadcastMessageMessage => ({
  type: 'chat:broadcast-message',
  payload: { id, roomId, content, userId, username, timestamp },
})
```

## Phase 3: Backend Chat Domain

### 3.1 Implement Serializers
**File:** `apps/backend/src/domains/chat/serializers.ts`

```typescript
import { Selectable } from 'kysely';
import { ChatMessageId, RoomId, UserId } from '@kernel/ids';
import { GameChatMessagesTable } from './chat.db';
import { ChatMessageEntity } from './types';

type GameChatMessageDB = Selectable<GameChatMessagesTable>;

function serializeChatMessageForGame(dbMessage: GameChatMessageDB, roomId: RoomId, username: string): ChatMessageEntity {
  return {
    id: ChatMessageId(dbMessage.id),
    roomId,
    content: dbMessage.content,
    userId: UserId(dbMessage.user_id),
    username,
    timestamp: dbMessage.created_at.getTime(),
  };
}

// For REST API responses
function serializeChatMessagesForAPI(dbMessages: GameChatMessageDB[]): Array<{
  id: number;
  content: string;
  userId: number;
  username: string;
  timestamp: number;
}> {
  // TODO: Need to join with users table to get username
  // Or store username in game_chat_messages table
}
```

**DECISION NEEDED:** Should we store `username` in `game_chat_messages` table, or join with `users` table when fetching?

### 3.2 Update ChatMessageEntity Type (Optional)
**File:** `apps/backend/src/domains/chat/types.ts`

Currently uses temp ChatMessageId. After DB insert, we'll use real integer ID converted to branded type.

No changes needed unless we want to track whether message is persisted.

### 3.3 Update createChatMessage Action
**File:** `apps/backend/src/domains/chat/actions/create-chat-message.ts`

```typescript
import { ChatMessageId, GameId, RoomId, UserId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';
import { requireEntity } from '@/utils/db-utils';
import { UserRepository } from '@/domains/users/user-repository';
import { ChatMessageRepository } from '@/domains/chat/chat-message-repository';
import { ChatMessageEntity } from '@/domains/chat/types';

async function createChatMessage(
  roomId: RoomId,
  gameId: GameId,  // ADD THIS PARAMETER
  content: string,
  userId: UserId,
): Promise<ChatMessageEntity> {
  const user = await requireEntity(
    new UserRepository().findById(userId),
    'User not found for broadcasting chat message',
  );

  const trimmed = content.trim();
  if (!trimmed) {
    console.error('Chat message contents empty...');
  }

  // Insert into DB
  const chatRepo = new ChatMessageRepository();
  const dbMessage = await chatRepo.createGameChat({
    content: trimmed,
    user_id: idToNumber(userId),
    game_id: idToNumber(gameId),
    updated_at: new Date(),
  });

  // Return entity with DB-generated ID and timestamp
  return {
    id: ChatMessageId(dbMessage.id),
    roomId,
    content: dbMessage.content,
    userId,
    username: user.username,
    timestamp: dbMessage.created_at.getTime(),
  };
}

export { createChatMessage };
```

### 3.4 Update broadcastChatMessage Action
**File:** `apps/backend/src/domains/chat/actions/broadcast-chat-message.ts`

```typescript
import { GameId, RoomId, UserId } from '@kernel/ids';
import { chatWsEffects } from '@/domains/chat/ws-effects';
import { createChatMessage } from '@/domains/chat/actions';

async function broadcastChatMessage(
  roomId: RoomId,
  gameId: GameId,  // ADD THIS PARAMETER
  content: string,
  userId: UserId
) {
  const chatMessage = await createChatMessage(roomId, gameId, content, userId);
  chatWsEffects.broadcastNewMessage(chatMessage);
}

export { broadcastChatMessage };
```

### 3.5 Update Handler
**File:** `apps/backend/src/domains/chat/handlers.ts`

**Convert `gameId` to branded type and derive authoritative `roomId`** from it:
```typescript
import { GameId, UserId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';
import { buildGameRoomId } from '@platform/domains/gameplay/helpers';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';
import type { AppHandlerContext } from '@/ws/app-handler-context';
import { broadcastChatMessage } from '@/domains/chat/actions';

const chatHandlers = {
  'chat:send-message': ({ gameId, content }, ctx) => {
    const brandedGameId = GameId(gameId);
    // Derive authoritative roomId from gameId (server controls this)
    const roomId = buildGameRoomId(brandedGameId);

    broadcastChatMessage(
      roomId,
      brandedGameId,
      content,
      UserId(ctx.userId)
    );
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, AppHandlerContext>;

export { chatHandlers };
```

**Key change:** Handler now derives `roomId` from `gameId` using `buildGameRoomId()` instead of trusting client-provided roomId.

### 3.6 Update WS Effects (REQUIRED)
**File:** `apps/backend/src/domains/chat/ws-effects.ts`

**Add message ID** as first parameter to `MsgCreators.createBroadcastMessageMessage()`:
```typescript
const chatWsEffects = {
  broadcastNewMessage({
    id,            // Use this
    roomId,
    content,
    userId,
    username,
    timestamp,
  }: ChatMessageEntity) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createBroadcastMessageMessage(
        idToNumber(id),        // ADD - now required for deduplication
        idToString(roomId),
        content,
        idToNumber(userId),
        username,
        timestamp,
      ),
    );
  },
};
```

### 3.7 Update Repository (if needed)
**File:** `apps/backend/src/domains/chat/chat-message-repository.ts`

Current implementation looks good. Might want to add username join:
```typescript
async findGameChatsByGameId(gameId: GameId): Promise<Array<GameChatMessageDB & { username: string }>> {
  const messages = await this.dbInstance
    .selectFrom('game_chat_messages')
    .innerJoin('users', 'users.id', 'game_chat_messages.user_id')
    .select([
      'game_chat_messages.id',
      'game_chat_messages.content',
      'game_chat_messages.created_at',
      'game_chat_messages.user_id',
      'game_chat_messages.game_id',
      'users.username',
    ])
    .where('game_chat_messages.game_id', '=', gameId)
    .orderBy('game_chat_messages.created_at', 'asc')
    .execute();

  return messages;
}
```

## Phase 4: REST API Endpoint

### 4.1 Create Chat Routes File
**File:** `apps/backend/src/domains/chat/chat-routes.ts`

Create new routes file following existing domain patterns:
```typescript
import type { FastifyPluginAsync } from 'fastify';
import { GameId } from '@kernel/ids';
import { asyncHandler } from '@/utils/async-handler';  // or similar helper
import { parseId } from '@/utils/route-helpers';        // or similar helper
import { ChatMessageRepository } from './chat-message-repository';

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/games/:gameId/chat
  fastify.get(
    '/games/:gameId/chat',
    asyncHandler(async (request, reply) => {
      const gameId = GameId(parseId(request.params.gameId));

      // TODO: Auth check - verify user has access to this game
      // Example: await requireGameAccess(request.user.id, gameId);

      const chatRepo = new ChatMessageRepository();
      const messages = await chatRepo.findGameChatsByGameId(gameId);

      // Serialize for API response
      const serialized = messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        userId: msg.user_id,
        username: msg.username,
        timestamp: msg.created_at.getTime(),
      }));

      return reply.send({ messages: serialized });
    })
  );
};

export { chatRoutes };
```

### 4.2 Register Routes in Server
**File:** `apps/backend/src/server.ts`

Register the chat routes with Fastify:
```typescript
import { chatRoutes } from '@/domains/chat/chat-routes';

// In server setup:
await server.register(chatRoutes, { prefix: '/api' });
```

**TODO:** Verify exact pattern used in other domain routes (check existing game routes, user routes, etc.).

## Phase 5: Frontend Updates

### 5.1 Update Chat Send Action
**File:** `apps/frontend/src/domains/chat/actions.ts` (or wherever chat send is)

**Remove `roomId`** and send only `gameId` and `content`:
```typescript
// Before:
ws.send({ type: 'chat:send-message', payload: { roomId, content } });

// After:
ws.send({ type: 'chat:send-message', payload: { gameId, content } });
```

The frontend should pass the numeric `gameId` (from game state/URL/store), not the roomId.

### 5.2 Create API Client Method
**File:** `apps/frontend/src/api/client.ts` (or similar)

```typescript
async function fetchGameChatHistory(gameId: number): Promise<ChatMessage[]> {
  const response = await fetch(`/api/games/${gameId}/chat`);
  const data = await response.json();
  return data.messages;
}
```

### 5.3 Load Chat History on Game Join
**File:** `apps/frontend/src/domains/game/actions.ts` (or game page component)

```typescript
// When joining/loading game:
async function loadGameChat(gameId: number) {
  const history = await fetchGameChatHistory(gameId);
  chatStore.mergeMessages(history); // deduplicate
}
```

### 5.4 Implement Deduplication in Store
**File:** `apps/frontend/src/domains/chat/store.ts`

**Note:** Messages now have numeric `id` field (from Phase 2.2), so we can deduplicate by ID.

```typescript
mergeMessages: (newMessages) => {
  set((state) => {
    const existingIds = new Set(state.messages.map(m => m.id));
    const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
    return {
      messages: [...state.messages, ...uniqueNew].sort((a, b) => a.timestamp - b.timestamp)
    };
  });
}
```

### 5.5 Update Chat Message Type (if needed)
**File:** `apps/frontend/src/domains/chat/types.ts` (or similar)

Ensure frontend chat message type includes `id: number`:
```typescript
interface ChatMessage {
  id: number;        // DB-generated ID for deduplication
  content: string;
  userId: number;
  username: string;
  timestamp: number;
  // roomId might still be here for display purposes
}
```

## Testing Checklist

- [ ] Migration runs successfully and creates index
- [ ] Can send chat message and it persists to DB
- [ ] Chat message broadcasts with real DB ID
- [ ] REST endpoint returns chat history
- [ ] Frontend fetches and displays history on game join
- [ ] Messages deduplicate correctly (no duplicates shown)
- [ ] Message ordering is correct (by timestamp)
- [ ] Empty chat history doesn't error
- [ ] Auth/permissions work correctly on REST endpoint

## Open Questions / TODOs

1. **Username storage:** Store in `game_chat_messages` or join with `users`? (Current plan: join with users table)
2. **REST API patterns:** Verify exact helpers (asyncHandler, parseId) used in existing routes
3. **Auth on REST endpoint:** How to verify user has access to game?
4. **Frontend chat store structure:** Need to explore current implementation
5. **Future optimization:** Consider optimistic message display

## Summary of Key Changes

1. **Client sends only `gameId`** (not roomId) - server derives roomId authoritatively
2. **Message ID required** in broadcast message for frontend deduplication
3. **REST endpoint** at `/api/games/:gameId/chat` via new `chat-routes.ts` file
4. **Migration edited** directly (not shipped yet) to add index
5. **Handler validates** gameId and builds roomId using `buildGameRoomId()`
