import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';

import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:state-update': (payload) => {
    gameplayActions.handleGameState(payload);
  },

  'gameplay:game-starting': (payload) => {
    gameplayActions.handleGameStarting(payload);
  },

  'gameplay:game-started': (payload) => {
    gameplayActions.handleGameStarted(payload);
  },

  'gameplay:game-ended': (payload) => {
    gameplayActions.handleGameEnded(payload);
  },
} satisfies HandlerMap<GameplayServerMessage>;

export { gameplayHandlers };
