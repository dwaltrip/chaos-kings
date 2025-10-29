import { UserId, GameId } from '@kernel/ids';

import { createScopedLogger } from '@/utils/scoped-logger';

const log = createScopedLogger('gameplay:user-game-mapping');

const userGameMapping: Map<UserId, GameId> = new Map();

function addUserToGame(userId: UserId, gameId: GameId): void {
  userGameMapping.set(userId, gameId);
  log.debug(`Added user ${userId} to game ${gameId}`);
}

function removeUserFromGame(userId: UserId): void {
  const gameId = userGameMapping.get(userId);
  if (gameId !== undefined) {
    userGameMapping.delete(userId);
    log.debug(`Removed user ${userId} from game ${gameId}`);
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
