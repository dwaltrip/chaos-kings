import { GameId } from '@kernel/ids';

import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';

function joinGameplay(gameId: GameId) {
  gameplayWsEffects.sendJoinGame(gameId);
}

function leaveGameplay(gameId: GameId) {
  gameplayWsEffects.sendLeaveGame(gameId);
}

export { joinGameplay, leaveGameplay };
