# Board Store

Framework-agnostic state management for the game board. Replaces the previous Zustand-based approach that had issues with `Object.is` brittleness, cross-store subscription chains, and bulk `set()` calls across 400+ per-tile stores.

Core idea: a generic store primitive handles the mutation lifecycle, while a centralized pipeline diffs every tile after each action and notifies only the tiles that changed.

## Architecture

```
┌───────────────────────────────────────────────────-──┐
│  React hooks (useTileData, useBoardState)            │  hooks.ts
│  └─ useSyncExternalStore bridges                     │
├───────────────────────────────────────────────────-──┤
│  BoardStore factory (createBoardStore)               │  board-store.ts
│  └─ tile cache, per-tile subscriptions, runPipeline  │
├───────────────────────────────────────────────────-──┤
│  Domain logic                                        │
│  ├─ actions.ts       pure state mutations            │
│  ├─ derived.ts       visibility, queuedMovesMap      │
│  ├─ tile-derived-state.ts   computeTileData          │
│  └─ tile-data.ts     tilesEqual, toTileRendererProps │
├─────────────────────────────────────────────────────-┤
│  Generic store (createStore)                         │  lib/create-store.ts
│  └─ mutate → derive → onChange → version++ → notify  │
└─────────────────────────────────────────────────────-┘
```

## Data Flow

```
action(args)
  → mutates BoardSessionInputState in place
  → derive(state) computes DerivedState (visibility, queuedMovesMap)
  → onChange(mergedState) runs the centralized pipeline:
      for each tile coord:
        computeTileData → diff against cache → if changed: update cache, notify tile subscribers
  → version++ → notify board-level subscribers
```

## Files

| File | Purpose |
|------|---------|
| `lib/create-store.ts` | Generic store primitive (~87 lines, zero domain knowledge) |
| `types.ts` | All type definitions (state buckets, TileData, QueuedDirs) |
| `actions.ts` | Pure functions that mutate `BoardSessionInputState` in place |
| `derived.ts` | Computes visibility (fog of war) and queued moves map |
| `tile-derived-state.ts` | `computeTileData` — assembles all 16 fields for one tile |
| `tile-data.ts` | `tilesEqual` (field-by-field diff), `toTileRendererProps` (adapter) |
| `board-store.ts` | `createBoardStore` factory — tile cache, subs, runPipeline |
| `index.ts` | Module singleton, wrapped actions, re-exports |
| `hooks.ts` | `useTileData`, `useBoardState` — React integration |
| `board-tile.tsx` | `BoardTile` component — wires useTileData to TileRenderer |

## Public API

Exported from `index.ts`:

**Store instance:**
- `boardStore` — the singleton (has `.state`, `.derived`, `.version`, `.subscribeTile()`, `.getTileData()`, `.reset()`)

**Wrapped actions** (each triggers the full lifecycle automatically):
- `initBoard(players, currentPlayerIndex, board?)` — set up players and initial board
- `applyTick(tick, board, queuedMoves, playerStats, winner?)` — apply server tick
- `setStatus(status)` — set `'active'` or `'ended'`
- `setSelectedTile(coord | null)` — UI selection
- `undoLastQueuedMove()` — remove last queued move
- `queueMoveOnBoard(source, direction)` — validate and queue a move, advance selection
- `cancelQueuedMoves()` — clear queue with snap-back logic

**React hooks** (from `hooks.ts`):
- `useTileData(store, coord)` — per-tile reactivity, only re-renders when that tile changes
- `useBoardState(store)` — board-level reactivity, re-renders on any action

**Component** (from `board-tile.tsx`):
- `BoardTile({ store, coord, onClick })` — wires `useTileData` to `TileRenderer`

## Types

| Type | What it holds |
|------|---------------|
| `BoardSourceState` | Server data: board, tick, status, players, currentPlayerIndex, queuedMoves, playerStats, winner |
| `UIState` | User interaction: selectedTile, hasUserSelectedSinceLastQueue |
| `BoardSessionInputState` | `{ game: BoardSourceState, ui: UIState }` — the mutable input state |
| `DerivedState` | Computed: visibleSquares, allVisible, queuedMovesMap |
| `BoardSessionState` | `BoardSessionInputState & DerivedState` — merged, passed to onChange |
| `TileData` | Flat 16-field struct with everything needed to render one tile |
| `QueuedDirs` | `{ up, down, left, right }` — boolean flags per direction |

## Status

Initial integration complete. Gameplay, sandbox, and puzzle domains use `queueMoveOnBoard` and `cancelQueuedMoves` from board-store.
