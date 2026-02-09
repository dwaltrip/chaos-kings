import { idToString } from '@kernel/branded-type';
import { RoomId } from '@kernel/ids';

import type { BoardState, Movement } from '@core/types';

import {
  MsgCreators,
  type SandboxConfig,
} from '@protocol/domains/sandbox/server-messages';

import { wsBridge } from '@/ws/server-bridge-bootstrap';

const sandboxWsEffects = {
  broadcastSessionStarted(roomId: RoomId, board: BoardState, config: SandboxConfig) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createSessionStartedMessage(board, config),
    );
  },

  broadcastStateUpdate(
    roomId: RoomId,
    tick: number,
    board: BoardState,
    moveQueue: Movement[],
    isPaused: boolean,
    maxTickReached: number,
    lastExecutedMove: Movement | null,
  ) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createStateUpdateMessage(
        tick,
        board,
        moveQueue,
        isPaused,
        maxTickReached,
        lastExecutedMove,
      ),
    );
  },

  broadcastError(roomId: RoomId, message: string, code?: string) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createErrorMessage(message, code),
    );
  },
};

export { sandboxWsEffects };
