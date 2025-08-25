# Queued Move Arrows Feature Specification

**Date:** 2025-08-25  
**Status:** Planning Phase  
**Scope:** Frontend-only implementation

## Overview

Add visual directional arrows to the game UI that show the player's currently queued moves. This provides immediate visual feedback when players queue multiple moves, helping them understand their pending actions before they're processed by the server.

The main remaining technical unknown / challenge is discussed at the bottom: can we accurately update the list of queued moves by looking at new board states as they come in, without adding any new direct information from the backend related to queued moves.

## Current State Analysis

### Existing Move System
- Players select tiles and use WASD/arrow keys to queue moves
- `useGameplay.handleMoveRequest()` immediately calls `followArmyMovement()` for visual selection following
- Moves are sent via WebSocket to backend `GameServer.queueMove()`
- Server processes moves during game ticks and broadcasts updated board state
- No current visual indication of queued moves beyond selection following

### Code Architecture
- **State:** `gameplay-store.ts` manages game state including `selectedTile`
- **Actions:** `use-gameplay.ts` handles move requests and tile selection  
- **UI:** `GameTile` component renders individual tiles with overlays for selection/valid moves
- **Styling:** CSS-based tile system with overlay support via `TileOverlay` component

## Feature Requirements

### Core Functionality
1. **Visual Arrow Display:** Show directional arrows on tiles that have queued moves
2. **Multiple Move Support:** Handle multiple queued moves from the same source tile
3. **Real-time Updates:** Arrows appear immediately when moves are queued
4. **Queue Cleanup:** Remove arrows when moves are processed or cancelled
5. **Player-only Display:** Only show the current player's queued moves (not opponents)

### Visual Design
- **Arrow Style:** Unicode arrows (→ ↑ ↓ ←) positioned on tile edges pointing toward destination
- **Color:** White arrows for clear visibility
- **Multiple Directions:** Show 1-4 arrows per tile (one for each direction with queued moves)
- **Multiple Same Direction:** Treat multiple moves in same direction as single arrow display
- **Positioning:** Arrows positioned on tile edges - top (↑), right (→), bottom (↓), left (←)
- **Player Visibility:** Only show current player's queued moves (frontend-only approach)

## Implementation Plan

### 1. Extend Gameplay State (`gameplay-store.ts`)

```typescript
interface QueuedMove {
  sourceCoord: Coord;
  direction: Movement;
  timestamp: number; // for cleanup/debugging
}

// Add to GameplayState interface:
queuedMoves: QueuedMove[];

// Add to actions:
addQueuedMove: (move: QueuedMove) => void;
removeQueuedMove: (sourceCoord: Coord, direction: Movement) => void;
clearQueuedMoves: () => void;
```

### 2. Update Move Request Logic (`use-gameplay.ts`)

```typescript
const handleMoveRequest = useCallback((direction, selectedTile) => {
  if (!selectedTile) return;
  
  // Add to local queue for visual display
  actions.addQueuedMove({
    sourceCoord: selectedTile,
    direction: direction as Movement,
    timestamp: Date.now()
  });
  
  // Existing logic (followArmyMovement, WebSocket send)
  // ...
}, [actions]);
```

### 3. Create Arrow Component (`game-ui/components/move-arrow.tsx`)

```typescript
interface MoveArrowProps {
  direction: Movement;
}

function MoveArrow({ direction }: MoveArrowProps) {
  const arrows = {
    UP: '↑',
    DOWN: '↓', 
    LEFT: '←',
    RIGHT: '→'
  };
  
  return (
    <div className={`move-arrow move-arrow-${direction.toLowerCase()}`}>
      {arrows[direction]}
    </div>
  );
}
```

### 4. Update GameTile Component (`game-ui/components/game-tile.tsx`)

- Add hook to get queued moves for current coordinate
- Render arrow components for each queued move
- Handle z-index layering with existing overlays

### 5. Queue Management Strategy

#### Move Removal Context:
- **Game Tick Rate:** 4 moves per second (0.25s intervals)
- **Move Validation:** Use existing validation only (no additional frontend validation)
- **Detection Approach:** Heuristic-based cleanup when board state updates arrive

#### Move Removal Triggers:
- **Game State Updates:** Analyze board changes to detect executed/invalid moves
- **Cancel Moves:** Clear all queued moves when `handleCancelMoves()` called
- **Immediate Invalid:** Remove moves when source conditions change

### 6. CSS Implementation (`game-tile.css`)

```css
.move-arrow {
  position: absolute;
  color: white;
  font-size: 16px;
  font-weight: bold;
  z-index: 3; /* Above tile content, below overlays */
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8); /* Ensure visibility on all backgrounds */
}

.move-arrow-up {
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
}

.move-arrow-right {
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
}

.move-arrow-down {
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
}

.move-arrow-left {
  left: 2px;
  top: 50%;
  transform: translateY(-50%);
}
```

## Technical Considerations

### Performance
- Minimal performance impact (simple array operations and CSS)
- Consider limiting max queued moves displayed
    - Doesn't seem super important technically, but could be a sanity check
    - Maybe like 100-200? At faster game speeds, a player might queue many moves.
- Use React keys properly for arrow component rendering

### Edge Cases
- **Rapid Move Queueing:** Multiple moves queued faster than tick processing
- **Network Issues:** Moves queued but not processed due to connection problems
- **Game State Desync:** Local queue out of sync with server state
- **Multiple Moves Same Direction:** How to visually represent duplicate moves

### Accessibility
- Ensure arrows are visible on all tile types and colors
- Consider adding ARIA labels or alt text for screen readers
- Maintain sufficient color contrast

## Resolved Requirements

### Visual Design (RESOLVED)
- ✅ **Arrow Styling:** Unicode arrows (→ ↑ ↓ ←)
- ✅ **Multiple Arrows:** 1-4 arrows per tile (one per direction), positioned on tile edges
- ✅ **Multiple Same Direction:** Single arrow display (multiple moves same direction = one arrow)
- ✅ **Color Scheme:** White arrows with text shadow for visibility
- ✅ **Player Visibility:** Only show current player's queued moves (frontend-only)
- ✅ **Mobile Support:** Not applicable (game doesn't support mobile)

### Technical Implementation (RESOLVED)
- ✅ **Move Validation:** Use existing validation only, no additional frontend validation
- ✅ **Performance Limits:** Assume reasonable limits based on game mechanics (4 moves/second)
- ✅ **Move Cancellation:** Only bulk cancellation via existing cancel command

## Queue Cleanup Strategy - TO DISCUSS

### Heuristic Approach Framework
**"Move occurred" detection logic:**
- **Before**: Tile A has N troops, owned by player
- **Queued**: A→RIGHT 
- **After**: Tile A has <N troops, still owned by player
- **Logic**: If A lost troops AND the RIGHT move was queued, likely that move executed → remove RIGHT arrow

**"No longer possible" detection:**
- Tile A has 0 troops → remove ALL arrows from A (can't move with 0)
- Tile A no longer owned by player → remove ALL arrows from A (can't move from enemy tile)

### Edge Cases to Resolve
1. **Simultaneous incoming/outgoing moves**: Tile A loses 3 troops from queued move but gains 2 from incoming move → net -1, but our move still executed
2. **Failed move vs pending move**: If A→RIGHT fails (blocked destination), how do we know the arrow should disappear vs the move still being pending?
3. **Troop threshold**: If tile A has 2 troops and we queue A→RIGHT, but by next tick A only has 1 troop (minimum to stay), did our move fail or was it invalid to begin with?
4. **Destination captured**: We queue A→RIGHT toward enemy tile B, but ally captures B first - does our move still execute or get cancelled?

### Questions for Server Behavior
- When a queued move becomes invalid (like destination blocked), does the server drop it silently or does it get processed but fail?
- How does the server handle minimum troop requirements for moves?
- Are moves atomic per tile or can partial moves occur?

### Double-checking "frontend-only" assumption, future considerations

- What would the simplest solution involving backend changes look like? Would it greatly simplify the frontend?
- Relatedly, but also tangentially, the backend move queue will probably need some enhancements at some point. It's quite simplistic right now, and doens't have any special handling of edge cases, which we will probably need. But unclear if this is worth looking into for now.
- Will need to balance moving forward reasonably quickly on this spike with laying some nice ground work for the future
- Perhaps some of the logic we come up with for heuristics or other aspects of queuing moves could be added to the core package

## Success Criteria

1. **Immediate Feedback:** Arrows appear instantly when moves are queued
2. **Clear Direction:** Arrow direction unambiguously indicates move destination
3. **No Visual Clutter:** Arrows don't obscure important tile information
4. **Accurate State:** Arrows accurately represent actual queued moves
5. **Clean Cleanup:** Arrows disappear appropriately when moves are processed/cancelled
6. **Performance:** No noticeable impact on game performance or responsiveness

## Future Enhancements (Out of Scope)

- Animated arrows showing move progression
- Move sequence numbering (1st, 2nd, 3rd queued move)
- Hover tooltips showing move details
- Keyboard shortcuts for arrow navigation
- Integration with replay system to show historical move queues
