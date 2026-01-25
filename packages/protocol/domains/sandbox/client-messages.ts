import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { EmptyPayload, ExtractMsg } from '@protocol/utils/type-helpers';

import type { Coord, Direction } from '@core/types';

type SandboxClientPayloadMap = {
  'sandbox:start-session': EmptyPayload;
  'sandbox:end-session': EmptyPayload;

  'sandbox:play': EmptyPayload;
  'sandbox:pause': EmptyPayload;
  'sandbox:step-forward': EmptyPayload;
  'sandbox:step-back': EmptyPayload;
  'sandbox:rewind': { targetTick: number };
  'sandbox:reset': EmptyPayload;

  'sandbox:move-request': {
    sourceCoord: Coord;
    direction: Direction;
  };
  'sandbox:undo-move': EmptyPayload;
  'sandbox:cancel-moves': EmptyPayload;
};

type SandboxClientMessage = MessageUnion<SandboxClientPayloadMap>;

type StartSessionMessage = ExtractMsg<SandboxClientMessage, 'sandbox:start-session'>;
type EndSessionMessage = ExtractMsg<SandboxClientMessage, 'sandbox:end-session'>;
type PlayMessage = ExtractMsg<SandboxClientMessage, 'sandbox:play'>;
type PauseMessage = ExtractMsg<SandboxClientMessage, 'sandbox:pause'>;
type StepForwardMessage = ExtractMsg<SandboxClientMessage, 'sandbox:step-forward'>;
type StepBackMessage = ExtractMsg<SandboxClientMessage, 'sandbox:step-back'>;
type RewindMessage = ExtractMsg<SandboxClientMessage, 'sandbox:rewind'>;
type ResetMessage = ExtractMsg<SandboxClientMessage, 'sandbox:reset'>;
type MoveRequestMessage = ExtractMsg<SandboxClientMessage, 'sandbox:move-request'>;
type UndoMoveMessage = ExtractMsg<SandboxClientMessage, 'sandbox:undo-move'>;
type CancelMovesMessage = ExtractMsg<SandboxClientMessage, 'sandbox:cancel-moves'>;

const MsgCreators = {
  createStartSessionMessage: (): StartSessionMessage => ({
    type: 'sandbox:start-session',
    payload: {},
  }),

  createEndSessionMessage: (): EndSessionMessage => ({
    type: 'sandbox:end-session',
    payload: {},
  }),

  createPlayMessage: (): PlayMessage => ({
    type: 'sandbox:play',
    payload: {},
  }),

  createPauseMessage: (): PauseMessage => ({
    type: 'sandbox:pause',
    payload: {},
  }),

  createStepForwardMessage: (): StepForwardMessage => ({
    type: 'sandbox:step-forward',
    payload: {},
  }),

  createStepBackMessage: (): StepBackMessage => ({
    type: 'sandbox:step-back',
    payload: {},
  }),

  createRewindMessage: (targetTick: number): RewindMessage => ({
    type: 'sandbox:rewind',
    payload: { targetTick },
  }),

  createResetMessage: (): ResetMessage => ({
    type: 'sandbox:reset',
    payload: {},
  }),

  createMoveRequestMessage: (
    sourceCoord: Coord,
    direction: Direction,
  ): MoveRequestMessage => ({
    type: 'sandbox:move-request',
    payload: { sourceCoord, direction },
  }),

  createUndoMoveMessage: (): UndoMoveMessage => ({
    type: 'sandbox:undo-move',
    payload: {},
  }),

  createCancelMovesMessage: (): CancelMovesMessage => ({
    type: 'sandbox:cancel-moves',
    payload: {},
  }),
} as const;

export type { SandboxClientPayloadMap, SandboxClientMessage };
export { MsgCreators };
