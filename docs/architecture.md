# Chaos Kings - Architecture Guide

**Last Updated:** 2025-11-28
**Status:** v2 WebSocket architecture refactor complete

This document describes the current state of the codebase after the October 2025 WebSocket architecture and monorepo refactor. For historical context on the refactor itself, see `epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/`.

---

## Overview

Chaos Kings is a real-time multiplayer strategy game (inspired by generals.io) built with:
- **Backend:** Node.js + Fastify + WebSockets + PostgreSQL
- **Frontend:** React + Zustand + WebSockets + Vite
- **Shared Packages:** TypeScript across both apps + shared protocol definitions

The architecture emphasizes:
- **Type safety** - Discriminated unions for all WS messages, branded types for IDs
- **Clear boundaries** - Protocol, domain logic, and transport layers are cleanly separated
- **Domain organization** - Code organized by business domain (chat, matchmaking, gameplay, etc.)
- **Consistent patterns** - Uniform patterns across all domains make the codebase predictable

---

## Monorepo Structure

The codebase is organized as a monorepo with clear separation between shared packages and application code:

```
generals-v2/
├── packages/          # Shared, pure code (no I/O, no app-specific concerns)
│   ├── protocol/      # WebSocket message types, DTOs, schemas
│   ├── core/          # Pure game logic (engine, rules, mechanics)
│   ├── kernel/        # Minimal primitives (branded IDs, timestamps)
│   ├── platform/      # Shared domain types/constants (TEMPORARY STATE - see Open Questions)
│   └── utils/         # Generic helper functions
│
└── apps/              # Application-specific code
    ├── backend/       # Server: handlers, actions, persistence, WS server
    └── frontend/      # Client: hooks, stores, components, WS client
```

### Dependency Rules

Packages have strict dependency constraints:

- `protocol` → depends only on `kernel`
- `core` → depends on `kernel`, `utils`
- `platform` → depends on `protocol`, `core`, `kernel`, `utils`
- `apps/*` → can depend on any package

**Key principle:** Packages should be pure, reusable, and have no I/O or app-specific concerns.

### Import Path Aliases

- `@protocol/*` → `packages/protocol/`
- `@core/*` → `packages/core/`
- `@kernel/*` → `packages/kernel/`
- `@platform/*` → `packages/platform/`
- `@utils/*` → `packages/utils/`
- `@/*` → `apps/backend/src/` or `apps/frontend/src/` (app-specific)

---

## Domain Architecture

Both `apps/backend` and `apps/frontend` organize code by **business domain** under `src/domains/`:

### Current Domains

- **chat** - In-game and lobby chat messaging
- **matchmaking** - Queue joining, player matching, game creation
- **gameplay** - Real-time game state updates, player moves
- **games** - Game entity management, lifecycle
- **users** - User accounts, authentication, profiles
- **system** - WebSocket lifecycle, room management, connection tracking

### Domain Structure (Backend)

Each backend domain typically contains:

```
apps/backend/src/domains/[domain]/
├── handlers.ts       # WebSocket message handlers (routes messages → actions)
├── actions.ts        # Domain business logic (called by handlers, timers, other code)
├── ws-effects.ts     # Outbound message sending (called by actions)
├── types.ts          # Domain-specific types
├── [service].ts      # Domain services (optional)
└── [repo].db.ts      # Database repositories (optional)
```

### Domain Structure (Frontend)

Each frontend domain typically contains:

```
apps/frontend/src/domains/[domain]/
├── handlers.ts       # WebSocket message handlers (updates stores/state)
├── actions.ts        # Domain operations (user interactions, UI logic)
├── ws-effects.ts     # Outbound message sending (optional - some use actions directly)
├── stores/           # Zustand stores for domain state
├── types.ts          # Domain-specific types
└── components/       # Reusable domain components (used across pages)
```

**Note:** Frontend also has `src/pages/[page]/` for page-specific components and orchestration.

---

## WebSocket Architecture

The WebSocket system uses a **bidirectional message flow** with strong typing throughout.

### Message Flow Pattern

**Incoming (Server → Client or Client → Server):**
```
WebSocket receives message
  ↓
handlers.ts routes to appropriate handler function
  ↓
handler converts primitives → branded types
  ↓
handler calls action in actions.ts
  ↓
action performs business logic
  ↓
action updates state/DB/store
```

**Outgoing (Application code → WebSocket):**
```
Application code calls action
  ↓
action performs business logic
  ↓
action calls ws-effects function
  ↓
ws-effects converts branded types → primitives
  ↓
ws-effects calls bridge.send()
  ↓
WebSocket sends message
```

### Key Components

#### Protocol Messages (`packages/protocol/`)

All WebSocket messages are defined in protocol packages:

- `domains/[domain]/client-messages.ts` - Client→Server messages
- `domains/[domain]/server-messages.ts` - Server→Client messages

Messages use **discriminated unions** for type safety:

```typescript
// Example from protocol/domains/chat/client-messages.ts
type ChatClientMsg =
  | { type: 'chat:send-message'; payload: { gameId: string; text: string } }
  | { type: 'chat:mark-read'; payload: { gameId: string } };
```

#### Handlers (`handlers.ts`)

- **Pure message routers** - No business logic
- Convert primitive types → branded types at the entry boundary
- Delegate all logic to actions
- One handler function per message type

```typescript
// Simplified example
export async function handleSendMessage(
  ctx: HandlerContext,
  payload: { gameId: string; text: string }
) {
  const gameId = toGameId(payload.gameId);
  await chatActions.sendMessage(ctx.userId, gameId, payload.text);
}
```

#### Actions (`actions.ts`)

- **Domain business logic owners** - Primary entry point for domain operations
- **Bidirectional** - Called by handlers (incoming) AND app code (outgoing)
- May call other actions, services, repositories
- May call ws-effects to send messages

```typescript
// Simplified example
export async function sendMessage(
  userId: UserId,
  gameId: GameId,
  text: string
) {
  const message = await chatRepo.createMessage(userId, gameId, text);
  await chatWsEffects.broadcastMessage(gameId, message);
}
```

#### WS Effects (`ws-effects.ts`)

- **Outbound message senders** - Only purpose is to send WebSocket messages
- Convert branded types → primitives at the exit boundary
- Call `bridge.send()` or `bridge.broadcast()`
- No business logic

```typescript
// Simplified example
export async function broadcastMessage(gameId: GameId, message: ChatMessage) {
  await serverBridge.broadcast(
    roomKey('chat', idToString(gameId)),
    {
      type: 'chat:message-received',
      payload: { ...message, gameId: idToString(gameId) }
    }
  );
}
```

#### Bridges (`ws/server-bridge.ts`, `ws/client-bridge.ts`)

- **WebSocket infrastructure layer**
- Backend: `ServerBridge` - manages connections, rooms, broadcasting
- Frontend: `ClientBridge` - manages connection, reconnection, message queuing
- Type-safe send/broadcast methods
- Domain-agnostic (knows nothing about specific domains)

### Type Conversion Boundaries

The codebase uses **branded types** for IDs to prevent mixing different ID types:

```typescript
// From packages/kernel/
type UserId = string & { readonly __brand: 'UserId' };
type GameId = string & { readonly __brand: 'GameId' };
```

**Conversion happens at domain boundaries:**

- **Entry:** Handlers convert `string → GameId` when receiving messages
- **Exit:** WS-effects convert `GameId → string` when sending messages
- **Interior:** All domain logic uses branded types

Helper functions:
- `toGameId(str)` / `toUserId(str)` - Create branded types
- `idToString(id)` - Convert back to primitives

---

## Key Patterns & Conventions

### Actions as Bidirectional Hinges

Actions are the **primary API** for domain logic:

- **Inbound flow:** Handler receives message → calls action
- **Outbound flow:** Button click / timer → calls action → calls ws-effect
- **Cross-domain:** One domain's action can call another domain's action

This pattern keeps business logic centralized and testable.

### Handlers are Pure Routers

Handlers should be **thin routing layers** with zero business logic:

✅ **Good handler:**
```typescript
export async function handleJoinQueue(ctx: HandlerContext, payload: {}) {
  await matchmakingActions.joinQueue(ctx.userId);
}
```

❌ **Bad handler (contains business logic):**
```typescript
export async function handleJoinQueue(ctx: HandlerContext, payload: {}) {
  const user = await userRepo.findById(ctx.userId);
  if (user.isInQueue) return;
  await matchmakingService.addToQueue(user);
  await wsEffects.notifyQueueJoined(user);
}
```

### File Organization

**Single file per domain** - Most domains keep `handlers.ts`, `actions.ts`, `ws-effects.ts` as single files.

**Split when needed** - If a domain grows complex, split into directories:
```
domains/gameplay/
├── handlers.ts
├── actions/
│   ├── handle-player-move.ts
│   ├── start-game.ts
│   └── end-game.ts
└── ws-effects.ts
```

**Current state:** Only `gameplay` domain has split `actions/` directory.

### Store Access Patterns

**Open question** - Not yet standardized. Some actions:
- Call `domainStore.getState()` directly
- Receive state as arguments (pure functions)

Both patterns exist. See `docs/open-questions.md` for discussion.

---

## Package Details

### `packages/protocol/`

**Purpose:** Define all WebSocket message types and DTOs.

**Contents:**
- `domains/[domain]/client-messages.ts` - Client→Server messages
- `domains/[domain]/server-messages.ts` - Server→Client messages
- `utils/message-helpers.ts` - Type helpers, message creators

**Dependencies:** Only `@kernel`

**Key principle:** Protocol is the contract between frontend and backend. Changing protocol types affects both apps.

### `packages/core/`

**Purpose:** Pure game engine logic - rules, mechanics, game state.

**Contents:**
- `engine.ts` - Main game engine
- `board.ts`, `square.ts` - Game board representation
- `moves/` - Move validation
- `terrain-generation/` - Map generation
- `replay/` - Replay system
- `game/types.ts` - Core game types

**Dependencies:** `@kernel`, `@utils`

**Key principle:** Core has no I/O. All logic is pure and deterministic.

### `packages/kernel/`

**Purpose:** Minimal primitives shared across the entire codebase.

**Contents:**
- `domains/[domain]/ids.ts` - Branded ID types (UserId, GameId, etc.)
- `domains/[domain]/constants.ts` - Domain constants

**Dependencies:** None

**Key principle:** Kernel is the foundation. Everything can depend on kernel.

### `packages/platform/`

**Purpose:** Shared domain types and constants (between backend/frontend).

**Current state:** ⚠️ **TEMPORARY - See Open Questions**

`platform/domains/games/types.ts` currently holds `Game`, `Player`, `GameWithPlayers` types that were hastily moved from the old `@common` package to complete the refactor. These types need proper architecture (DB entities vs. API types).

**Note:** The original refactor plan envisioned platform as a robust shared domain layer, but this hasn't materialized. Future work may move these types to `@core` or split them into app-specific types.

### `packages/utils/`

**Purpose:** Generic helper functions (not game-specific).

**Contents:**
- `assertions/invariant.ts` - Runtime assertions

**Dependencies:** None

**Key principle:** Utils should be generic and reusable, not domain-specific.

---

## Frontend-Specific Patterns

### Page Organization

Frontend code is organized by:
- `src/domains/[domain]/` - Domain logic, stores, reusable components
- `src/pages/[page]/` - Page-specific orchestration and components

**Current heuristic:**
- **domains/[domain]/** gets:
  - Core domain logic (actions, handlers, stores, types)
  - Components representing domain concepts that may be used across pages
- **pages/[page]/** gets:
  - Page orchestration (layout, routing, side effects)
  - Components tightly coupled to that page's specific UX flow

**Example:** `GameBoard` component lives in `domains/gameplay/components/` because it's a reusable domain concept. `JoinGameForm` lives in `pages/join-game/` because it's specific to that page's flow.

**Note:** This heuristic is working well but not yet formalized. See `docs/open-questions.md`.

### State Management

Frontend uses **Zustand** for state management:
- Each domain has its own store(s) in `domains/[domain]/stores/`
- Stores are updated by handlers (incoming messages) or actions (user interactions)
- React components subscribe to stores via hooks

### WebSocket Initialization

Frontend initializes WebSocket on app mount:
- `useWebSocketConnection()` hook in root component
- Automatic reconnection and message queuing
- Connection state tracked in `domains/system/stores/connection-store.ts`

---

## Backend-Specific Patterns

### Database Access

Backend uses **PostgreSQL** with:
- Raw SQL queries (no ORM currently)
- Repository pattern: `[domain]/[entity].db.ts` or `[domain]/repositories/`
- Migrations in `apps/backend/src/db/migrations/`

### Authentication

- Passport.js for auth strategy
- User session stored in PostgreSQL
- `HandlerContext` provides `userId` to all handlers

### Server Bootstrap

Entry point: `apps/backend/src/main.ts`

1. Initialize Fastify app
2. Set up authentication (Passport)
3. Bootstrap WebSocket server (`ws/server-bootstrap.ts`)
4. Register HTTP routes
5. Start listening

---

## Testing

**Current state:** Minimal tests.

- `packages/core/` has unit tests for engine logic
- Apps have very few tests
- No integration tests for WebSocket flows yet

See `docs/open-questions.md` for testing strategy discussion.

---

## Related Documentation

- **AGENTS.md** - High-level project overview, coding conventions, import/export patterns
- **docs/open-questions.md** - Remaining work, architectural decisions needed, loose ends
- **epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/** - Historical refactor docs

---

## Quick Reference

### Adding a New Message Type

1. Define message in `packages/protocol/domains/[domain]/client-messages.ts` or `server-messages.ts`
2. Add handler in `apps/backend/src/domains/[domain]/handlers.ts` (or frontend)
3. Implement logic in `apps/backend/src/domains/[domain]/actions.ts`
4. (Optional) Add ws-effect in `ws-effects.ts` if action needs to send messages
5. Update handler registration in domain's main handler map

### Adding a New Domain

1. Create `packages/protocol/domains/[new-domain]/client-messages.ts` and `server-messages.ts`
2. Create `packages/kernel/domains/[new-domain]/ids.ts` for branded types
3. Create backend domain structure: `apps/backend/src/domains/[new-domain]/`
4. Create frontend domain structure: `apps/frontend/src/domains/[new-domain]/`
5. Register handlers in both apps' WebSocket bootstrapping

### Finding Code

- **WebSocket message definitions:** `packages/protocol/domains/[domain]/`
- **Backend domain logic:** `apps/backend/src/domains/[domain]/actions.ts`
- **Frontend UI components:** `apps/frontend/src/pages/[page]/` or `apps/frontend/src/domains/[domain]/components/`
- **Game engine logic:** `packages/core/src/`
- **Type definitions:** Look in domain's `types.ts` or in protocol packages
