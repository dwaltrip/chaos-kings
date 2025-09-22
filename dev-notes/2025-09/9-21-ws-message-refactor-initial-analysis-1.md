# WebSocket Message Refactor - Initial Analysis #1

*Date: 2025-09-21*
*Status: Initial analysis of proposed refactoring approach*

## Current Architecture Analysis

### Core Issue Identified

The fundamental problem is that **WebSocket message types don't properly distinguish between client-to-server and server-to-client messages**, leading to:

1. **Type safety violations**: Backend handlers expect hydrated messages with `user` property, but message types only define the raw client structure
2. **Architecture confusion**: Both BE and FE handlers have to deal with message types they shouldn't handle
3. **Coupling issues**: Action methods are tightly coupled to WebSocket message structures

### Current TypeScript Errors

Build failures show the core issue clearly:
- Backend: `Property 'user' does not exist on type 'JoinQueueMessage'` (and similar for other types)
- Frontend: Similar issues where handlers expect different message structures

These errors occur because:
- Backend receives **hydrated messages** (raw client message + user info) in `manager.ts:96-99`
- Message type definitions only describe the **raw client message structure**
- Frontend receives **server-sent messages** but types don't distinguish this

### Current Message Flow

1. **Client → Server**: Raw message (domain, type, payload)
2. **Server processing**: Message hydrated with user info (`WsServerMessage`)
3. **Server → Client**: Message broadcast to rooms (varies by domain)
4. **Client processing**: Message handled by domain-specific handlers

### Domain Analysis

#### Game Matchmaking (`game-matchmaking`)
- **Client→Server**: `join-queue`, `leave-queue`, `early-start-vote`
- **Server→Client**: `queue-status`, `early-start-status`, `game-ready`
- **Current issues**: Backend has dummy handlers for server→client messages, Frontend has dummy handlers for client→server messages

#### Gameplay (`gameplay`)
- **Client→Server**: `move-request`, `undo-move-request`, `cancel-moves-request`, `join-room`, `leave-room`
- **Server→Client**: `game-state-update`, `game-starting`, `game-started`, `game-ended`
- **Current issues**: Backend has empty handlers for server→client messages

#### Game Chat (`game-chat`)
- **Bidirectional**: `new-message` (client sends, server broadcasts), `join-room`, `leave-room`
- **Pattern**: Simpler, mostly bidirectional messages

#### Shared Messages
- `join-room` and `leave-room` appear across multiple domains
- Defined in `common/websockets/message-types.ts`
- Creates additional complexity for type splitting

## Issues with Current Proposed Approach

### What Daniel Got Right ✅
- Correctly identified the core client/server message type distinction issue
- Recognized need for thin handlers that delegate to action methods
- Understood the tight coupling between actions and WebSocket infrastructure
- Identified the good pattern in `gameplay-ws-handler.ts` (thin handlers + action delegation)

### Gaps and Issues in Proposed Approach ❌

#### 1. **Incomplete Type Splitting Strategy**
- Simply splitting `GameMatchmakingMessageType` won't solve the hydrated message issue
- Backend handlers still need to work with `WsServerMessage` (which includes user info)
- No clear plan for how to handle shared message types (`join-room`, `leave-room`)

#### 2. **Action Decoupling Strategy Unclear**
- Current actions take `WsMessage` + `WsActions` parameters directly
- No concrete plan for how to extract data and make actions WebSocket-agnostic
- Risk of creating action methods that are still tightly coupled to WebSocket concepts

#### 3. **Handler Architecture Inconsistency**
- Backend uses `DomainAPI` with typed handler mappings
- Frontend uses manual switch statements
- Proposed approach doesn't address this architectural difference

#### 4. **Missing Outbound Message Typing**
- Focus only on incoming message typing
- No consideration for how server→client message creation should be typed
- Broadcasting and message creation aren't type-safe

#### 5. **Shared Message Type Complexity**
- `join-room`/`leave-room` are used across multiple domains
- No clear strategy for handling these in a type-split approach
- Risk of duplicating shared functionality

#### 6. **Migration Strategy Missing**
- No plan for how to migrate existing code incrementally
- Risk of breaking changes across multiple domains simultaneously

## Alternative Refactoring Approaches

### Approach 1: Domain-Specific Directional Types

**Strategy**: Split each domain's message types into clear client/server directions

#### Implementation
```typescript
// game-matchmaking-types.ts
type GameMatchmakingClientMessageType = 'join-queue' | 'leave-queue' | 'early-start-vote';
type GameMatchmakingServerMessageType = 'queue-status' | 'early-start-status' | 'game-ready';

namespace GameMatchmakingClient {
  export interface JoinQueue extends WsClientMessage { /* ... */ }
  export interface LeaveQueue extends WsClientMessage { /* ... */ }
  // ...
}

namespace GameMatchmakingServer {
  export interface QueueStatus extends WsServerMessage { /* ... */ }
  export interface GameReady extends WsServerMessage { /* ... */ }
  // ...
}
```

#### Backend Handler Pattern
```typescript
const GameMatchmakingWsAPI = new ClientDomainAPI<GameMatchmakingClientMessageType>({
  'join-queue': (data, wsActions) => handleJoinQueue(data.payload, data.user, wsActions),
  'leave-queue': (data, wsActions) => handleLeaveQueue(data.payload, data.user, wsActions),
  // No server→client handlers
});
```

#### Frontend Handler Pattern
```typescript
const GameMatchmakingWsHandler = new ServerDomainHandler<GameMatchmakingServerMessageType>({
  'queue-status': (payload) => actions.setQueueStatus(payload),
  'game-ready': (payload) => actions.handleGameReady(payload),
  // No client→server handlers
});
```

**Pros:**
- Clear separation of concerns
- Type safety for both directions
- Eliminates dummy handlers
- Each side only handles relevant messages

**Cons:**
- Requires duplicating shared message types (`join-room`, `leave-room`)
- Significant refactoring required across all domains
- Risk of breaking existing functionality during migration

### Approach 2: Generic Message Infrastructure with Direction Metadata

**Strategy**: Create a unified message system that understands direction at the type level

#### Implementation
```typescript
// Core message infrastructure
interface MessageDefinition<TType extends string, TPayload, TDirection extends 'C2S' | 'S2C' | 'BOTH'> {
  type: TType;
  direction: TDirection;
  payload: TPayload;
}

// Domain-specific message registry
type GameMatchmakingMessages =
  | MessageDefinition<'join-queue', null, 'C2S'>
  | MessageDefinition<'queue-status', {queueSize: number, playersNeeded: number}, 'S2C'>
  | MessageDefinition<'join-room', {room: string}, 'BOTH'>;

// Conditional types for extracting directional messages
type ClientMessages<T> = T extends MessageDefinition<infer Type, infer Payload, 'C2S' | 'BOTH'>
  ? {type: Type, payload: Payload} : never;

type ServerMessages<T> = T extends MessageDefinition<infer Type, infer Payload, 'S2C' | 'BOTH'>
  ? {type: Type, payload: Payload} : never;
```

#### Handler Typing
```typescript
// Backend only handles client messages
const backendHandler: MessageHandler<ClientMessages<GameMatchmakingMessages>> = {
  'join-queue': (payload, user) => { /* ... */ },
  'join-room': (payload, user) => { /* ... */ },
  // 'queue-status' not available - compile error if attempted
};

// Frontend only handles server messages
const frontendHandler: MessageHandler<ServerMessages<GameMatchmakingMessages>> = {
  'queue-status': (payload) => { /* ... */ },
  'join-room': (payload) => { /* ... */ },
  // 'join-queue' not available - compile error if attempted
};
```

**Pros:**
- Single source of truth for message definitions
- Handles shared messages naturally
- Strong compile-time guarantees
- Reduces code duplication

**Cons:**
- Complex TypeScript metaprogramming required
- Harder to understand for developers unfamiliar with advanced TypeScript
- Potential performance impact from complex type inference
- May hit TypeScript compiler limits with large message sets

### Approach 3: Complete Separation with Shared Payload Types

**Strategy**: Completely separate client and server message definitions, extract shared payload types

#### Implementation
```typescript
// Shared payload types
namespace GameMatchmakingPayloads {
  export interface QueueStatus {
    queueSize: number;
    playersNeeded: number;
  }
  export interface GameReady {
    gameId: string;
  }
  export interface Room {
    room: string;
    timestamp: number;
  }
}

// Client message definitions
namespace GameMatchmakingClientMessages {
  export interface JoinQueue extends WsClientMessage {
    type: 'join-queue';
    payload: null;
  }
  export interface JoinRoom extends WsClientMessage {
    type: 'join-room';
    payload: GameMatchmakingPayloads.Room;
  }
}

// Server message definitions
namespace GameMatchmakingServerMessages {
  export interface QueueStatus extends WsMessage {
    type: 'queue-status';
    payload: GameMatchmakingPayloads.QueueStatus;
  }
  export interface JoinRoom extends WsMessage {
    type: 'join-room';
    payload: GameMatchmakingPayloads.Room;
  }
}
```

#### Action Decoupling
```typescript
// Pure business logic actions
export function handleJoinQueue(userId: string, matchmakingService: MatchmakingService): Promise<GameMatchmakingPayloads.QueueStatus> {
  // Business logic only, no WebSocket concepts
}

// Thin WebSocket handler
const handler = {
  'join-queue': async (data: GameMatchmakingClientMessages.JoinQueue, wsActions) => {
    const result = await handleJoinQueue(data.user.id, getMatchmakingService());
    wsActions.broadcastToRoom('matchmaking', {
      type: 'queue-status',
      payload: result
    });
  }
};
```

**Pros:**
- Complete decoupling of business logic from WebSocket infrastructure
- Clear, explicit message contracts
- Shared payload types prevent drift between client/server
- Easy to test business logic in isolation
- Handles shared messages cleanly

**Cons:**
- Most verbose approach
- Requires significant refactoring
- Higher maintenance overhead (three places to update for each message)
- Risk of payload type drift if not properly maintained

### Approach 4: Hybrid Approach with Incremental Migration

**Strategy**: Combine elements from approaches above with a migration-friendly implementation

#### Phase 1: Type System Foundation
- Introduce `WsClientMessage` and `WsServerMessage` base types
- Update existing message types to extend appropriate base
- Fix immediate build errors

#### Phase 2: Domain-by-Domain Migration
- Start with one domain (game-matchmaking as suggested)
- Implement directional type splitting for that domain
- Extract action methods to be WebSocket-agnostic
- Validate approach before applying to other domains

#### Phase 3: Infrastructure Improvements
- Unify frontend/backend handler patterns
- Implement shared message type handling
- Add compile-time guarantees for message direction

#### Phase 4: Advanced Features
- Type-safe message broadcasting
- Message serialization/validation
- Runtime type checking for development

**Pros:**
- Low risk - can validate approach incrementally
- Allows learning and refinement during migration
- Minimal disruption to existing functionality
- Can incorporate lessons learned from each domain

**Cons:**
- Longer timeline to completion
- Temporary inconsistency during migration period
- Risk of losing momentum/not completing all phases

## Critical Decisions Required

### 1. **Shared Message Type Strategy**
- **Question**: How should `join-room`/`leave-room` be handled across domains?
- **Options**:
  - Domain-specific implementations with shared payload types
  - True shared message types with domain-specific handling
  - Generic room management infrastructure

### 2. **Action Method Signature Design**
- **Question**: What should the interface be for decoupled action methods?
- **Options**:
  - `handleJoinQueue(userId: string, payload: PayloadType): Promise<ResultType>`
  - `handleJoinQueue(context: ActionContext, payload: PayloadType): Promise<ResultType>`
  - `handleJoinQueue(data: {user: User, payload: PayloadType}): Promise<ResultType>`

### 3. **Handler Architecture Unification**
- **Question**: Should frontend and backend use the same handler pattern?
- **Options**:
  - Unify on `DomainAPI` pattern for both sides
  - Create new shared abstraction
  - Keep separate but type-compatible patterns

### 4. **Migration Strategy**
- **Question**: Should this be done incrementally or as a big-bang refactor?
- **Impact**: Affects development velocity and risk of breaking existing functionality

### 5. **Type Safety vs. Complexity Trade-off**
- **Question**: How much TypeScript complexity is acceptable for type safety gains?
- **Consideration**: Team familiarity with advanced TypeScript features

## Recommendations

### For Initial Implementation: **Approach 3 (Complete Separation) + Approach 4 (Incremental)**

**Rationale:**
1. **Clear contracts**: Explicit separation makes the architecture intent obvious
2. **Action decoupling**: Pure business logic functions are easily testable
3. **Incremental migration**: Validate approach on one domain before expanding
4. **Future-proof**: Can easily add runtime validation, API documentation generation, etc.

### Implementation Steps:
1. **Start with game-matchmaking domain** as suggested
2. **Extract payload types** into shared namespace
3. **Create separate client/server message definitions**
4. **Refactor action methods** to be WebSocket-agnostic
5. **Update handlers** to be thin delegation layers
6. **Validate** with comprehensive testing
7. **Apply lessons learned** to remaining domains

### Key Success Metrics:
- [ ] Zero TypeScript build errors
- [ ] Action methods testable without WebSocket mocking
- [ ] Clear separation between client/server message handling
- [ ] No dummy/empty handlers required
- [ ] Compile-time prevention of sending wrong message types

## Next Steps

1. **Choose approach** based on team preferences and constraints
2. **Create detailed implementation plan** for chosen approach
3. **Set up feature branch** for experimental implementation
4. **Implement game-matchmaking refactor** as proof of concept
5. **Gather feedback** and refine approach
6. **Document patterns** for remaining domain migrations

---

*This analysis provides the foundation for making an informed decision about the WebSocket message refactoring approach. Each option has trade-offs that should be evaluated against the team's specific needs and constraints.*
