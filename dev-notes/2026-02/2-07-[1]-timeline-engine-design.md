# TimelineEngine Design

Date: 2026-02-07
Status: Implemented and tested in `@core/timeline/`. Not yet integrated into sandbox.

## Context

The sandbox needed move history + rewind that actually works. Designing this led to extracting a `TimelineEngine` abstraction that owns game state + history + checkpoints.

This same abstraction should eventually be shared by: sandbox, replay viewer, puzzles, and gameplay. It also enables a future "edit replay" feature (branch from a replay's history, try different moves).

## Naming Decisions

"Session" = a user's active interaction with a game board (sandbox, puzzle, gameplay, replay).
Already established on frontend via `BoardSessionStore`.

| Concept | New name | Old name | Lives in |
|---------|----------|----------|----------|
| Core timeline logic | `TimelineEngine` | (new) | `@core/timeline/` |
| Sandbox orchestrator | `SandboxSession` | `SandboxManager` | backend |
| Puzzle orchestrator | `PuzzleSession` | `PuzzleManager` | backend |
| Gameplay orchestrator | `GameSession` | `GameServer` | backend |
| Multi-game registry | `GameSessionRegistry` | `GameCoordinator` | backend |
| Pending move queue | `MoveQueue` | `MoveQueueEngine` | `@core` |

NOTE: "TimelineEngine" name is provisional — revisit after usage settles.
NOTE: Rename MoveQueueEngine → MoveQueue (drop "Engine" for simple building blocks).
NOTE: Renames are not done yet — do them as part of integration work.

## Architecture Layering

```
Building blocks (simple data structures, @core):
  MoveQueue        — pending moves (what's about to happen)
  (move history is internal to TimelineEngine)

Composite logic (@core):
  TimelineEngine   — game state + history + checkpoints + replay

Session orchestration (backend):
  SandboxSession   — timer, move queue, WS broadcasting, user commands
  PuzzleSession    — (future: adopt TimelineEngine)
  GameSession      — (future: adopt TimelineEngine, per-player queues)

Session registry (backend, gameplay only):
  GameSessionRegistry — holds active GameSessions, maps users → games, global tick loop
```

NOTE: Reconsider whether MoveQueue should live inside TimelineEngine after integrating across all domains (replay, puzzle, gameplay). Keeping it separate for now because gameplay has per-player queues managed by GameSession.

## TimelineEngine — Implemented API

### MoveInput / MoveEvent Relationship

```ts
// What callers pass to tick() — no step field
interface MoveInput {
  playerIndex: number;
  sourceCoord: Coord;
  direction: Direction;
}

// What gets recorded in history — engine assigns step
interface MoveEvent extends MoveInput {
  step: number;
}
```

Key decision: the engine owns step/tick numbering. Callers just provide move data.
NOTE: `MoveEvent` in `@core/replay/types.ts` hasn't been updated to extend `MoveInput` yet — the `MoveInput` type currently lives only in `timeline-engine.ts`. Unifying these types is a follow-up.

### Class Interface

```ts
class TimelineEngine {
  constructor(
    initialState: GameState,
    timing: TimingConfig,
    config?: Partial<{ checkpointInterval: number }>,  // default: 25
  )

  tick(moves: MoveInput[]): ProcessStepResult
  jumpToTick(target: number): void   // throws if out of [0, maxTick]
  reset(): void

  getState(): Readonly<GameState>    // live reference, see caveat below
  getMaxTick(): number
  getCurrentTick(): number
}
```

### ProcessStepResult (now exported from step-processor.ts)

```ts
interface ProcessStepResult {
  appliedEvents: MoveEvent[];
  gameEvents: GameEvent[];
  gameEnded: boolean;
  winnerPlayerIndex?: number;
}
```

### deepCloneGameState

Consolidated into `@core/timeline/timeline-engine.ts` as single source of truth. Exported.
Previously duplicated in: sandbox-manager.ts, jump-to-step.ts (replay), replayer.ts.
Follow-up: delete the duplicates and import from `@core/timeline`.

## Internal Mechanics

### Move History
- `(MoveEvent[] | null)[]` — dense array indexed by tick (index = tick - 1)
- `null` entries for ticks with no applied moves
- Array per tick supports multiplayer (multiple moves in one tick)
- Truncation via `.length` — O(1) for branching
- Only `processStep().appliedEvents` are recorded (validated moves)

### Checkpoints
- `Map<number, GameState>` — deep clones at intervals
- Saved every `checkpointInterval` ticks (default 25)
- Tick-0 checkpoint always exists
- Used by `jumpToTick` to avoid replaying from tick 0
- Still uses Map (truly sparse — every N ticks). Truncation iterates at most maxTick/N entries.

### Branching
- When `tick()` is called and `currentTick < maxTick`:
  - `moveHistory.length = currentTick` (truncates future history)
  - Delete checkpoints > currentTick
  - Reset maxTick to currentTick
- Then proceed with normal tick
- Old branches are discarded (no branch history for now)

### Replay (internal, used by jumpToTick)
- Find nearest checkpoint at or before target
- Clone that checkpoint's state
- For each tick from checkpoint to target: look up from history, call processStep
- No checkpoint saving during replay
- NOTE: future optimization — for forward jumps (target > currentTick), could replay from current state instead of finding a checkpoint. Deferred; checkpoint interval bounds worst case to ~25 ticks.

### getState() Caveat
`Readonly<GameState>` is zero-cost type safety but doesn't protect against stale references. If the caller holds a ref across ticks, the underlying object has been mutated by processStep. Current usage is all inline reads (broadcast, validation) so this is fine. If bugs from stale refs, consider adding `snapshotState()` that clones.

## SandboxSession Integration (Not Yet Done)

```ts
class SandboxSession {
  private timeline: TimelineEngine;
  private moveQueue: MoveQueueEngine;  // rename to MoveQueue later
  private tickTimer: NodeJS.Timeout | null;
  private isPaused: boolean;

  play()            — start interval, each tick calls doTick() + broadcast
  pause()           — clear interval
  stepForward()     — doTick() + broadcast
  stepBack()        — timeline.jumpToTick(current - 1), clear queue, broadcast
  jumpToTick(n)     — timeline.jumpToTick(n), clear queue, broadcast
  queueMove(s, d)   — moveQueue.queueMove(s, d, board), broadcast
  reset()           — pause, timeline.reset(), clear queue, broadcast

  doTick()          — shift from queue, build MoveInput[], timeline.tick(moves)
  broadcastState()  — read timeline.getState() + getMaxTick(), serialize + send
}
```

Key: pending move queue is cleared on any jump. The queue was built against a specific game state; jumping changes that state.

## Protocol / Frontend Changes (Not Yet Done)

`sandbox:state-update` needs a new field:
```ts
{
  tick: number;
  maxTickReached: number;    // NEW
  board: BoardState;
  moveQueue: Movement[];
  isPaused: boolean;
}
```

Frontend control bar shows: `tick / maxTickReached`

Frontend `SandboxMetaStore` already has `maxTickReached` field + `updateMaxTick` action + `selectMaxTickReached` selector (added but not yet wired up).

## Replay Viewer — Current State and Comparison

The replay viewer's frontend `jumpToStep` uses the same checkpoint + replay-forward algorithm as TimelineEngine. Key differences:
- Replay is **read-only** (pre-loaded history from DB, no branching)
- Replay has an **LRU frame cache** (100 entries) on top of checkpoints — rendering optimization
- Replay runs entirely **client-side**; sandbox runs server-side
- Replay has no `TimelineEngine` — logic is split across Zustand store + actions
- The core `replayFrames` generator in `@core/replay/replayer.ts` is only used by a backend verification script, not the frontend

## Future Work

### Replay Viewer Integration
- Replace `jumpToStep` logic with `TimelineEngine`
- Add `loadHistory(events: MoveEvent[])` method to TimelineEngine
- Delete duplicated `deepCloneGameState` from replay actions

### "Edit Replay" Feature
- Load a completed game's replay into TimelineEngine via `loadHistory`
- User jumps to a tick, queues new moves, calls `tick()` — branching kicks in
- Need to preserve original history so user can revert to it (future: branch tracking)

### Puzzle / Gameplay Integration
- Puzzles: straightforward, single player, similar to sandbox
- Gameplay: per-player queues, multiple MoveEvents per tick. `tick()` accepts `MoveInput[]` so this works naturally. Complexity is in the GameSession orchestration layer.

### Consolidation Tasks
- Rename: MoveQueueEngine → MoveQueue, SandboxManager → SandboxSession, etc.
- Unify MoveInput/MoveEvent types: move MoveInput to `@core/replay/types.ts`, have MoveEvent extend it
- Delete duplicated deepCloneGameState from other files
