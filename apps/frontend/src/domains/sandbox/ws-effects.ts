import type { Coord, Direction } from '@core/types';

import { MsgCreators } from '@protocol/domains/sandbox/client-messages';

import { wsBridge } from '@/ws';

const sandboxWsEffects = {
  sendStartSession() {
    wsBridge.send(MsgCreators.createStartSessionMessage());
  },

  sendEndSession() {
    wsBridge.send(MsgCreators.createEndSessionMessage());
  },

  sendPlay() {
    wsBridge.send(MsgCreators.createPlayMessage());
  },

  sendPause() {
    wsBridge.send(MsgCreators.createPauseMessage());
  },

  sendStepForward() {
    wsBridge.send(MsgCreators.createStepForwardMessage());
  },

  sendStepBack() {
    wsBridge.send(MsgCreators.createStepBackMessage());
  },

  sendRewind(targetTick: number) {
    wsBridge.send(MsgCreators.createRewindMessage(targetTick));
  },

  sendReset() {
    wsBridge.send(MsgCreators.createResetMessage());
  },

  sendMoveRequest(sourceCoord: Coord, direction: Direction) {
    wsBridge.send(MsgCreators.createMoveRequestMessage(sourceCoord, direction));
  },

  sendUndoMove() {
    wsBridge.send(MsgCreators.createUndoMoveMessage());
  },

  sendCancelMoves() {
    wsBridge.send(MsgCreators.createCancelMovesMessage());
  },
};

export { sandboxWsEffects };
