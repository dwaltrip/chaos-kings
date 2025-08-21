# Grid Abstraction Refactor

## Problem
Generic `Grid` + `GridTile` components created a leaky abstraction making custom tile borders difficult to implement. The render prop pattern prevents direct communication between deeply nested `TileContent` (which has tile state) and `GridTile` (which needs to set CSS custom properties for borders).

## Root Cause
- State needed for borders exists in `TileContent` (isSelected, isNeighborOfSelected)
- Border styling must be applied at `GridTile` level via CSS variables
- Render prop architecture creates 2-level separation: GameBoard → Tile → TileContent
- React hooks cannot be used in non-component functions (attempted object return from children)

## Analysis
**Valuable Generic Parts:**
- `useAutoTileSize` hook with resize observer
- `calcTileSize` utility function  
- CSS grid layout styling

**Problematic Parts:**
- Generic `Grid` component with render props
- `GridTile` wrapper component
- Forced separation of concerns that need to be coupled

## Solution Options

### Option 1: Extract Grid Sizing Hook Only ⭐
Remove all generic components, keep only sizing logic:
```tsx
// useGridLayout.ts - extracted sizing logic
// GameTile.tsx - direct tile component with state access
// GameBoard.tsx - simplified direct rendering
```

### Option 2: Generic GridContainer + Direct Rendering
Minimal container component with direct tile rendering:
```tsx
<GridContainer rows={rows} cols={cols}>
  {tiles.map(tile => <GameTile key={...} coord={...} />)}
</GridContainer>
```

### Option 3: Ref-Based DOM Manipulation
Keep structure but add escape hatch via useRef + direct DOM manipulation

### Option 4: Custom Hook for Border Management
Extract border logic to reusable `useTileBorders` hook

## Recommendation
**Option 1** - Complete removal of generic abstraction. Cleanest solution that eliminates architectural mismatch while preserving valuable resize observer logic.

## Implementation Impact
- Delete: `Grid.tsx`, `GridTile.tsx`, render prop complexity
- Keep: Resize observer, grid sizing calculations, CSS styling
- Gain: Direct state access, simpler mental model, easier custom styling