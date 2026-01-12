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
- **`isMoveValid()`** - Same validation (when implemented per refactor notes)
- **`GameState`, `BoardState`** - Existing types, no puzzle-specific state types needed

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

## Implementation Order

1. **@core/puzzles/best-start** - types, create, is-complete, score
2. **PuzzleManager class** - tick loop, move queue, lifecycle
3. **Wire handlers** - connect existing handler stubs to PuzzleManager
4. **WS effects** - state updates, puzzle end
5. **Frontend handlers** - process incoming messages, update store
6. **Frontend UI** - display state, show results

---

## Related Documents

- `1-11-[2]-branch-summary-puzzles-1st-spike.md` - Previous spike summary
- `1-11-[3]-gameserver-refactor-notes.md` - Design principles for orchestration vs logic separation
- `docs/architecture.md` - Overall system architecture
