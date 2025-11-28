# Domain Object Patterns

**Status:** TENTATIVE - Patterns evolving as we implement chat persistence and other features
**Last Updated:** 2025-11-28

This document describes patterns for representing domain objects across different layers of the application (database, backend domain, protocol, frontend domain). The goal is to minimize unnecessary type projections while maintaining type safety and clear boundaries.

---

## The Problem

Domain objects (like chat messages, games, users) need different representations in different contexts:
- **Database:** Snake_case columns, foreign key IDs, `Date` objects
- **Backend domain:** CamelCase, branded type IDs, enriched with joined data
- **Protocol (wire format):** Primitives for JSON serialization
- **Frontend domain:** May need UI-specific fields (loading states, optimistic updates)

Without clear patterns, we end up with too many intermediate projections and duplicated type definitions.

---

## The Pattern: 3 Layers

### Layer 1: Shared Vocabulary (`@core`, `@kernel`)

**Purpose:** Stable types used across frontend, backend, AND protocol.

**Examples:**
- `Coord`, `Direction`, `BoardState` (in `@core/types`)
- `ChatMessageId`, `GameId`, `UserId` (branded types in `@kernel`)

**Key principle:** These are fundamental domain types that represent the shared language of the application. They can be imported anywhere, including protocol.

```typescript
// @kernel/domains/chat.ts
type ChatMessageId = Brand<number, 'ChatMessageId'>;

// @core/types.ts
type Coord = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type BoardState = { grid: GameGrid; size: Size2d };
```

---

### Layer 2: Wire Format (`@protocol`)

**Purpose:** Describes the exact JSON structure that goes over WebSockets.

**Can import:** Type definitions from `@core`, `@kernel`, and `@platform` when they represent shared vocabulary.

**Cannot import:** Functions, business logic, or stateful code.

**Uses primitives for IDs** (not branded types) for JSON serialization.

```typescript
// packages/protocol/domains/chat/server-messages.ts
import type { MessageUnion } from '@protocol/utils/message-helpers';

type ChatServerPayloadMap = {
  'chat:broadcast-message': {
    id: number;           // primitive, not ChatMessageId
    roomId: string;       // primitive, not RoomId
    content: string;
    userId: number;       // primitive, not UserId
    username: string;
    timestamp: number;
  };
};
```

```typescript
// packages/protocol/domains/gameplay/server-messages.ts
import type { BoardState, PlayerIndex } from '@core/types';  // ✅ Reuse shared types

type GameplayServerPayloadMap = {
  'gameplay:state-update': {
    tick: number;
    boardState: BoardState;  // Direct reuse!
  };
};
```

---

### Layer 3: App-Specific Entities (apps/backend, apps/frontend)

**Purpose:** Working models for each app's specific needs.

#### Backend Entities

Backend entities are enriched with data from database joins and use branded types for type safety.

```typescript
// apps/backend/src/domains/chat/types.ts
import { ChatMessageId, RoomId, UserId } from '@kernel/ids';

interface ChatMessageEntity {
  id: ChatMessageId;        // branded
  gameId: GameId;           // branded
  userId: UserId;           // branded
  username: string;         // enriched from users table join
  roomId: RoomId;           // derived from gameId
  content: string;
  timestamp: number;        // converted from created_at Date
}
```

#### Frontend Entities

**Frontend has two options:**

**Option A: Reuse protocol shape directly (recommended when possible)**
```typescript
// apps/frontend/src/domains/chat/types.ts
import type { ChatServerPayloadMap } from '@protocol/domains/chat/server-messages';

// Just alias the protocol payload
type ChatMessage = ChatServerPayloadMap['chat:broadcast-message'];
```

**When to use Option A:**
- Frontend doesn't need additional fields beyond protocol
- No UI-specific state needed (loading, optimistic, etc.)
- Protocol payload is already complete for UI needs

**Option B: Define custom entity**
```typescript
// apps/frontend/src/domains/chat/types.ts
interface ChatMessage {
  id: number;
  roomId: string;
  content: string;
  userId: number;
  username: string;
  timestamp: number;
  isOptimistic?: boolean;  // UI-specific field
  isEditing?: boolean;     // UI-specific field
}
```

**When to use Option B:**
- Frontend needs UI-specific fields (loading states, optimistic updates)
- Branded types provide value on frontend
- Need to compute derived fields for UI

---

## Database Layer

### Table Schema Definitions

Use Kysely table schemas without creating unnecessary type aliases:

```typescript
// apps/backend/src/domains/chat/chat.db.ts
import { ColumnType, Generated } from 'kysely';

interface GameChatMessagesTable {
  id: Generated<number>;
  content: string;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  user_id: number;
  game_id: number;
}
```

### Avoid Intermediate Types

❌ **Don't create unnecessary aliases:**
```typescript
type GameChatMessageDB = Selectable<GameChatMessagesTable>;  // Unnecessary!
```

✅ **Use Kysely types inline:**
```typescript
async findById(id: number): Promise<Selectable<GameChatMessagesTable> | null> {
  // ...
}
```

---

## Conversion Functions

Use conversion functions to transform between layers.

### Separate Serializers Pattern (Recommended)

**Recommended approach:** Keep serializers in a separate `serializers.ts` file.

**Benefits:**
- **Separation of concerns:** Repository focuses on data access, serializers focus on transformations
- **Reusability:** Multiple views on the same data for different use cases
- **Easier to add projections:** New API endpoints or features can add new serializers without modifying repository
- **Type exports:** Serializers can export intermediate types (like `ChatMessageRow`) for reuse

```typescript
// apps/backend/src/domains/chat/serializers.ts
import { Selectable } from 'kysely';
import { ChatMessageId, GameId, RoomId, UserId } from '@kernel/ids';
import { buildGameRoomId } from '@platform/domains/gameplay/helpers';

import { GameChatMessagesTable } from '@/domains/chat/chat.db';
import { ChatMessageEntity } from '@/domains/chat/types';

// Export the enriched DB row type for reuse
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

// Can add more serializers for different use cases
function toApiResponse(row: ChatMessageRow) {
  return {
    id: row.id,
    content: row.content,
    userId: row.user_id,
    username: row.username,
    timestamp: row.created_at.getTime(),
  };
}

export { toEntity, toApiResponse };
export type { ChatMessageRow };
```

```typescript
// apps/backend/src/domains/chat/chat-message-repository.ts
import { Selectable, Insertable, Kysely } from 'kysely';
import { GameId } from '@kernel/ids';
import { GameChatMessagesTable } from './chat.db';
import { ChatMessageRow } from './serializers';

class ChatMessageRepository {
  async findGameChatsByGameId(gameId: GameId): Promise<ChatMessageRow[]> {
    const rows = await this.dbInstance
      .selectFrom('game_chat_messages')
      .innerJoin('users', 'users.id', 'game_chat_messages.user_id')
      .select([...])
      .where('game_id', '=', idToNumber(gameId))
      .execute();

    return rows; // Return raw rows, let caller choose serializer
  }
}
```

```typescript
// apps/backend/src/domains/chat/actions/create-chat-message.ts
import { ChatMessageRepository } from '@/domains/chat/chat-message-repository';
import { toEntity } from '@/domains/chat/serializers';

async function createChatMessage(gameId: GameId, ...): Promise<ChatMessageEntity> {
  const repo = new ChatMessageRepository();
  const dbRow = await repo.createGameChat({...});

  // Use serializer to convert
  return toEntity(dbRow, gameId);
}
```

### Alternative: Repository Pattern

If you prefer keeping conversions in the repository (less recommended, but simpler for small projects):

```typescript
// apps/backend/src/domains/chat/chat-message-repository.ts
import { Selectable, Insertable, Kysely } from 'kysely';
import { ChatMessageId, GameId, UserId } from '@kernel/ids';
import { GameChatMessagesTable } from './chat.db';
import { ChatMessageEntity } from './types';

class ChatMessageRepository {
  async findGameChatsByGameId(gameId: GameId): Promise<ChatMessageEntity[]> {
    const rows = await this.dbInstance
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
      .where('game_id', '=', idToNumber(gameId))
      .orderBy('created_at', 'asc')
      .execute();

    // Convert directly to entities
    return rows.map(row => this.toEntity(row, gameId));
  }

  private toEntity(
    dbRow: Selectable<GameChatMessagesTable> & { username: string },
    gameId: GameId
  ): ChatMessageEntity {
    const roomId = buildGameRoomId(gameId);
    return {
      id: ChatMessageId(dbRow.id),
      gameId,
      userId: UserId(dbRow.user_id),
      username: dbRow.username,
      roomId,
      content: dbRow.content,
      timestamp: dbRow.created_at.getTime(),
    };
  }
}
```

---

## Summary: Total Projections

For a typical domain object like chat messages:

1. **Table schema** - `GameChatMessagesTable` (DB structure)
2. **Shared vocabulary** - `ChatMessageId` in `@kernel` (if needed)
3. **Protocol payload** - `ChatServerPayloadMap['chat:broadcast-message']` (wire format)
4. **Backend entity** - `ChatMessageEntity` (enriched, branded)
5. **Frontend entity** - Reuse protocol (Option A) OR custom type (Option B)

**Total: 3-5 representations** depending on frontend needs.

**NOT:**
- ❌ `GameChatMessageDB = Selectable<Table>` (use inline)
- ❌ `NewGameChatMessage = Insertable<Table>` (use inline)
- ❌ Duplicated type definitions in protocol

---

## Conversion Boundaries

**Database → Backend Entity:**
- **Preferred:** Separate serializers (e.g., `toEntity()` in `serializers.ts`)
- **Alternative:** Repository private methods
- Converts snake_case → camelCase
- Converts `Date` → `number` (timestamps)
- Converts IDs → branded types
- Enriches with joined data

**Backend Entity → Protocol:**
- WS-effects functions
- Converts branded types → primitives
- Destructures entity into protocol payload shape

**Protocol → Frontend:**
- Handlers receive protocol messages
- May convert to custom frontend entity OR
- Store protocol shape directly in Zustand stores

---

## Examples from Codebase

### ✅ Good Pattern: Game Repository

```typescript
// apps/backend/src/domains/games/types.ts
import { Selectable, Insertable } from 'kysely';
import { GamesTable } from './game.db';
import { GameId } from '@kernel/ids';

// Only create the entity type with branded IDs
type Game = Omit<Selectable<GamesTable>, 'id'> & { id: GameId };

// Use Insertable inline for create operations
type NewGame = Insertable<GamesTable>;

// apps/backend/src/domains/games/game-repository.ts
function deserializeGame(game: Selectable<GamesTable>): Game {
  return { ...game, id: GameId(game.id) };
}
```

This pattern could be even leaner by using `Selectable<GamesTable>` inline instead of aliasing to `NewGame`.

---

## Open Questions

1. **When to use branded types on frontend?** Currently backend uses branded types extensively, frontend less so. Is this the right balance?

2. ~~**Serializer files vs repository methods?**~~ ✅ **RESOLVED (2025-11-28):** Prefer separate `serializers.ts` files. Enables reusability (multiple views on data), separation of concerns, and easier addition of new projections for different use cases.

3. **Protocol DTO vs Entity alignment:** When protocol payloads closely match backend entities, is that a sign of good design (aligned models) or coupling concern?

4. ~~**Repository return types:**~~ ✅ **RESOLVED (2025-11-28):** Repositories return enriched DB rows (e.g., `ChatMessageRow`), actions/callers use serializers to convert to entities. This gives callers flexibility to choose different serializers for different use cases.

---

## Related Documentation

- **docs/architecture.md** - Overall architecture, dependency rules
- **docs/open-questions.md** - Unresolved architectural questions
- **AGENTS.md** - Import/export patterns, coding conventions
