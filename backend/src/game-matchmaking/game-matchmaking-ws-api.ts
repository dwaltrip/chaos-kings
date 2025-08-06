import { DomainAPI } from '@/websocket/api';
import {
  GameMatchmaking,
  GameMatchmakingMessageType,
  GAME_MATCHMAKING_DOMAIN
} from '@common/types/game-matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';

// -----------------------------------------------------------------------
// TODO: Message types can be client -> server and / or server -> client.
// The current architecture doens't reflect the "or" part.
// The "...MessagType" type defs should be split into two.
// -----------------------------------------------------------------------
const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingMessageType>(GAME_MATCHMAKING_DOMAIN, {
  'join-queue': async (data: GameMatchmaking.JoinQueueMessage, wsActions) => {
    if (!data.user) {
      console.error('No user data in join-queue message');
      return;
    }

    wsActions.joinRoom(MATCHMAKING_ROOM_NAME);
    
    const matchmakingService = await getMatchmakingService();
    const game = await matchmakingService.addPlayer(data.user.id, { 
      username: data.user.username 
    });
    
    if (game) {
      wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'game-ready',
        payload: { gameId: game.gameId }
      });
    }
    
    const queueStatus = await matchmakingService.getQueueStatus();
    wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
      domain: GAME_MATCHMAKING_DOMAIN,
      type: 'queue-status',
      payload: {
        queueSize: queueStatus.queueSize,
        playersNeeded: queueStatus.playersNeeded
      }
    });
  },
  'leave-queue': async (data: GameMatchmaking.LeaveQueueMessage, wsActions) => {
    if (!data.user) {
      console.error('No user data in leave-queue message');
      return;
    }

    const matchmakingService = await getMatchmakingService();
    await matchmakingService.removePlayer(data.user.id);
    
    const queueStatus = await matchmakingService.getQueueStatus();
    wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
      domain: GAME_MATCHMAKING_DOMAIN,
      type: 'queue-status',
      payload: {
        queueSize: queueStatus.queueSize,
        playersNeeded: queueStatus.playersNeeded
      }
    });
  },
  'queue-status': async (data: GameMatchmaking.QueueStatusMessage, wsActions) => {
    const matchmakingService = await getMatchmakingService();
    const queueStatus = await matchmakingService.getQueueStatus();
    
    wsActions.sendToSelf({
      domain: GAME_MATCHMAKING_DOMAIN,
      type: 'queue-status',
      payload: {
        queueSize: queueStatus.queueSize,
        playersNeeded: queueStatus.playersNeeded
      }
    });
  },
  // TODO: remove this once we fix the types.
  'game-ready': (data: GameMatchmaking.GameReadyMessage, wsActions) => {
    // NOT NEEDED! (This is sent by the server to clients when a game is ready)
    // Clients do not send this message.
    // See the TODO at the top of this file.
  },
});

export { GameMatchmakingWsAPI };
