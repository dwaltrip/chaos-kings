import { idToNumber } from '@kernel/branded-type';
import { GameId } from '@kernel/domains/game';
import { MsgCreators } from '@protocol/domains/gameplay/client-messages';
import type { Coord, Direction } from '@core/types';

import { wsBridge } from '@/ws';

const gameplayWsEffects = {
  sendMoveRequest(sourceCoord: Coord, direction: Direction) {
    wsBridge.send(MsgCreators.createMoveRequestMessage(sourceCoord, direction));
  },

  sendCancelMoves() {
    wsBridge.send(MsgCreators.createCancelMovesMessage());
  },

  sendUndoMove(gameId: GameId) {
    wsBridge.send(MsgCreators.createUndoMoveMessage(idToNumber(gameId)));
  },
};

export { gameplayWsEffects };
