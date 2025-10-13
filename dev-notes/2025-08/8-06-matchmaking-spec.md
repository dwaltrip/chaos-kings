# Matchmaking Implementation Spec

## Overview
Minimal prototype matchmaking system using Redis queues and WebSocket rooms. Players join a global matchmaking queue, see real-time queue status, and get notified when a game is ready to start.

**Architecture Pattern**: Follows the game-chat pattern with DomainAPI handlers, Zustand store, WebSocket handlers, and actions files.

## Constants & Configuration

### `common/constants/matchmaking.ts` (new file)
```typescript
export const PLAYERS_PER_GAME = 4;
export const MATCHMAKING_ROOM_NAME = "matchmaking-queue";
```

## Backend Implementation

### 1. Matchmaking Service (`backend/src/services/matchmaking-service.ts`)
Adapt the existing `MatchmakingQueue` class from `backend/src/matchmaking-example.ts`:

**Key adaptations:**
- Use `PLAYERS_PER_GAME` constant instead of hardcoded value
- Simplify for prototype: remove cleanup methods, advanced locking
- Keep core methods: `addPlayer()`, `removePlayer()`, `getQueueStatus()`, `createGame()`
- Use authenticated user IDs as queue identifiers

**Queue structure in Redis:**
- Queue: `matchmaking:queue` (sorted set by join timestamp)  
- Player data: `matchmaking:players` (hash of player info)

### 2. WebSocket Handlers (`backend/src/game-matchmaking/game-matchmaking-ws-api.ts`)

**Current stubs to implement:**

```typescript
const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingMessageType>(GAME_MATCHMAKING_DOMAIN, {
  'join-queue': (data: GameMatchmaking.JoinQueueMessage, wsActions) => {
    // 1. Auto-join client to MATCHMAKING_ROOM_NAME
    // 2. Add data.user.id to Redis queue via MatchmakingService
    // 3. Get updated queue status
    // 4. Broadcast queue-status message to entire room
  },
  'leave-queue': (data: GameMatchmaking.LeaveQueueMessage, wsActions) => {
    // 1. Remove data.user.id from Redis queue
    // 2. Get updated queue status  
    // 3. Broadcast queue-status message to entire room
  },
  'queue-status': (data: GameMatchmaking.QueueStatusMessage, wsActions) => {
    // Return current queue status (queueSize, playersNeeded)
  },
  'game-ready': (data: GameMatchmaking.GameReadyMessage, wsActions) => {
    // Stub: console.log('Game ready with gameId:', gameId)
    // TODO: Create actual game in database, redirect players
  },
});
```

**User Authentication:**
- `data.user` is automatically populated by WebSocket manager
- Use `data.user.id` as the unique player identifier
- User object has: `{ id, username, session_id, user_key, created_at }`

## Frontend Implementation

### 1. Actions File (`frontend/src/pages/join-game/game-matchmaking-actions.ts`)

**Pattern to follow**: `game-chat-actions.ts`

```typescript
// Functions to implement:
function websocketConnect(): ReturnType<typeof getWebSocketService>
function joinQueue(): void  // Send join-queue message
function leaveQueue(): void // Send leave-queue message  
function cleanup(): void    // Leave room, disconnect
```

**WebSocket integration:**
- Connect to WebSocket service
- Auto-join MATCHMAKING_ROOM_NAME
- Send join-queue/leave-queue messages
- Handle cleanup on component unmount

### 2. WebSocket Handler (`frontend/src/pages/join-game/game-matchmaking-ws-handler.ts`)

**Current stubs to implement:**

```typescript
switch (type as GameMatchmakingMessageType) {
  case 'queue-status':
    // Update gameMatchmakingStore with queueSize, playersNeeded
    // actions.setQueueSize(payload.queueSize)
    // actions.setPlayersNeeded(payload.playersNeeded)
    break;
  case 'game-ready':  
    // Stub: console.log('Game ready!', payload.gameId)
    // TODO: Navigate to game page
    break;
}
```

### 3. Store Updates (`frontend/src/pages/join-game/join-game-store.ts`)

**Current store is good**, just needs to be connected to real data instead of mock data.

### 4. Page Component (`frontend/src/pages/join-game/join-game-page.tsx`)

**Updates needed:**
- Replace mock data with `gameMatchmakingStore` values
- Connect buttons to real `joinQueue()` / `leaveQueue()` actions  
- Add WebSocket connect/cleanup on mount/unmount
- Remove timer logic (can add back later if needed)

**Pattern to follow**: How game-chat page connects to its WebSocket handler

## Message Flow

### Join Queue Flow
1. User navigates to `/join-game`
2. Component mounts → `websocketConnect()` → auto-join `MATCHMAKING_ROOM_NAME`
3. User clicks "Join Queue" → `joinQueue()` → send `join-queue` message
4. Backend adds user to Redis queue → broadcast `queue-status` to room
5. All clients in room receive `queue-status` → update UI

### Leave Queue Flow  
1. User clicks "Cancel" → `leaveQueue()` → send `leave-queue` message
2. Backend removes user from queue → broadcast `queue-status` to room
3. All clients update UI

### Game Ready Flow (Stub)
1. When queue reaches `PLAYERS_PER_GAME` → backend logs "Game ready"
2. Eventually: create game in DB, send `game-ready` to matched players
3. Eventually: navigate players to game page

## Type Updates

### `common/types/game-matchmaking.ts`
**Current types look good**. The `GameMatchmakingMessage` interface has extra fields that aren't used - can ignore for prototype.

**Key types:**
- `QueueStatusMessage.payload: { queueSize: number; playersNeeded: number }`
- `GameReadyMessage.payload: { gameId: string }`

## Files to Create/Modify

### New Files:
- `common/constants/matchmaking.ts`
- `backend/src/services/matchmaking-service.ts` 
- `frontend/src/pages/join-game/game-matchmaking-actions.ts`

### Files to Modify:
- `backend/src/game-matchmaking/game-matchmaking-ws-api.ts` (implement stubs)
- `frontend/src/pages/join-game/game-matchmaking-ws-handler.ts` (implement stubs)  
- `frontend/src/pages/join-game/join-game-page.tsx` (connect to real data/actions)
- `frontend/src/pages/join-game/join-game-store.ts` (minor cleanup if needed)

## Implementation Notes

### Patterns to Follow:
- **WebSocket integration**: Follow `game-chat` pattern exactly
- **User authentication**: Use `data.user.id` from authenticated WebSocket messages
- **Room management**: Single global room, auto-join on first message
- **Store updates**: Update store immediately when receiving WebSocket messages

### Key Simplifications:
- No error handling (prototype only)
- No tests
- Single global matchmaking queue (no game modes/types)
- Basic Redis operations only
- Game creation is stubbed out

### Redis Dependencies:
- Requires existing Redis service (`backend/src/services/redis.ts`)
- Uses existing patterns from `matchmaking-example.ts`

### Authentication Requirements:
- Users must be authenticated (have cookies) to join queue
- WebSocket manager validates auth and populates `data.user`
- Use `data.user.id` as unique identifier in queue