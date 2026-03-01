# Game UI Lab — Design Spec

## Purpose

A frontend-only page (`/game-ui-lab`) for iterating on the game board's visual design and UX. Renders pre-generated game states that can be stepped through one tick at a time, showing everything a player sees during real gameplay — including fog of war and queued move arrows.

The goal is to quickly try different visual variants (via CSS classes) and see how they look and feel on realistic game states.

## Two Parts

### 1. Game State Generator (script)

A standalone script (run manually, not part of the app) that:

- Uses `@core` to generate a random board with 1 player
- Simulates a sequence of moves via `processStep`
- At each tick, captures a snapshot: `{ boardState, queuedMoves, tick }`
- Outputs a JSON file that the frontend page imports

The moves should feel somewhat natural (expanding outward from the general, capturing nearby territory). Not fully random — we want realistic-looking game progression.

Queued moves are included in some snapshots so we can see how the move arrows render on the board.

If the scripted data doesn't feel natural enough, we can later add a "record" feature to capture real gameplay (including queued moves) as an alternative data source.

### 2. Frontend Page (`/game-ui-lab`)

Loads the pre-generated snapshots and renders them using the standard game board components.

**What's shown:**
- Game board with `TileRenderer` (or variant)
- Fog of war computed from player 0's perspective
- Queued move arrows on relevant tiles
- Variant selector (dropdown)

**Controls:**
- Left arrow / `A` — step backward one tick
- Right arrow / `D` — step forward one tick
- Dropdown select — swap between UI variants

**Not included (intentionally):**
- No game clock or auto-play
- No player interaction / move input
- No server connection

## Variant System

A variant controls the visual styling of the board and tiles via CSS classes.

```ts
type Variant = {
  name: string;
  cssClasses: {
    board?: string;
    tile?: string;
  };
};
```

**How it works:**
- `GameBoard` and `TileRenderer` each accept an optional `className` prop
- The selected variant's CSS classes are passed down through these props
- Variant-specific styles live in dedicated CSS files

**Starting point:** One "default" variant (current look) plus one or two experimental variants to prove out the system.

**Future extensions:**
- Component-level swaps (custom `TileRenderer` or `GameBoard` per variant)
- Side-by-side comparison mode (two boards, same state, different variants)
- 2-player scenarios (fog of war with enemy territory, combat)

## Snapshot Data Shape

```ts
type LabSnapshot = {
  tick: number;
  boardState: BoardState;
  queuedMoves: Movement[];
};

type LabData = {
  snapshots: LabSnapshot[];
  playerIndex: number; // whose perspective we're viewing (0)
  config: {
    size: Size2d;
    numPlayers: number;
  };
};
```
