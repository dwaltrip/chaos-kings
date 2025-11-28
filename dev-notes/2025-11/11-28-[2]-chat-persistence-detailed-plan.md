# Chat Persistence - Detailed Implementation Plan

**Status:** Updated 2025-11-28 to align with domain object patterns from docs/domain-object-patterns.md

## Overview

Implementing persistent game chat with DB storage and REST API for history retrieval.

**Pattern:** Following the 3-layer pattern (DB → Backend Entity → Protocol) documented in docs/domain-object-patterns.md

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

**Pattern:** Separate serializers file for DB → Entity conversions. Keeps repository focused on data access, serializers focused on transformations.

**Decision:** Join with `users` table when fetching (don't denormalize username into chat table).

```typescript
import { Selectable } from 'kysely';
import { ChatMessageId, GameId, RoomId, UserId } from '@kernel/ids';
import { buildGameRoomId } from '@platform/domains/gameplay/helpers';

import { GameChatMessagesTable } from '@/domains/chat/chat.db';
import { ChatMessageEntity } from '@/domains/chat/types';

// DB row type (with username from join)
type ChatMessageRow = Selectable<GameChatMessagesTable> & { username: string };

// Convert DB row to backend entity
function toEntity(row: ChatMessageRow, gameId: GameId): ChatMessageEntity {
  const roomId = buildGameRoomId(gameId);
  return {
    id: ChatMessageId(row.id),
    gameId,
    userId: UserId(row.user_id),
    username: row.username,
    roomId,
    content: row.content,
    timestamp: row.created_at.getTime(),
  };
}

export { toEntity };
export type { ChatMessageRow };
```

### 3.2 Update ChatMessageEntity Type
**File:** `apps/backend/src/domains/chat/types.ts`

Add `gameId` field to entity (needed for repository queries and REST API):

```typescript
import { ChatMessageId, GameId, RoomId, UserId } from '@kernel/ids';

interface ChatMessageEntity {
  id: ChatMessageId;
  gameId: GameId;      // ADD - needed for DB operations
  userId: UserId;
  username: string;
  roomId: RoomId;
  content: string;
  timestamp: number;
}
```

### 3.3 Update createChatMessage Action
**File:** `apps/backend/src/domains/chat/actions/create-chat-message.ts`

**Pattern:** Action calls repository, then uses serializer to convert to entity.

```typescript
import { GameId, RoomId, UserId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';
import { buildGameRoomId } from '@platform/domains/gameplay/helpers';

import { ChatMessageRepository } from '@/domains/chat/chat-message-repository';
import { toEntity } from '@/domains/chat/serializers';
import { ChatMessageEntity } from '@/domains/chat/types';

async function createChatMessage(
  gameId: GameId,
  content: string,
  userId: UserId,
): Promise<ChatMessageEntity> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Chat message content cannot be empty');
  }

  // Insert into DB (repository handles username join on return)
  const chatRepo = new ChatMessageRepository();
  const dbRow = await chatRepo.createGameChat({
    content: trimmed,
    user_id: idToNumber(userId),
    game_id: idToNumber(gameId),
    updated_at: new Date(),
  });

  // Convert DB row to entity using serializer
  return toEntity(dbRow, gameId);
}

export { createChatMessage };
```

**Note:** Simplified signature - removed `roomId` parameter since we can derive it from `gameId`.

### 3.4 Update broadcastChatMessage Action
**File:** `apps/backend/src/domains/chat/actions/broadcast-chat-message.ts`

```typescript
import { GameId, UserId } from '@kernel/ids';

import { chatWsEffects } from '@/domains/chat/ws-effects';
import { createChatMessage } from '@/domains/chat/actions';

async function broadcastChatMessage(
  gameId: GameId,
  content: string,
  userId: UserId
) {
  const chatMessage = await createChatMessage(gameId, content, userId);
  chatWsEffects.broadcastNewMessage(chatMessage);
}

export { broadcastChatMessage };
```

**Note:** Simplified - removed `roomId` parameter (derived from `gameId` in entity).

### 3.5 Update Handler
**File:** `apps/backend/src/domains/chat/handlers.ts`

**Convert `gameId` to branded type and call action:**
```typescript
import { GameId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';
import type { AppHandlerContext } from '@/ws/app-handler-context';

import { broadcastChatMessage } from '@/domains/chat/actions';

const chatHandlers = {
  'chat:send-message': ({ gameId, content }, ctx) => {
    broadcastChatMessage(
      GameId(gameId),
      content,
      UserId(ctx.userId)
    );
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, AppHandlerContext>;

export { chatHandlers };
```

**Key change:** Handler converts primitives to branded types, action/serializer handle roomId derivation.

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

### 3.7 Update Repository
**File:** `apps/backend/src/domains/chat/chat-message-repository.ts`

Update both `createGameChat` and `findGameChatsByGameId` to join with users table and return `ChatMessageRow`:

```typescript
import { Selectable, Insertable, Kysely } from 'kysely';
import { GameId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import { Database } from '@/types';
import { db } from '@/services/db';
import { GameChatMessagesTable } from '@/domains/chat/chat.db';
import { ChatMessageRow } from '@/domains/chat/serializers';

class ChatMessageRepository {
  constructor(private dbInstance: Kysely<Database> = db) {}

  async createGameChat(data: Insertable<GameChatMessagesTable>): Promise<ChatMessageRow> {
    const message = await this.dbInstance
      .insertInto('game_chat_messages')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Join to get username
    const messageWithUsername = await this.dbInstance
      .selectFrom('game_chat_messages')
      .innerJoin('users', 'users.id', 'game_chat_messages.user_id')
      .select([
        'game_chat_messages.id',
        'game_chat_messages.content',
        'game_chat_messages.created_at',
        'game_chat_messages.updated_at',
        'game_chat_messages.user_id',
        'game_chat_messages.game_id',
        'users.username',
      ])
      .where('game_chat_messages.id', '=', message.id)
      .executeTakeFirstOrThrow();

    return messageWithUsername;
  }

  async findGameChatsByGameId(gameId: GameId): Promise<ChatMessageRow[]> {
    const messages = await this.dbInstance
      .selectFrom('game_chat_messages')
      .innerJoin('users', 'users.id', 'game_chat_messages.user_id')
      .select([
        'game_chat_messages.id',
        'game_chat_messages.content',
        'game_chat_messages.created_at',
        'game_chat_messages.updated_at',
        'game_chat_messages.user_id',
        'game_chat_messages.game_id',
        'users.username',
      ])
      .where('game_chat_messages.game_id', '=', idToNumber(gameId))
      .orderBy('game_chat_messages.created_at', 'asc')
      .execute();

    return messages;
  }
}

export { ChatMessageRepository };
```

**Pattern:** Repository returns `ChatMessageRow` (DB row with username), serializer converts to `ChatMessageEntity`.

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

### 5.5 Update Chat Message Type
**File:** `apps/frontend/src/domains/chat/types.ts`

**Pattern decision:** Per docs/domain-object-patterns.md, frontend should reuse protocol shape when possible.

**Option A (Recommended): Reuse protocol shape**
```typescript
import type { ChatServerPayloadMap } from '@protocol/domains/chat/server-messages';

type ChatMessage = ChatServerPayloadMap['chat:broadcast-message'];
```

**Option B: Define custom type (only if UI-specific fields needed)**
```typescript
interface ChatMessage {
  id: number;
  roomId: string;
  content: string;
  userId: number;
  username: string;
  timestamp: number;
  isOptimistic?: boolean;  // If needed for optimistic updates
}
```

**Use Option A unless you need UI-specific fields.**

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

## Pattern Decisions (Updated 2025-11-28)

✅ **Resolved:**
1. **Separate serializers file** - Keeps repository focused on data access, serializers on conversions
2. **Username via join** - Join with users table, don't denormalize
3. **Frontend type** - Reuse protocol shape (Option A) unless UI-specific fields needed
4. **No intermediate type aliases** - Use `Selectable<GameChatMessagesTable>` inline, export `ChatMessageRow` from serializers for reuse

## Open Questions / TODOs

1. **REST API patterns:** Verify exact helpers (asyncHandler, parseId) used in existing routes
2. **Auth on REST endpoint:** How to verify user has access to game?
3. **Frontend chat store structure:** Need to explore current implementation
4. **Future optimization:** Consider optimistic message display

## Summary of Key Changes

1. **Client sends only `gameId`** (not roomId) - server derives roomId authoritatively
2. **Message ID required** in broadcast message for frontend deduplication
3. **REST endpoint** at `/api/games/:gameId/chat` via new `chat-routes.ts` file
4. **Migration edited** directly (not shipped yet) to add index
5. **Handler validates** gameId and builds roomId using `buildGameRoomId()`
