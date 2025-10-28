import type { UserId, GameId } from '@core/db-types';

const userGameMapping: Map<UserId, number> = new Map();

function addUserToGame(userId: UserId, gameId: GameId): void {
  userGameMapping.set(userId, gameId);
  console.log(`[GameplayActions] Added user ${userId} to game ${gameId}`);
}

function removeUserFromGame(userId: UserId): void {
  const gameId = userGameMapping.get(userId);
  if (gameId) {
    userGameMapping.delete(userId);
    console.log(`[GameplayActions] Removed user ${userId} from game ${gameId}`);
  }
}

function getUserGame(userId: UserId): GameId | undefined {
  return userGameMapping.get(userId);
}

function requireUserGame(userId: UserId): GameId {
  const gameId = userGameMapping.get(userId);
  if (gameId === undefined) {
    throw new Error(`User ${userId} is not in a game`);
  }
  return gameId;
}

export { addUserToGame, removeUserFromGame, getUserGame, requireUserGame };
