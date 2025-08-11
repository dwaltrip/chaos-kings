import { DomainAPI } from '@/websocket/api';
import {
  Gameplay,
  GameplayMessageType,
  GAMEPLAY_DOMAIN
} from '@common/types/gameplay';
import { getGameCoordinator } from './game-coordinator';

// TODO: We need a way to find which game a user is currently in
// For now, we'll implement a simple user -> gameId mapping
const userGameMapping: Map<string, number> = new Map();

const GameplayWsAPI = new DomainAPI<GameplayMessageType>(GAMEPLAY_DOMAIN, {
  'move-request': async (data: Gameplay.MoveRequest, wsActions) => {
    if (!data.user) {
      console.error('[GameplayWsAPI] No user data in move-request message');
      return;
    }

    const userId = data.user.id.toString();
    const gameId = userGameMapping.get(userId);
    
    if (!gameId) {
      console.log(`[GameplayWsAPI] User ${userId} not in any active game`);
      return;
    }

    const gameCoordinator = getGameCoordinator();
    const gameServer = gameCoordinator.getGame(gameId);
    
    if (!gameServer) {
      console.log(`[GameplayWsAPI] Game ${gameId} not found for user ${userId}`);
      return;
    }

    gameServer.queueMove(userId, data.payload.direction, data.payload.fromCoord);
  },

  'cancel-moves-request': async (data: Gameplay.CancelMovesRequest, wsActions) => {
    if (!data.user) {
      console.error('[GameplayWsAPI] No user data in cancel-moves-request message');
      return;
    }

    const userId = data.user.id.toString();
    const gameId = userGameMapping.get(userId);
    
    if (!gameId) {
      console.log(`[GameplayWsAPI] User ${userId} not in any active game`);
      return;
    }

    const gameCoordinator = getGameCoordinator();
    const gameServer = gameCoordinator.getGame(gameId);
    
    if (!gameServer) {
      console.log(`[GameplayWsAPI] Game ${gameId} not found for user ${userId}`);
      return;
    }

    gameServer.clearMoves(userId);
  },

  // Server -> Client messages (not handled by clients)
  'game-state-update': (data: Gameplay.GameStateUpdate, wsActions) => {
    // Clients don't send this message, only receive it
  },

  'game-started': (data: Gameplay.GameStarted, wsActions) => {
    // Clients don't send this message, only receive it
  },

  'game-ended': (data: Gameplay.GameEnded, wsActions) => {
    // Clients don't send this message, only receive it
  }
});

// Helper functions for managing user-game mappings
export function addUserToGame(userId: string, gameId: number): void {
  userGameMapping.set(userId, gameId);
  console.log(`[GameplayWsAPI] Added user ${userId} to game ${gameId}`);
}

export function removeUserFromGame(userId: string): void {
  const gameId = userGameMapping.get(userId);
  if (gameId) {
    userGameMapping.delete(userId);
    console.log(`[GameplayWsAPI] Removed user ${userId} from game ${gameId}`);
  }
}

export function getUserGame(userId: string): number | undefined {
  return userGameMapping.get(userId);
}

export { GameplayWsAPI };