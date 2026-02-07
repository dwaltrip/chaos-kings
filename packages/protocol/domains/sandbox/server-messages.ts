import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

import type { BoardState, Movement, Size2d } from '@core/types';
import type { TimingConfig } from '@core/timing/types';

interface SandboxConfig {
  mapSize: Size2d;
  timing: TimingConfig;
  checkpointInterval: number;
}

type SandboxServerPayloadMap = {
  'sandbox:session-started': {
    board: BoardState;
    config: SandboxConfig;
  };

  'sandbox:state-update': {
    tick: number;
    maxTickReached: number;
    board: BoardState;
    moveQueue: Movement[];
    isPaused: boolean;
  };

  'sandbox:error': {
    message: string;
    code?: string;
  };
};

type SandboxServerMessage = MessageUnion<SandboxServerPayloadMap>;

type SessionStartedMessage = ExtractMsg<SandboxServerMessage, 'sandbox:session-started'>;
type StateUpdateMessage = ExtractMsg<SandboxServerMessage, 'sandbox:state-update'>;
type ErrorMessage = ExtractMsg<SandboxServerMessage, 'sandbox:error'>;

const MsgCreators = {
  createSessionStartedMessage: (
    board: BoardState,
    config: SandboxConfig,
  ): SessionStartedMessage => ({
    type: 'sandbox:session-started',
    payload: { board, config },
  }),

  createStateUpdateMessage: (
    tick: number,
    board: BoardState,
    moveQueue: Movement[],
    isPaused: boolean,
    maxTickReached: number,
  ): StateUpdateMessage => ({
    type: 'sandbox:state-update',
    payload: { tick, maxTickReached, board, moveQueue, isPaused },
  }),

  createErrorMessage: (message: string, code?: string): ErrorMessage => ({
    type: 'sandbox:error',
    payload: { message, code },
  }),
};

export type { SandboxServerPayloadMap, SandboxServerMessage, SandboxConfig };
export { MsgCreators };
