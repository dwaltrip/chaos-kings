# Tile Store Refactor - Complete Analysis

## Background

We have significant performance issues where every move triggers 400+ tile re-renders on a 20x20 board. The root cause is global state subscription patterns where each tile subscribes to entire state objects and filters at render time.

## Current Performance Problem

### Critical Issues Identified
1. **Mass Re-renders**: Every keystroke (move queue) triggers ALL tiles to re-render
   - 20x20 map = 400 component re-renders per move
   - Scales poorly: 30x30 = 900 re-renders per keystroke
   
2. **Expensive Visibility Calculations**: `Board.getVisibleSquares()` runs on every tile render
   - O(playerSquares × 8) complexity per calculation  
   - Called once per tile = O(tiles × playerSquares × 8) total
   - Most expensive performance bottleneck

3. **Global State Subscription**: Each `GameTile` subscribes to entire `queuedMoves` array
   - Zustand triggers re-renders for ANY change to the array
   - Filtering happens at render time, not subscription time

## Proposed Solution: Tile-Level Stores

Create individual Zustand stores for each tile coordinate that contain ALL tile-specific state (both game state and UI state). Use `useShallow` to prevent unnecessary re-renders when data is structurally the same but recreated.

### Key Architecture Principles
1. **Fixed tile count**: No need for store lifecycle management - tiles don't unmount during game
2. **Fully derived state**: Backend sends complete game state every 250ms, tile stores reflect that
3. **Single source per tile**: Each tile store contains both core game state AND UI state
4. **Efficient subscriptions**: Only tiles with genuinely changed data re-render

## Complete Tile State Audit

### Current State Requirements
From analyzing `useTileState()`, `useTileQueuedMoves()`, and `GameTile` component:

**Core Game State:**
- `square`: Square object with type, units, playerIndex
- `queuedMoves`: Set<Direction> for this tile

**Selection/Interaction State:**  
- `isSelected`: Boolean - currently selected tile
- `isSelectable`: Boolean - can be selected
- `isNeighborOfSelected`: Boolean - adjacent to selected tile

**Visibility/Display State:**
- `isVisible`: Boolean - fog of war visibility
- `isGeneral`: Boolean - contains a general
- `neighborVisibility`: Object with top/bottom/left/right boolean flags
- `borders`: Object with top/left boolean flags for rendering

**Derived Display State:**
- `isValidMove`: Boolean - valid move target (computed from other state)
- `playerColor`: String - background color based on player index

### Current Global Dependencies
These are the expensive global subscriptions that cause performance issues:

**Direct Store Subscriptions:**
- `gameplayStore.boardState` - entire board grid
- `gameplayStore.selectedTile` - currently selected coordinate  
- `gameplayStore.queuedMovesByCoord` - all queued moves by coordinate
- `gameMetadataStore.game` - complete game metadata
- `gameMetadataStore.currentPlayerIndex` - current player

**Expensive Computed Values:**
- `visibleSquares` - from `Board.getVisibleSquares()` - **MAJOR BOTTLENECK**
  - Currently computed per tile = O(tiles × boardSize)
  - Should be computed once globally and distributed to tiles

## useShallow Compatibility Analysis  

Based on Zustand documentation, `useShallow` performs shallow comparison that:
- ✅ Works with objects containing primitive values (compares top-level properties)
- ✅ Works with arrays/Sets of primitives
- ❌ Fails with nested objects (compares object references, not contents)
- ❌ Fails with arrays of objects

### ✅ Safe for useShallow (no flattening needed):
- `square: {type: SquareType, units: number, playerIndex: number}` - single object with primitives
- `neighborVisibility: {top: boolean, bottom: boolean, left: boolean, right: boolean}` - single object with primitives  
- `borders: {top: boolean, left: boolean}` - single object with primitives
- `queuedMoves: Set<Direction>` - collection of primitives
- All boolean/number/string values

### ❌ Would break useShallow (if we had them):
- Arrays of objects like `[{sourceCoord: Coord, direction: Movement}]` 
- Nested objects like `{player: {info: {name: string}}}`

**Conclusion**: Our current tile state is already compatible with `useShallow`! No flattening required.

## Proposed Tile Store Interface

```typescript
interface TileState {
  // Core game state (from Square)
  square: {
    type: SquareType;
    units: number | null; 
    playerIndex: number | null;
  };
  
  // Queued moves for this tile
  queuedMoves: Set<Direction>;
  
  // Selection state
  isSelected: boolean;
  isSelectable: boolean;
  isNeighborOfSelected: boolean;
  
  // Visibility state  
  isVisible: boolean;
  isGeneral: boolean;
  neighborVisibility: {
    top: boolean;
    bottom: boolean;
    left: boolean; 
    right: boolean;
  };
  borders: {
    top: boolean;
    left: boolean;
  };
  
  // Actions for updating this tile
  update: (newState: Partial<TileState>) => void;
}
```

## Critical Architecture Questions to Resolve

### 1. Coord → TileStore Mapping
**Key unsolved problem**: How do we manage the mapping from coordinates to tile stores?

Options to consider:
- Global registry: `Map<string, TileStore>` owned by a module/context
- Board component owns mapping, passes down via React context  
- Singleton pattern: Each tile store is a named export/module

### 2. Store Creation & Updates
- **Who creates tile stores?** Board component? Global registry? On-demand?
- **When are they created?** At game start? On first tile mount?
- **How does board orchestrator find stores for updates?** Access to same mapping?

### 3. Global State Orchestration
- **How do we update all relevant tile stores** when backend sends new game state?
- **How do we handle expensive computations** like `visibleSquares` efficiently?
- **Where does cross-tile logic live?** (selections, move validation, etc.)

## Performance Impact Prediction

**Current (20x20 map):**
- 400 tile renders per move
- 400 expensive `Board.getVisibleSquares()` calls per move  
- O(queue_size × tiles) WebSocket processing overhead

**After Refactor:**
- 1-4 tile renders per move (100-400x reduction)
- 1 global `visibleSquares` computation per move (400x reduction)
- O(queue_size + unique_coordinates) WebSocket processing

**Expected Result**: 100:1 to 400:1 performance improvement on larger maps.

## Next Implementation Steps

1. **Design coord → tileStore mapping architecture** (critical decision)
2. **Implement tile store creation and management system**  
3. **Create board-level orchestration for distributing state updates**
4. **Migrate GameTile component to use tile stores with useShallow**
5. **Test and verify performance improvements**
6. **Handle global computations efficiently** (visibleSquares, etc.)

## Risk Assessment

**Low Risk:**
- useShallow compatibility ✅
- Fixed tile count (no lifecycle issues) ✅  
- Well-defined state requirements ✅

**Medium Risk:**
- Store mapping architecture (needs careful design)
- State synchronization across many stores
- Global computation distribution

**High Risk:**
- Performance may not improve if mapping/updates are inefficient
- Complex debugging with many distributed stores
- Migration complexity if current code has hidden dependencies

The approach is fundamentally sound, but success depends heavily on the coord → tileStore mapping design.