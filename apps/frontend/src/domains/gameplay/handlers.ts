// import { GameId } from '@kernel/domains/game';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';

import type { HandlerMap } from '@/ws-lib';
import {
  updateForGameStart,
  updateForGameStarting,
  updateGameplayState,
  updateForGameEnded,
} from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:state-update': (payload) => {
    updateGameplayState(payload.tick, payload.boardState, payload.playerQueues || {});
  },

  'gameplay:game-starting': (payload) => {
    // const gameId: GameId(payload.gameId);
    updateForGameStarting(payload.countdown);
  },

  'gameplay:game-started': (payload) => {
    updateForGameStart(payload.game, payload.boardState, payload.playerMapping);
  },

  'gameplay:game-ended': (payload) => {
    updateForGameEnded(payload.finalBoardState, payload.winner);
  },
} satisfies HandlerMap<GameplayServerMessage>;

export { gameplayHandlers };
