import { GameId } from '@kernel/domains/game';
import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';

import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:state-update': (payload) => {
    gameplayActions.handleGameState(payload);
  },

  'gameplay:game-starting': (payload) => {
    gameplayActions.handleGameStarting({
      gameId: GameId(payload.gameId),
      countdown: payload.countdown,
    });
  },

  'gameplay:game-started': (payload) => {
    gameplayActions.handleGameStarted({
      gameId: GameId(payload.gameId),
      playerMapping: payload.playerMapping,
      boardState: payload.boardState,
      game: payload.game,
    });
  },

  'gameplay:game-ended': (payload) => {
    gameplayActions.handleGameEnded(payload);
  },
} satisfies HandlerMap<GameplayServerMessage>;

export { gameplayHandlers };
