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

### Game Design Confirmed
**DECISION MADE**: We are building a **Generals.io-style game** with:
- Territory control with armies and unit counts
- Capturing enemy generals converts all their territory
- Turn-based movement with army splitting
- Current `/core` package is already built for this

*Note: The Grid Collection Game spec (`grid-game-spec-v3.md`) was for a different simpler game prototype and is not relevant to this project.*

## Minimal Implementation Plan

### Phase 1: Game Loop Foundation (2-3 hours)
**Backend Components:**
- Create `GameServer` class implementing the tick-based architecture from spec
- Build `GameCoordinator` integration with existing matchmaking
- Add WebSocket domain handler for `gameplay` messages
- Implement basic game state broadcasting

**Core Tasks:**
1. Create `game-server.ts` with simplified tick loop (100ms intervals)
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
  type: 'move',
  payload: { from: Coord, direction: Movement }
}

// Server → Client  
{
  domain: 'gameplay',
  type: 'game_state',
  payload: { tick: number, board: BoardState, players: PlayerInfo[] }
}
```

### Minimal Game Flow
1. **Matchmaking**: Use existing service to match 2 players
2. **Game Start**: Create `GameServer` instance, broadcast initial state
3. **Game Loop**: 100ms ticks processing queued moves
4. **Move Processing**: Validate → Apply → Broadcast new state
5. **Win Detection**: Check for general capture after each move
6. **Game End**: Broadcast winner, cleanup resources

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
3. **Tick Rate**: 100ms (10 ticks/second) for responsive feel
4. **Game Type**: Generals-style leveraging existing core engine
5. **Player Count**: Start with 2 players (already configured)
6. **Board Size**: Start small (10x10) for easier debugging

## Major Decisions Still Needed

1. **Game Initialization**: How are starting positions assigned?
2. **Board Generation**: Random vs fixed starting layouts?
3. **Move Timing**: All moves processed simultaneously per tick?
4. **Reconnection**: Handle or ignore disconnected players?
5. **Game Persistence**: Save game history or just final results?

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

### Generals.io Game Rules to Implement
- Each player starts with 1 general (25 units) on random square
- Cities spawn 1 unit every 2 ticks, armies spawn 1 every 2 ticks  
- Move splits army: leave 1 unit, move rest to adjacent square
- Combat: attacking army must have more units than defending square
- Capture enemy general → convert all their territory to yours
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

1. **Clarify Game Choice**: Confirm Generals-style vs Grid Collection
2. **Start Phase 1**: Build game server foundation
3. **Iterate Rapidly**: Get basic version working end-to-end
4. **Test with 2 Browser Windows**: Validate multiplayer sync

## Effort Estimate

**Total: 7-10 hours for fully working 2-player prototype**
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours  
- Phase 3: 2-3 hours

This represents a minimal but complete implementation that can be expanded incrementally once the core loop is working.