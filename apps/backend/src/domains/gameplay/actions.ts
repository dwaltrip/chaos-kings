import type { Coord, Direction } from '@core/types';

import type { HandlerContext } from '@/ws/types';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';
import { systemActions } from '@/domains/system/actions';

const gameplayActions = {
  joinRoom(room: string, gameId: number, ctx: HandlerContext) {
    // TODO: [SYSTEM-DOMAIN] gameplay shouldn't own join-room/leave-room messages
    // System domain should handle room membership more generically
    // Consider removing gameplay:join-room/leave-room in favor of system:join-room

    // Join game room for broadcasts
    systemActions.joinRoom(room, ctx);

    // TODO: [GAMEPLAY] Implement join room logic
    // - V1: GameServer.onPlayerJoinedRoom(userId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Track player connection in game instance
    // - Check if enough players connected to start countdown
    // - If yes: Start countdown timer, broadcast game-starting every second (5 → 4 → 3 → 2 → 1)
    // - When countdown reaches 0: Initialize game, update DB status to IN_PROGRESS, broadcast game-started
    // - Handle reconnection case (player was in game before)
  },

  leaveRoom(room: string, gameId: number, ctx: HandlerContext) {
    // TODO: [GAMEPLAY] Implement leave room logic
    // - V1: GameServer.onPlayerLeftRoom(userId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Mark player as disconnected (but not defeated - they can reconnect)
    // - If game not started and player leaves, may need to cancel countdown
    // - Clear player's move queue
    // - Don't end game yet - wait for timeout or defeat

    // Leave game room
    systemActions.leaveRoom(room, ctx);
  },

  queueMove(
    sourceCoord: Coord,
    direction: Direction,
    gameId: number,
    ctx: HandlerContext,
  ) {
    // TODO: [GAMEPLAY] Implement move queueing logic
    // - V1: GameServer.queueMove(userId, sourceCoord, direction)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Validations:
    //   - Player is in game and not defeated
    //   - Source coordinate is valid and owned by player
    //   - Player's queue size < 200 (MAX_MOVE_QUEUE_SIZE)
    // - Add move to player's queue: { sourceCoord, direction, timestamp }
    // - Move will be processed on next tick (no immediate broadcast)
    // - Return early if validation fails (log error)
    // - TODO: [V1-SUBOPTIMAL] v1 uses get-user-mapping to find game from userId
    //   This pattern is not ideal - consider better approach in v2
  },

  cancelMoves(gameId: number, ctx: HandlerContext) {
    // TODO: [GAMEPLAY] Implement cancel moves logic
    // - V1: GameServer.clearMoves(userId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Clear all queued moves for the player
    // - No validation needed (always safe to clear own moves)
    // - No immediate broadcast - reflected in next state-update
  },

  undoMove(gameId: number, ctx: HandlerContext) {
    // TODO: [GAMEPLAY] Implement undo move logic
    // - V1: GameServer.undoMove(userId, gameId)
    // - V1 file: /backend/src/gameplay/game-server.ts
    // - Pop last move from player's queue (LIFO)
    // - If queue empty, do nothing (no error)
    // - gameId used for validation (ensure player is in correct game)
    // - No immediate broadcast - reflected in next state-update
  },

  // TODO: [GAMEPLAY] Add internal helper functions as needed during unstubbing
  // Examples:
  // - startCountdown(gameId, roomId) - countdown timer management
  // - initializeGame(gameId) - game start logic
  // - validateMove(userId, gameId, sourceCoord, direction) - move validation
  // - getGameInstance(gameId) - access to GameServer instance
};

export { gameplayActions };
