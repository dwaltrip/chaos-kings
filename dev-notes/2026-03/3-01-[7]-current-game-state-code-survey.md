# Current Game State Code Survey

Complete survey of all frontend game-state-related code, organized by area. March 2026.

---

## Core Finding

There are **three parallel board-state systems** (gameplay, puzzles, sandbox) that share a per-tile registry but use different top-level Zustand stores. A newer unified `BoardSessionStore` exists but is only adopted by sandbox.

---

## 1. Gameplay Stores

### `gameplay-page-store.ts`
**Path:** `domains/gameplay/stores/gameplay-page-store.ts`

Manages `GameWithPlayers` entity (loaded from REST via `createAsyncStore`), plus pre-game countdown UI state.

```ts
{
  status: 'idle' | 'loading' | 'success' | 'error',
  data: GameWithPlayers | null,
  countdownActive: boolean,
  countdownSeconds: number,
  isGameEnded: () => boolean,
  actions: { setGame, updateGame, setCountdownActive, setCountdownSeconds, resetAll }
}
```

**Cross-store dep:** `gameplay-store-v2` subscribes to this store at module load to sync `game`.

### `gameplay-store-v2.ts`
**Path:** `domains/gameplay/stores/gameplay-store-v2.ts`

All live gameplay session state — the biggest and most complex store.

```ts
{
  game: GameWithPlayers | null,       // mirrored from gameplay-page-store
  tick: number,
  winner: PlayerIndex | null,
  gameplayReady: boolean,
  boardState: BoardState | null,
  selectedTile: Coord | null,
  visibleSquares: Set<string>,
  queuedMoves: Movement[],
  playerStats: CorePlayerState[],
  players: Player[],
  playersByIndex: Map<PlayerIndex, Player>,
  playersByUserId: Map<UserId, Player>,
  currentPlayerIndex: PlayerIndex | null,
  currentPlayer: Player | null,
  isGameEnded: () => boolean,         // derived method on state object
  actions: { setTick, setGameplayReady, setSelectedTileV2, clearSelectedTile,
             updateBoard, setVisibleSquares, setQueuedMoves, setPlayerStats,
             addQueuedMove, setWinner, setPlayerData }
}
```

**Problems:**
- `updateBoard` action calls `tileOrchestrator.updateTileSquares()` as side effect
- `isGameEnded()` method on state calls `get()` internally
- Cross-store subscription to `gameplayPageStore`
- Parameterized selectors create new function references per tile per render

---

## 2. Tile System

### `tile-store-registry.ts` — `domains/games/stores/`
Global `Map<string, ZustandStore>` keyed by serialized coord. Each per-tile store:
```ts
{ square: Square, queuedDirections: Set<Direction>, updateSquare(), updateQueuedDirections(), addQueuedDirection() }
```
Lazy creation via `getTileStore(coord)`. This is the key performance architecture — tile re-renders are isolated.

### `tile-orchestrator.ts` — `domains/games/stores/`
Class that fans out board-level updates to all per-tile stores. Called by gameplay, puzzles, AND sandbox (via `apply-state.ts`).

### `use-tile-store-state.ts` — `domains/games/hooks/`
- `useTileSquare(coord)` — subscribes to tile store, returns `Square` with `useShallow`
- `useTileQueuedDirections(coord)` — subscribes to tile store, returns `Set<Direction>`

Used by all three tile components (GameTile, PuzzleTile, SandboxTile).

---

## 3. Gameplay Actions

### `update-gameplay-state.ts` — The main tick handler
1. Guards on `gameplayReady` and `currentPlayerIndex`
2. `setTick`, `updateBoard` (fans out to tile stores)
3. Computes `visibleSquares` via `Board.getVisibleSquares(board, playerIndex)`
4. Clears all tile queued directions, re-applies from new queue
5. `setPlayerStats`

Cross-store writes to both `gameplay-store-v2` and per-tile stores.

### `setup-game-state.ts` — One-time init
Writes to `gameplayPageStore`, reads from `userStore`, writes to `gameplay-store-v2`.

### `queue-move.ts` — Move queuing
Dual-write: `addQueuedMove` on global store + `addQueuedDirection` on per-tile store. Sends WS message.

### `undo-last-queued-move.ts` — Move undo
Reads/writes both global store and per-tile stores.

---

## 4. Game UI Components

### `game-ui.tsx` — Shell + keyboard controls
Subscribes to `gameplay-store-v2` for `game`, `board`, `selectedTile`. Sets up arrow/Z/X keyboard handlers.

### `game-board.tsx` — Grid renderer
**No store subscriptions.** Receives `boardState` as prop, renders `GameTile` per coord.

### `game-tile.tsx` — Per-tile component (7 subscriptions!)
1. `useTileSquare(coord)` — per-tile store
2. `useTileQueuedDirections(coord)` — per-tile store
3. `useIsGameEnded` — gameplay store
4. `useIsTileSelected(coord)` — gameplay store
5. `useIsAdjacentToSelected(coord)` — gameplay store
6. `useIsVisible(coord)` — gameplay store
7. `useNeighborVisibility(coord)` — gameplay store

Each tile has 5 subscriptions to `gameplay-store-v2`. All selectors re-evaluate on every store change.

### `tile-renderer.tsx` — Pure presentational
**No stores.** All state as props. `React.memo`. Shared by all tile components.

---

## 5. Board Session Store

### `board-session-store.ts` — `domains/games/stores/`

```ts
{
  board: BoardState | null,
  tick: number,
  selectedTile: Coord | null,
  visibleSquares: Set<string>,
  queuedMoves: Movement[],
  lastExecutedMove: Movement | null,
  isEnded: boolean,
  actions: { setBoard, setTick, setSelectedTile, clearSelectedTile,
             setVisibleSquares, setQueuedMoves, addQueuedMove,
             setLastExecutedMove, setIsEnded, reset }
}
```

Plus `moveHistoryCache: Map<number, Movement | null>` — lives outside Zustand (doesn't drive renders).

**Currently consumed by:** sandbox only. TODO in `sandbox-tile.tsx`: migrate GameTile/PuzzleTile.

### `board-session/actions/apply-state.ts`
Shared action that writes to `boardSessionStore` + tile registry. TODO notes it should be the common entry point for all domains.

---

## 6. Game UI Lab — Zero-Store Proof of Concept

**No Zustand at all.** Pure React local state + props.
- `game-ui-lab-page.tsx` — `useState` for variant/frame index, passes everything as props
- `lab-board.tsx` — computes visibility + queued directions inline from props
- `lab-tile.tsx` — pure props, wraps `TileRenderer`

**Proves:** Board rendering works entirely without Zustand.

---

## 7. Puzzles Domain

### `puzzle-store.ts` — Self-contained
```ts
{
  status: 'idle' | 'playing' | 'ended',
  board: BoardState | null,
  tick: number,
  moveQueue: Movement[],        // note: "moveQueue" not "queuedMoves"
  visibleSquares: Set<string>,
  result: BestStartResult | null,
  userStats: UserPuzzleStats | null,
  selectedTile: Coord | null,
  actions: { ... }
}
```

**No cross-store deps.** Cleanest store in the system.

### `puzzle-tile.tsx` — Same pattern as GameTile
5 subscriptions to `puzzle-store` + 2 to tile registry. Structurally identical to `GameTile`.

---

## 8. Sandbox Domain

### `sandbox-meta-store.ts`
Sandbox-specific metadata: `status`, `isPaused`, `config`, `maxTickReached`.
Uses `boardSessionStore` for all board state. This is the target state for the unified refactor.

---

## Key Cross-Cutting Patterns

### Dual-Write Pattern (global + per-tile)
Every board update and move queue writes to BOTH the main store AND per-tile stores. This is what enables tile-level re-render isolation. Any replacement must preserve this.

### Parameterized Selectors
```ts
const selectIsTileSelected = (coord: Coord) => (state) => isTileSelected(state.selectedTile, coord)
```
Used in all tile components. Creates new function reference per tile per render.

### Module-Level Action Extraction
```ts
const { setSelectedTileV2 } = useGameplayStoreV2.getState().actions
```
Used in `game-tile.tsx` and `puzzle-tile.tsx`. Safe because actions are stable.

### Store Shape Convergence
`boardSessionStore` and `puzzleStore` are very close. `gameplay-store-v2` is a superset (adds player identity, winner, playerStats). Could use one base interface with extensions.

---

## File Summary Table

| File | Zustand? | Cross-store deps |
|------|----------|-----------------|
| `gameplay/stores/gameplay-page-store.ts` | Yes | Subscribed to BY gameplay-store-v2 |
| `gameplay/stores/gameplay-store-v2.ts` | Yes | Subscribes to page store; calls tileOrchestrator |
| `games/stores/board-session-store.ts` | Yes | None |
| `games/stores/tile-store-registry.ts` | Yes (one per tile) | None |
| `games/stores/tile-orchestrator.ts` | No (class) | Reads tile-store-registry |
| `puzzles/stores/puzzle-store.ts` | Yes | None |
| `sandbox/stores/sandbox-meta-store.ts` | Yes | None |
| `gameplay/ui/game-tile.tsx` | 7 subscriptions | gameplay-store-v2 + tile registry |
| `gameplay/ui/tile-renderer.tsx` | None | Pure props |
| `game-ui-lab/ui/lab-board.tsx` | None | Pure props |
