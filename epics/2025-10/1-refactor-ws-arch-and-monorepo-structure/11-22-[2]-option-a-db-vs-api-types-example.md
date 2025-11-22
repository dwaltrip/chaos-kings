# Option A: Separate DB vs API Types - Concrete Example

**Date:** 2025-11-22
**Context:** Question 2 from common cleanup - how to handle DB types vs API types

---

## Current State (What We Have Now)

### Backend has TWO type systems that are disconnected:

**1. Backend's own types** (`backend/src/domains/games/types.ts`):
```typescript
// DB layer (what Kysely returns)
type DBGame = Selectable<GamesTable>;  // created_at: Date

// Domain layer (with branded types)
type Game = Omit<DBGame, 'id'> & { id: GameId };  // created_at: Date
```

**2. Common's shared types** (`common/types/games.ts`):
```typescript
// Shared type used by both BE + FE
interface Game {
  id: number;
  // ...
  created_at: Date | string;  // ❌ Loses type safety!
  updated_at: Date | string;  // ❌ Loses type safety!
}

interface GameWithPlayers extends Game {
  players: Player[];
}
```

### Current Flow (Implicit Serialization)

```
┌─────────────────────────────────────────────────────────────┐
│ BACKEND                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DB (Postgres)                                               │
│    ↓                                                         │
│  GamesTable: { created_at: Date }  (Kysely schema)          │
│    ↓                                                         │
│  DBGame: { created_at: Date }  (Selectable<GamesTable>)     │
│    ↓                                                         │
│  Game: { id: GameId, created_at: Date }  (domain type)      │
│    ↓                                                         │
│  GameRepository.findByIdWithPlayers()                        │
│    ↓                                                         │
│  Game & { players: GamePlayer[] }  (still has Date)         │
│    ↓                                                         │
│  🎯 HTTP Route handler (game-routes.ts:34)                  │
│     reply.send({ game })  ← Fastify serializes Date → string│
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
                      HTTP (JSON over wire)
                      created_at: "2024-10-31T..."
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  fetch('/api/games/123')                                     │
│    ↓                                                         │
│  response.json() as GetGameResponse                          │
│    ↓                                                         │
│  GameWithPlayers: { created_at: Date | string } ❌           │
│    ↓                                                         │
│  Store / Component (actually gets string, types lie!)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Problem:** Types say `Date | string` but at runtime:
- Backend has `Date` (before serialization)
- Frontend has `string` (after deserialization)
- No type safety - you have to remember which you have

---

## Option A: Separate Types (Proposed)

### New Type Hierarchy

**1. Core DB Entities** (`@core/src/types/entities.ts`):
```typescript
import { GameId, PlayerId, UserId } from '@kernel/ids';
import { GameConfig } from '@core/game-config';
import { CompletedGameState } from '@core/types';

// Pure domain entity - what the game engine cares about
export interface GameEntity {
  id: GameId;
  gameState: {} | CompletedGameState;
  config: GameConfig;
  moveHistory: object | null;
  status: GameStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerEntity {
  id: PlayerId;
  gameId: GameId;
  userId: UserId;
  joinedAt: Date | undefined;
  status: GamePlayerStatus;
  playerIndex: PlayerIndex;
  data: object | null;
  username?: string; // Optional for when joined with users
}

export enum GameStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
}

export type PlayerIndex = number;
export type GamePlayerStatus = 'active' | 'captured' | 'inactive';
```

**2. Protocol DTOs** (`@protocol/domains/gameplay/types.ts` or shared location):
```typescript
import { GameId, PlayerId, UserId } from '@kernel/ids';
import { GameConfig } from '@core/game-config';
import { CompletedGameState } from '@core/types';

// Data Transfer Objects - what goes over the wire
export interface GameDTO {
  id: number; // Serialized GameId
  gameState: {} | CompletedGameState;
  config: GameConfig;
  moveHistory: object | null;
  status: string;
  createdAt: string; // ✅ Always string
  updatedAt: string; // ✅ Always string
}

export interface PlayerDTO {
  id: number; // Serialized PlayerId
  gameId: number; // Serialized GameId
  userId: number; // Serialized UserId
  joinedAt: string | undefined;
  status: string;
  playerIndex: number;
  data: object | null;
  username?: string;
}

export interface GameWithPlayersDTO {
  id: number;
  gameState: {} | CompletedGameState;
  config: GameConfig;
  moveHistory: object | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  players: PlayerDTO[];
}

// API Response envelopes
export interface GetGameResponse {
  game: GameWithPlayersDTO;
}

export interface ListGamesResponse {
  games: GameWithPlayersDTO[];
}
```

### Mapper Functions

**Backend mappers** (`backend/src/domains/games/mappers.ts`):
```typescript
import { GameEntity, PlayerEntity } from '@core/types/entities';
import { GameDTO, PlayerDTO, GameWithPlayersDTO } from '@protocol/domains/gameplay/types';
import { idToNumber } from '@kernel/branded-type';

export function gameEntityToDTO(entity: GameEntity): GameDTO {
  return {
    id: idToNumber(entity.id),
    gameState: entity.gameState,
    config: entity.config,
    moveHistory: entity.moveHistory,
    status: entity.status,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export function playerEntityToDTO(entity: PlayerEntity): PlayerDTO {
  return {
    id: idToNumber(entity.id),
    gameId: idToNumber(entity.gameId),
    userId: idToNumber(entity.userId),
    joinedAt: entity.joinedAt?.toISOString(),
    status: entity.status,
    playerIndex: entity.playerIndex,
    data: entity.data,
    username: entity.username,
  };
}

export function gameWithPlayersToDTO(
  game: GameEntity,
  players: PlayerEntity[]
): GameWithPlayersDTO {
  return {
    ...gameEntityToDTO(game),
    players: players.map(playerEntityToDTO),
  };
}
```

**Or use a mapper library** like `class-transformer` or write generic helpers.

### Updated Flow

```
┌──────────────────────────────────────────────────────────────┐
│ BACKEND                                                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  DB (Postgres)                                                │
│    ↓                                                          │
│  GamesTable: { created_at: Date }  (Kysely schema - snake)   │
│    ↓                                                          │
│  DBGame: Selectable<GamesTable>                              │
│    ↓                                                          │
│  deserializeGame() → GameEntity  (camelCase, branded IDs)    │
│    type: { id: GameId, createdAt: Date, ... }                │
│    ↓                                                          │
│  GameRepository returns GameEntity                            │
│    ↓                                                          │
│  🔄 gameEntityToDTO() mapper                                 │
│    ↓                                                          │
│  GameDTO: { id: number, createdAt: string, ... }             │
│    ↓                                                          │
│  HTTP Route: reply.send({ game: gameDTO })                   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                              ↓
                      HTTP (JSON over wire)
                      { game: { id: 123, createdAt: "..." } }
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND                                                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  fetch('/api/games/123')                                      │
│    ↓                                                          │
│  response.json() as GetGameResponse                           │
│    type: { game: GameWithPlayersDTO }                         │
│    ↓                                                          │
│  GameWithPlayersDTO: { createdAt: string } ✅                 │
│    ↓                                                          │
│  Store / Component (types match runtime!)                    │
│    ↓                                                          │
│  (Optional) Convert to Date if needed for display:           │
│    new Date(game.createdAt)                                   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Code Changes Required

**1. Backend route handler** (`backend/src/domains/games/game-routes.ts`):
```typescript
// BEFORE
fastify.get('/games/:id', async (request, reply) => {
  const game = await getGame(gameId); // returns GameEntity & { players }
  if (!game) {
    return reply.status(404).send({ error: 'Game not found' });
  }
  return reply.send({ game }); // ❌ sends Date objects
});

// AFTER
import { gameWithPlayersToDTO } from './mappers';

fastify.get('/games/:id', async (request, reply) => {
  const gameEntity = await getGame(gameId);
  if (!gameEntity) {
    return reply.status(404).send({ error: 'Game not found' });
  }

  const gameDTO = gameWithPlayersToDTO(gameEntity, gameEntity.players);
  return reply.send({ game: gameDTO }); // ✅ sends strings
});
```

**2. Backend repository** (`backend/src/domains/games/game-repository.ts`):
```typescript
// Already returns GameEntity (with Date), no changes needed!
async findByIdWithPlayers(id: GameId): Promise<GameEntity & { players: PlayerEntity[] }> {
  // ... existing code
  return {
    ...deserializeGame(game),
    players: players,
  };
}
```

**3. Frontend API client** (`frontend/src/domains/games/games-api.ts`):
```typescript
// BEFORE
import { GameWithPlayers, GetGameResponse } from '@common/types/games';

async function loadGame(gameId: string): Promise<GameWithPlayers> {
  const data: GetGameResponse = await response.json();
  return data.game; // Type says Date | string, actually string
}

// AFTER
import { GameWithPlayersDTO, GetGameResponse } from '@protocol/domains/gameplay/types';

async function loadGame(gameId: string): Promise<GameWithPlayersDTO> {
  const data: GetGameResponse = await response.json();
  return data.game; // ✅ Type says string, runtime is string!
}
```

**4. Frontend components** (`frontend/src/pages/gameplay/components/*.tsx`):
```typescript
// BEFORE
import { GameWithPlayers } from '@common/types/games';
function GameplayHeader({ game }: { game: GameWithPlayers }) {
  // created_at is Date | string - which is it?
}

// AFTER
import { GameWithPlayersDTO } from '@protocol/domains/gameplay/types';
function GameplayHeader({ game }: { game: GameWithPlayersDTO }) {
  // created_at is definitely string
  const createdDate = new Date(game.createdAt); // convert when needed
}
```

---

## Pros & Cons

### ✅ Pros
1. **Type safety**: Types match runtime values at each layer
2. **Clarity**: Explicit about what layer you're in (Entity vs DTO)
3. **Flexibility**: Can have different shapes (e.g., DTO could omit sensitive fields)
4. **Standard pattern**: Common in backend architectures (Entity/DTO separation)

### ❌ Cons
1. **Boilerplate**: Need mapper functions for each type
2. **Duplication**: Two type definitions that are very similar
3. **Migration effort**: Need to update all existing code
4. **Learning curve**: More concepts for contributors to understand

---

## Alternative: Lighter-Weight Version

If full Entity/DTO split feels like overkill, we could do a simpler version:

**Keep one type, but serialize explicitly:**
```typescript
// Backend domain type
interface Game {
  id: GameId;
  createdAt: Date; // ✅ Always Date in backend
  // ...
}

// Helper to serialize for API
function serializeGame(game: Game): SerializedGame {
  return {
    ...game,
    id: idToNumber(game.id),
    createdAt: game.createdAt.toISOString(),
  };
}
type SerializedGame = ReturnType<typeof serializeGame>;

// Frontend imports SerializedGame (with string dates)
// Backend uses Game (with Date objects)
```

This gives some type safety without full DTO duplication.

---

## Recommendation

For this codebase, I'd suggest:

**Phase 1 (Short-term):** Lighter-weight version
- Keep single `Game` type in `@core`
- Add explicit serialization helpers
- Frontend uses `SerializedGame` type
- Less migration effort, reasonable type safety

**Phase 2 (Long-term):** Full Entity/DTO split
- If the codebase grows and we need more flexibility
- When we want DTOs to differ more from Entities (e.g., computed fields, omitted fields)
- Standard pattern that's well-understood

What do you think? Want to see what either approach would look like for the full migration?
