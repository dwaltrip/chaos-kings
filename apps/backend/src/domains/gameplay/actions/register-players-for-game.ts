import { GameId, UserId } from '@kernel/ids';

import { createScopedLogger } from '@/utils/scoped-logger';

import { addUserToGame } from './user-game-mapping';

const log = createScopedLogger('gameplay:register-players');

function registerPlayersForGame(gameId: GameId, playerUserIds: UserId[]): void {
  playerUserIds.forEach((userId) => {
    addUserToGame(userId, gameId);
  });
  log.debug(`Registered ${playerUserIds.length} players for game ${gameId}`);
}

export { registerPlayersForGame };
