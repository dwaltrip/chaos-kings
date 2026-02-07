# TimelineEngine Design Sketch

Date: 2026-02-07
Status: Design phase — not yet implemented

## Context

The sandbox needs move history + rewind that actually works. Designing this led to extracting a `TimelineEngine` abstraction that owns game state + history + checkpoints.

This same abstraction should eventually be shared by: sandbox, replay viewer, puzzles, and gameplay. It also enables a future "edit replay" feature (branch from a replay's history, try different moves).

## Naming

"Session" = a user's active interaction with a game board (sandbox, puzzle, gameplay, replay).
Already established on frontend via `BoardSessionStore`.

| Concept | Name | Lives in |
|---------|------|----------|
| Core timeline logic | `TimelineEngine` | `@core` |
| Sandbox orchestrator | `SandboxSession` (was `SandboxManager`) | backend |
| Puzzle orchestrator | `PuzzleSession` (was `PuzzleManager`) | backend |
| Gameplay orchestrator | `GameSession` (was `GameServer`) | backend |
| Multi-game registry | `GameSessionRegistry` (was `GameCoordinator`) | backend |
| Pending move queue | `MoveQueue` (was `MoveQueueEngine`) | `@core` |

NOTE: "TimelineEngine" name is provisional — revisit after implementation settles.
NOTE: Rename MoveQueueEngine → MoveQueue (drop "Engine" for simple building blocks).

## The Layering

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

## TimelineEngine Interface

```ts
class TimelineEngine {
  constructor(
    initialState: GameState,
    timing: TimingConfig,
    checkpointInterval: number,
  )

  // Advance game state by one tick. Calls processStep internally.
  // Records only applied events (processStep validates moves).
  // Handles branching automatically if current tick < maxTickReached.
  tick(events: MoveEvent[]): ProcessStepResult

  // Jump to any tick in [0, maxTickReached].
  // Works both forward and backward.
  // Finds nearest checkpoint, replays from history.
  jumpToTick(target: number): void

  // Restore initial state, clear history + checkpoints.
  reset(): void

  // Read access.
  // TODO: Readonly<GameState> is zero-cost type safety but doesn't protect
  // against stale references. If the caller holds a ref across ticks, the
  // underlying object has been mutated by processStep. Current usage is all
  // inline reads (broadcast, validation) so this is fine. If we hit bugs
  // from stale refs, consider adding a snapshotState() that clones.
  getState(): Readonly<GameState>
  getMaxTick(): number
  getCurrentTick(): number
}
```

## Internal Mechanics

### Move History
- `Map<number, MoveEvent>` — sparse, keyed by tick number
- Only ticks where a move was applied have entries
- Populated from `processStep().appliedEvents`

### Checkpoints
- `Map<number, GameState>` — deep clones at intervals
- Saved every `checkpointInterval` ticks (default 25)
- Used by `jumpToTick` to avoid replaying from tick 0

### Branching
- When `tick()` is called and `currentTick < maxTickReached`:
  - Truncate history entries > currentTick
  - Invalidate checkpoints > currentTick
  - Reset maxTickReached to currentTick
- Then proceed with normal tick
- Old branches are discarded (no branch history for now)

### Replay (internal, used by jumpToTick)
- Find nearest checkpoint at or before target
- Clone that checkpoint's state
- For each tick from checkpoint to target:
  - Look up move from history (if any)
  - Call processStep with that move
- No checkpoint saving during replay

## SandboxSession (Simplified)

```ts
class SandboxSession {
  private timeline: TimelineEngine;
  private moveQueue: MoveQueue;
  private tickTimer: NodeJS.Timeout | null;
  private isPaused: boolean;
  // + userId, roomId, config for session management

  play()            — start interval, each tick calls doTick() + broadcast
  pause()           — clear interval
  stepForward()     — doTick() + broadcast
  stepBack()        — timeline.jumpToTick(current - 1), clear queue, broadcast
  jumpToTick(n)     — timeline.jumpToTick(n), clear queue, broadcast
  queueMove(s, d)   — moveQueue.queueMove(s, d, board), broadcast
  reset()           — pause, timeline.reset(), clear queue, broadcast

  doTick()          — shift from queue, build MoveEvent, timeline.tick(events)
  buildEvents()     — Movement -> MoveEvent (adds step, playerIndex: 0)
  broadcastState()  — read timeline.getState(), serialize + send via WS
}
```

Key: pending move queue is cleared on any jump. The queue was built against a specific game state; jumping changes that state.

## What Gets Sent to Frontend

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

## Future: Replay Viewer Integration

A replay viewer would create a TimelineEngine pre-loaded with history:
```ts
const timeline = new TimelineEngine(initialState, timing, checkpointInterval);
timeline.loadHistory(savedMoveEvents);  // populate history without ticking
```

"Edit replay" = jump to a tick, then `tick()` with new moves (branches automatically).

## Future: Puzzle / Gameplay Integration

Puzzles: straightforward adoption, single player, similar to sandbox.
Gameplay: more complex — per-player queues, multiple MoveEvents per tick. But TimelineEngine.tick() already accepts MoveEvent[] so it handles this naturally.
