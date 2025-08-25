# Queued Move Arrows - Implementation Strategy

**Date:** 2025-08-25  
**Status:** Analysis Complete, Ready for Implementation  
**Previous Doc:** [2025-08-25-queued-move-arrows-feature-spec.md](./2025-08-25-queued-move-arrows-feature-spec.md)

## Decision Summary

**Selected Approach:** Backend-supported implementation  
**Rationale:** Frontend-only heuristics proved complex and error-prone with heavy move queuing (dozens of moves)

## Analysis Results

### Frontend-Only Heuristic Approach - Rejected

**Why it looked appealing:**
- No backend changes required
- Seemed like simple state management

**Why it's actually complex:**
- Players queue dozens of moves regularly
- Server processes moves silently (no failure notifications)
- Ambiguous scenarios: move failed vs. tile attacked vs. move pending
- Edge cases multiply with heavy queuing
- Conservative cleanup leads to lingering arrows
- Aggressive cleanup risks removing valid moves

**Estimated complexity:** 2-3 days development + extensive edge case testing

### Backend-Supported Approach - Selected

**Core insight:** Server already perfectly tracks player move queues in `GameServer.playerQueues`

**Implementation:** Piggyback queue data on existing `game-state-update` broadcasts

**Advantages:**
- 100% accurate (no heuristics)
- Simple frontend logic
- Leverages existing server state
- No edge cases to handle
- Immediate visual feedback matches server reality

**Estimated complexity:** ~4 hours development + testing

## Technical Analysis

### Current Backend Queue Processing

**Location:** `backend/src/gameplay/game-server.ts:137-188`

**Key behaviors:**
- Exactly **one move per player per tick** processed (`moveQueue.shift()`)
- **Tick-time validation:** ownership, unit count, coordinate bounds
- **Failed moves silently dropped** with console logging only
- Queue-time validation only checks coordinate bounds

**Processing order:** FIFO per player (oldest queued move processed first)

### Current State Management

**Frontend store:** `frontend/src/game-ui/store/gameplay-store.ts`
- Manages board state, player mapping, selected tile
- No current queue state tracking

**Move handling:** `frontend/src/game-ui/hooks/use-gameplay.ts:17-41`
- Immediately calls `followArmyMovement()` for selection following
- Sends WebSocket message to backend
- No local queue tracking

## Implementation Plan

### 1. Backend Changes

**File:** `backend/src/gameplay/game-server.ts`

```typescript
// Modify broadcastGameState() method
private broadcastGameState(): void {
  if (!this.gameState) return;
  
  const wsManager = getGlobalWebSocketManager();
  wsManager.serverBroadcastToRoom(this.roomName, {
    domain: GAMEPLAY_DOMAIN,
    type: 'game-state-update',
    payload: {
      tick: this.gameState.tick,
      boardState: this.gameState.board,
      playerQueues: this.getPlayerQueuesForBroadcast(), // NEW
    },
  });
}

// Add new helper method
private getPlayerQueuesForBroadcast(): Record<number, Array<{sourceCoord: Coord, direction: Movement}>> {
  const result: Record<number, Array<{sourceCoord: Coord, direction: Movement}>> = {};
  for (const [playerIndex, queue] of this.playerQueues) {
    result[playerIndex] = queue.map(move => ({
      sourceCoord: move.sourceCoord,
      direction: move.movement
    }));
  }
  return result;
}
```

### 2. Type Updates

**File:** `common/types/gameplay.ts`

```typescript
// Update GameStateUpdate interface
export interface GameStateUpdate extends WsMessage {
  payload: {
    tick: number;
    boardState: BoardState;
    playerQueues?: Record<number, Array<{sourceCoord: Coord, direction: Movement}>>; // NEW - optional for backward compatibility
  };
}
```

### 3. Frontend State Management

**File:** `frontend/src/game-ui/store/gameplay-store.ts`

```typescript
// Add to GameplayState interface
interface GameplayState {
  // ... existing fields
  queuedMoves: Array<{sourceCoord: Coord, direction: Movement}>; // Current player's queue
  // ... rest
}

// Add to actions
actions: {
  // ... existing actions
  setQueuedMoves: (moves: Array<{sourceCoord: Coord, direction: Movement}>) => void;
  // ... rest
}
```

### 4. WebSocket Handler Updates

**File:** `frontend/src/game-ui/store/gameplay-ws-handler.ts`

```typescript
// Update game-state-update handler
case 'game-state-update':
  actions.setBoardState(payload.boardState);
  actions.setTick(payload.tick);
  
  // Handle queue updates
  if (payload.playerQueues) {
    const currentPlayerIndex = getCurrentPlayerIndex(); // Helper function needed
    const myQueue = payload.playerQueues[currentPlayerIndex] || [];
    actions.setQueuedMoves(myQueue);
  }
  break;
```

### 5. UI Component Updates

**File:** `frontend/src/game-ui/components/game-tile.tsx`

- Add hook to get queued moves for current coordinate
- Render `MoveArrow` components for each queued direction
- Handle multiple moves in same direction (single arrow display)

**File:** `frontend/src/game-ui/components/move-arrow.tsx` (new file)

- Simple component rendering Unicode arrows
- CSS positioning on tile edges
- White color with text shadow for visibility

### 6. CSS Implementation

**File:** `frontend/src/game-ui/game-tile.css`

- Arrow positioning classes (top, right, bottom, left edges)
- Z-index layering (above tile content, below overlays)
- Visibility and contrast styling

## Success Criteria

1. **Immediate Feedback:** Arrows appear instantly when moves are queued
2. **Accurate State:** Arrows exactly match server queue state  
3. **Clean Removal:** Arrows disappear immediately when moves are processed
4. **Multiple Directions:** Show 1-4 arrows per tile as needed
5. **Performance:** No impact on game responsiveness
6. **Visual Quality:** Clear visibility on all tile backgrounds

## Edge Cases Handled Automatically

With server-side queue tracking, these become non-issues:

- ✅ **Silent move failures** - Server removes from queue, arrows disappear
- ✅ **Multiple moves same direction** - Frontend shows one arrow per direction
- ✅ **Race conditions** - Server state is authoritative
- ✅ **Network issues** - Arrows sync with actual server queue on reconnect
- ✅ **Heavy queuing** - Scales to dozens of moves without complexity

## Testing Strategy

### Unit Tests
- Queue state management in store
- Arrow component rendering
- WebSocket message handling

### Integration Tests  
- End-to-end: queue moves → see arrows → moves process → arrows disappear
- Multiple players (arrows only show for current player)
- Cancel moves functionality

### Performance Tests
- Heavy queuing scenarios (30+ moves)
- Rapid move queueing/processing cycles

## Future Enhancements (Out of Scope)

- Move sequence indicators (1st, 2nd, 3rd move)
- Animated arrow styles  
- Hover tooltips with move details
- Integration with replay system

## Implementation Timeline

**Estimated effort:** 4-6 hours total
- Backend changes: 1 hour
- Type updates: 30 minutes  
- Frontend state: 1 hour
- UI components: 2 hours
- CSS styling: 30 minutes
- Testing: 1-2 hours

**Risk level:** Low - leverages existing architecture patterns

---

## Final Review (2025-08-25)

### Technical Accuracy Verification ✅

**Backend queue processing:** Confirmed accurate description of `GameServer.processPlayerMoves()` at `game-server.ts:137-188`
- Exactly one move per player per tick via `moveQueue.shift()`
- Tick-time validation (ownership, units, coordinates) matches documented behavior
- Silent failure handling with console logging verified

**Current architecture:** All references to existing code structure verified:
- `broadcastGameState()` at `game-server.ts:211-224` matches planned modification point
- `GameStateUpdate` interface at `common/types/gameplay.ts:29-34` ready for extension
- Frontend store structure and WebSocket handling patterns confirmed

### Implementation Readiness Assessment

**Approach validation:** Backend-supported approach is optimal
- Frontend-only complexity analysis is accurate - heavy queuing creates significant edge case burden  
- Server-side queue state (`GameServer.playerQueues`) is the perfect authoritative source
- Piggybacking on existing `game-state-update` broadcasts follows established patterns

**Code integration points:** All identified correctly
- Backend broadcast modification is minimal and safe
- Frontend state management follows existing Zustand patterns
- WebSocket handler extension is straightforward

### Additional Technical Insights

**Architecture considerations:**
- Current backend/core separation is clean: backend handles player-specific validation (ownership, units), core handles pure game rules (`Board.canMove` - coordinates, mountains)
- Future opportunity: As queue complexity grows (move chaining rules, conditional moves, sequence validation), consider moving pure queue logic to core for better testability and reuse

**Performance considerations:**
- Current approach is perfectly fine for prototype phase - sending small arrays a few times per second is negligible overhead
- No optimization needed at this stage; premature optimization should be avoided

**Testing approach:**
- Light touch for prototype phase - focus on manual testing and basic functionality
- Only add tests for high-value, logic-intensive code expected to persist long-term
- `getPlayerQueuesForBroadcast()` serialization logic could benefit from a simple unit test if time permits
- Manual testing should cover: queue moves → see arrows → moves process → arrows disappear

### Final Recommendation

**Status:** Ready to implement immediately
**Confidence level:** High - design is sound and follows established patterns
**Estimated complexity:** 4-6 hours remains accurate, potentially on lower end due to clean integration points

The document demonstrates thorough analysis and the selected approach eliminates the complex edge cases that would plague alternative implementations. All technical assumptions verified against actual codebase.

### Implementation Notes for Fresh Session

**Context for new Claude Code session:**
- This is a multiplayer real-time strategy game prototype (Generals.io style)
- Feature adds visual arrows showing queued moves to players
- All technical analysis complete, ready for direct implementation
- Follow the step-by-step implementation plan exactly as outlined
- Project uses TypeScript throughout with strict conventions (see CLAUDE.md)
- Build verification: Always run `bash tools/build-all.sh` after changes
- File naming: Use kebab-case for all files (e.g., `move-arrow.tsx`)

**Key architectural decisions already made:**
- Backend-supported approach (not frontend-only heuristics)
- Piggyback queue data on existing `game-state-update` broadcasts  
- Server queue state in `GameServer.playerQueues` is authoritative source
- Frontend shows arrows only for current player's moves

**Implementation order:** Follow sections 1-6 in sequence as documented above