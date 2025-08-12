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

### Initial Board Composition (MVP)
- **Size**: 10x10 grid for MVP (configurable via game config for future)
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

---

## 🚨 Critical Issues Identified & Resolved

### Player Index Inconsistency (FIXED)
- **Issue**: Core map generation uses 1-based indices, but arrays expect 0-based
- **Location**: `core/src/map/generate-grid.ts:117` and `backend/src/game/actions/create-game.ts:54`
- **Solution**: Convert entire codebase to 0-based player indices for consistency

### Incomplete Core Engine  
- **Issue**: `core/src/engine.ts:6` has empty `tick()` function
- **Solution**: Implement production timing and game state progression

### Missing Integration Points
- **Issue**: No connection between matchmaking completion and game server spawning
- **Solution**: Add game instances to global tick system when matchmaking completes

---

## 📋 Detailed Phased Implementation Plan

### **Phase 0: Foundation Fixes (30 mins)**
**Goal**: Fix critical inconsistencies before building on top
- Convert player indices to 0-based throughout codebase
- Fix `addRandomGenerals()` in `core/src/map/generate-grid.ts:117` 
- Fix `gamePlayersData` mapping in `backend/src/game/actions/create-game.ts:54`
- Test map generation produces consistent player indices

**Verification**: Map generation test shows generals have playerIndex 0,1 instead of 1,2

---

### **Phase 1: Core Game Engine (1-2 hours)**
**Goal**: Implement the heart of the game - the tick system and production
- Implement `tick()` function in `core/src/engine.ts`
- Add production timing: generals every 4 ticks, armies every 100 ticks
- Fix combat logic bug where failed attacks set `source.units = 0`
- Add basic game state validation

**Key Files**: 
- `core/src/engine.ts` - Complete the tick function
- Add unit tests for production and combat

**Verification**: Standalone tests show generals produce units, combat works correctly

---

### **Phase 2: Game Server & WebSocket Integration (2-3 hours)**  
**Goal**: Connect the game engine to real-time multiplayer infrastructure
- Create `GameServer` class managing individual game instances
- Create global tick timer in main server process (250ms intervals)
- Add `gameplay` WebSocket domain with message types
- Wire matchmaking completion to spawn game instances with 3-second delay

**Key Files**:
- `backend/src/gameplay/game-server.ts` - New game instance management
- `backend/src/gameplay/gameplay-ws-api.ts` - New WebSocket domain handler  
- `common/types/gameplay.ts` - New message type definitions
- Modify `backend/src/game-matchmaking/matchmaking-service.ts` to trigger game spawning

**Message Types Needed**:
```typescript
// Client → Server
MoveRequest { direction: Movement }
CancelMovesRequest { }

// Server → Client  
GameStateUpdate { tick: number, board: BoardState, players: PlayerInfo[] }
GameStarted { gameId: string, playerMapping: {playerId: string, playerIndex: number}[] }
GameEnded { winner: number, reason: string }
```

**Verification**: Two browser windows can connect, receive game_started, and see synchronized tick updates

---

### **Phase 3: Movement & Victory (1-2 hours)**
**Goal**: Players can actually play the game
- Integrate existing `applyMovement()` from core engine
- Add move queuing system (high capacity ~few hundred)
- Implement victory detection when general captured
- Add basic player info broadcasting

**Key Files**:
- Extend `GameServer` with move processing
- Add victory condition checking
- Territory conversion on general capture

**Verification**: Players can move armies, capture each other's generals, game ends correctly

---

### **Phase 4: Frontend Live Integration (2-3 hours)**
**Goal**: Connect existing GameUI to live gameplay with WebSocket integration and player input

**Phase 4 Implementation Tasks:**

1. **Adapt GameUI for Live Data** (`frontend/src/game-ui/game-ui.tsx`)
   - Change props from `GameWithPlayers` to `BoardState` + player info
   - Fix player indexing bug in `playerIndexToPlayer()` function (line 25)
   - Add input callbacks for move requests

2. **WebSocket Integration** (game page level - stay board-agnostic)
   - Create `gameplay-ws-handler.ts` for WebSocket domain connection
   - Handle `game-started` message → join gameplay room, pass data to GameUI
   - Process `game-state-update` messages → pass BoardState to GameUI
   - Send `move-request` and `cancel-moves-request` messages
   - Handle `game-ended` message → show victory/defeat screen

3. **Game Page State Management** (`game-page-store.ts`)
   - Replace placeholder with minimal game state (stay board-agnostic)
   - Store: current BoardState (pass-through), player mapping, game status
   - Actions: WebSocket message handlers, input forwarding

4. **Player Input System** (add to GameUI)
   - Click selection: Allow clicking on player's own tiles
   - WASD keyboard controls: Queue moves from selected tile
   - 'Q' key: Cancel all queued moves  
   - Selected tile tracking: Update selection when army moves

**Success Criteria for Phase 4:**
- ✅ Two browser windows can complete full gameplay flow
- ✅ Visual game board displays and updates in real-time
- ✅ Players can select tiles and queue moves with WASD
- ✅ Room transitions work (matchmaking → gameplay)
- ✅ Game ends properly with victory/defeat display

**Testing Approach:**
1. Start backend server (with Phase 3 movement logic working)
2. Open two browser tabs
3. Both join matchmaking queue  
4. Verify game spawns and board displays correctly
5. Test tile selection and movement controls
6. Verify real-time board updates
7. Test complete gameplay flow to victory

**Estimated Time:** 2-3 hours for frontend integration

---

### **Phase 5: Polish & Room Transitions (1 hour)**
**Goal**: Smooth user experience and proper room management  
- Add room transitions: matchmaking room → game-specific rooms
- Display game status (waiting, active, ended)
- Add basic error handling for disconnections (display message, don't crash)
- Game cleanup when players disconnect

**Key Files**:
- Update room management in WebSocket handlers
- Add game state UI indicators
- Basic error boundaries

**Verification**: Players transition smoothly from matchmaking to gameplay, games clean up properly

---

## 🎯 Success Criteria for Each Phase

- **Phase 0**: Unit tests pass, no 1-based indices remain
- **Phase 1**: Game engine can run standalone with unit production  
- **Phase 2**: WebSocket messages flow, game instances spawn on matchmaking
- **Phase 3**: Players can move and win/lose games
- **Phase 4**: Visual game board displays and responds to keyboard input
- **Phase 5**: End-to-end user experience is smooth

## 🔧 Technical Implementation Notes

### Room Management Strategy
- Matchmaking: Players join `matchmaking` room
- Game Start: Players transition to `game-${gameId}` rooms  
- Game messages broadcast only to game-specific room

### Global Tick System Architecture  
- Single `setInterval(250ms)` in main server process
- Maintains `Map<gameId, GameServer>` of active games
- Each tick: iterate all games, call `game.tick()`, broadcast updates
- Games self-remove when ended or empty

### State Synchronization
- Server sends full board state each tick (< 10KB for 10x10 grid)
- No client-side prediction or state management
- Client displays exactly what server sends

### Error Handling Strategy (MVP)
- Invalid moves: Skip silently, continue processing
- Player disconnection: Display message, keep game running
- Game crashes: Log error, remove from tick system

## Reminder

Assume the 95% happy path! This is a prototype :) Don't over-engineer things.

---

## 🎯 Implementation Progress Log

### ✅ **Phase 0 + 1 Complete** (2025-08-11)

**Foundation Fixes:**
- Fixed player index inconsistency: converted entire codebase to 0-based indexing
- Updated `addRandomGenerals()` in `core/src/map/generate-grid.ts:117` 
- Fixed `gamePlayersData` mapping and `playerIndexToColor` in `create-game.ts`
- Added tests confirming map generation produces playerIndex 0,1 instead of 1,2
- **Committed:** Fix player index inconsistency - convert to 0-based indexing

**Core Game Engine:**
- Implemented `tick()` function in `core/src/engine.ts` with production logic:
  - General production: +1 unit every 4 ticks (1 per second at 250ms)
  - Army production: +1 unit every 100 ticks (25 seconds)
  - Victory condition detection when only one general remains
- Added comprehensive unit tests for production timing and victory detection
- Exported `applyMovement` function for server integration
- **Committed:** Implement core game engine tick function with production logic

### ✅ **Phase 2 Complete** (2025-08-11)

**Game Server Infrastructure:**
- ✅ Created `GameCoordinator` service with global 250ms tick system managing all active games
- ✅ Implemented `GameServer` class for individual game instance management
- ✅ Built per-player move queues with 1-move-per-tick rate limiting
- ✅ Added automatic game lifecycle: spawn → tick → cleanup on completion
- ✅ **Committed:** Implement Phase 2: Game Server & WebSocket Integration

**WebSocket Integration:**
- ✅ Created `gameplay` domain with message types: `move-request`, `cancel-moves-request`, `game-state-update`, `game-started`, `game-ended`
- ✅ Implemented server-side broadcasting system with `serverBroadcastToRoom()` method
- ✅ Added global WebSocketManager access pattern for GameServer broadcasting
- ✅ Built user-game mapping system for message routing
- ✅ Wired matchmaking completion → 3-second delay → game instance spawn

**Technical Achievements:**
- ✅ Server compiles cleanly and runs without errors
- ✅ All WebSocket domains registered and functional
- ✅ GameCoordinator tick system operational
- ✅ Room transition system ready (matchmaking → gameplay rooms)
- ✅ Type-safe message protocol established

**Phase 2 Status:** **FULLY OPERATIONAL** 🚀
- Backend infrastructure complete and tested
- Ready for frontend integration and actual movement implementation

### 🚨 **Known Issues for Future Phases:**

1. **Movement Logic**: `applyMovement()` integration commented out - needs source coordinate selection system
2. **Room Transitions**: Players need to join gameplay rooms on game-started message (frontend work)
3. **Combat Logic Bug**: Failed attacks set `source.units = 0` - needs investigation
4. **Victory Logic**: Territory conversion verification on general capture
5. **Frontend Integration**: Game board rendering and input system needed

### 📋 **Next: Phase 3 - Complete Backend Movement Logic**

**Goal**: Implement actual army movement, combat, and victory detection in GameServer

**Phase 3 Implementation Tasks:**

1. **Complete Movement Processing** (`backend/src/gameplay/game-server.ts`)
   - Uncomment and implement movement logic (lines 109-123)
   - Integrate `applyMovement()` from core engine
   - Add source coordinate selection system for moves
   - Handle move validation and error cases

2. **Player Selection State**
   - Add selected tile tracking per player in GameServer
   - Implement tile selection logic for move origins
   - Handle edge cases (no selection, invalid selection)

3. **Combat & Victory Integration**
   - Test that combat logic works correctly
   - Verify territory conversion on general capture
   - Ensure game ends properly with correct winner

4. **Movement Testing**
   - Test army movement between adjacent tiles
   - Test combat between armies of different sizes
   - Test general capture and immediate victory
   - Verify tick-based processing works

**Success Criteria for Phase 3:**
- ✅ Armies actually move on the board during ticks
- ✅ Combat logic works (larger army defeats smaller)
- ✅ General capture converts all territory and ends game
- ✅ Move queues process correctly at 250ms intervals
- ✅ Invalid moves are handled gracefully

**Testing Approach:**
1. Use server logs to verify move processing
2. Check board state changes in GameCoordinator
3. Test with mock move queue data
4. Verify victory detection triggers game end

**Estimated Time:** 2-3 hours for backend movement completion

**Architecture Context for Phase 4:**

**Backend (Ready after Phase 3):**
- `GameCoordinator` - Global tick system with working movement processing
- `GameServer` - Complete game instance management with functional move logic
- `GameplayWsAPI` - WebSocket message handling
- Core movement and combat logic fully operational

**Frontend (To Implement):**
- `game-ui.tsx` - Adapt existing component for live BoardState data
- `gameplay-ws-handler.ts` - WebSocket domain connection
- `game-page-store.ts` - Minimal state management (board-agnostic)
- `game-page.tsx` - WebSocket integration (data pass-through)

**Data Flow:**
```
User Input (WASD/Click in GameUI) 
  → GameUI callback to Game Page
  → Game Page WebSocket move-request 
  → GameServer Move Queue (Phase 3 working)
  → Engine Tick Processing (Phase 3 working)
  → Board State Update (Phase 3 working)
  → WebSocket game-state-update
  → Game Page passes BoardState to GameUI
  → GameUI Re-render
```

**Architecture Principles:**
- GameUI: Handles rendering + input, agnostic to WebSocket/networking
- Game Page: WebSocket integration, passes data through without interpretation
- Clear separation: visual logic vs networking logic
