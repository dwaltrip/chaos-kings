# GamePage Architecture Analysis & Refactoring Plan

**Date:** 2025-08-13  
**Author:** Claude Code Analysis  
**Context:** Deep review of frontend game-page architecture and separation of concerns

## Executive Summary

The current GamePage implementation significantly violates the intended architectural separation where GamePage should handle high-level page concerns while GameUI manages all gameplay details. GamePage currently knows far too much about low-level game mechanics, creating tight coupling and architectural confusion.

## Current Architecture Problems

### 1. GamePage Scope Violations

**Current GamePage responsibilities (182 lines):**
- ✅ Game metadata loading (`loadGame()` at line 65-82)
- ✅ Page layout and routing
- ❌ **Gameplay state management** (lines 26-32: boardState, selectedTile, playerMapping, etc.)
- ❌ **Fog of war calculations** (line 35: `useFogOfWar()`)
- ❌ **Game mechanics handling** (line 36: `useGameplay()`)
- ❌ **WebSocket gameplay setup** (lines 45-63: GameplayWsHandler registration)
- ❌ **Real-time game state processing**

**GamePage store dependencies:**
```typescript
// Lines 26-32: Direct gameplay store access
const boardState = gameplayStore((state) => state.boardState);
const selectedTile = gameplayStore((state) => state.selectedTile);
const playerMapping = gameplayStore((state) => state.playerMapping);
const gameEnded = gameplayStore((state) => state.gameEnded);
const winner = gameplayStore((state) => state.winner);
const endReason = gameplayStore((state) => state.endReason);
```

### 2. Props Explosion to GameUI

**Current GameUI interface (7+ props):**
```typescript
// Lines 151-160: Heavy prop drilling
<GameUI 
  boardState={boardState}
  selectedTile={selectedTile}
  onTileSelect={handleTileSelect}
  onMoveRequest={(direction) => handleMoveRequest(direction, selectedTile)}
  onCancelMoves={handleCancelMoves}
  disabled={gameEnded}
  currentPlayerIndex={currentPlayerIndex}
  visibleSquares={visibleSquares}
/>
```

**Problems:**
- GameUI has **zero autonomy** - completely dependent on GamePage
- GameUI cannot function independently
- Any gameplay state change triggers GamePage re-render
- Impossible to reuse GameUI in other contexts (spectator, replay, tutorial)

### 3. State Management Confusion

**Two different WebSocket patterns:**
- **GameChat**: Self-contained in `game-chat.tsx` with own store/handlers
- **Gameplay**: Managed by GamePage, passed to GameUI as props

**Mixed state boundaries:**
- **Page-level state**: `game` (local useState)
- **Global gameplay state**: `gameplayStore` (accessed from GamePage)
- **No clear ownership** of gameplay concerns

### 4. WebSocket Lifecycle Issues

**GamePage manages gameplay WebSockets (lines 45-63):**
```typescript
// GamePage shouldn't know about gameplay message handling
wsService.addMessageHandler(GAMEPLAY_DOMAIN, GameplayWsHandler);
const gameplayRoom = roomNameForGameplay(game);
wsService.send(createJoinRoomMessage(gameplayRoom));
```

**Problems:**
- Page-level component handling game-level messages
- Cleanup race conditions during unmounting
- No error handling for WebSocket failures

## Original Architectural Vision vs Reality

### Intended Design
```
GamePage (High-level orchestrator)
├── GameHeader (metadata, status)
├── GameSidebar (chat)
└── GameMain
    └── GameUI (self-contained gameplay module)
```

### Current Reality
```
GamePage (Knows everything about gameplay)
├── gameplayStore access
├── Fog of war calculations  
├── WebSocket gameplay handling
├── Game mechanics processing
└── GameUI (dumb renderer)
```

## Proposed Refactoring

### 1. GamePage Responsibilities (Should)
- ✅ Route parameter extraction (`gameId`)
- ✅ Game metadata loading and error handling
- ✅ Page layout and structure
- ✅ High-level loading/error states
- ✅ Chat sidebar orchestration
- ❌ **NO gameplay state knowledge**
- ❌ **NO WebSocket gameplay handling**
- ❌ **NO game mechanics awareness**

### 2. GameUI Responsibilities (Should)
- ✅ **Complete gameplay autonomy**
- ✅ Own WebSocket connection management
- ✅ Internal gameplay state management
- ✅ Game mechanics and rules handling
- ✅ Fog of war calculations
- ✅ Keyboard controls and interactions
- ✅ Real-time state updates

### 3. New Interface Design

**Simplified GamePage:**
```typescript
function GamePage() {
  const { gameId } = useParams();
  const [game, setGame] = useState<GameWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Only metadata loading
  useEffect(() => { loadGameMetadata(gameId); }, [gameId]);
  
  return (
    <div className="game-layout">
      <GameHeader game={game} />
      <GameSidebar><GameChat game={game} /></GameSidebar>
      <GameMain>
        {/* GameUI is completely self-contained */}
        <GameUI gameId={game?.id} />
      </GameMain>
    </div>
  );
}
```

**Autonomous GameUI:**
```typescript
interface GameUIProps {
  gameId: number;  // Only needs this!
}

function GameUI({ gameId }: GameUIProps) {
  // Self-contained gameplay state
  const gameplayState = useGameplayState(gameId);
  
  // Own WebSocket management
  useGameplayWebSocket(gameId);
  
  // Internal game mechanics
  const actions = useGameplayActions();
  
  return <GameBoard {...gameplayState} {...actions} />;
}
```

### 4. State Management Boundaries

**Page Store (GamePage only):**
```typescript
const gamePageStore = create(() => ({
  game: null,           // Game metadata
  loading: false,       // Page loading state
  error: null,          // Page-level errors
  // NO gameplay state
}));
```

**Gameplay Store (GameUI only):**
```typescript
const gameplayStore = create(() => ({
  boardState: null,         // Game board
  selectedTile: null,       // Current selection
  playerMapping: null,      // Player assignments
  visibleSquares: new Set(), // Fog of war
  gameEnded: false,         // Game status
  winner: null,             // Game outcome
  // ALL gameplay state here
}));
```

## Implementation Benefits

### 1. True Separation of Concerns
- **Clear boundaries** between page and game logic
- **Single responsibility** for each component
- **Easier reasoning** about state flow

### 2. Improved Reusability
- GameUI becomes **standalone module**
- Can be used in spectator mode, replays, tutorials
- **Zero coupling** to specific page structure

### 3. Better Performance
- **Fewer re-renders** - gameplay changes don't affect page layout
- **Localized state updates** contained within GameUI
- **Better memoization** opportunities

### 4. Enhanced Maintainability
- **Easier testing** - GameUI can be tested in isolation
- **Clearer debugging** - gameplay issues contained in GameUI
- **Simplified state management** with clear ownership

### 5. Scalability
- **Multiple GameUI instances** possible (split screen, spectator)
- **Independent versioning** of gameplay vs page logic
- **Plugin architecture** potential for different game modes

## Migration Strategy

### Phase 1: Move Gameplay State to GameUI
1. Create `useGameplayState(gameId)` hook
2. Move all gameplayStore access into GameUI
3. Remove gameplay state from GamePage

### Phase 2: Internalize WebSocket Management
1. Create `useGameplayWebSocket(gameId)` hook
2. Move GameplayWsHandler registration to GameUI
3. Remove WebSocket setup from GamePage

### Phase 3: Simplify GameUI Interface
1. Replace 7+ props with single `gameId` prop
2. Move fog of war calculations to GameUI
3. Internalize all game mechanics handling

### Phase 4: Clean Up GamePage
1. Remove all gameplay-related imports
2. Simplify to pure page orchestration
3. Focus on metadata, layout, and chat

## Validation Checklist

**GamePage should NOT:**
- [ ] Import any @core types (BoardState, Coord, etc.)
- [ ] Access gameplayStore
- [ ] Handle WebSocket gameplay messages  
- [ ] Calculate fog of war
- [ ] Process game mechanics
- [ ] Know about tiles, armies, or board state

**GameUI should:**
- [ ] Function independently with only gameId
- [ ] Handle all gameplay WebSocket connections
- [ ] Manage complete gameplay state internally
- [ ] Be reusable in different contexts
- [ ] Have zero dependencies on GamePage structure

## Files Requiring Changes

### Primary Files
- `frontend/src/pages/game/game-page.tsx` - Major simplification
- `frontend/src/game-ui/game-ui.tsx` - Add autonomy and state management
- `frontend/src/pages/game/gameplay/gameplay-store.ts` - Scope to GameUI only

### Supporting Files  
- `frontend/src/pages/game/use-fog-of-war.ts` - Move to GameUI
- `frontend/src/pages/game/use-gameplay.ts` - Move to GameUI
- `frontend/src/pages/game/gameplay/gameplay-ws-handler.ts` - Scope to GameUI

### New Files Needed
- `frontend/src/game-ui/use-gameplay-state.ts`
- `frontend/src/game-ui/use-gameplay-websocket.ts`  
- `frontend/src/game-ui/use-gameplay-actions.ts`

---

**Next Steps:** Proceed with Phase 1 implementation to move gameplay state management into GameUI module.