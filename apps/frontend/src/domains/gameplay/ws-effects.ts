import { idToNumber } from '@kernel/branded-type';
import { GameId } from '@kernel/domains/game';
import { MsgCreators } from '@protocol/domains/gameplay/client-messages';
import type { Coord, Direction } from '@core/types';

// TODO: [PHASE-2] Import wsBridge when available
// import { wsBridge } from '@/ws/bridge';
const wsBridge: any = {};

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
