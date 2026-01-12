import { idToString } from '@kernel/branded-type';
import { RoomId } from '@kernel/ids';
import {
  MsgCreators,
  type BestStartResult,
} from '@protocol/domains/puzzles/server-messages';

import type { BoardState, Movement } from '@core/types';

import { wsBridge } from '@/ws/server-bridge-bootstrap';

const puzzlesWsEffects = {
  broadcastPuzzleState(
    roomId: RoomId,
    tick: number,
    board: BoardState,
    moveQueue: Movement[],
  ) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createStateUpdateMessage(tick, board, moveQueue),
    );
  },

  broadcastPuzzleEnd(roomId: RoomId, finalBoard: BoardState, result: BestStartResult) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createEndPuzzleMessage(finalBoard, result),
    );
  },
};

export { puzzlesWsEffects };
