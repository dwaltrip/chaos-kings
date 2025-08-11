import { DomainAPI } from '@/websocket/api';
import {
  GameMatchmaking,
  GameMatchmakingMessageType,
  GAME_MATCHMAKING_DOMAIN
} from '@common/types/game-matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getGameCoordinator } from '@/gameplay/game-coordinator';
import { addUserToGame } from '@/gameplay/gameplay-ws-api';
import { getGame } from '@/game/actions/get-game';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

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

      // Spawn game instance after 3-second delay
      setTimeout(async () => {
        try {
          await spawnGameInstance(game.gameId);
        } catch (error) {
          console.error(`Failed to spawn game instance for game ${game.gameId}:`, error);
        }
      }, 3000);
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

async function spawnGameInstance(gameId: number): Promise<void> {
  console.log(`[MatchmakingWsAPI] Spawning game instance for game ${gameId}`);
  
  // Get game data with players
  const gameData = await getGame(gameId);
  if (!gameData) {
    throw new Error(`Game ${gameId} not found when spawning instance`);
  }

  // Add game to coordinator (this creates the GameServer instance)
  const gameCoordinator = getGameCoordinator();
  gameCoordinator.addGame(gameId);

  // Set up user-game mappings for WebSocket API
  gameData.players.forEach((player) => {
    addUserToGame(player.player_id.toString(), gameId);
  });

  // Remove players from matchmaking room (they'll join gameplay room from frontend)
  const wsManager = getGlobalWebSocketManager();
  gameData.players.forEach((player) => {
    wsManager.removeUserFromRoom(player.player_id.toString(), 'matchmaking');
  });

  // Get the GameServer instance and start the game
  const gameServer = gameCoordinator.getGame(gameId);
  if (gameServer) {
    gameServer.startGame();
    console.log(`[MatchmakingWsAPI] Game ${gameId} started successfully`);
  } else {
    console.error(`[MatchmakingWsAPI] GameServer not found after adding game ${gameId}`);
  }
}

export { GameMatchmakingWsAPI };

