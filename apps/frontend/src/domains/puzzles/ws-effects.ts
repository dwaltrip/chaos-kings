import { MsgCreators } from '@protocol/domains/puzzles/client-messages';
import type { Coord, Direction } from '@core/types';

import { wsBridge } from '@/ws';

const puzzlesWsEffects = {
  sendStartPlaying() {
    wsBridge.send(MsgCreators.createStartPlayingMessage());
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

export { puzzlesWsEffects };
