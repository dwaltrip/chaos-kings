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

## Remaining Implementation Plan

### Phase 3: Complete Backend Movement Logic (1-2 hours)
**Goal**: Implement actual army movement, combat, and victory in GameServer

**Backend Tasks:**
1. **Add Source Coordinate Selection System**
   - Track selected tile per player in GameServer
   - Handle tile selection via WebSocket messages
   - Validate selection is player-owned territory

2. **Integrate Movement Processing**
   - Uncomment movement logic in GameServer (`game-server.ts:109-123`)
   - Use `applyMovement()` from core engine with selected source
   - Process moves from queue during tick with source/destination

3. **Complete Victory Detection**
   - Territory conversion when general captured
   - Game end broadcasting and cleanup
   - Test win condition triggers correctly

**Success Criteria:**
- Armies move between tiles during ticks
- Combat works (larger army defeats smaller)
- General capture converts territory and ends game
- Move queues process at 250ms intervals

### Phase 4: Frontend Integration (2-3 hours)
**Goal**: Connect existing GameUI to live gameplay with input system

**Frontend Tasks:**
1. **Adapt GameUI Component** (`frontend/src/game-ui/game-ui.tsx`)
   - Fix playerIndex bug: `game.players[playerIndex - 1]` → `game.players[playerIndex]` (line 25)
   - Change props from `GameWithPlayers` to `BoardState` + player mapping
   - Add input callbacks: `onTileSelect`, `onMoveRequest`, `onCancelMoves`

2. **Add Input System to GameUI**
   - Click selection: highlight selected tile, validate player ownership
   - WASD keyboard: queue moves from selected tile
   - 'Q' key: cancel queued moves
   - Visual feedback for selection and moves

3. **WebSocket Integration Layer** (game page level)
   - Create `gameplay-ws-handler.ts` following chat pattern
   - Handle `game-started` → join gameplay room
   - Process `game-state-update` → pass BoardState to GameUI
   - Send `move-request` and `tile-select-request` messages

4. **Update Game Page**
   - Pass live BoardState to GameUI (stay board-agnostic)
   - Forward input callbacks to WebSocket layer
   - Handle room transitions (matchmaking → gameplay)

**Success Criteria:**
- Two browser windows complete full gameplay flow
- Visual board updates in real-time
- Players select tiles and move with WASD
- Game ends with victory/defeat display

## Technical Architecture

### WebSocket Message Protocol
```typescript
// Client → Server
{
  domain: 'gameplay',
  type: 'tile_select_request',
  payload: { row: number, col: number }
}

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

### Game Flow
1. **Matchmaking**: Use existing service to match 2 players
2. **Game Creation**: Create `GameServer` instance, send players to gameplay page
3. **Game Start**: Brief delay (few seconds), then start tick loop
4. **Tile Selection**: Players select source tiles for moves
5. **Move Processing**: WASD input → Queue moves → Process on tick → Broadcast state
6. **Win Detection**: Immediate game stop when general captured
7. **Game End**: Broadcast winner, cleanup resources

### Integration Points

**Existing Systems to Leverage:**
- `WebSocketManager` - handles connections and room broadcasting
- `MatchmakingService` - already configured for 2-player games  
- `Board` utilities from `/core` - movement validation, coord math
- `GameRepository` - persist game state to database
- Frontend `WebSocketService` - domain-based message routing
- **GameUI Component** - existing board renderer with tile/army display

**Remaining Components Needed:**
- Tile selection system in GameServer (Phase 3)
- Input handling in GameUI (Phase 4)
- WebSocket integration layer for frontend (Phase 4)

## Key Architecture Decisions

1. **Server-Authoritative**: Full state sent each tick (< 10KB for 2 players)
2. **No Client Prediction**: Display last received state only
3. **Tick Rate**: 250ms (4 ticks/second) for move rate and production timing
4. **GameUI/GamePage Separation**: GameUI handles rendering/input, GamePage handles WebSocket/networking
5. **Move System**: Tile selection + WASD movement with move queuing
6. **Board Size**: 10x10 for MVP debugging

## Generals.io Game Rules (MVP Reference)
- Each player starts with 1 general (1 unit initially) on random blank square
- **NO CITIES in MVP** - only generals, armies, blank squares, and mountains
- Generals produce 1 unit every 4 ticks (1 per second at 250ms tick rate)
- All player land produces 1 unit every 100 ticks (25 seconds at 250ms tick rate)
- Move splits army: leave 1 unit, move rest to adjacent square
- Combat: attacking army must have more units than defending square
- Capture enemy general → convert all their territory to yours → immediate win

## Things NOT Implementing for MVP
- Fog of war
- Client reconnection  
- Neutral cities
- Optimistic rendering
- Thorough error handling

**Reminder**: Assume the 95% happy path! This is a prototype.

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
