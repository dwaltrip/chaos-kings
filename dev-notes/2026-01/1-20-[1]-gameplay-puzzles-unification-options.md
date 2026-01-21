# Gameplay & Puzzles Code Unification Options

**Date:** 2026-01-20

**Status:** Analysis / Options Document

**Context:** Investigating how to share code between gameplay and puzzles domains to avoid duplicating changes (e.g., keyboard shortcuts) across multiple modes.

---

## Problem Statement

The gameplay and puzzles domains share core mechanics (board rendering, move queuing, keyboard controls) but are currently implemented separately. This creates maintenance burden: changing how keyboard shortcuts work requires updating both domains, and future modes (sandbox, tutorials) would add more copies.

**Goal:** Identify where code can be unified so that core board interaction behavior is defined once and reused across all modes.

---

## Current State Summary

### What's Already Shared
- `TileRenderer` component (renders individual tile visuals)
- `useGridLayout` hook (calculates board dimensions)
- `@core` utilities: `Board.canMove()`, `Board.applyDirection()`, `Board.getVisibleSquares()`
- Tile store infrastructure: `getTileStore()`, `useTileSquare()`, `useTileQueuedDirections()`
- `tileOrchestrator` for batch tile updates
- `useKeyboardControls` hook (puzzles imports from gameplay)
- Tile selection helpers: `isTileSelected()`, `isTileAdjacentToSelected()`, etc.

### What's Duplicated
- **Tile components:** `GameTile` (74 lines) and `PuzzleTile` (69 lines) - ~90% similar
- **Board components:** `GameBoard` (30 lines) and `PuzzleBoard` (31 lines) - ~99% similar
- **Queue actions:** `queueMove` implementations - ~85% similar logic
- **State update handlers:** Similar patterns for updating stores from WS messages
- **Stores:** Separate stores with overlapping fields (board, tick, selectedTile, visibility, queuedMoves)
- **WS effects:** Separate but structurally identical move/undo/clear messages

### Key Differences (Legitimate)
- **Multiplayer vs single-player:** Gameplay tracks multiple players, per-player queues, player stats
- **Lifecycle:** Gameplay has join/leave/countdown; puzzles has start/end with scoring
- **End conditions:** Gameplay ends on general capture; puzzles end on turn limit
- **Visibility rules:** Gameplay spectators see everything; puzzles always player 0

---

## Area 1: Frontend Stores

**This is the most impactful decision.** The store architecture determines whether tiles/boards can be unified or must remain separate.

### Current State

**GameplayStoreV2** contains:
```
board, tick, selectedTile, visibleSquares, queuedMoves  // "board session" state
game, players, playersByIndex, playerStats, winner, ...  // gameplay-specific
```

**PuzzleStore** contains:
```
board, tick, selectedTile, visibleSquares, moveQueue  // "board session" state
status, result                                         // puzzle-specific
```

The "board session" fields are identical in purpose but live in separate stores.

### Option 1A: Single Shared BoardSession Store

Extract common board state into a dedicated store that all modes use:

```ts
// domains/games/stores/board-session-store.ts
const useBoardSessionStore = create({
  board: null,
  tick: 0,
  selectedTile: null,
  visibleSquares: new Set(),
  queuedMoves: [],
  isEnded: false,  // Explicit flag, set by domain logic

  actions: {
    setBoard, setTick, setSelectedTile, setVisibleSquares,
    setQueuedMoves, addQueuedMove, setIsEnded, reset,
  },
});

// Domain stores become smaller, no board state:
// useGameplayStore: { game, players, playerStats, winner, ... }
// usePuzzleStore: { status, result }
```

**Pros:**
- Tile components can be unified (one `Tile` component for all modes)
- Board component can be unified
- Interaction layer (queueMove, undo) becomes trivial - just uses shared store
- Clear mental model: "board session" vs "domain metadata"
- Adding new mode requires only domain-specific store

**Cons:**
- Two stores to coordinate on state updates (domain store + board session)
- Need to reset board session when switching modes
- "isEnded" must be explicitly set by domain logic (minor)

**Impact:** Enables component unification. Recommended if you want maximum sharing.

### Option 1B: Zustand Slices (Compose Shared State into Each Store)

Define shared state as a reusable slice, compose into each domain store:

```ts
const createBoardSessionSlice = (set, get) => ({
  board: null,
  tick: 0,
  selectedTile: null,
  visibleSquares: new Set(),
  queuedMoves: [],
  setBoard: (board) => set({ board }),
  // ... other setters
});

const useGameplayStore = create((...a) => ({
  ...createBoardSessionSlice(...a),
  game: null, players: [], ...  // gameplay-specific
}));

const usePuzzleStore = create((...a) => ({
  ...createBoardSessionSlice(...a),
  status: 'idle', result: null,  // puzzle-specific
}));
```

**Pros:**
- Code reuse without adding a new store
- Each domain has one store (simpler mental model for some)
- No cross-store coordination needed

**Cons:**
- Different store instances → tiles still need different components (or injection pattern)
- Selectors must be duplicated or generified per store type
- Slice pattern adds some indirection

**Impact:** Reduces code duplication but doesn't enable component unification.

### Option 1C: Single Unified Store with Mode

One store holds everything, with a mode discriminator:

```ts
type BoardMode = 'idle' | 'gameplay' | 'puzzle' | 'sandbox';

const useBoardStore = create({
  mode: 'idle',

  // Shared session
  board: null, tick: 0, selectedTile: null, ...

  // Mode-specific (only one populated at a time)
  gameplay: null as { game, players, ... } | null,
  puzzle: null as { status, result } | null,
});
```

**Pros:**
- Single store for everything
- Mode is explicit in state
- One Tile component works for all

**Cons:**
- Larger store with nullable sections
- Must null-check mode-specific state everywhere
- Mixes concerns (board session + all domain data)
- Less clear ownership of domain-specific logic

**Impact:** Enables component unification but at cost of store complexity.

### Option 1D: Keep Separate, Formalize Interface

Keep stores separate but define a shared TypeScript interface:

```ts
interface BoardSessionState {
  board: BoardState | null;
  tick: number;
  selectedTile: Coord | null;
  visibleSquares: Set<string>;
  queuedMoves: Movement[];
}

interface BoardSessionActions {
  setBoard(board: BoardState | null): void;
  setSelectedTile(coord: Coord | null): void;
  addQueuedMove(move: Movement): void;
  setQueuedMoves(moves: Movement[]): void;
}

// Both stores implement the interface (enforced by types)
```

**Pros:**
- Minimal change from current code
- Type safety ensures stores stay aligned
- Each domain fully owns its store
- Easy to diverge if needed

**Cons:**
- Still need separate Tile components (different store hooks)
- Interface alignment is manual discipline
- Interaction layer needs to accept generic store

**Impact:** Enables interaction code sharing but not component unification.

### Recommendation

**Option 1A (shared BoardSession store)** provides the most benefit if the goal is "change once, works everywhere." The two-store coordination cost is low - state update handlers already do multiple operations.

**Option 1D (formalized interface)** is the conservative choice if you want to preserve current structure while improving consistency.

---

## Area 2: Frontend Components

### Board Component

Currently: `GameBoard` and `PuzzleBoard` are nearly identical (~30 lines each), differing only in which Tile component they render.

### Option 2A: Generic Board with TileComponent Prop

```tsx
interface BoardProps {
  boardState: BoardState;
  TileComponent: ComponentType<{ coord: Coord }>;
}

function Board({ boardState, TileComponent }: BoardProps) {
  const { containerRef, gridStyle } = useGridLayout(rows, cols);
  return (
    <div ref={containerRef} className="game-grid-container">
      <div className="game-grid" style={gridStyle}>
        {boardState.grid.flatMap((row) =>
          row.map(({ coord }) => <TileComponent coord={coord} key={...} />)
        )}
      </div>
    </div>
  );
}
```

**Pros:**
- Single Board component
- Works regardless of store architecture
- Trivial change

**Cons:**
- None significant

**Recommendation:** Do this regardless of other decisions.

### Tile Component

Currently: `GameTile` and `PuzzleTile` are ~90% identical but use different store hooks.

### Option 2B: Unified Tile (requires shared store - Option 1A)

If using a shared BoardSession store, tiles become identical:

```tsx
function Tile({ coord }: { coord: Coord }) {
  const square = useTileSquare(coord);
  const queuedDirections = useTileQueuedDirections(coord);

  // All from shared store
  const isSelected = useBoardSessionStore(selectIsTileSelected(coord));
  const isVisible = useBoardSessionStore(selectIsVisible(coord));
  const neighborVisibility = useBoardSessionStore(selectNeighborVisibility(coord));
  const isEnded = useBoardSessionStore(state => state.isEnded);

  // ... compute derived state, render TileRenderer
}
```

**Pros:**
- One Tile component for all modes
- No duplication of selection/visibility logic

**Cons:**
- Requires shared store (Option 1A)

### Option 2C: Keep Separate Tiles (if stores remain separate)

If stores remain separate, keep `GameTile` and `PuzzleTile` as they are. The duplication (~70 lines each) is acceptable given they're binding to different stores.

**Pros:**
- No abstraction overhead
- Clear which store each tile uses

**Cons:**
- Logic duplication
- Changes must be made in multiple places

### Option 2D: Generic Tile Factory (if stores remain separate)

Create a factory that generates tile components:

```tsx
function createTileComponent(
  useStore: UseBoundStore<StoreApi<BoardSessionState>>,
  selectors: TileSelectors,
) {
  return React.memo(({ coord }) => {
    const isSelected = useStore(selectors.isSelected(coord));
    // ...
    return <TileRenderer {...props} />;
  });
}

const GameTile = createTileComponent(useGameplayStore, gameplaySelectors);
const PuzzleTile = createTileComponent(usePuzzleStore, puzzleSelectors);
```

**Pros:**
- Core logic defined once
- Works with separate stores

**Cons:**
- Factory pattern adds indirection
- Selectors must have identical signatures
- Debugging is slightly harder (generated components)

### Layout / Page Structure

Currently: Each page (GameplayPage, PuzzlePage) composes its own layout with domain-specific UI (sidebars, controls, overlays).

### Option 2E: Shared Layout with Slots

```tsx
function BoardLayout({ board, sidebar, header, overlay }: BoardLayoutProps) {
  return (
    <div className="board-layout">
      {header && <header>{header}</header>}
      <aside>{sidebar}</aside>
      <main>
        {board}
        {overlay}
      </main>
    </div>
  );
}
```

**Pros:**
- Consistent layout structure
- Shared CSS positioning

**Cons:**
- May be too rigid if layouts need to diverge significantly
- Another abstraction layer

### Option 2F: Natural Composition (No Formal Layout)

Let pages compose freely using shared Board component:

```tsx
function PuzzlePage() {
  return (
    <div className="puzzle-page">
      <PuzzleSidebar />
      <Board boardState={board} TileComponent={PuzzleTile} />
      {showSolution && <SolutionOverlay />}
    </div>
  );
}
```

**Pros:**
- Maximum flexibility
- No layout abstraction to learn
- Easy for domains to diverge

**Cons:**
- Some CSS duplication for common patterns

**Recommendation:** Start with Option 2F (natural composition). Extract a shared layout only if you find yourself duplicating significant layout code across 3+ modes.

---

## Area 3: Frontend Interactions

The `queueMove`, `undoLastMove`, and `clearMoves` actions are nearly identical between domains. Currently:
- Gameplay: has optimistic undo with tile store updates
- Puzzles: simple undo (just sends WS message, waits for server)

This inconsistency is likely unintentional - both should probably have optimistic updates.

### Option 3A: Factory Function

```ts
interface BoardInteractionDeps {
  getBoard: () => BoardState | null;
  getSelectedTile: () => Coord | null;
  setSelectedTile: (coord: Coord) => void;
  addQueuedMove: (move: Movement) => void;
  getQueuedMoves: () => Movement[];
  setQueuedMoves: (moves: Movement[]) => void;
  wsEffects: {
    sendMoveRequest: (source: Coord, direction: Direction) => void;
    sendUndoMove: () => void;
    sendClearMoves: () => void;
  };
}

function createBoardInteractions(deps: BoardInteractionDeps) {
  return {
    queueMove(direction: Direction) {
      const board = deps.getBoard();
      const selectedTile = deps.getSelectedTile();
      if (!board || !selectedTile) return;
      if (!Board.canMove(board, selectedTile, direction)) return;

      deps.addQueuedMove({ sourceCoord: selectedTile, direction });
      getTileStore(selectedTile).getState().addQueuedDirection(direction);
      deps.setSelectedTile(Board.applyDirection(selectedTile, direction));
      deps.wsEffects.sendMoveRequest(selectedTile, direction);
    },

    undoLastMove() {
      const moves = deps.getQueuedMoves();
      if (moves.length === 0) return;

      // Optimistic update
      const lastMove = moves[moves.length - 1];
      // ... update tile store, selected tile
      deps.setQueuedMoves(moves.slice(0, -1));
      deps.wsEffects.sendUndoMove();
    },

    clearMoves() {
      // ... clear all queued directions from tile stores
      deps.setQueuedMoves([]);
      deps.wsEffects.sendClearMoves();
    },
  };
}
```

Each domain wires up its own instance:

```ts
// domains/gameplay/lib/gameplay-interactions.ts
const gameplayInteractions = createBoardInteractions({
  getBoard: () => useGameplayStore.getState().boardState,
  getSelectedTile: () => useGameplayStore.getState().selectedTile,
  // ...
});
```

**Pros:**
- Core logic defined once
- Explicit dependencies (easy to test)
- Works with any store architecture

**Cons:**
- Boilerplate to wire up each domain
- Must keep dependencies stable (can't use hooks directly in deps)

### Option 3B: Shared Core Functions + Domain Wrappers

Extract shared logic as pure functions, keep thin wrappers in each domain:

```ts
// domains/games/lib/board-interaction-core.ts
function executeQueueMove(
  board: BoardState,
  selectedTile: Coord,
  direction: Direction,
  callbacks: {
    addQueuedMove: (move: Movement) => void;
    setSelectedTile: (coord: Coord) => void;
    sendMoveRequest: (source: Coord, direction: Direction) => void;
  },
): void {
  if (!Board.canMove(board, selectedTile, direction)) return;

  callbacks.addQueuedMove({ sourceCoord: selectedTile, direction });
  getTileStore(selectedTile).getState().addQueuedDirection(direction);
  callbacks.setSelectedTile(Board.applyDirection(selectedTile, direction));
  callbacks.sendMoveRequest(selectedTile, direction);
}

// domains/gameplay/actions/queue-move.ts
function queueMove(direction: Direction) {
  const { boardState, selectedTile, actions } = useGameplayStore.getState();
  if (!boardState || !selectedTile) return;

  executeQueueMove(boardState, selectedTile, direction, {
    addQueuedMove: actions.addQueuedMove,
    setSelectedTile: actions.setSelectedTile,
    sendMoveRequest: gameplayWsEffects.sendMoveRequest,
  });
}
```

**Pros:**
- Minimal abstraction
- Each domain still has explicit entry points
- Easy to understand

**Cons:**
- Some wrapper duplication
- New domain must write wrapper (though it's trivial)

### Option 3C: Direct Usage with Shared Store (requires Option 1A)

If using shared BoardSession store, interactions become trivial:

```ts
// domains/games/actions/queue-move.ts
function queueMove(direction: Direction, wsEffects: WsEffects) {
  const { board, selectedTile, actions } = useBoardSessionStore.getState();
  if (!board || !selectedTile) return;
  if (!Board.canMove(board, selectedTile, direction)) return;

  actions.addQueuedMove({ sourceCoord: selectedTile, direction });
  getTileStore(selectedTile).getState().addQueuedDirection(direction);
  actions.setSelectedTile(Board.applyDirection(selectedTile, direction));
  wsEffects.sendMoveRequest(selectedTile, direction);
}
```

The only domain-specific part is which `wsEffects` to use (or this could be unified too - see Protocol section).

**Pros:**
- Simplest implementation
- Almost no domain-specific code needed

**Cons:**
- Requires shared store (Option 1A)

**Recommendation:**
- If using shared store (1A): Option 3C
- If keeping separate stores: Option 3A (factory) for maximum consistency, or Option 3B for lighter touch

---

## Area 4: Protocol Structure

### Client Messages (Frontend → Backend)

Currently:
```
gameplay:move-request  { sourceCoord, direction }
gameplay:cancel-moves  {}
gameplay:undo-move     {}

puzzles:move-request   { sourceCoord, direction }
puzzles:cancel-moves   {}
puzzles:undo-move      {}
```

The payloads are identical - only the prefix differs.

### Option 4A: Unified `board:*` Protocol for Move Operations

```ts
// Shared move operations
'board:move-request': { sourceCoord: Coord; direction: Direction }
'board:cancel-moves': {}
'board:undo-move': {}

// Domain-specific lifecycle (unchanged)
'gameplay:join-game', 'gameplay:leave-game', ...
'puzzles:start-playing', ...
```

**Pros:**
- Single handler for move operations on backend
- Single ws-effects for move operations on frontend
- New modes get move handling automatically
- Makes the shared nature explicit in the protocol

**Cons:**
- Backend must determine context from connection state (which game/puzzle is this user in?)
- Slightly more complex routing

### Option 4B: Keep Separate Prefixes, Share Types

```ts
// Shared payload types
type MoveRequestPayload = { sourceCoord: Coord; direction: Direction };

// Separate message types using shared payload
'gameplay:move-request': MoveRequestPayload
'puzzles:move-request': MoveRequestPayload
```

**Pros:**
- Clear which domain a message belongs to
- Routing is explicit (gameplay handler handles gameplay:*)
- Can add domain-specific fields later without affecting others
- Minimal change from current code

**Cons:**
- Type duplication (minor)
- New mode requires defining new message types (though trivial)

**Recommendation:** Option 4B is lower risk. The protocol duplication is minimal, and explicit prefixes make debugging easier.

### Server Messages (Backend → Frontend)

Currently:
```
gameplay:state-update  { tick, boardState, playerQueues?, playerStats }
puzzles:state-update   { tick, board, moveQueue }
```

The key difference: gameplay sends all players' queues, puzzles sends single queue.

### Option 4C: Unified Base + Domain Extensions

```ts
// Base state update (used by all modes)
'board:state-update': {
  tick: number;
  board: BoardState;
  moveQueue: Movement[];  // Current player's queue
}

// Gameplay sends additional data
'gameplay:multiplayer-state': {
  allPlayerQueues: PlayerQueuesMap;
  playerStats: CorePlayerState[];
}
```

**Pros:**
- Clean base case for single-player modes
- Multiplayer complexity isolated to gameplay

**Cons:**
- Two messages for gameplay updates
- More complex frontend handling

### Option 4D: Unified with Optional Fields

```ts
'board:state-update': {
  tick: number;
  board: BoardState;
  moveQueue: Movement[];              // Current player's queue (always present)
  allPlayerQueues?: PlayerQueuesMap;  // Only for multiplayer
  playerStats?: CorePlayerState[];    // Only for multiplayer
}
```

**Pros:**
- Single message type
- Frontend ignores fields it doesn't need

**Cons:**
- Optional fields can be confusing
- Type narrowing needed in handlers

### Option 4E: Keep Separate State Messages

Keep `gameplay:state-update` and `puzzles:state-update` as they are.

**Pros:**
- Each domain gets exactly what it needs
- No optional fields or multiple messages
- No migration needed

**Cons:**
- Handlers remain separate

**Recommendation:** Option 4E (keep separate) for state updates is fine. The state shapes are genuinely different (multiplayer vs single-player), and unifying them adds complexity without much benefit. The duplication is in the handlers, not the logic.

---

## Area 5: Backend Architecture

### Current State

**GameServer:**
- Manages multiplayer game: per-player queues, player coordination
- Tick driven by GameCoordinator (global tick loop)
- Complex lifecycle: countdown, start, player join/leave, end

**PuzzleManager:**
- Manages single-player puzzle: single move queue
- Tick driven by internal setInterval
- Simple lifecycle: start, tick, end with scoring

Both use:
- `coreProcessStep()` from @core for game logic
- `Board.isCoordValid()` for validation
- Same `MAX_QUEUED_MOVES = 200`
- Same `queueMove()`, `clearMoves()`, `undoMove()` patterns

### Option 5A: Shared Utility Functions (Lightest Touch)

Extract shared logic as pure functions in @core:

```ts
// packages/core/src/move-queue.ts
function validateAndQueueMove(
  queue: Movement[],
  source: Coord,
  direction: Direction,
  board: BoardState,
  maxQueueSize: number,
): { success: boolean; queue: Movement[] } { ... }

function buildMoveEventsForStep(
  queues: Movement[] | Map<PlayerIndex, Movement[]>,
  nextStep: number,
  playerIndex?: PlayerIndex,
): MoveEvent[] { ... }
```

**Pros:**
- Minimal abstraction
- Easy to understand
- No class hierarchy
- Each manager remains independent

**Cons:**
- Managers still have similar-looking code (calling the shared functions)
- Less structural enforcement

### Option 5B: Composition with MoveQueueEngine

Create a small class that manages a single move queue:

```ts
class MoveQueueEngine {
  private queue: Movement[] = [];
  private maxSize: number;

  constructor(maxSize: number = 200) { this.maxSize = maxSize; }

  queueMove(source: Coord, direction: Direction, board: BoardState): boolean {
    if (!Board.isCoordValid(board, source)) return false;
    if (this.queue.length >= this.maxSize) return false;
    this.queue.push({ sourceCoord: source, direction });
    return true;
  }

  undoMove(): Movement | undefined { return this.queue.pop(); }
  clearMoves(): void { this.queue = []; }
  shiftMove(): Movement | undefined { return this.queue.shift(); }
  getQueue(): Movement[] { return [...this.queue]; }
}

// GameServer uses one engine per player
class GameServer {
  private playerEngines: Map<PlayerIndex, MoveQueueEngine>;
}

// PuzzleManager uses single engine
class PuzzleManager {
  private engine: MoveQueueEngine;
}
```

**Pros:**
- Encapsulates queue logic
- GameServer can have multiple engines (one per player)
- Easy to test in isolation

**Cons:**
- More boilerplate than raw functions
- Engine doesn't know about broadcasting (managers still handle that)

### Option 5C: Shared Base Class

```ts
abstract class BoardEngine {
  protected gameState: GameState;
  protected config: { timing: TimingConfig; maxQueuedMoves: number };

  protected abstract getQueuesForStep(): Map<PlayerIndex, Movement[]> | Movement[];
  protected abstract broadcastState(): void;
  protected abstract onGameEnd(): void;

  tick(): boolean {
    const events = this.buildMoveEvents();
    const result = coreProcessStep(this.gameState, events, this.config.timing);

    if (result.gameEnded) {
      this.onGameEnd();
      return true;
    }

    this.broadcastState();
    return false;
  }

  // Shared queue operations (single queue version)
  protected queueMove(queue: Movement[], source: Coord, direction: Direction): boolean { ... }
  protected undoMove(queue: Movement[]): Movement | undefined { ... }
  protected clearQueue(queue: Movement[]): void { ... }
}
```

**Pros:**
- Tick loop defined once
- Clear extension points

**Cons:**
- Inheritance can be rigid
- GameServer's multi-queue model doesn't fit single-queue base cleanly
- Abstract classes can be harder to test

**Recommendation:** Option 5A (shared utility functions) is the safest. The backend managers have genuinely different responsibilities (multiplayer coordination vs single-player), and forcing them into a hierarchy may create awkward abstractions. Extract shared logic as functions, keep managers independent.

---

## Dependencies Between Areas

The store decision (Area 1) has cascading effects:

```
Store Architecture
       │
       ├── Shared Store (1A) ──────┬── Unified Tile Component (2B)
       │                           ├── Unified Board Component (2A)
       │                           └── Simple Interaction Layer (3C)
       │
       └── Separate Stores (1B/1D) ┬── Separate Tile Components (2C) or Factory (2D)
                                   ├── Generic Board with TileComponent prop (2A)
                                   └── Factory-based Interactions (3A/3B)
```

Protocol and backend decisions are largely independent of frontend store choice.

---

## Summary: Option Combinations

### Path A: Maximum Unification

- **Stores:** Shared BoardSession store (1A)
- **Components:** Unified Tile, unified Board (2A, 2B)
- **Interactions:** Direct usage with shared store (3C)
- **Protocol:** Keep separate prefixes, share types (4B)
- **Backend:** Shared utility functions (5A)

**Result:** One Tile component, one Board component, one interaction layer. Adding new mode requires: domain-specific store, lifecycle handlers, page UI.

### Path B: Moderate Sharing

- **Stores:** Zustand slices or formalized interface (1B or 1D)
- **Components:** Generic Board, separate Tiles (2A, 2C)
- **Interactions:** Factory function (3A)
- **Protocol:** Keep separate (4B, 4E)
- **Backend:** Shared utility functions (5A)

**Result:** Shared interaction logic, shared Board component, but separate Tiles. Adding new mode requires: full store, tile component, interaction wiring, lifecycle handlers, page UI.

### Path C: Minimal Change

- **Stores:** Keep separate, formalize interface (1D)
- **Components:** Generic Board, keep separate Tiles (2A, 2C)
- **Interactions:** Shared core functions + wrappers (3B)
- **Protocol:** Keep as-is
- **Backend:** Keep as-is

**Result:** Less duplication, clearer contracts, but still separate implementations. Changes to core logic (e.g., optimistic undo) must be made in shared core and verified in each domain.

---

## Open Questions

1. **Should puzzles have optimistic undo?** Currently gameplay does, puzzles doesn't. If they should behave the same, this is a bug to fix regardless of refactoring approach.

2. **How often will new modes be added?** If sandbox and tutorials are coming soon, Path A pays off faster. If it's just gameplay + puzzles for a while, Path C might be sufficient.

3. **How different will future modes be?** If sandbox needs to control multiple players or modify the board directly, the shared abstraction needs to accommodate that. Worth sketching out sandbox requirements before committing to an architecture.

4. **Is the protocol split (gameplay:* vs puzzles:*) causing problems?** If not, unifying it adds risk without clear benefit. The duplication is in types, not logic.
