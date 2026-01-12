# Puzzles Spike 2 - Implementation Plan

**Date:** 2026-01-11
**Branch:** feat/puzzles-spike-2
**Status:** Planning (not yet implemented)
**Predecessor:** puzzles-1st-spike branch (see `1-11-[2]-branch-summary-puzzles-1st-spike.md`)

---

## Overview

This document describes the planned implementation for the "Best Start" puzzle mode. The design follows principles established in the GameServer refactor notes (`1-11-[3]-gameserver-refactor-notes.md`): backend orchestration should be thin, delegating all game logic to `@core`.

---

## Architecture Principles

### Separation of Concerns

**@core (game logic):**
- Puzzle creation (initial state)
- Move processing (reuses existing `processStep`)
- Completion detection ("is this puzzle done?")
- Scoring ("how well did the player do?")
- All game rules

**Backend PuzzleManager (orchestration):**
- Tick loop timing
- Move queue management
- Broadcasting state to clients
- Session lifecycle (started, ended)
- No knowledge of game rules

The orchestrator asks "what happened?" and "is it done?" but doesn't know *how* any of that works.

---

## @core/puzzles Module

### Directory Structure

```
packages/core/src/puzzles/
├── best-start/
│   ├── types.ts           # BestStartConfig, BestStartResult
│   ├── create.ts          # Create initial puzzle state
│   ├── is-complete.ts     # Check if puzzle finished
│   └── score.ts           # Calculate final score
└── index.ts               # Re-exports
```

No generic "puzzle framework" abstraction yet - just what best-start needs. Abstractions will emerge when a second puzzle type reveals shared patterns.

### Types

```typescript
// packages/core/src/puzzles/best-start/types.ts

interface BestStartConfig {
  timing: TimingConfig;  // reuses existing timing config
  mapSize: { width: number; height: number };
  // future: terrain density, general placement, etc.
}

interface BestStartResult {
  landCount: number;
  armyCount: number;
  // future: efficiency rating, comparison to ideal solution
}
```

### Key Insight: maxTurns Derived from Timing

The "25 turns" in Best Start isn't a separate config - it comes from `timing.armyProductionTicks`. One "round" = one army production cycle. The puzzle ends when the first round completes.

This means `isBestStartComplete` checks: `tick >= config.timing.armyProductionTicks`

### Functions

**`createBestStartPuzzle(config: BestStartConfig): GameState`**
- Creates initial game state for puzzle
- Generates map (blank or procedural based on config)
- Places general at appropriate position
- Returns standard `GameState` (reuses existing type)

**`isBestStartComplete(tick: number, config: BestStartConfig): boolean`**
- Returns `tick >= config.timing.armyProductionTicks`
- Simple, but keeps the rule in core (not backend)

**`scoreBestStart(board: BoardState): BestStartResult`**
- Calculates `landCount` and `armyCount` for player 0
- May reuse/share logic with `getPlayerStats` (see GameServer refactor notes)
- Future: compare to computed ideal solution

### Reuses Existing Core

- **`processStep()`** - Same function GameServer uses for move processing
- **`GameState`, `BoardState`** - Existing types, no puzzle-specific state types needed

### New Core Functions (to build for puzzles, later reuse in GameServer refactor)

- **`isMoveValid()`** - Move validation (bounds, ownership, direction). Build as part of puzzle work, then GameServer refactor can adopt it.

---

## Backend: PuzzleManager

### Location

`apps/backend/src/domains/puzzles/puzzles-manager.ts`

### Responsibilities (Orchestration Only)

| Owns | Delegates to @core |
|------|-------------------|
| Tick loop (timer-based) | `processStep()` |
| Move queue (single player) | `isBestStartComplete()` |
| Broadcasting state to client | `scoreBestStart()` |
| Session lifecycle | Move validation |

### Class Structure

```typescript
class PuzzleManager {
  // State
  private gameState: GameState;
  private config: BestStartConfig;
  private moveQueue: QueuedMove[];
  private tickTimer: NodeJS.Timeout | null;
  private started: boolean;
  private ended: boolean;

  // Room/user info
  private userId: UserId;
  private roomId: RoomId;

  constructor(userId: UserId, config: BestStartConfig) {
    this.gameState = createBestStartPuzzle(config);
    this.config = config;
    this.moveQueue = [];
    this.roomId = buildPuzzleRoomId(userId);
    // ...
  }

  // Lifecycle
  start(): void {
    // Start tick timer based on config.timing.tickRateMs
    // Broadcast initial state
  }

  stop(): void {
    // Clear timer
    // Cleanup
  }

  // Move queue (orchestration)
  queueMove(source: Coord, direction: Direction): void {
    // Validate via core: isMoveValid(...)
    // Add to queue if valid
  }

  clearMoves(): void {
    this.moveQueue = [];
  }

  undoMove(): void {
    this.moveQueue.pop();
  }

  // Core loop
  private tick(): void {
    // 1. Build move events from queue (take first move)
    // 2. Call processStep() from core
    // 3. Check isBestStartComplete()
    // 4. If complete:
    //    - Calculate score via scoreBestStart()
    //    - Broadcast puzzle end with results
    //    - Stop timer
    // 5. Else:
    //    - Broadcast state update
  }
}
```

### Differences from GameServer

| GameServer | PuzzleManager |
|------------|---------------|
| Multiple players | Single player |
| Player mapping (userId → playerIndex) | Always player 0 |
| `activePlayers` tracking | N/A |
| Countdown before start | Start immediately |
| Disconnect/timeout handling | Simple: stop puzzle |
| Game end (winner detection) | Puzzle end (turn limit) |
| Move history persistence | Not needed for PoC |

### Integration with Handlers

Handlers remain thin routers:

```typescript
// handlers.ts
async function handleStartPlaying(ctx: HandlerContext) {
  await puzzleActions.startPuzzle(ctx.userId, ctx.connectionId);
}

async function handleMoveRequest(ctx: HandlerContext, payload: { sourceCoord, direction }) {
  puzzleActions.queueMove(ctx.userId, payload.sourceCoord, payload.direction);
}

async function handleCancelMoves(ctx: HandlerContext) {
  puzzleActions.clearMoves(ctx.userId);
}

async function handleUndoMove(ctx: HandlerContext) {
  puzzleActions.undoMove(ctx.userId);
}
```

### Actions Layer

```typescript
// actions/index.ts or actions/puzzle-actions.ts

// Maps userId → PuzzleManager instance
const activePuzzles = new Map<UserId, PuzzleManager>();

function startPuzzle(userId: UserId, connectionId: ConnectionId): void {
  // Join user to puzzle room
  // Create PuzzleManager with default config
  // Store in activePuzzles map
  // Call manager.start()
}

function queueMove(userId: UserId, source: Coord, direction: Direction): void {
  const manager = activePuzzles.get(userId);
  if (manager) manager.queueMove(source, direction);
}

function clearMoves(userId: UserId): void {
  const manager = activePuzzles.get(userId);
  if (manager) manager.clearMoves();
}

function undoMove(userId: UserId): void {
  const manager = activePuzzles.get(userId);
  if (manager) manager.undoMove();
}
```

### WS Effects

Outbound messages to client:

```typescript
// ws-effects.ts

function broadcastPuzzleState(roomId: RoomId, tick: number, board: BoardState, moveQueue: QueuedMove[]): void {
  // Send puzzles:state-update message
}

function broadcastPuzzleEnd(roomId: RoomId, result: BestStartResult, finalBoard: BoardState): void {
  // Send puzzles:end-puzzle message
}
```

---

## Message Flow

### Start Puzzle

```
Client                    Backend                      Core
  |                          |                           |
  |--puzzles:start-playing-->|                           |
  |                          |--createBestStartPuzzle()--|
  |                          |<------ GameState ---------|
  |                          |                           |
  |                          | [start tick timer]        |
  |<--puzzles:state-update---|                           |
```

### Each Tick

```
Backend                                    Core
  |                                          |
  | [timer fires]                            |
  |                                          |
  | [build MoveEvent from queue]             |
  |--------processStep(board, events)------->|
  |<----------- updated board ---------------|
  |                                          |
  |--------isBestStartComplete(tick)-------->|
  |<------------- boolean -------------------|
  |                                          |
  | [if not complete: broadcast state]       |
  | [if complete: scoreBestStart, broadcast end]
```

### Move Request

```
Client                    Backend                      Core
  |                          |                           |
  |--puzzles:move-request--->|                           |
  |                          |------isMoveValid()------->|
  |                          |<-------- boolean ---------|
  |                          |                           |
  |                          | [if valid: add to queue]  |
  |                          |                           |
  |<--puzzles:state-update---| (includes updated queue)  |
```

---

## Configuration

### Default Best Start Config

```typescript
const DEFAULT_BEST_START_CONFIG: BestStartConfig = {
  timing: {
    tickRateMs: 500,           // from existing TICK_RATE_MS
    generalProductionTicks: 2, // from existing config
    armyProductionTicks: 25,   // from existing config - this is maxTurns
  },
  mapSize: { width: 21, height: 21 },
};
```

### Future Config Options

- Terrain density (mountains, cities)
- General starting position (center vs random)
- Map seed (for reproducible puzzles)
- Speed variants (faster/slower tick rate)

---

## Open Questions (To Resolve During Implementation)

1. **Move queue broadcast:** Should state updates include the player's move queue so UI can render pending moves? (Probably yes, GameServer does this)

2. **Immediate feedback:** When player queues a move, should we broadcast state immediately, or wait for next tick? (GameServer waits for tick)

3. **Pause/resume:** If player navigates away, should puzzle pause? Or just keep ticking? (Probably keep ticking for PoC)

4. **Multiple puzzles:** Can a user have multiple active puzzles? (Probably no - one at a time, new puzzle replaces old)

5. **Puzzle persistence:** Save puzzle state to DB? (Not for PoC - in-memory only)

---

## Frontend

### Architecture Principle: Pure Actions

Frontend actions follow "pure inputs, effectful outputs":

- **Don't** reach into stores to gather inputs
- **Do** receive all needed data as parameters
- **Can** update stores and send WS messages (effects)

The action's signature tells you exactly what it needs. No hidden dependencies.

```typescript
// GOOD: Pure inputs
function handleStateUpdate(tick: number, board: BoardState, moveQueue: QueuedMove[]): void {
  const { updateState } = puzzleStore.getState().actions;
  updateState(tick, board, moveQueue);
}

// BAD: Hidden dependency
function handleStateUpdate(payload: Payload): void {
  const user = userStore.getState().data;  // hidden read
  // ...
}
```

### Directory Structure

```
apps/frontend/src/domains/puzzles/
├── stores/
│   └── puzzle-store.ts         # NEW - puzzle state
├── handlers.ts                  # NEW - incoming message handlers
├── actions/
│   ├── index.ts                # EXISTS - re-exports
│   ├── start-playing-puzzles.ts # EXISTS - needs cleanup
│   └── puzzle-actions.ts       # NEW - pure action functions
├── ws-effects.ts               # EXISTS - outbound messages (complete)
└── pages/
    ├── best-start-main/        # EXISTS
    └── best-start-play/        # EXISTS - needs updates
```

### Puzzle Store

Simpler than gameplay store - single player, no player mapping.

```typescript
// stores/puzzle-store.ts

interface PuzzleState {
  // Core state (from server)
  status: 'idle' | 'playing' | 'ended';
  board: BoardState | null;
  tick: number;
  moveQueue: QueuedMove[];      // pending moves (from server)

  // Results (populated when ended)
  result: BestStartResult | null;

  // UI state (local)
  selectedTile: Coord | null;

  actions: {
    // State updates (called by handlers via actions)
    updateState: (tick: number, board: BoardState, moveQueue: QueuedMove[]) => void;
    setEnded: (result: BestStartResult, finalBoard: BoardState) => void;
    reset: () => void;

    // UI state
    setSelectedTile: (coord: Coord | null) => void;
  };
}

const puzzleStore = create<PuzzleState>((set) => ({
  status: 'idle',
  board: null,
  tick: 0,
  moveQueue: [],
  result: null,
  selectedTile: null,

  actions: {
    updateState: (tick, board, moveQueue) => set({
      status: 'playing',
      tick,
      board,
      moveQueue,
    }),

    setEnded: (result, finalBoard) => set({
      status: 'ended',
      result,
      board: finalBoard,
    }),

    reset: () => set({
      status: 'idle',
      board: null,
      tick: 0,
      moveQueue: [],
      result: null,
      selectedTile: null,
    }),

    setSelectedTile: (coord) => set({ selectedTile: coord }),
  },
}));
```

**Key simplifications vs gameplay store:**
- No `game`, `winner`, `players`, `playersByIndex`, etc.
- No cross-store subscriptions
- Single `status` field instead of multiple booleans
- `result` holds scoring when puzzle ends

### Handlers

Thin routers that call actions with payload data.

```typescript
// handlers.ts

import type { HandlerMap } from '@/ws-lib';
import type { PuzzlesServerMessage } from '@protocol/domains/puzzles/server-messages';
import { handleStateUpdate, handlePuzzleEnd } from './actions/puzzle-actions';

const puzzleHandlers = {
  'puzzles:state-update': (payload) => {
    handleStateUpdate(payload.tick, payload.board, payload.moveQueue);
  },

  'puzzles:end-puzzle': (payload) => {
    handlePuzzleEnd(payload.result, payload.finalBoard);
  },
} satisfies HandlerMap<PuzzlesServerMessage>;

export { puzzleHandlers };
```

### Actions (Pure)

```typescript
// actions/puzzle-actions.ts

import type { BoardState, Coord, Direction } from '@core/types';
import type { BestStartResult } from '@core/puzzles/best-start/types';
import type { QueuedMove } from '@/domains/puzzles/types';

import { puzzleStore } from '../stores/puzzle-store';
import { puzzlesWsEffects } from '../ws-effects';

// --- Outbound actions (send WS messages) ---

function startPuzzle(): void {
  puzzleStore.getState().actions.reset();
  puzzlesWsEffects.sendStartPlaying();
}

function queueMove(source: Coord, direction: Direction): void {
  puzzlesWsEffects.sendMoveRequest(source, direction);
}

function undoMove(): void {
  puzzlesWsEffects.sendUndoMove();
}

function clearMoves(): void {
  puzzlesWsEffects.sendCancelMoves();
}

// --- Inbound actions (update store from server messages) ---

function handleStateUpdate(tick: number, board: BoardState, moveQueue: QueuedMove[]): void {
  const { updateState } = puzzleStore.getState().actions;
  updateState(tick, board, moveQueue);
}

function handlePuzzleEnd(result: BestStartResult, finalBoard: BoardState): void {
  const { setEnded } = puzzleStore.getState().actions;
  setEnded(result, finalBoard);
}

export {
  startPuzzle,
  queueMove,
  undoMove,
  clearMoves,
  handleStateUpdate,
  handlePuzzleEnd,
};
```

### Page Updates

`best-start-play-page.tsx` changes:

1. **Remove hardcoded board** - Use `puzzleStore` instead of static `GRID`/`BOARD`
2. **Subscribe to store** - `board`, `tick`, `status`, `result`, `selectedTile`
3. **Wire up interactions** - Tile clicks → `queueMove(source, direction)`
4. **Show results** - When `status === 'ended'`, display `result`

```typescript
// pages/best-start-play/best-start-play-page.tsx
// Illustrative sketch - may change during implementation based on what
// works with existing components or what looks/feels better.

function BestStartPlayPage() {
  const status = puzzleStore((s) => s.status);
  const board = puzzleStore((s) => s.board);
  const tick = puzzleStore((s) => s.tick);
  const result = puzzleStore((s) => s.result);
  const selectedTile = puzzleStore((s) => s.selectedTile);
  const { setSelectedTile } = puzzleStore((s) => s.actions);

  const handleTileClick = (coord: Coord) => {
    if (selectedTile) {
      const direction = getDirectionBetween(selectedTile, coord);
      if (direction) {
        queueMove(selectedTile, direction);
        setSelectedTile(null);
      } else {
        setSelectedTile(coord);
      }
    } else {
      setSelectedTile(coord);
    }
  };

  if (status === 'idle') {
    return <StartScreen onStart={startPuzzle} />;
  }

  if (status === 'ended') {
    return <ResultsScreen result={result} board={board} onRestart={startPuzzle} />;
  }

  return (
    <div>
      <div>Turn: {tick}/25</div>
      <GameBoard
        boardState={board}
        onTileClick={handleTileClick}
        selectedTile={selectedTile}
      />
      <button onClick={undoMove}>Undo</button>
      <button onClick={clearMoves}>Clear</button>
    </div>
  );
}
```

### Reusing GameBoard (Needs Investigation)

The existing `GameBoard` component from gameplay may be reusable, but needs investigation. Potential issues:
- May be tightly coupled to gameplay stores
- May need props for `onTileClick` callback (if not already present)
- May need props for `selectedTile` highlighting
- May have multiplayer/fog of war assumptions that don't apply to single-player puzzles

If reuse is too complicated, consider building a simpler puzzle-specific board component using `TileRenderer`.

### Frontend Message Flow

```
User clicks tile
    ↓
Component calls queueMove(source, direction)
    ↓
Action sends WS message (pure - no store reads)
    ↓
Server processes, broadcasts state-update
    ↓
Handler receives message
    ↓
Handler calls handleStateUpdate(tick, board, queue)
    ↓
Action updates store
    ↓
Component re-renders with new state
```

---

## UI Design

### Design Principles

- **Minimal styling** - No visual fanciness, keep it simple for PoC
- **Investigate reuse of existing components** - TileRenderer, queued move arrows, stats display (see "Components to Investigate" section - reuse may not be straightforward)
- **No animations** - Instant transitions between states

### User Flow

1. **Start** → Click "Start" button → "Loading..." → puzzle begins
2. **Play** → Make moves, watch ticks, see stats update
3. **Complete** → Turn 25 finishes → results appear, fog clears
4. **Next** → Click "Play Again" → new puzzle starts (same page)

### Screen: Start (idle state)

```
┌─────────────────────────────────────────────┐
│                                             │
│              Best Start Puzzle              │
│                                             │
│                 [Start]                     │
│                                             │
└─────────────────────────────────────────────┘
```

- Simple start button
- Click → "Loading..." while server creates puzzle

### Screen: Play (playing state)

```
┌─────────────────────────────────────────────┐
│                                             │
│    ┌─────────────────┐    ┌───────────┐    │
│    │                 │    │ Turn 5/25 │    │
│    │                 │    ├───────────┤    │
│    │                 │    │ Land: 12  │    │
│    │     Board       │    │ Army: 47  │    │
│    │                 │    │           │    │
│    │  (with queued   │    │           │    │
│    │   move arrows)  │    │           │    │
│    │                 │    │           │    │
│    └─────────────────┘    └───────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

- Board centered, stats panel to the right
- Turn counter shows progress (e.g., "Turn 5/25")
- Live-updating land count and army count
- Queued moves shown as arrows on board (investigate reusing existing viz)
- No visible controls - undo/clear via keyboard shortcuts

Note: Layout/design may evolve during implementation based on what looks and feels right.

### Screen: Results (ended state)

```
┌─────────────────────────────────────────────┐
│                                             │
│    ┌─────────────────┐    ┌───────────┐    │
│    │                 │    │ Complete! │    │
│    │                 │    ├───────────┤    │
│    │                 │    │ Land: 18  │    │
│    │     Board       │    │ Army: 64  │    │
│    │                 │    │           │    │
│    │  (fog cleared,  │    ├───────────┤    │
│    │   full view)    │    │           │    │
│    │                 │    │ [Play     │    │
│    │                 │    │  Again]   │    │
│    └─────────────────┘    └───────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

- Same layout as play screen
- Turn counter replaced with "Complete!" header
- Final stats displayed (land count, army count)
- Fog of war removed - full board visible
- "Play Again" button appears
- No animations - instant transition from playing → ended

### Keyboard Shortcuts

- **Undo** - Remove last queued move (same as gameplay)
- **Clear** - Remove all queued moves (same as gameplay)

### Components to Investigate for Reuse

These components from gameplay UI may be reusable, but there may be complications (tight coupling to gameplay stores, multiplayer assumptions, etc.). Investigate during implementation:

- `TileRenderer` - Likely reusable (pure component, props-driven)
- Queued move arrows - May need adaptation for single-player context
- Stats display - May be coupled to gameplay store
- Turn display - May be coupled to gameplay store

### Deferred (Not for PoC)

- Landing page with puzzle selection/options
- Previous attempt comparison
- Ideal solution comparison
- Leaderboards
- Puzzle history/stats

---

## Implementation Order

1. **@core/puzzles/best-start** - types, create, is-complete, score
2. **PuzzleManager class** - tick loop, move queue, lifecycle
3. **Wire backend handlers** - connect existing handler stubs to PuzzleManager
4. **Backend WS effects** - state updates, puzzle end
5. **Frontend puzzle-store** - state management
6. **Frontend handlers + actions** - process incoming messages
7. **Frontend UI** - wire up page to store, show results

---

## Related Documents

- `1-11-[2]-branch-summary-puzzles-1st-spike.md` - Previous spike summary
- `1-11-[3]-gameserver-refactor-notes.md` - Design principles for orchestration vs logic separation
- `docs/architecture.md` - Overall system architecture
