# Game UI Lab — Implementation Summary

## What It Is

A frontend-only page at `/game-ui-lab` for iterating on game board visual design. Renders pre-generated game states that can be stepped through frame-by-frame, showing everything a player sees during real gameplay: fog of war, selected tile, queued move arrows, valid move targets.

## How It Works

### Two-part system

1. **Generator script** (`tools/generate-ui-lab-data.ts`) — run manually, outputs two JSON files
2. **Frontend page** (`domains/game-ui-lab/`) — loads JSON, renders board with variant switching

### Generator

Run: `npx tsx --tsconfig packages/core/tsconfig.json tools/generate-ui-lab-data.ts` (from project root)

Uses `@core` to generate a 1-player 18x18 board and simulate ~80 ticks of gameplay. The "AI" waits for troops to accumulate on the general, then plans a directional chain of moves (3-7 moves) that pushes outward in a sustained direction.

**Key detail:** The generator emits two types of frames:
- **Tick frames** — board state changes after a move executes
- **Queuing frames** — board state stays the same, but `selectedTile` and `queuedMoves` progressively build up, simulating the player queuing moves between ticks

This means stepping through frames shows both the "planning" phase (queue building up) and "execution" phase (moves firing).

### Output files (in `domains/game-ui-lab/data/`)

- `lab-board-states.json` (~3MB) — board states keyed by tick number. Only changes on actual ticks.
- `lab-frames.json` (~57KB) — array of UI frames, each referencing a tick for its board state. Contains `selectedTile`, `queuedMoves`. Multiple frames can share the same tick (queuing frames).

Split into two files so queuing frames don't duplicate the large board state.

### Frontend components

```
domains/game-ui-lab/
  data/                          # generated JSON (gitignored board states)
  pages/
    game-ui-lab-page.tsx         # route entry, frame stepping, variant selector
    game-ui-lab-page.css
  ui/
    lab-board.tsx                 # computes visibility, queued directions, selection
    lab-tile.tsx                  # pure wrapper around TileRenderer
  variants.ts                    # variant type + definitions
  variants/
    variant-dark.css              # example variant
```

**Key difference from gameplay/sandbox:** No Zustand stores. Everything is computed from the static snapshot data and passed as props to `TileRenderer`. This makes it fully isolated from the rest of the app.

### Variant system

```ts
type Variant = { name: string; cssClass: string };
```

A variant CSS class is applied to the board container div. Variant styles use descendant selectors (`.variant-dark .cell { ... }`). Currently: Default (no class) and Dark.

Designed to extend to component-level swaps later if CSS isn't enough.

### Controls

- **Left arrow / A** — step back one frame
- **Right arrow / D** — step forward one frame
- **Variant dropdown** — switch visual variant

### What's rendered per frame

- Board grid via `TileRenderer` (reuses gameplay CSS)
- Fog of war (computed via `Board.getVisibleSquares` from player 0's perspective)
- Selected tile (white border)
- Valid move targets (dark overlay on adjacent non-mountain tiles)
- Queued move arrows (directional arrows on tiles with pending moves)
- Header: tick number, frame count, "selecting" / "N queued" indicators
