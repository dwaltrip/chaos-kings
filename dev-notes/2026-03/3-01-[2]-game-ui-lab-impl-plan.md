# Game UI Lab — Implementation Plan

## Overview

Two deliverables:
1. **Generator script** — produces a JSON file of game state snapshots
2. **Frontend page** at `/game-ui-lab` — renders snapshots with variant switching

---

## Part 1: Generator Script

**Location:** `tools/generate-ui-lab-data.ts`

Run with ts-node / tsx. Outputs JSON to `apps/frontend/src/domains/game-ui-lab/data/lab-snapshots.json`.

### Steps:
1. Call `generateGameMapV2()` with 1 player, a fixed seed (deterministic)
2. Wrap in `GameState` via `createGameState(board, 1)`
3. Loop ~40-60 ticks, calling `processStep()` each tick
4. For moves: write a simple "expand outward" heuristic — pick a player square on the border of owned territory, move toward an adjacent non-mountain unowned tile. Not random — should feel like natural expansion from the general.
5. At each tick, snapshot `{ tick, boardState (deep clone), queuedMoves }`
6. For queued moves: on some ticks, include 1-3 pre-planned moves in the snapshot (the moves that are "about to happen" in the next few ticks). This simulates what a player would see with moves in their queue.
7. Write the full `LabData` object to JSON

### Key imports from `@core`:
- `generateGameMapV2` from `@core/terrain-generation`
- `createGameState`, `processStep` from `@core/step-processor`
- `Board.getVisibleSquares` from `@core/board`
- `DEFAULT_TIMING` from `@core/game-timing-config`
- Types: `GameState`, `BoardState`, `Movement`, `MoveEvent`, `Coord`, `Direction`

### Output shape:
```ts
type LabSnapshot = {
  tick: number;
  boardState: BoardState;
  queuedMoves: Movement[];
};

type LabData = {
  snapshots: LabSnapshot[];
  playerIndex: number;
  config: { size: Size2d; numPlayers: number };
};
```

---

## Part 2: Frontend Page

### New domain: `apps/frontend/src/domains/game-ui-lab/`

```
game-ui-lab/
  data/
    lab-snapshots.json        # generated output
  pages/
    game-ui-lab-page.tsx      # route entry point
  ui/
    lab-board.tsx              # board component (wraps grid + useGridLayout)
    lab-tile.tsx               # tile component (computes props from snapshot, renders TileRenderer)
  variants.ts                 # variant definitions
  variants/
    default.css               # (empty or baseline — current look)
    example-v1.css             # first experimental variant
```

### Route

Add to `App.tsx`:
```tsx
<Route path="game-ui-lab" element={<GameUiLabPage />} />
```

### Page: `game-ui-lab-page.tsx`

State:
- `currentTick: number` (index into snapshots array)
- `selectedVariant: string` (variant name)

Renders:
- Variant selector dropdown (top)
- `LabBoard` (center)
- Tick indicator, e.g. "Tick 12 / 45" (bottom or top)

Keyboard bindings:
- Left arrow / `A` → decrement tick
- Right arrow / `D` → increment tick

### Board: `lab-board.tsx`

Similar to `SandboxBoard` but simpler:
- Takes `boardState`, `playerIndex`, `queuedMoves`, `variantClassName`
- Uses `useGridLayout` for responsive sizing
- Pre-computes `visibleSquares` set via `Board.getVisibleSquares(boardState, playerIndex)`
- Pre-computes `queuedDirectionsByCoord` map from `queuedMoves` array
- Wraps grid in a div with the variant class: `<div className={clsx('game-grid-container', variantClassName)}>`
- Renders `LabTile` for each coord, passing all needed data as props

### Tile: `lab-tile.tsx`

Pure presentational — no store subscriptions at all. Receives everything as props:
- `coord`, `square`, `isVisible`, `neighborVisibility`, `queuedDirections`
- Computes `hasTopBorder`, `hasLeftBorder` from visibility
- Passes through to `TileRenderer`
- No `isSelected`, `isSelectable`, `onClick` — this is view-only

### Variant system: `variants.ts`

```ts
type Variant = {
  name: string;
  cssClass: string;
};

const VARIANTS: Variant[] = [
  { name: 'Default', cssClass: '' },
  { name: 'Example V1', cssClass: 'variant-example-v1' },
];
```

Variant CSS files use descendant selectors:
```css
/* variants/example-v1.css */
.variant-example-v1 .cell { ... }
.variant-example-v1 .game-grid { ... }
.variant-example-v1 .fog-of-war { ... }
```

### Changes to existing components

**`TileRenderer`** — add optional `className?: string` prop, apply with `clsx` to the outer `.game-tile` div. (Not needed immediately if we go container-class-only approach, but low cost to add for future flexibility.)

---

## Implementation Order

1. Generator script — get the data
2. `LabTile` + `LabBoard` — render a single snapshot
3. `GameUiLabPage` — tick stepping + variant selector + route
4. One example variant CSS to prove the system works
5. Verify build passes

---

## Verification

- Run generator: `npx tsx tools/generate-ui-lab-data.ts`
- Start dev server: `./tools/dev-all.sh`
- Navigate to `localhost:5173/game-ui-lab`
- Step through ticks with arrow keys / A/D
- Switch variants in dropdown
- `./tools/build-all.sh` passes
