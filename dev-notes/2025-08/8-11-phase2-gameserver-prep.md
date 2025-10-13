# Phase 2 Game Server Implementation - Preparation & Design

**Date**: 2025-08-11  
**Phase**: Phase 2 - Game Server & WebSocket Integration  
**Status**: Ready for Implementation

## Executive Summary

After reviewing the codebase architecture and resolving key implementation questions, we have a clear plan for implementing the game server infrastructure. This document captures our findings, decisions, and detailed implementation plan for Phase 2.

## Codebase Architecture Review

### WebSocket System Analysis

**Current Infrastructure** (✅ Well-designed, ready to extend):
- **Domain-based routing**: `DomainAPI` pattern handles message types by domain (e.g., `game-matchmaking`, `game-chat`)
- **WebSocket manager**: Handles connections, room management, and broadcasting
- **Message structure**: `{ domain: string, type: string, payload: any, user?: User }`
- **Connection context**: `connection.currentUser` available for player identification
- **Room management**: Players can join/leave rooms, broadcast to specific rooms

**Existing Domains**:
- `game-matchmaking`: Queue management, player matching
- `game-chat`: Chat functionality within games

**Integration Points**:
- Register new domains via `registerDomainAPI()` in `server.ts`
- WebSocket connections have access to authenticated user data
- Room transitions work smoothly (matchmaking → game rooms)

### Matchmaking Flow Analysis

**Current Process**:
1. Players join `matchmaking` room via `game-matchmaking` domain
2. `MatchmakingService.addPlayer()` adds to Redis queue
3. When 2 players queued, `MatchmakingService.createGame()` is called
4. Database game record created via `createGame({ playerIds })`
5. `game-ready` message broadcast to matchmaking room with `gameId`

**Key Findings**:
- Matchmaking service already creates database records with proper player relationships
- Game records use 0-based player indices (Phase 0 fixes applied)
- Redis stores transient matchmaking state, PostgreSQL for game persistence
- Clear hook point after `game-ready` message for spawning game servers

### Core Game Engine Status

**Phase 1 Completion** (✅ Ready to use):
- `tick()` function implemented with production logic
- General production: +1 unit every 4 ticks (1/second at 250ms rate)  
- Army production: +1 unit every 100 ticks (25 seconds)
- Victory detection when only one general remains
- `applyMovement()` function available for move processing

## Technical Decisions Made

### 1. Game Instance Lifecycle Management
- **✅ Decision**: Create separate `GameCoordinator` service (not in `server.ts`)
- **✅ Decision**: Remove games from registry immediately on completion
- **Rationale**: Clean separation of concerns, minimal server.ts file

### 2. Room Transition Details  
- **✅ Decision**: Room naming pattern: `gameplay-${gameId}` 
- **✅ Decision**: Use domain prefix for easy grepping in logs
- **✅ Decision**: Player identification via `connection.currentUser` 
- **Rationale**: Clear, consistent naming; leverages existing auth infrastructure

### 3. Move Queue Implementation
- **✅ Decision**: Separate move queue per player
- **✅ Decision**: Rate limiting: max 1 move applied per player per tick (250ms)
- **✅ Decision**: Excess moves wait in queue until later ticks or cleared
- **Rationale**: Simpler queue management, natural rate limiting via tick system

### 4. State Synchronization Specifics
- **✅ Decision**: Broadcast state updates every tick (always, regardless of changes)
- **✅ Decision**: Minimal player info in updates (no per-tick changing data)  
- **Rationale**: MVP simplicity, consistent update timing

### 5. Error Handling Approach
- **✅ Decision**: Invalid moves logged with `console.log` and skipped
- **✅ Decision**: Player disconnection ignored for MVP (no special handling)
- **Rationale**: Happy path focus for prototyping

### 6. Integration with Database Schema
- **✅ Decision**: Game state stays in-memory during gameplay
- **✅ Decision**: Only persist final results to database
- **✅ Decision**: Use existing player-game relationships from matchmaking
- **Rationale**: Performance optimization, leverage existing data model

## Detailed Implementation Plan

### File Structure
```
backend/src/gameplay/
├── game-coordinator.ts     # Global game registry & tick system
├── game-server.ts         # Individual game instance management  
└── gameplay-ws-api.ts     # WebSocket domain handler

common/types/
└── gameplay.ts            # WebSocket message type definitions
```

### 1. Gameplay Message Types (`common/types/gameplay.ts`)

**Domain**: `gameplay`

**Client → Server Messages**:
```typescript
MoveRequest {
  direction: Movement  // UP, DOWN, LEFT, RIGHT
  fromCoord?: Coord   // Optional: specific source tile
}

CancelMovesRequest {
  // Clears all queued moves for the requesting player
}
```

**Server → Client Messages**:
```typescript
GameStarted {
  gameId: number
  playerMapping: { playerId: string, playerIndex: number }[]
  boardState: BoardState
}

GameStateUpdate {
  tick: number
  boardState: BoardState
  // Note: No per-tick player info needed for MVP
}

GameEnded {
  winner: number        // playerIndex of winner
  reason: 'general_captured' | 'timeout' | 'disconnect'
  finalBoardState: BoardState
}
```

### 2. GameCoordinator Service (`backend/src/gameplay/game-coordinator.ts`)

**Responsibilities**:
- Maintain global `Map<gameId, GameServer>` registry
- Run single 250ms `setInterval` for all active games
- Add/remove games from tick system
- Initialize games after matchmaking completion

**Key Methods**:
```typescript
class GameCoordinator {
  private games: Map<number, GameServer> = new Map()
  private tickInterval: NodeJS.Timeout | null = null
  
  startGlobalTick(): void          // Initialize 250ms timer
  addGame(gameId: number): void    // Add game to tick system  
  removeGame(gameId: number): void // Remove completed games
  private tick(): void             // Process all games each interval
}
```

### 3. GameServer Class (`backend/src/gameplay/game-server.ts`)

**Per-Game Instance Management**:
```typescript
class GameServer {
  private gameId: number
  private gameState: GameState
  private playerQueues: Map<number, Movement[]>  // Per-player move queues
  private wsManager: WebSocketManager
  private roomName: string  // "gameplay-${gameId}"
  
  tick(): void                     // Process one game tick
  queueMove(playerId: string, movement: Movement): void
  clearMoves(playerId: string): void
  broadcastState(): void           // Send GameStateUpdate to room
  private checkVictory(): boolean  // Victory condition detection
  private processPlayerMoves(): void // Apply max 1 move per player
}
```

**Move Processing Logic**:
1. For each player with queued moves, apply first move in queue
2. Use core engine's `applyMovement()` function
3. Remove processed move from queue
4. Invalid moves: log and skip, continue processing
5. Check victory condition after all moves processed

### 4. WebSocket Domain Handler (`backend/src/gameplay/gameplay-ws-api.ts`)

**Following Existing Pattern**:
```typescript
const GameplayWsAPI = new DomainAPI<GameplayMessageType>('gameplay', {
  'move-request': async (data: Gameplay.MoveRequest, wsActions) => {
    // Get user ID from data.user
    // Find GameServer for this user's active game  
    // Queue move in GameServer
  },
  'cancel-moves-request': async (data: Gameplay.CancelMovesRequest, wsActions) => {
    // Clear user's move queue in GameServer
  }
})
```

### 5. Matchmaking Integration Point

**Modify**: `backend/src/game-matchmaking/game-matchmaking-ws-api.ts`

**After `game-ready` broadcast**:
1. Add 3-second delay (`setTimeout`)
2. Call `gameCoordinator.addGame(gameId)` to spawn GameServer
3. Transition players from `matchmaking` room to `gameplay-${gameId}` room
4. Send `GameStarted` message with initial board state and player mapping

### 6. Server Registration (`backend/src/server.ts`)

**Updates Required**:
```typescript
import { GameplayWsAPI } from '@/gameplay/gameplay-ws-api'
import { initializeGameCoordinator } from '@/gameplay/game-coordinator'

// Register domain
registerDomainAPI(GameplayWsAPI)

// Initialize global game coordinator
initializeGameCoordinator()
```

## Integration Architecture

### WebSocket Message Flow
```
Client Move Input (WASD)
    ↓
Frontend sends MoveRequest
    ↓
WebSocket routes to gameplay domain
    ↓
GameplayWsAPI handler queues move
    ↓
GameServer processes on next tick
    ↓
GameServer broadcasts GameStateUpdate
    ↓
All clients in room receive update
    ↓
Frontend renders new board state
```

### Room Transition Flow
```
Matchmaking Complete
    ↓
game-ready message broadcast
    ↓
3-second delay
    ↓
GameCoordinator spawns GameServer
    ↓
Players transition: matchmaking → gameplay-${gameId}
    ↓
GameStarted message sent
    ↓
Tick loop begins, regular GameStateUpdate messages
```

## Success Criteria

### Phase 2 Completion Criteria
1. **✅ Two browser windows can complete matchmaking flow**
2. **✅ Game instances spawn automatically after 3-second delay**  
3. **✅ Players transition to game-specific rooms**
4. **✅ Players receive `GameStarted` message with board state**
5. **✅ Regular `GameStateUpdate` messages broadcast every 250ms**
6. **✅ Tick counter increments consistently across all clients**
7. **✅ Games clean up from registry when complete**

### Testing Approach
**Manual Verification with Two Browser Tabs**:
1. Both tabs join matchmaking queue
2. Observe `game-ready` message
3. After 3-second delay, receive `GameStarted` message
4. Verify both tabs show same initial board state
5. Confirm `GameStateUpdate` messages arrive every 250ms
6. Verify synchronized tick counter across tabs

## Next Steps After Phase 2

**Phase 3 Preview** (Movement & Victory):
- Implement frontend keyboard controls (WASD)  
- Integrate `MoveRequest` message sending
- Add victory condition handling
- Territory conversion on general capture

## Notes & Considerations

### Known Issues to Address Later
- Combat logic edge case: failed attacks may set `source.units = 0`
- Victory logic should verify territory conversion completed
- Move queue capacity limits not yet defined
- No game timeout mechanisms implemented

### Architecture Benefits
- **Clean separation**: Each game is isolated GameServer instance
- **Scalable tick system**: Single timer handles all games efficiently  
- **Extensible WebSocket pattern**: Easy to add new message types
- **Leverages existing auth**: No new authentication needed
- **Minimal database load**: In-memory state during gameplay

This completes our Phase 2 preparation. All architectural decisions are made and technical specifications are defined. Ready to begin implementation.