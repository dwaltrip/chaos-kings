import type { HandlerContext } from '@/ws/types';
import { matchmakingWsEffects } from '@/domains/matchmaking/ws-effects';
import { systemActions } from '@/domains/system/actions';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';

const matchmakingActions = {
  joinQueue(ctx: HandlerContext) {
    // Join matchmaking room
    systemActions.joinRoom(MATCHMAKING_ROOM_ID, ctx);

    // TODO: [MATCHMAKING] Implement join queue logic
    // - Add userId to queue in Redis (FIFO sorted set)
    // - Check queue size
    // - If size >= FFA_NUM_PLAYERS_MAX (8), spawn game immediately
    // - Otherwise, broadcast updated queue status to all in room
    // - If early start votes exist and size changed, recalculate vote status

    // Stub: broadcast fake queue status
    matchmakingWsEffects.broadcastQueueStatus(0, 8);
  },

  leaveQueue(ctx: HandlerContext) {
    // TODO: [MATCHMAKING] Implement leave queue logic
    // - Remove userId from queue in Redis
    // - Reset early start votes (clear this user's vote)
    // - Check remaining queue size
    // - Broadcast updated queue status to all in room
    // - If votes exist, recalculate and broadcast vote status

    // Leave matchmaking room
    systemActions.leaveRoom(MATCHMAKING_ROOM_ID, ctx);

    // Stub: broadcast fake queue status
    matchmakingWsEffects.broadcastQueueStatus(0, 8);
  },

  earlyStartVote(vote: boolean, ctx: HandlerContext) {
    // TODO: [MATCHMAKING] Implement early start vote logic
    // - Record vote in Redis (hash: userId -> vote)
    // - Get current queue size
    // - Check if all players in queue have voted
    // - If unanimous YES and size >= 2, spawn game
    // - Otherwise, broadcast updated vote status (voters list, allVoted flag)
    // - Note: v2 improvement - don't reset votes on join (only on leave/game-creation)

    // Stub: broadcast fake vote status
    matchmakingWsEffects.broadcastEarlyStartStatus([], 0, false);
  },

  // TODO: [MATCHMAKING] Add spawnGame helper function
  // - This will be called by joinQueue and earlyStartVote when conditions are met
  // - Create game in database (call v1 createGame function)
  // - Spawn game instance (call v1 GameCoordinator)
  // - Broadcast game-ready message to all players in queue
  // - Remove players from queue
  // - Reset early start votes
};

export { matchmakingActions };
