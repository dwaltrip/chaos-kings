# Sandbox Mode - Design Document

**Date:** 2026-01-25

**Status:** Ready for Implementation (Reviewed)

**Context:** Building a sandbox UI for testing game mechanics and UI/UX. This work also establishes shared infrastructure (BoardSessionStore, MoveQueueEngine, TimelineManager) that will later unify gameplay, puzzles, and replay modes.

---

## Goals

### Primary Goals (v1)
1. Functional sandbox with pause/resume, step forward/backward, rewind, reset
2. Extract `MoveQueueEngine` into `@core` - single source of truth for queue rules
3. Create `BoardSessionStore` - shared frontend store for board session state
4. Create `TimelineManager` - shared checkpoint/cache logic (extracted from replay)

### Non-Goals (v1)
- Migrating gameplay/puzzles to new shared infrastructure (future work)
- Map editing, config modification mid-session
- Multi-player control (single player only, but leave extension points)
- Variable speed playback (0.5x, 2x)
- Saving/loading sandbox sessions
- Nav link to sandbox (access via direct URL)

---

## User Stories (v1)

1. As a dev, I can visit `/sandbox` and a session starts automatically with a generated map
2. As a dev, I can queue moves using same controls as gameplay/puzzles (click tile, arrow keys)
3. As a dev, I can pause the game clock
4. As a dev, I can resume the game clock
5. As a dev, I can step backward one tick (rewind)
6. As a dev, I can step forward one tick (while paused)
7. As a dev, I can reset to initial state (tick 0)

---

## UI Design

Minimal control bar below the board:

```
┌─────────────────────────────────────┐
│                                     │
│              Board                  │
│                                     │
├─────────────────────────────────────┤
│  ◀  ▶/⏸  ▶  │  Reset  │  Tick: 42  │
└─────────────────────────────────────┘
```

- Step back (◀)
- Play/Pause toggle (▶/⏸)
- Step forward (▶)
- Reset button
- Tick counter (text)

No slider. Minimal styling. Control bar not tall.

---

## Architecture Overview

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tick control | Self-contained (like PuzzleManager) | Simpler for pause/rewind; revisit if shared abstraction needed |
| Rewind state | Backend owns history | Single source of truth; queue stays in sync |
| Queue on rewind | Clear queue | Simple; user probably wants to try different moves |
| Store migration | Sandbox uses new stores; existing modes unchanged | Prove pattern first, migrate later |
| Tile component | Build unified Tile for sandbox | Ready for other modes to adopt |
| Session start | Auto-start on page load | Simple UX for dev tool |
| History storage | Checkpoint every 25 ticks | Bounded memory; matches replay pattern |
| Optimistic updates | Yes, for queue operations | Match existing gameplay/puzzle UX |
| Player mode | Single player, no opponent | Simplest for v1; leave extension points |
| Step-forward behavior | Processes queued move | Consistent with normal tick |
| Initial map | Hardcoded defaults (small map) | No URL params for v1 |

### Known Limitations (v1)

**Disconnect cleanup:** Sessions are not automatically cleaned up when users disconnect. For a dev tool this is acceptable. Sessions will persist until server restart.
- TODO: Add idle timeout (e.g., cleanup after 5 min with no activity)
- TODO: Wire disconnect handler to cleanup sessions

### Dependency Flow

```
                    ┌─────────────────┐
                    │     @core       │
                    │  (game logic +  │
                    │ MoveQueueEngine)│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ SandboxManager  │ │BoardSessionStore│ │ TimelineManager │
│   (backend)     │ │   (frontend)    │ │   (frontend)    │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│domains/sandbox  │ │domains/sandbox  │ │ domains/replay  │
│   (backend)     │ │  (frontend)     │ │   (frontend)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Module Organization

### @core (package) - New

```
packages/core/src/
  move-queue/
    move-queue-engine.ts      # Stateful queue + validation + grace logic
    types.ts                  # Movement, QueueConfig types
    index.ts
```

### Frontend - Shared (New)

```
apps/frontend/src/domains/games/
  stores/
    board-session-store.ts    # NEW: shared board state
    tile-store-registry.ts    # existing
  lib/
    timeline-manager.ts       # NEW: checkpoint/cache (extracted from replay)
```

### Frontend - Sandbox Domain (New)

```
apps/frontend/src/domains/sandbox/
  stores/
    sandbox-meta-store.ts     # isPaused, maxTick
  actions/
    index.ts
    start-sandbox.ts
    playback-controls.ts      # play, pause, stepForward, stepBack, reset
    queue-move.ts
  handlers.ts
  ws-effects.ts
  pages/
    sandbox-page.tsx
  ui/
    sandbox-control-bar.tsx
    sandbox-tile.tsx          # Unified tile using BoardSessionStore
```

### Backend - Sandbox Domain (New)

```
apps/backend/src/domains/sandbox/
  sandbox-manager.ts          # Per-session game engine
  sandbox-service.ts          # Manages active sessions, future persistence
  handlers.ts
  actions.ts
  ws-effects.ts
  types.ts
```

### Protocol (New)

```
packages/protocol/
  domains/
    sandbox/
      client-messages.ts
      server-messages.ts
      index.ts
```

---

## Detailed Design

### 0. SandboxConfig

Configuration for sandbox sessions. Hardcoded defaults for v1.

```typescript
// apps/backend/src/domains/sandbox/types.ts
interface SandboxConfig {
  mapSize: { width: number; height: number };  // default: 10x10
  timing: TimingConfig;                         // from @core
  seed?: number;                                // for reproducible maps (optional)
  checkpointInterval: number;                   // default: 25 (every 25 ticks)
}

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  mapSize: { width: 10, height: 10 },
  timing: DEFAULT_TIMING_CONFIG,  // from @core
  checkpointInterval: 25,
};
```

### 1. MoveQueueEngine (@core)

Encapsulates queue state and rules. Lives in @core because validation and "grace" logic are game rules.

```typescript
// packages/core/src/move-queue/types.ts
interface QueueConfig {
  maxSize: number;           // default 200
  enableGrace?: boolean;     // future: skip invalid moves
}

// packages/core/src/move-queue/move-queue-engine.ts
class MoveQueueEngine {
  private queue: Movement[];
  private config: QueueConfig;

  constructor(config?: Partial<QueueConfig>);

  // Queue operations
  queueMove(source: Coord, direction: Direction, board: BoardState): boolean;
  undoMove(): Movement | undefined;
  clearMoves(): void;

  // Tick processing
  shiftMove(): Movement | undefined;   // consume next move
  peekMove(): Movement | undefined;    // view without consuming

  // Accessors
  getQueue(): Movement[];              // returns copy
  getLength(): number;
  isEmpty(): boolean;

  // Future: grace logic
  // shiftValidMove(board: BoardState): Movement | undefined;
}
```

**Usage by backend:**
- SandboxManager: one engine instance
- GameServer: one engine per player (future migration)
- PuzzleManager: one engine (future migration)

### 2. BoardSessionStore (Frontend)

Shared store for board session state. Used by sandbox now; gameplay/puzzles migrate later.

```typescript
// apps/frontend/src/domains/games/stores/board-session-store.ts
interface BoardSessionState {
  board: BoardState | null;
  tick: number;
  selectedTile: Coord | null;
  visibleSquares: Set<string>;
  queuedMoves: Movement[];
  isEnded: boolean;
}

interface BoardSessionActions {
  setBoard(board: BoardState | null): void;
  setTick(tick: number): void;
  setSelectedTile(coord: Coord | null): void;
  clearSelectedTile(): void;
  setVisibleSquares(squares: Set<string>): void;
  setQueuedMoves(moves: Movement[]): void;
  addQueuedMove(move: Movement): void;
  setIsEnded(ended: boolean): void;
  reset(): void;
}

// Also expose selectors similar to existing stores:
// selectIsTileSelected(coord), selectIsVisible(coord), etc.
```

### 3. TimelineManager (Frontend)

Extracted from replay's checkpoint/cache logic. Manages game state history for time navigation.

```typescript
// apps/frontend/src/domains/games/lib/timeline-manager.ts
interface GameStateSnapshot {
  gameState: GameState;
  tick: number;
}

interface TimelineConfig {
  checkpointInterval: number;    // default 25
  maxCacheSize: number;          // default 100
}

class TimelineManager {
  private checkpoints: Map<number, GameStateSnapshot>;
  private frameCache: Map<number, GameStateSnapshot>;
  private frameCacheOrder: number[];  // LRU tracking
  private config: TimelineConfig;

  constructor(config?: Partial<TimelineConfig>);

  // Record state as time progresses
  recordTick(gameState: GameState): void;

  // Time navigation
  getStateAtTick(targetTick: number, replayFn: ReplayFunction): GameState;

  // Lifecycle
  clear(): void;
  getMaxTick(): number;
}

type ReplayFunction = (fromState: GameState, toTick: number) => GameState;
```

**Note:** Replay domain will be refactored to use this. For v1, we build it for sandbox; replay migration is follow-up work.

### 4. SandboxManager (Backend)

Per-session game engine with pause/rewind support.

```typescript
// apps/backend/src/domains/sandbox/sandbox-manager.ts
class SandboxManager {
  private gameState: GameState;
  private moveQueue: MoveQueueEngine;
  private checkpoints: Map<number, GameStateSnapshot>;  // tick -> snapshot (every N ticks)
  private tickTimer: NodeJS.Timeout | null;
  private isPaused: boolean;
  private userId: UserId;
  private roomId: RoomId;
  private config: SandboxConfig;

  constructor(userId: UserId, config: SandboxConfig);

  // Lifecycle
  start(): void;              // Initialize, broadcast initial state (starts paused)
  stop(): void;               // Cleanup timers

  // Playback control
  play(): void;               // Start tick interval
  pause(): void;              // Stop tick interval
  stepForward(): void;        // Single tick, stay paused
  rewindToTick(tick: number): void;  // Restore from history, clear queue
  reset(): void;              // Rewind to tick 0

  // Move operations (delegate to MoveQueueEngine)
  queueMove(source: Coord, direction: Direction): void;
  undoMove(): void;
  clearMoves(): void;

  // Internal
  private tick(): void;
  private maybeSaveCheckpoint(): void;  // save if tick % checkpointInterval === 0
  private broadcastState(): void;

  // Accessors
  getState(): { tick, board, queue, isPaused };
  isEnded(): boolean;
}
```

### 5. SandboxService (Backend)

Manages active sandbox sessions. Simple for v1, extensible for future features.

```typescript
// apps/backend/src/domains/sandbox/sandbox-service.ts
class SandboxService {
  private sessions: Map<UserId, SandboxManager>;

  createSession(userId: UserId, config?: SandboxConfig): SandboxManager;
  getSession(userId: UserId): SandboxManager | undefined;
  destroySession(userId: UserId): void;

  // Future: persistence, multiple sessions per user, etc.
}

// Singleton instance
const sandboxService = new SandboxService();
```

### 6. Frontend Action Pattern (IMPORTANT)

**All frontend domain actions follow this pattern:**

1. **One action per file** in `actions/` directory
2. **Internal function (`_actionName`)** that takes all dependencies as parameters
3. **Exported wrapper (`actionName`)** that collects state and calls the internal function

This pattern improves testability and makes dependencies explicit.

```typescript
// apps/frontend/src/domains/sandbox/actions/queue-move.ts

interface QueueMoveDeps {
  board: BoardState | null;
  selectedTile: Coord | null;
  addQueuedMove: (move: Movement) => void;
  setSelectedTile: (coord: Coord) => void;
  addTileQueuedDirection: (coord: Coord, direction: Direction) => void;
  sendMoveRequest: (source: Coord, direction: Direction) => void;
}

// Internal: takes dependencies as parameters
function _queueMove(direction: Direction, deps: QueueMoveDeps): void {
  const { board, selectedTile } = deps;
  if (!board || !selectedTile) return;
  if (!Board.canMove(board, selectedTile, direction)) return;

  deps.addQueuedMove({ sourceCoord: selectedTile, direction });
  deps.addTileQueuedDirection(selectedTile, direction);
  deps.setSelectedTile(Board.applyDirection(selectedTile, direction));
  deps.sendMoveRequest(selectedTile, direction);
}

// Exported: collects state, calls internal
function queueMove(direction: Direction): void {
  const { board, selectedTile, actions } = useBoardSessionStore.getState();

  _queueMove(direction, {
    board,
    selectedTile,
    addQueuedMove: actions.addQueuedMove,
    setSelectedTile: actions.setSelectedTile,
    addTileQueuedDirection: (coord, dir) =>
      getTileStore(coord).getState().addQueuedDirection(dir),
    sendMoveRequest: sandboxWsEffects.sendMoveRequest,
  });
}

export { queueMove };
```

Optimistic updates provide immediate UI feedback. Server `state-update` will reconcile if needed.

**Apply this pattern to all sandbox actions:**
- `actions/start-sandbox.ts`
- `actions/queue-move.ts`
- `actions/undo-move.ts`
- `actions/clear-moves.ts`
- `actions/play.ts`
- `actions/pause.ts`
- `actions/step-forward.ts`
- `actions/step-back.ts`
- `actions/reset.ts`

**Note:** This is a new pattern being introduced with sandbox. If it proves valuable, consider migrating existing gameplay/puzzle actions to follow it.

### 7. SandboxTile (Frontend)

Unified tile component using BoardSessionStore. Template for future unified Tile.

```typescript
// apps/frontend/src/domains/sandbox/ui/sandbox-tile.tsx
// Uses BoardSessionStore instead of GameplayStoreV2 or PuzzleStore
// Otherwise same structure as GameTile/PuzzleTile

function SandboxTile({ coord }: { coord: Coord }) {
  const square = useTileSquare(coord);
  const queuedDirections = useTileQueuedDirections(coord);

  // These use BoardSessionStore
  const isSelected = useBoardSessionStore(selectIsTileSelected(coord));
  const isVisible = useBoardSessionStore(selectIsVisible(coord));
  const isEnded = useBoardSessionStore(state => state.isEnded);
  // ... etc

  return <TileRenderer {...props} />;
}
```

---

## Protocol Messages

### Client → Server

```typescript
// packages/protocol/domains/sandbox/client-messages.ts

'sandbox:start-session': {}
// Response: sandbox:session-started

'sandbox:play': {}
'sandbox:pause': {}
'sandbox:step-forward': {}
'sandbox:step-back': {}
'sandbox:rewind': { targetTick: number }
'sandbox:reset': {}

'sandbox:move-request': { sourceCoord: Coord, direction: Direction }
'sandbox:undo-move': {}
'sandbox:cancel-moves': {}

'sandbox:end-session': {}  // explicit cleanup (optional, sessions also timeout)
```

### Server → Client

```typescript
// packages/protocol/domains/sandbox/server-messages.ts

'sandbox:session-started': {
  board: BoardState,
  config: SandboxConfig,
}

'sandbox:state-update': {
  tick: number,
  board: BoardState,
  moveQueue: Movement[],
  isPaused: boolean,
}

'sandbox:error': {
  message: string,
  code?: string,  // e.g., 'INVALID_TICK', 'SESSION_NOT_FOUND'
}
```

---

## Implementation Order

### Phase 1: Core Infrastructure
1. `MoveQueueEngine` in @core
2. `BoardSessionStore` in frontend
3. Protocol messages for sandbox

### Phase 2: Backend Sandbox
4. `SandboxManager` (uses MoveQueueEngine)
5. `SandboxService`
6. Handlers, actions, ws-effects

### Phase 3: Frontend Sandbox
7. `SandboxMetaStore`
8. `SandboxTile` (uses BoardSessionStore)
9. Sandbox actions (start, playback controls, queue move)
10. Handlers, ws-effects
11. `SandboxControlBar` component
12. `SandboxPage`

### Phase 4: Polish
13. Keyboard shortcuts for playback controls
14. Testing & bug fixes

### Future Work (Not v1)
- Extract `TimelineManager` and integrate with replay
- Migrate gameplay to BoardSessionStore + MoveQueueEngine
- Migrate puzzles to BoardSessionStore + MoveQueueEngine
- Unify Tile component across all modes
- Multi-player sandbox control
- Sandbox session persistence

---

## Extension Points (TODOs to Leave in Code)

```typescript
// In SandboxManager
// TODO: Support multiple players (playerIndex parameter for queueMove)
// TODO: Variable tick speed (configurable interval)

// In MoveQueueEngine
// TODO: Grace logic - skip invalid moves, try next in queue

// In SandboxService
// TODO: Multiple sessions per user
// TODO: Session persistence (save/load)

// In SandboxTile
// TODO: This is the "unified" tile - migrate GameTile/PuzzleTile to use BoardSessionStore

// In BoardSessionStore
// TODO: Gameplay and Puzzles should migrate to use this store
```

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Where does rewind state live? | Backend (SandboxManager stores checkpoints) |
| What happens to queue on rewind? | Clear it |
| When to migrate existing modes? | After sandbox proves the pattern |
| Where does MoveQueueEngine live? | @core (queue rules are game rules) |
| Where does TimelineManager live? | domains/games/lib/ |
| How does sandbox session start? | Auto-start on page load |
| History storage strategy? | Checkpoint every 25 ticks (bounded memory) |
| Optimistic queue updates? | Yes, match existing gameplay/puzzle UX |
| Single or multi-player? | Single player, no opponent for v1 |
| Step-forward behavior? | Processes queued move (consistent with normal tick) |
| Initial map config? | Hardcoded defaults; no URL params for v1 |
| Disconnect cleanup? | Known limitation; document TODO for idle timeout |

---

## Related Documents

- `dev-notes/2026-01/1-20-[1]-gameplay-puzzles-unification-options.md` - Original analysis
- `dev-notes/2025-09/9-12-sandbox-ui-design-brainstorm.md` - Earlier brainstorm
- `docs/architecture.md` - System architecture
