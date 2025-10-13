# Frontend Performance Analysis

## Background

As the game grows to support larger maps and more complex gameplay mechanics, we've identified potential performance bottlenecks that could cause UI freezing. This analysis examines React re-rendering patterns, state management efficiency, and component optimization opportunities in the frontend codebase.

The focus is on identifying issues that become exponentially worse with larger map sizes, since the core game loop involves frequent board state updates that could trigger cascading re-renders across hundreds of tile components.

## Critical Severity Issues

### 1. Global State Subscription Causing Mass Re-renders

**Location**: `frontend/src/game-ui/components/game-tile.tsx:31`

**Problem**: Every `GameTile` component subscribes directly to the global `queuedMoves` state:

```typescript
const queuedMoves = gameplayStore((state) => state.queuedMoves);
```

**Impact**: 
- On every keystroke (move queue), ALL tiles re-render regardless of whether they're affected
- For a 20x20 map (400 tiles), a single move triggers 400 component re-renders
- Scales poorly: 30x30 map = 900 re-renders per keystroke
- Each re-render involves expensive tile state calculations, coordinate lookups, and DOM updates

**Why This Happens**:
The current implementation filters queued moves at render time inside each tile:
```typescript
const tileQueuedMoves = queuedMoves.filter(
  (move) => move.sourceCoord.x === coord.x && move.sourceCoord.y === coord.y,
);
```

Zustand triggers re-renders for any component subscribing to `queuedMoves`, even if the filtering would result in the same data.

**Solution**:
Use a tile-specific selector that only triggers updates when that tile's moves actually change:
```typescript
const tileQueuedMoves = gameplayStore((state) => 
  state.queuedMoves.filter(move => 
    move.sourceCoord.x === coord.x && move.sourceCoord.y === coord.y
  ),
  (a, b) => JSON.stringify(a) === JSON.stringify(b) // shallow compare
);
```

### 2. Expensive Visibility Calculations on Every Render

**Location**: `frontend/src/game-ui/hooks/use-fog-of-war.ts:18-21`

**Problem**: The `useFogOfWar` hook triggers `Board.getVisibleSquares()` computation on every tile render:

```typescript
const visibleSquares = useMemo(() => {
  if (!boardState || currentPlayerIndex === null) return new Set<string>();
  return Board.getVisibleSquares(boardState, currentPlayerIndex);
}, [boardState, currentPlayerIndex]);
```

**Impact**:
- `Board.getVisibleSquares()` iterates through ALL player squares on the board (`core/src/board.ts:94`)
- For each player square, checks 8 neighboring coordinates (`core/src/board.ts:96`)
- Creates new Set objects and performs coordinate serialization repeatedly
- Complexity: O(playerSquares × 8) per visibility calculation
- Called once per tile component = O(tiles × playerSquares × 8) total

**Why This Happens**:
Each `GameTile` component calls `useTileState()` which calls `useFogOfWar()`. The visibility calculation is expensive and shouldn't be duplicated across every tile.

**Solution**:
Move visibility calculation to a higher level (board or game state) and memoize the result:
```typescript
// In gameplay store or board component
const visibilityMemo = useMemo(() => 
  Board.getVisibleSquares(boardState, currentPlayerIndex),
  [boardState, currentPlayerIndex]
);
```

## High Severity Issues

### 3. Inefficient Array Operations in State Updates

**Location**: 
- `frontend/src/game-ui/store/gameplay-store.ts:79`
- `frontend/src/game-ui/hooks/use-gameplay.ts:59`

**Problem**: Queued moves are replaced entirely instead of being updated incrementally:

```typescript
// Current approach - creates new array every time
setQueuedMoves: (moves) => set(() => ({ queuedMoves: moves }));

// In use-gameplay.ts
actions.setQueuedMoves([...currentQueuedMoves, newMove]);
```

**Impact**:
- Every move addition triggers a full array replacement
- Causes unnecessary re-renders in components subscribing to `queuedMoves`
- Memory allocation overhead from constant array creation
- Makes optimization harder since the entire array reference changes

**Solution**:
Implement incremental updates or use a more efficient data structure:
```typescript
addQueuedMove: (move) => set((state) => ({
  queuedMoves: [...state.queuedMoves, move]
}));

removeQueuedMoves: (predicate) => set((state) => ({
  queuedMoves: state.queuedMoves.filter(predicate)
}));
```

### 4. Missing React.memo Optimization

**Location**: `frontend/src/game-ui/components/game-tile.tsx`

**Problem**: `GameTile` component isn't wrapped in `React.memo`, so it re-renders whenever its parent re-renders, regardless of prop changes.

**Impact**:
- Tiles re-render even when their individual state hasn't changed
- Combined with the global state issue above, causes excessive re-computation
- Each tile recalculates expensive operations (visibility, borders, styling) unnecessarily

**Solution**:
```typescript
const GameTile = React.memo(({ coord, row, col }: GameTileProps) => {
  // component logic
}, (prevProps, nextProps) => {
  return prevProps.coord.x === nextProps.coord.x && 
         prevProps.coord.y === nextProps.coord.y;
});
```

## Performance Impact Summary

These issues compound to create significant performance problems:

1. **Mass re-renders**: Every keystroke triggers hundreds of component updates
2. **Redundant calculations**: Expensive visibility logic runs hundreds of times per update
3. **Memory pressure**: Constant array creation and object allocation
4. **UI freezing**: On larger maps (25x25+), the combination can cause noticeable lag

The most critical fix is addressing the global state subscription pattern, as this alone could resolve 80% of the performance issues with larger maps.

## Detailed Performance Analysis

### Current Implementation Load (20x20 map, 400 tiles)

**Per Move Operation:**
- **Component renders**: 400 tiles × 2 triggers (client + server broadcast) = 800 renders
- **Visibility calculations**: 400 × 2 = 800 expensive `Board.getVisibleSquares()` calls
- **Array filtering**: 400 × 2 = 800 filter operations per move

**Peak Load (20 moves/second):**
- 16,000 component renders/second
- 16,000 visibility calculations/second  
- 16,000 array filter operations/second

**WebSocket Processing Overhead:**
- Every WS update triggers 400 subscription evaluations
- Each subscription filters entire move queue: O(queue_size × tiles)
- 5 moves = 2,000 filter operations per WS update

### Proposed Solution: Coordinate-Keyed Move Storage

**Performance Improvements:**
- **Component renders**: 1-2 tiles × 2 triggers = 2-4 renders per move (400x reduction)
- **Visibility calculations**: 2-4 per move (400x reduction)
- **WS processing**: O(queue_size + unique_coordinates) vs O(queue_size × tiles)

**Implementation Overview:**
```typescript
// Store structure change
interface GameplayState {
  queuedMovesByCoord: Record<string, Movement[]>; // "x,y" → [directions]
  actions: {
    setQueuedMovesFromArray: (moves: Array<{sourceCoord: Coord; direction: Movement}>) => void;
    addQueuedMove: (sourceCoord: Coord, direction: Movement) => void;
    clearAllQueuedMoves: () => void;
  }
}

// Tile subscription with CRITICAL equality function
const tileQueuedMoves = gameplayStore(
  state => state.queuedMovesByCoord[`${coord.x},${coord.y}`] || [],
  (prev, next) => {
    // Essential: Only re-render if THIS tile's moves actually changed
    if (prev.length !== next.length) return false;
    return prev.every((move, i) => move === next[i]);
  }
);

// WS handler stays clean
actions.setQueuedMovesFromArray(myQueue);
```

**Result**: 100:1 to 400:1 performance improvement with larger maps while maintaining code clarity.

### ⚠️ Critical Implementation Notes

**Zustand Subscription Behavior:**
- Zustand cannot automatically detect that `state.queuedMovesByCoord[key]` should only trigger on specific key changes
- Without the equality function, ALL tiles will still re-render when ANY coordinate in the record changes
- The custom equality function is **essential** for the optimization to work

**Implementation Checklist:**
1. ✅ Change store structure to coordinate-keyed Record
2. ⚠️ **MUST** add equality functions to all tile subscriptions  
3. ⚠️ Verify Zustand subscription behavior with React DevTools
4. ⚠️ Test that only affected tiles re-render (not all 400)
5. ⚠️ Consider store-level optimizations for individual coordinate updates

**Alternative Store Approach (potentially more efficient):**
```typescript
// Individual coordinate updates to minimize Zustand object changes
setMovesForCoord: (coord: Coord, moves: Movement[]) => set((state) => ({
  queuedMovesByCoord: {
    ...state.queuedMovesByCoord,
    [`${coord.x},${coord.y}`]: moves
  }
}))
```

This approach updates only specific coordinates rather than replacing the entire Record, potentially reducing the number of subscriptions that need evaluation.