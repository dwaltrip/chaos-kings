# Game State Refactor Notes — Away from Zustand

## Why: The Problem

Tried to play a test game via the gameplay page → hit "Maximum call stack size exceeded". Root cause is likely the cross-store subscription pattern and/or selectors returning new objects every render. Zustand's equality model (`Object.is`) is too brittle for real-time game state that updates every tick.

## Current Architecture (What Exists Today)

### Two Overlapping Zustand Stores

1. **`gameplayPageStore`** (`gameplay-page-store.ts`)
   - Built on `createAsyncStore` — handles loading/error/success for fetching the game
   - Holds: `data` (the `GameWithPlayers`), `countdownActive`, `countdownSeconds`
   - Has methods on state: `isGameEnded()`, `isLoading()`, `isReady()`

2. **`useGameplayStoreV2`** (`gameplay-store-v2.ts`)
   - The main game state store
   - Holds: `game`, `tick`, `winner`, `boardState`, `selectedTile`, `visibleSquares` (Set), `queuedMoves`, `playerStats`, `players`, `playersByIndex` (Map), `playersByUserId` (Map), `currentPlayerIndex`, `currentPlayer`
   - Has `isGameEnded()` method on state that calls `get()` internally
   - **Cross-store subscription**: subscribes to `gameplayPageStore` at store creation time to sync `game` (line 75)

3. **Per-tile Zustand stores** (`tile-store-registry.ts`)
   - Each board coordinate gets its own Zustand store (created lazily via `getTileStore(coord)`)
   - Holds: `square` (tile data) and `queuedDirections` (Set)
   - Updated in bulk by `tileOrchestrator` which iterates all coords and calls `set()` on each tile store

### Data Flow

```
WebSocket tick message
  → handlers.ts routes to action
  → updateGameplayState() in actions/update-gameplay-state.ts
    → sets tick, board, visibleSquares, playerStats on useGameplayStoreV2
    → tileOrchestrator.updateTileSquares(board) → iterates ALL coords, calls set() on each tile store
    → tileOrchestrator.clearAllQueuedDirections() + re-applies queued moves
```

### Game Setup Flow

```
GameplayPage mounts
  → useEffect calls loadGameplayPage(gameId)
    → resets all state
    → fetches game from API via createAsyncStore.load()
    → setupGameState(game):
      → setGame(game) on gameplayPageStore → triggers syncGame subscription → sets game on useGameplayStoreV2
      → setPlayerData(players, currentUserId) on useGameplayStoreV2
      → setGameplayReady(true)
      → if game has board state, calls updateGameplayState(tick, board)
```

### Component Subscriptions (GameTile — one per board cell)

Each `GameTile` subscribes to:
- `useGameplayStoreV2`: isGameEnded, isSelected, isAdjacentToSelected, isVisible, neighborVisibility
- Per-tile store: square data, queuedDirections
- Uses `React.memo` with custom comparator (only checks coord equality)

### Specific Brittleness Found

1. **Cross-store sync subscription** (`gameplayPageStore.subscribe(syncGame)`) — synchronous `set()` inside a subscriber. Could cause recursive notification if any downstream code path circles back.

2. **Selectors returning new objects** — `useNeighborVisibility` always returns `{ top, left }` as a new object. With `Object.is` comparison, this means every store notification triggers re-renders for every tile.

3. **Methods on state calling `get()`** — `isGameEnded()` is defined on the state object and calls the store's `get()`. This is used inside visibility selectors, so every tile's visibility check goes through `get()`.

4. **Module-level action extraction** — `game-tile.tsx:26` extracts `setSelectedTileV2` at module level via `getState().actions`. Can go stale if store is reset. (The `gameplayActions()` helper was created as a workaround.)

5. **Bulk synchronous updates** — `tileOrchestrator.updateTileSquares()` calls `set()` on potentially hundreds of individual tile stores in a loop, each triggering synchronous subscriber notifications.

6. **`useShallow` with Sets** — `useTileQueuedDirections` uses `useShallow` on a `Set<Direction>`, which requires Zustand's shallow comparator to handle Sets correctly.

## Key Files

- `apps/frontend/src/domains/gameplay/stores/gameplay-store-v2.ts` — main game state store
- `apps/frontend/src/domains/gameplay/stores/gameplay-page-store.ts` — async loading store
- `apps/frontend/src/domains/games/stores/tile-store-registry.ts` — per-tile stores
- `apps/frontend/src/domains/games/stores/tile-orchestrator.ts` — bulk tile updates
- `apps/frontend/src/domains/games/hooks/use-tile-store-state.ts` — tile store hooks
- `apps/frontend/src/domains/gameplay/ui/game-tile.tsx` — tile component (heavy subscriber)
- `apps/frontend/src/domains/gameplay/ui/game-ui.tsx` — board + keyboard controls
- `apps/frontend/src/domains/gameplay/ui/game-board.tsx` — renders grid of GameTiles
- `apps/frontend/src/domains/gameplay/actions/update-gameplay-state.ts` — tick update logic
- `apps/frontend/src/domains/gameplay/actions/setup-game-state.ts` — initial game setup
- `apps/frontend/src/domains/gameplay/actions/load-gameplay-page.ts` — page load orchestration
- `apps/frontend/src/pages/gameplay/gameplay-page.tsx` — page component

## State Shape Summary

The real-time game state that needs to be managed:
- **Game metadata**: game object, players, currentPlayerIndex, currentPlayer
- **Tick state**: tick number, boardState, visibleSquares, queuedMoves, playerStats, winner
- **UI state**: selectedTile
- **Per-tile derived state**: square data, queued directions
- **Page-level state**: loading/error/countdown

## What the Refactor Needs to Solve

- Eliminate `Object.is` brittleness for objects, Sets, Maps
- Eliminate cross-store subscription complexity
- Handle bulk per-tick updates efficiently (board + visibility + queues + stats all at once)
- Keep per-tile granular re-renders (don't re-render all 400 tiles when one tile changes)
- Simple, predictable update flow — no synchronous subscriber chains
