import { UserId } from '@kernel/ids';

import type { Coord, Direction } from '@core/types';

import { createScopedLogger } from '@/utils/scoped-logger';
import type { ConnectionId } from '@/ws-lib';
import { systemActions } from '@/domains/system/actions';
import { roomMembershipTracker } from '@/domains/system/membership-tracker';
import { buildSandboxRoomId } from '@/domains/sandbox/utils';
import { sandboxService, type SandboxSession } from '@/domains/sandbox/sandbox-service';

// TODO: Add idle timeout (e.g., cleanup after 5 min with no activity)

const log = createScopedLogger('sandbox-actions');

function withSession(
  userId: UserId,
  actionName: string,
  run: (session: SandboxSession) => void,
): void {
  const session = sandboxService.getSession(userId);
  if (!session) {
    log.warn(`Ignoring ${actionName}: no sandbox session for user ${userId}`);
    return;
  }

  run(session);
}

function startSession(userId: UserId, connectionId: ConnectionId): void {
  const roomId = buildSandboxRoomId(userId);
  systemActions.joinRoom({ roomId, userId, connectionId });

  const session = sandboxService.createSession(userId);
  session.start();
}

function endSession(userId: UserId): void {
  sandboxService.destroySession(userId);
}

function play(userId: UserId): void {
  withSession(userId, 'play', (session) => {
    session.play();
  });
}

function pause(userId: UserId): void {
  withSession(userId, 'pause', (session) => {
    session.pause();
  });
}

function stepForward(userId: UserId): void {
  withSession(userId, 'step-forward', (session) => {
    session.stepForward();
  });
}

function stepBack(userId: UserId): void {
  withSession(userId, 'step-back', (session) => {
    session.stepBack();
  });
}

function rewind(userId: UserId, targetTick: number): void {
  withSession(userId, 'rewind', (session) => {
    session.jumpToTick(targetTick);
  });
}

function reset(userId: UserId): void {
  withSession(userId, 'reset', (session) => {
    session.reset();
  });
}

function queueMove(userId: UserId, source: Coord, direction: Direction): void {
  withSession(userId, 'move-request', (session) => {
    session.queueMove(source, direction);
  });
}

function undoMove(userId: UserId): void {
  withSession(userId, 'undo-move', (session) => {
    session.undoMove();
  });
}

function clearMoves(userId: UserId): void {
  withSession(userId, 'cancel-moves', (session) => {
    session.clearMoves();
  });
}

function handleDisconnect(userId: UserId): void {
  const roomId = buildSandboxRoomId(userId);
  const remainingMembers = roomMembershipTracker.getUserIds(roomId);

  if (remainingMembers.length === 0) {
    log.debug(
      `Cleaning up sandbox session for user ${userId} (no remaining connections)`,
    );
    sandboxService.destroySession(userId);
  }
}

const sandboxActions = {
  startSession,
  endSession,
  play,
  pause,
  stepForward,
  stepBack,
  rewind,
  reset,
  queueMove,
  undoMove,
  clearMoves,
  handleDisconnect,
};

export { sandboxActions };
