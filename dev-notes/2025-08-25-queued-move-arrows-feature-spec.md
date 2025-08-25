# Queued Move Arrows Feature Specification

**Date:** 2025-08-25  
**Status:** Planning Phase  
**Scope:** Frontend-only implementation

## Overview

Add visual directional arrows to the game UI that show the player's currently queued moves. This provides immediate visual feedback when players queue multiple moves, helping them understand their pending actions before they're processed by the server.

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
- Directional arrows pointing toward destination tile (UP/DOWN/LEFT/RIGHT)
- Subtle but clearly visible over tile content
- Multiple arrows should stack/offset if multiple moves from same tile
- Consistent with existing UI color scheme and styling
- Responsive to different tile sizes

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
  index?: number; // for stacking multiple arrows
}

function MoveArrow({ direction, index = 0 }: MoveArrowProps) {
  // CSS class based on direction
  // Optional offset based on index for multiple arrows
  return <div className={`move-arrow move-arrow-${direction.toLowerCase()}`} />;
}
```

### 4. Update GameTile Component (`game-ui/components/game-tile.tsx`)

- Add hook to get queued moves for current coordinate
- Render arrow components for each queued move
- Handle z-index layering with existing overlays

### 5. Queue Management Strategy

#### Move Removal Triggers:
- **Game State Updates:** Remove moves when new board state arrives (compare ticks)
- **Cancel Moves:** Clear all queued moves when `handleCancelMoves()` called
- **Timeout Cleanup:** Optional fallback for edge cases

#### Implementation Options:
1. **Tick-based Cleanup:** Remove moves when `tick` increases (assumes moves processed)
2. **Smart Cleanup:** Track which moves were likely processed based on board state changes
3. **Simple Timeout:** Remove moves after fixed duration (2-3 seconds)

### 6. CSS Implementation (`game-tile.css`)

```css
.move-arrow {
  position: absolute;
  width: 0;
  height: 0;
  z-index: 3; /* Above tile content, below overlays */
}

.move-arrow-up {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 10px solid #4CAF50;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
}

.move-arrow-right {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 10px solid #4CAF50;
  right: 10%;
  top: 50%;
  transform: translateY(-50%);
}

/* DOWN, LEFT variants... */
```

## Technical Considerations

### Performance
- Minimal performance impact (simple array operations and CSS)
- Consider limiting max queued moves displayed (10+)
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

## Open Questions & Clarifications Needed

### Visual Design Questions
1. **Arrow Styling:** Simple CSS triangles vs Unicode arrows (→ ↑ ↓ ←) vs custom SVG icons?
2. **Multiple Arrows:** How should 3+ queued moves from same tile be displayed?
   - Stack vertically/horizontally?
   - Show count badge instead?
   - Limit display to most recent N moves?
3. **Color Scheme:** What color should arrows be?
   - Match player color?
   - Fixed color (green for "pending")?
   - Different color per move in sequence?

### Technical Implementation Questions
4. **Queue Cleanup Strategy:** Which approach for removing processed moves?
   - Tick-based (remove all on tick change)?
   - Smart detection (compare board changes)?
   - Fixed timeout duration?
5. **Move Validation:** Should we validate queued moves locally?
   - Check if source tile is still owned by player?
   - Validate destination isn't blocked?
   - Or rely entirely on server validation?
6. **Performance Limits:** Maximum number of queued moves to display?
   - Per tile limit?
   - Total limit across board?

### User Experience Questions  
7. **Arrow Persistence:** How long should arrows remain visible?
   - Until next game tick?
   - Until move is processed?
   - Fixed timeout (2-3 seconds)?
8. **Multiple Players:** In multiplayer, show only own moves or all visible players' moves?
9. **Move Cancellation:** Should individual queued moves be cancellable?
   - Click on arrow to remove that specific move?
   - Or only bulk cancellation via existing cancel command?

### Integration Questions
10. **Fog of War:** Do queued moves interact with fog of war visibility?
11. **Spectator Mode:** Should spectators see queued moves? Whose moves?
12. **Mobile Support:** How do arrows display on touch interfaces with different tile sizes?

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