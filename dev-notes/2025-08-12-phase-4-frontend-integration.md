# Phase 4: Frontend Integration (MVP/Prototype)
*Created: 2025-08-12*

## Goal
Connect existing GameUI to live gameplay with minimal input system. Get basic click-to-select + WASD movement working.

## Current State
- ✅ **Backend**: GameServer fully working with movement, combat, victory
- ✅ **WebSocket**: Gameplay domain messages working
- 🔄 **Frontend**: GameUI uses static data, no input handling, no live updates

## Simple Architecture
```
Click/WASD → GameUI → Game Page → WebSocket → GameServer
             ↑                              
GameServer → WebSocket → Game Page → GameUI (re-render)
```

## Implementation Tasks (Barebones MVP)

### 1. Fix GameUI - Use Live Data Instead of Static
- Fix bug: `game.players[playerIndex - 1]` → `game.players[playerIndex]` 
- Change props to accept `BoardState` instead of `GameWithPlayers`
- Add `selectedTile` prop for visual feedback
- Add click handlers to tiles

### 2. Add Simple Input System
- Barebones input handling layer that separates DOM events from resulting game logic / messages to server, etc
- Click tile → select it (show highlight)
- WASD keys → send move from selected tile
- Q key → cancel moves

### 3. Create Game Page Store (Copy Chat Pattern)
- Store: `boardState`, `selectedTile`, `playerMapping`
- Actions: `setBoardState`, `setSelectedTile`

### 4. Create Gameplay WebSocket Handler (Copy Chat Pattern)
- Handle `game-state-update` → update store
- Handle `game-started` → join room, set player mapping
- Handle `game-ended` → show winner

### 5. Wire Everything in Game Page
- Connect WebSocket handler on mount
- Pass live `boardState` to GameUI instead of static game
- Instantiate input handler to catch tile clicks and keyboard events, and call frontend actions appropriately
- Send `move-request` messages to server

## Simple Success Test
1. Open 2 browser windows
2. Complete matchmaking → both get redirected to gameplay
3. Click tile → see highlight
4. Press WASD → see army move on both screens
5. Capture enemy general → game ends

---

## Things NOT Implementing for MVP
- Fog of war
- Client reconnection  
- Neutral cities
- Optimistic rendering
- Thorough error handling

## Remember! We are prototyping
- Assume the 95% happy path! This is a prototype.
