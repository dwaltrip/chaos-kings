import { idToNumber } from '@kernel/branded-type';
import { GameId } from '@kernel/domains/game';
import { MsgCreators } from '@protocol/domains/gameplay/client-messages';
import type { Coord, Direction } from '@core/types';

import { wsBridge } from '@/ws';

const gameplayWsEffects = {
  sendJoinGame(gameId: GameId) {
    wsBridge.send(MsgCreators.createJoinGameMessage(idToNumber(gameId)));
  },

  sendLeaveGame(gameId: GameId) {
    wsBridge.send(MsgCreators.createLeaveGameMessage(idToNumber(gameId)));
  },

  sendMoveRequest(sourceCoord: Coord, direction: Direction) {
    wsBridge.send(MsgCreators.createMoveRequestMessage(sourceCoord, direction));
  },

  sendCancelMoves() {
    wsBridge.send(MsgCreators.createCancelMovesMessage());
  },

  sendUndoMove() {
    wsBridge.send(MsgCreators.createUndoMoveMessage());
  },
};

export { gameplayWsEffects };
