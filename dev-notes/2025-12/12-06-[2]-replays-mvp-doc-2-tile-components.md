# Replay Tile Rendering - Component Extraction

**Date:** 2025-12-06
**Context:** Replay viewer MVP - deciding how to render tiles without gameplay interactions

## Decision: Extract TileRenderer Base Component

We'll refactor the current `GameTile` component to separate pure rendering from gameplay state management.

### Architecture

```
TileRenderer (new)
  ├─ Pure rendering logic
  ├─ Visual state passed as props
  └─ No hooks, no state management

GameTile (refactored)
  ├─ All gameplay hooks (selection, queued moves, visibility)
  ├─ Wraps TileRenderer
  └─ Passes computed state as props

ReplayTile (new)
  ├─ Minimal logic (just coord -> square lookup)
  ├─ Wraps TileRenderer
  └─ No interactions, no selection, no queued moves
```

## Rationale

**Why not reuse GameTile directly?**
- Heavy gameplay dependencies (tile orchestrator, queued moves, selection hooks)
- Would need lots of conditionals (`if (!isReplayMode) ...`)
- Harder to reason about replay behavior

**Why not duplicate code with separate ReplayTile?**
- Risk of visual inconsistencies
- Need to maintain styling in two places
- Loses fog-of-war rendering (might want for POV mode later)

**Why extraction works:**
- Clean separation of concerns: rendering vs state
- ReplayTile is trivial to implement
- Easy to extend for future modes (spectator, tournament view, etc.)
- Preserves all visual features (fog-of-war for POV mode)

## Component Interfaces

### TileRenderer (Pure Rendering)

```tsx
interface TileRendererProps {
  coord: Coord;
  square: Square;

  // Visual state
  isVisible: boolean;
  hasTopBorder: boolean;
  hasLeftBorder: boolean;

  // Optional interaction state (for GameTile)
  isSelected?: boolean;
  isSelectable?: boolean;
  isValidMove?: boolean;
  queuedDirections?: Set<Direction>;
  onClick?: () => void;
}

function TileRenderer(props: TileRendererProps) {
  // All rendering logic from current GameTile
  // - Mountain/general/army icons
  // - Fog of war overlay
  // - Border styling
  // - Player colors
  // - Move arrows (if queuedDirections provided)
  // - Valid move overlay (if isValidMove)
}
```

### GameTile (Refactored)

```tsx
function GameTile({ coord }: { coord: Coord }) {
  // All gameplay hooks (unchanged from current implementation)
  const square = useTileSquare(coord);
  const isSelected = useGameplayStoreV2(useIsTileSelected(coord));
  const isVisible = useGameplayStoreV2(useIsVisible(coord));
  const queuedDirections = useTileQueuedDirections(coord);
  const isGameEnded = useGameplayStoreV2(useIsGameEnded);
  const neighborVisibility = useGameplayStoreV2(useNeighborVisibility(coord));
  // ... etc

  // Compute derived state
  const isSelectable = !isGameEnded && !(isMountain || isSelected);
  const hasTopBorder = isVisible || neighborVisibility.top;
  const hasLeftBorder = isVisible || neighborVisibility.left;

  return (
    <TileRenderer
      coord={coord}
      square={square}
      isVisible={isVisible}
      hasTopBorder={hasTopBorder}
      hasLeftBorder={hasLeftBorder}
      isSelected={isSelected}
      isSelectable={isSelectable}
      isValidMove={isValidMove}
      queuedDirections={queuedDirections}
      onClick={isSelectable ? selectTileV2 : undefined}
    />
  );
}
```

### ReplayTile (New)

```tsx
interface ReplayTileProps {
  coord: Coord;
  square: Square;
  isVisible?: boolean;  // For POV mode support
}

function ReplayTile({ coord, square, isVisible = true }: ReplayTileProps) {
  // Simple border logic (show borders when visible)
  const hasTopBorder = isVisible;
  const hasLeftBorder = isVisible;

  return (
    <TileRenderer
      coord={coord}
      square={square}
      isVisible={isVisible}
      hasTopBorder={hasTopBorder}
      hasLeftBorder={hasLeftBorder}
      // All interaction props omitted (defaults to no interaction)
    />
  );
}
```

## Migration Path

1. **Create `TileRenderer` component**
   - Extract all rendering logic from current `GameTile`
   - Accept all visual state as props
   - No hooks, no state subscriptions

2. **Refactor `GameTile`**
   - Keep all hooks and state logic
   - Render `TileRenderer` instead of direct JSX
   - Pass computed state as props

3. **Create `ReplayTile`**
   - Simple wrapper around `TileRenderer`
   - Minimal props and logic

4. **Test**
   - Verify gameplay still works (GameTile unchanged behavior)
   - Create simple replay test page

## Future Extensions

This pattern enables:
- **Replay POV mode**: Pass visibility calculations to ReplayTile
- **Spectator mode**: Similar to ReplayTile but with live game state
- **Tournament view**: Show multiple games side-by-side
- **Minimap**: Tiny tiles with simplified rendering

## Files Affected

```
apps/frontend/src/domains/gameplay/ui/
  ├── tile-renderer.tsx          (new - pure rendering)
  ├── game-tile.tsx              (refactored - wraps TileRenderer)
  └── ...

apps/frontend/src/domains/replay/ui/
  └── replay-tile.tsx            (new - simple wrapper)
```

## Benefits

- ✅ Clean separation: rendering vs state management
- ✅ ReplayTile is < 20 lines of code
- ✅ Exact visual parity between gameplay and replay
- ✅ Easy to extend for future display modes
- ✅ Preserves fog-of-war for POV mode
- ✅ No conditionals or mode flags
