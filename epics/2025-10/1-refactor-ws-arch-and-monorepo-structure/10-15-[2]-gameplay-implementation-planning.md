# Gameplay Implementation Planning

**Date:** 2025-10-15
**Status:** Planning
**Session:** Scaffolding gameplay domain in v2 architecture (Phase 1)

## Purpose

Plan and execute the implementation of the gameplay domain within the v2 architecture, following the established patterns from chat and matchmaking domains. This is the third and final major domain implementation in Phase 1.

## Session Goals

1. Review existing v1 gameplay implementation for feature parity
2. Confirm protocol message types are complete and match v1 functionality
3. Scaffold backend and frontend domain structure (handlers, actions, ws-effects)
4. Document v1 behavior in stubbed actions with TODOs
5. Mark completion of Phase 1 domain scaffolding

## Protocol Review

### ✅ Protocol Types (Already Defined)

**Client → Server (`packages/protocol/domains/gameplay/client-messages.ts`):**
- `gameplay:join-room` - Player enters gameplay room (`{ room: string }`)
- `gameplay:leave-room` - Player exits gameplay room (`{ room: string }`)
- `gameplay:move-request` - Queue a move (`{ sourceCoord: Coord, direction: Direction }`)
- `gameplay:cancel-moves` - Clear all queued moves (empty payload)
- `gameplay:undo-move` - Pop last queued move (`{ gameId: number }`)

**Server → Client (`packages/protocol/domains/gameplay/server-messages.ts`):**
- `gameplay:state-update` - Board state + queues (`{ tick, boardState, playerQueues? }`)
- `gameplay:game-starting` - Countdown notification (`{ gameId, countdown }`)
- `gameplay:game-started` - Game begins (`{ gameId, playerMapping, boardState, game }`)
- `gameplay:game-ended` - Game over (`{ winner, finalBoardState }`)

**Protocol Status:** ✅ Complete - All message types defined with MsgCreators

## V1 Implementation Summary

### Backend Architecture (`/backend/src/gameplay/`)

**GameCoordinator** (singleton, manages all active games):
- Maintains registry of active GameServer instances
- Runs global tick loop at TICK_RATE_MS intervals (~10x/sec)
- Processes all games each tick, detects when games end
- Lifecycle: initialization → countdown → active play → end

**GameServer** (per-game instance):
- Manages game state, move queues (max 200/player), player mappings
- Tick processing: execute queued moves → update board → detect defeats → broadcast state
- Broadcasts state updates to game room every tick
- Flushes move history to DB periodically
- Detects game end (general captured) and triggers cleanup

**GamePlayWsApi** (message router):
- Routes incoming client messages to appropriate handlers/actions
- Coordinates with GameCoordinator to access game instances

**Key Operations:**
1. **Join Game Room** → `onPlayerJoinedRoom()` → triggers countdown if enough players
2. **Queue Move** → `queueMove()` → validated & added to player's queue (max 200) → processed next tick
3. **Cancel/Undo Moves** → `clearMoves()` or `undoMove()` → modify queue immediately
4. **Countdown** → Broadcast `game-starting` each second until game begins
5. **Game Start** → Update DB status to IN_PROGRESS → broadcast `game-started` with player mapping
6. **Tick Processing** → Execute moves → update board → detect defeats → broadcast `state-update`
7. **Game End** → Detect general capture → save to DB (COMPLETE) → broadcast `game-ended` → cleanup

### Frontend Architecture (`/frontend/src/game-ui/`)

**gameplay-store-v2.ts** (Zustand store):
- Board state, tick counter, winner, queued moves
- Selected tile, fog of war calculations
- Actions: setGameState, queueMove, undoMove, clearMoves, resetGame

**gameplay-ws-handler.ts**:
- Handles incoming server messages
- Updates store with state-update, game-started, game-ended
- Manages countdown display during game-starting

**Move Queuing:**
- Frontend maintains local queue of moves (optimistic updates)
- Server validates and processes moves
- Queue sync: server sends back player queues in state-update

## V2 Target Structure

### Backend (`apps/backend/src/domains/gameplay/`)
```
gameplay/
├── handlers.ts        # Route 5 client messages to actions
├── actions.ts         # Business logic (stubbed with detailed TODOs)
├── ws-effects.ts      # Broadcast functions (mocked wsBridge)
└── types.ts           # Domain types (if needed)
```

### Frontend (`apps/frontend/src/domains/gameplay/`)
```
gameplay/
├── handlers.ts        # Route 4 server messages to actions
└── actions.ts         # Bidirectional (send messages + handle responses)
```

## Key Decisions

### ✅ Room Identifier Pattern
**Decision:** Use room identifier from client message payload.
- Client sends `{ room: string }` with join-room/leave-room messages
- This is the game room ID (e.g., `game-123`)
- Different from matchmaking which uses constant `MATCHMAKING_ROOM_ID`
- System domain actions will receive this room ID dynamically

### ✅ System Domain Integration
**Decision:** Call existing system domain stubs for room membership.
- Backend: `systemActions.joinRoom(roomId, ctx)` / `leaveRoom(roomId, ctx)`
- Frontend: Similar pattern (thin stubs)
- System domain already has stubs from matchmaking implementation

### ✅ Actions File Structure
**Decision:** Use single `actions.ts` file per side (BE/FE).
- Simpler than chat's subdirectory approach
- Follows matchmaking pattern
- Can split later if file grows too large

### ✅ GameCoordinator Integration
**Decision:** Don't import or touch v1 GameCoordinator/GameServer yet.
- Keep actions stubbed with TODOs explaining v1 behavior
- Migration happens in Phase 3+ when unstubbing
- Document where v1 GameCoordinator is called in TODOs

### ✅ Move Queue Validation
**Decision:** Document v1 validation logic in action TODOs.
- Max 200 moves per player
- Defeated players can't queue moves
- Invalid coordinates rejected
- Don't implement validation in Phase 1 stubs

### ✅ State Broadcasting Pattern
**Decision:** Create ws-effects for all server-initiated broadcasts.
- `broadcastGameState(roomId, tick, boardState, playerQueues?)` - Called every tick
- `broadcastGameStarting(roomId, gameId, countdown)` - Countdown notifications
- `broadcastGameStarted(roomId, gameId, playerMapping, boardState, game)` - Game begin
- `broadcastGameEnded(roomId, winner, finalBoardState)` - Game over
- All use mocked wsBridge for now

## Implementation Plan

### 1. Backend Scaffolding

**File:** `apps/backend/src/domains/gameplay/handlers.ts`
- 5 message handlers (thin routing to actions)
- Pattern: Extract payload → call action
- Use `satisfies HandlerMapWithCtx<GameplayClientMessage, HandlerContext>`

**File:** `apps/backend/src/domains/gameplay/actions.ts`
- 5 action functions (stubbed with detailed TODOs):
  - `joinRoom(room: string, ctx: HandlerContext)` - Call systemActions.joinRoom, document v1 onPlayerJoinedRoom behavior
  - `leaveRoom(room: string, ctx: HandlerContext)` - Document v1 leave logic, call systemActions.leaveRoom
  - `queueMove(sourceCoord: Coord, direction: Direction, ctx: HandlerContext)` - Document v1 queueMove with validation
  - `cancelMoves(ctx: HandlerContext)` - Document v1 clearMoves logic
  - `undoMove(gameId: number, ctx: HandlerContext)` - Document v1 undoMove logic

**File:** `apps/backend/src/domains/gameplay/ws-effects.ts`
- 4 broadcast functions using mocked wsBridge:
  - `broadcastGameState(roomId, tick, boardState, playerQueues?)`
  - `broadcastGameStarting(roomId, gameId, countdown)`
  - `broadcastGameStarted(roomId, gameId, playerMapping, boardState, game)`
  - `broadcastGameEnded(roomId, winner, finalBoardState)`
- Import MsgCreators from `@protocol/domains/gameplay/server-messages`
- Mock: `const wsBridge: any = {};`

**File:** `apps/backend/src/domains/gameplay/types.ts` (optional)
- Only create if domain-specific types needed beyond protocol types
- May not be necessary if we can use @core types and protocol types

### 2. Frontend Scaffolding

**File:** `apps/frontend/src/domains/gameplay/handlers.ts`
- 4 message handlers (thin routing to actions)
- Pattern: Extract payload → call action
- Use `satisfies HandlerMap<GameplayServerMessage>`

**File:** `apps/frontend/src/domains/gameplay/actions.ts`
- Bidirectional actions (stubbed):
  - **Outbound (send messages):**
    - `sendJoinRoom(room: string)` - Send join-room message
    - `sendLeaveRoom(room: string)` - Send leave-room message
    - `sendMoveRequest(sourceCoord: Coord, direction: Direction)` - Send move-request
    - `sendCancelMoves()` - Send cancel-moves message
    - `sendUndoMove(gameId: number)` - Send undo-move message
  - **Inbound (handle server messages):**
    - `handleGameState(payload)` - TODO: update store with state-update
    - `handleGameStarting(payload)` - TODO: display countdown, prepare game UI
    - `handleGameStarted(payload)` - TODO: initialize game, set player mapping, update store
    - `handleGameEnded(payload)` - TODO: display winner, update store, handle navigation

### 3. Pattern Reference

**Backend Handler Pattern:**
```ts
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';
import type { HandlerContext } from '@/ws/types';
import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    gameplayActions.queueMove(sourceCoord, direction, ctx);
  },
  // ... 4 more handlers
} satisfies HandlerMapWithCtx<GameplayClientMessage, HandlerContext>;

export { gameplayHandlers };
```

**Backend Action Pattern (with system domain integration):**
```ts
import type { HandlerContext } from '@/ws/types';
import type { Coord, Direction } from '@core/types';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';
import { systemActions } from '@/domains/system/actions';

const gameplayActions = {
  joinRoom(room: string, ctx: HandlerContext) {
    // Join game room for broadcasts
    systemActions.joinRoom(room, ctx);

    // TODO: [GAMEPLAY] Implement join room logic
    // - Called when player enters game room
    // - V1: GameServer.onPlayerJoinedRoom()
    // - Check if game has enough players to start countdown
    // - If yes, start countdown timer (broadcast game-starting every second)
    // - Track connected players in game instance
  },

  queueMove(sourceCoord: Coord, direction: Direction, ctx: HandlerContext) {
    // TODO: [GAMEPLAY] Implement move queueing logic
    // - V1: GameServer.queueMove()
    // - Validate: player is in game, not defeated, valid coordinates
    // - Check queue size < 200 (max per player)
    // - Add move to player's queue
    // - Move will be processed on next tick
    // - No immediate broadcast (wait for tick processing)
  },

  // ... more actions
};

export { gameplayActions };
```

**Backend WS-Effects Pattern:**
```ts
import { MsgCreators } from '@protocol/domains/gameplay/server-messages';
import type { BoardState, PlayerIndex, PlayerMapping } from '@core/types';
import type { PlayerQueuesMap } from '@common/types/gameplay';
import type { GameWithPlayers } from '@common/types/games';

const wsBridge: any = {}; // mocked until Phase 2

const gameplayWsEffects = {
  broadcastGameState(
    roomId: string,
    tick: number,
    boardState: BoardState,
    playerQueues?: PlayerQueuesMap,
  ) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createStateUpdateMessage(tick, boardState, playerQueues),
    );
  },

  broadcastGameStarting(roomId: string, gameId: number, countdown: number) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createGameStartingMessage(gameId, countdown),
    );
  },

  // ... more broadcast functions
};

export { gameplayWsEffects };
```

**Frontend Handler Pattern:**
```ts
import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';
import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:state-update': (payload) => {
    gameplayActions.handleGameState(payload);
  },
  // ... 3 more handlers
} satisfies HandlerMap<GameplayServerMessage>;

export { gameplayHandlers };
```

**Frontend Action Pattern:**
```ts
import { MsgCreators as ClientMsgCreators } from '@protocol/domains/gameplay/client-messages';
import type { Coord, Direction } from '@core/types';
// TODO: Import ws client when available

const gameplayActions = {
  // Outbound (send messages)
  sendMoveRequest(sourceCoord: Coord, direction: Direction) {
    // TODO: [GAMEPLAY-FE] Send move-request message via ws client
    // const msg = ClientMsgCreators.createMoveRequestMessage(sourceCoord, direction);
    // wsClient.send(msg);
  },

  // Inbound (handle server messages)
  handleGameState(payload: { tick: number; boardState: BoardState; playerQueues?: PlayerQueuesMap }) {
    // TODO: [GAMEPLAY-FE] Update store with game state
    // - Update board state in store
    // - Update tick counter
    // - Update player move queues for UI display
    // - Trigger fog of war recalculation
    // - V1: gameplay-store-v2 setGameState action
  },

  // ... more actions
};

export { gameplayActions };
```

## V1 Behavior Documentation (For Action TODOs)

### Backend Action Details

**joinRoom(room, ctx):**
- V1: `GameServer.onPlayerJoinedRoom(userId)`
- Track player connection in game instance
- Check if enough players connected to start countdown
- If yes: Start countdown timer, broadcast `game-starting` every second (5 → 4 → 3 → 2 → 1)
- When countdown reaches 0: Initialize game, update DB status to IN_PROGRESS, broadcast `game-started`

**leaveRoom(room, ctx):**
- V1: `GameServer.onPlayerLeftRoom(userId)`
- Mark player as disconnected (but not defeated)
- Handle reconnection logic
- If game not started and player leaves, may need to cancel countdown
- Clear player's move queue

**queueMove(sourceCoord, direction, ctx):**
- V1: `GameServer.queueMove(userId, sourceCoord, direction)`
- Validations:
  - Player is in game and not defeated
  - Source coordinate is valid and owned by player
  - Player's queue size < 200 (MAX_MOVE_QUEUE_SIZE)
- Add move to player's queue: `{ sourceCoord, direction, timestamp }`
- No immediate broadcast - moves processed on next tick
- Return early if validation fails (log error)

**cancelMoves(ctx):**
- V1: `GameServer.clearMoves(userId)`
- Clear all queued moves for the player
- No validation needed (always safe to clear own moves)
- No immediate broadcast - reflected in next state-update

**undoMove(gameId, ctx):**
- V1: `GameServer.undoMove(userId, gameId)`
- Pop last move from player's queue (LIFO)
- If queue empty, do nothing
- gameId used for validation (ensure player is in correct game)
- No immediate broadcast - reflected in next state-update

### Tick Processing (GameCoordinator)

**Global Tick Loop** (runs every TICK_RATE_MS ~100ms):
1. For each active game: `gameServer.processTick()`
2. Process all player move queues (execute first move in each queue)
3. Update board state (army movement, combat resolution)
4. Detect defeated players (general captured)
5. Check for game end condition (only one general remaining)
6. Broadcast `state-update` to game room
7. If game ended: broadcast `game-ended`, save to DB, cleanup instance

### Frontend Action Details

**sendJoinRoom(room):**
- Create and send join-room message via ws client
- Room ID typically comes from URL params or matchmaking

**sendLeaveRoom(room):**
- Create and send leave-room message via ws client
- Called when player navigates away or disconnects

**sendMoveRequest(sourceCoord, direction):**
- Create and send move-request message via ws client
- Called from game UI when player clicks/drags to move armies
- Optimistic update: add to local queue immediately, wait for server confirmation

**sendCancelMoves():**
- Create and send cancel-moves message via ws client
- Called when player clicks "Clear Moves" button
- Optimistic update: clear local queue immediately

**sendUndoMove(gameId):**
- Create and send undo-move message via ws client
- Called when player presses undo hotkey (e.g., 'Z')
- Optimistic update: pop from local queue immediately

**handleGameState(payload):**
- Update store with new board state, tick, player queues
- Trigger fog of war recalculation based on player's vision
- Update UI to show current state
- V1: gameplay-store-v2.setGameState()

**handleGameStarting(payload):**
- Display countdown overlay (5... 4... 3... 2... 1...)
- Prepare game UI (show board, controls)
- Store gameId for future messages

**handleGameStarted(payload):**
- Initialize game in store
- Set player mapping (which player index is current user)
- Set initial board state
- Display game UI, hide countdown
- Store game metadata for UI display
- V1: gameplay-store-v2.resetGame() + setGameState()

**handleGameEnded(payload):**
- Display winner announcement (YOU WIN / YOU LOSE)
- Show final board state
- Disable game controls
- Handle navigation (stay on page, offer rematch, return to lobby?)
- V1: gameplay-store-v2 update winner field

## Integration Points

### System Domain Dependencies
- Room membership management (join/leave game rooms)
- System domain stubs already exist from matchmaking implementation
- Backend: `systemActions.joinRoom/leaveRoom`
- Frontend: Similar pattern

### V1 Code Dependencies (Don't Touch Yet)

**Backend:**
- GameCoordinator (singleton tick loop, game registry)
- GameServer (per-game instance, move processing, state management)
- createGame function (database operations)
- Move validation logic
- Board state update logic (army movement, combat)
- Defeat detection logic
- Game end detection logic

**Frontend:**
- gameplay-store-v2 (Zustand store)
- gameplay-ws-handler (current message handling)
- Game UI components (board, controls, move queue display)
- Fog of war calculations
- Navigation logic (game-ended → where to go?)

### Protocol Type Dependencies (Already Satisfied)
- `@core/types` - Coord, Direction, BoardState, PlayerIndex, PlayerMapping
- `@common/types/gameplay` - PlayerQueuesMap
- `@common/types/games` - GameWithPlayers

## Follow-Up Tasks (For Later Phases)

**Phase 2 (WS Infrastructure):**
- [ ] Wire gameplay handlers into main message router
- [ ] Connect mocked wsBridge to real WebSocket implementation
- [ ] Test message flow end-to-end

**Phase 3+ (Business Logic Migration):**
- [ ] Migrate GameCoordinator tick loop into v2 backend
- [ ] Migrate GameServer logic into v2 backend actions
- [ ] Implement move validation and queue management
- [ ] Implement board state update logic (moves, combat)
- [ ] Implement defeat detection and game end logic
- [ ] Unstub frontend actions with store integration
- [ ] Integrate with existing gameplay-store-v2 or create new v2 store
- [ ] Implement countdown UI logic
- [ ] Implement game-ended navigation logic
- [ ] Test full gameplay loop end-to-end

**Phase 4+ (Refinements):**
- [ ] Add forfeit/surrender functionality
- [ ] Add timeout/inactivity detection
- [ ] Optimize tick rate and state broadcasting
- [ ] Add move history replay functionality
- [ ] Performance testing under load

## Open Questions (Defer to Later)

1. **Store Integration** - Use existing gameplay-store-v2 or create new v2 store?
2. **Navigation After Game End** - Where should player go? Stay on page? Return to lobby?
3. **Reconnection Handling** - How to handle disconnect/reconnect during active game?
4. **Move Queue Optimization** - Should we batch moves or send one at a time?
5. **Fog of War** - Keep in frontend store or move to backend? (affects protocol)
6. **Error Handling** - How to communicate move validation errors to client?

## Success Criteria

**Phase 1 Complete When:**
- [x] Protocol messages defined (already done)
- [ ] Backend handlers.ts created and routes all 5 message types
- [ ] Backend actions.ts created with stubbed functions and detailed TODOs
- [ ] Backend ws-effects.ts created with 4 broadcast functions
- [ ] Frontend handlers.ts created and routes all 4 message types
- [ ] Frontend actions.ts created with bidirectional stubs
- [ ] All files follow established conventions (imports, exports, types)
- [ ] All TODOs reference v1 behavior and file locations

## References

- [Strategy & Tracker](./[STRATEGY-AND-TRACKER].md)
- [Workflow Guide](./[WORKFLOW-WIP].md)
- [Matchmaking Planning](./10-15-[1]-matchmaking-implementation-planning.md) - Reference for patterns
- [Folder Structure](../../../dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md)
- [WebSocket Architecture](../../../dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md)
- V1 Backend Gameplay: `/backend/src/gameplay/`
- V1 Frontend Gameplay: `/frontend/src/game-ui/`
- V2 Protocol: `/packages/protocol/domains/gameplay/`
- Reference Patterns: `/apps/backend/src/domains/matchmaking/`
