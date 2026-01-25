import { UserId } from '@kernel/ids';

import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { SandboxClientMessage } from '@protocol/domains/sandbox/client-messages';

import type { ConnectionContext } from '@/ws/connection-context';
import { sandboxActions } from '@/domains/sandbox/actions';

const sandboxHandlers = {
  'sandbox:start-session': ({}, ctx) => {
    sandboxActions.startSession(UserId(ctx.userId), ctx.connectionId);
  },

  'sandbox:end-session': ({}, ctx) => {
    sandboxActions.endSession(UserId(ctx.userId));
  },

  'sandbox:play': ({}, ctx) => {
    sandboxActions.play(UserId(ctx.userId));
  },

  'sandbox:pause': ({}, ctx) => {
    sandboxActions.pause(UserId(ctx.userId));
  },

  'sandbox:step-forward': ({}, ctx) => {
    sandboxActions.stepForward(UserId(ctx.userId));
  },

  'sandbox:step-back': ({}, ctx) => {
    sandboxActions.stepBack(UserId(ctx.userId));
  },

  'sandbox:rewind': ({ targetTick }, ctx) => {
    sandboxActions.rewind(UserId(ctx.userId), targetTick);
  },

  'sandbox:reset': ({}, ctx) => {
    sandboxActions.reset(UserId(ctx.userId));
  },

  'sandbox:move-request': ({ sourceCoord, direction }, ctx) => {
    sandboxActions.queueMove(UserId(ctx.userId), sourceCoord, direction);
  },

  'sandbox:undo-move': ({}, ctx) => {
    sandboxActions.undoMove(UserId(ctx.userId));
  },

  'sandbox:cancel-moves': ({}, ctx) => {
    sandboxActions.clearMoves(UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<SandboxClientMessage, ConnectionContext>;

export { sandboxHandlers };
