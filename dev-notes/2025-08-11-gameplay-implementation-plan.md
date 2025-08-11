# Gameplay Implementation Plan - 2025-08-11

## Executive Summary

After reviewing existing specs and codebase, we have strong foundational infrastructure already built for multiplayer realtime gameplay. This document outlines a minimal barebones approach for implementing 2-player gameplay, assuming the 95% happy path for prototyping.

## Current State Analysis

### ✅ Infrastructure Already Built
- **WebSocket Manager**: Complete with room-based broadcasting, user authentication, domain routing
- **Matchmaking Service**: Redis-backed queue system already configured for 2 players
- **Database Layer**: Games, users, and game_players tables with full CRUD operations
- **Frontend WebSocket Service**: Domain-based message handling with Zustand integration
- **Core Game Engine**: Board utilities, movement validation, game state types
- **Authentication**: Full user system with session management

### Game Design
We are building a **Generals.io-style game** with:
- Territory control with armies and unit counts
- Capturing enemy generals converts all their territory
- Turn-based movement with army splitting
- Current `/core` package is already built for this. This is where all code relate dto core game logic and mechanics should live.

## Minimal Implementation Plan

### Phase 1: Game Loop Foundation (2-3 hours)
**Backend Components:**
- Create `GameServer` class implementing the tick-based architecture
- Build `GameCoordinator` integration with existing matchmaking
- Add WebSocket domain handler for `gameplay` messages
- Implement basic game state broadcasting

**Core Tasks:**
1. Create `game-server.ts` with simplified tick loop (250ms intervals)
2. Create `gameplay-ws-api.ts` domain handler
3. Wire matchmaking to spawn game instances
4. Basic game state synchronization (no game logic yet)

### Phase 2: Core Gameplay (3-4 hours)
**Game Mechanics:**
- Player movement validation using existing `Board.canMove()`
- Army movement with unit splitting using existing `applyMovement()`
- Basic turn structure (moves queued per tick)
- Win condition: capture enemy general

**Core Tasks:**
1. Implement move validation and application
2. Add turn progression logic
3. Implement general capture victory condition
4. Basic error handling for invalid moves

### Phase 3: Frontend Integration (2-3 hours)
**UI Components:**
- Game board rendering with CSS Grid
- Player input handling (keyboard)  
- Real-time state updates from WebSocket
- Basic game status display

**Core Tasks:**
1. Create game board component with square rendering
2. Add keyboard movement controls
3. Connect to gameplay WebSocket domain
4. Display current game state and player info

## Technical Architecture

### WebSocket Message Protocol
```typescript
// Client → Server
{
  domain: 'gameplay',
  type: 'move_request',
  payload: { direction: Movement }
}

// Server → Client  
{
  domain: 'gameplay',
  type: 'game_state_update',
  payload: { tick: number, board: BoardState, players: PlayerInfo[] }
}

// Server → Client (game start)
{
  domain: 'gameplay', 
  type: 'game_started',
  payload: { gameId: string, playerMapping: {playerId: string, playerIndex: number}[] }
}
```

### Minimal Game Flow
1. **Matchmaking**: Use existing service to match 2 players
2. **Game Creation**: Create `GameServer` instance, send players to gameplay page
3. **Game Start**: Brief delay (few seconds), then start tick loop
4. **Game Loop**: 250ms ticks processing queued moves
5. **Move Processing**: Queue moves → Process on tick → Broadcast state
6. **Win Detection**: Immediate game stop when general captured
7. **Game End**: Broadcast winner, cleanup resources

### Integration Points

**Existing Systems to Leverage:**
- `WebSocketManager` - handles connections and room broadcasting
- `MatchmakingService` - already configured for 2-player games
- `Board` utilities from `/core` - movement validation, coord math
- `GameRepository` - persist game state to database
- Frontend `WebSocketService` - domain-based message routing

**New Components Needed:**
- `GameServer` class - manages individual game instances
- `GameCoordinator` - bridges matchmaking to game instances  
- `gameplay-ws-api.ts` - WebSocket domain handler
- Frontend game board component
- Game state management in frontend

## Key Decisions Made

1. **Server-Authoritative**: Full state sent each tick (< 10KB for 2 players)
2. **No Client Prediction**: Display last received state only
3. **Tick Rate**: 250ms (4 ticks/second) for move rate and production timing
4. **Game Type**: Generals-style leveraging existing core engine
5. **Player Count**: Start with 2 players (already configured)
6. **Board Size**: Start small (10x10) for easier debugging
7. **Move System**: Queued moves with high cap (~few hundred per player)
8. **Global Timer**: One timer for all games to maintain consistency

## ✅ Major Decisions Resolved

1. **Game Initialization**: Random general placement on blank squares using existing `generateRandomMap()`
2. **Board Generation**: `generateRandomMap` also generates random mountain tiles
3. **Move Timing**: Queued moves processed once per 250ms tick (4 moves/sec max)
4. **Reconnection**: Ignore for MVP (happy path only) 
5. **Game Persistence**: Final results only for MVP
6. **Move Queue**: High cap (~few hundred) to prevent hitting limits in practice
7. **Invalid Moves**: Skip silently, no error messages to client
8. **Game Start**: Few second delay after matchmaking before tick loop begins
9. **Victory Condition**: Immediate game stop when general captured
10. **WebSocket Typing**: Use naming conventions (MoveRequest vs GameStateUpdate) to distinguish direction

## Key Context for Next Implementation Session

### Existing Core Game Logic Review Needed
- `core/src/engine.ts` has `applyMovement()` function that handles army combat
- `core/src/board.ts` has movement validation and board utilities
- `core/src/types.ts` defines `GameState`, `BoardState`, and square types
- Current implementation assumes 1-based player indices (needs review)

### Architecture Integration Points
- Matchmaking already creates database game records via `createGame()`
- WebSocket domain system uses `{ domain: 'X', type: 'Y', payload: {...} }` structure  
- Game state needs to bridge between database persistence and realtime sync
- Frontend uses Zustand stores for state management
- Map generation exists at `core/src/map/generate-grid.ts` with `generateRandomMap()`
- Core engine has movement/combat logic but empty `tick()` function to implement
- Player indices currently 1-based in map generation (minor fix needed)

### Generals.io Game Rules for MVP
- Each player starts with 1 general (1 unit initially) on random blank square
- **NO CITIES in MVP** - only generals, armies, blank squares, and mountains
- Generals produce 1 unit every 4 ticks (1 per second at 250ms tick rate)
- All player land produces 1 unit every 100 ticks (25 seconds at 250ms tick rate)
- Move splits army: leave 1 unit, move rest to adjacent square
- Combat: attacking army must have more units than defending square
- Capture enemy general → convert all their territory to yours → immediate win
- Fog of war: only see squares adjacent to your territory

### Quick Start Development Order
1. Get basic tick loop working with 2 players
2. Implement simple movement (no combat) to test sync
3. Add combat logic using existing engine functions  
4. Add victory condition detection
5. Build minimal frontend board renderer

## Implementation Strategy

### Happy Path Assumptions (95% case)
- Players have stable connections
- Valid moves only (minimal error handling)
- No edge cases (disconnections, timeouts, etc.)
- Simple win/loss outcomes only
- No spectators or mid-game joins

### Success Metrics
- 2 players can join queue and start game
- Real-time bidirectional communication working
- Players can move their armies
- Game ends when general is captured
- Basic game state is visually rendered

## Next Steps

1. **✅ Game design confirmed**: Generals.io-style game (the other game was spec removed)
2. **Create Gameplay WebSocket Messages**: Define types in `common/types/gameplay.ts` following existing patterns
3. **Start Phase 1**: Build game server foundation with 250ms tick loop
4. **Iterate Rapidly**: Get basic version working end-to-end
5. **Test with 2 Browser Windows**: Validate multiplayer sync

## Detailed Technical Specifications

### Timing System
- **Movement rate**: 4 moves per second or at most 1 move per 250 ms. Move rate should be configurable.
- **Global tick rate**: For 4 moves/second, the global tick would need to be at most 250ms.
- **General production**: Once per second (for 250 ms tick, once every 4 ticks)
- **Land production**: Every 25 seconds (for 250 ms tick, once every 100 ticks)
- **Game start delay**: ~3 seconds after player matching

### Initital Board Composition (MVP)
- **Size**: small 10x10 grid to start (configurable via settings / config)
- **Elements**: Generals (1 per player), blank squares, mountains only
- **No cities, neutral cities, or other structures**
- **Generals start with 1 unit each**
- **Army / player-owned land tiles**: As players move on the map, they will accumulate tiles.

### Movement System
- **Queue-based**: Moves queued immediately, processed on tick boundary
- **Rate limiting**: Natural limit of 4 moves/second due to tick rate
- **Queue capacity**: High limit (~few hundred moves) to avoid practical limits
- **Invalid move handling**: Skip silently, continue processing queue

### Victory Conditions
- **Win condition**: Capture enemy general
- **Territory conversion**: All enemy land becomes yours when general captured
- **Game end**: Immediate stop when victory achieved

### WebSocket Architecture
- **Domain**: `gameplay` following existing chat-demo pattern
- **Message types**: Use directional naming (Request vs Update suffixes)
- **Player identification**: Server sends full player mapping (playerId → playerIndex)
- **State synchronization**: Full board state broadcast each tick

---

## Things we are **NOT** implementing for initial MVP
- Fog of war
- Client reconnection
- Neutral cities
- Optimistic rendering of player's own moves (only render game state that the server sends up)
- Automated testing
- Thorough error handling
- Logging
- Perf monitoring
- Other similar infrastructure important for a robust production-ready game
