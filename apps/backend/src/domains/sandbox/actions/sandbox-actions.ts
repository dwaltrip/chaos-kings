import { UserId } from '@kernel/ids';

import type { Coord, Direction } from '@core/types';

import type { ConnectionId } from '@/ws-lib';
import { systemActions } from '@/domains/system/actions';
import { buildSandboxRoomId } from '@/domains/sandbox/utils';
import { sandboxService } from '@/domains/sandbox/sandbox-service';

// TODO: Add idle timeout (e.g., cleanup after 5 min with no activity)
// TODO: Wire disconnect handler to cleanup sessions

function startSession(userId: UserId, connectionId: ConnectionId): void {
  const roomId = buildSandboxRoomId(userId);
  systemActions.joinRoom({ roomId, userId, connectionId });

  const manager = sandboxService.createSession(userId);
  manager.start();
}

function endSession(userId: UserId): void {
  sandboxService.destroySession(userId);
}

function play(userId: UserId): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.play();
}

function pause(userId: UserId): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.pause();
}

function stepForward(userId: UserId): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.stepForward();
}

function stepBack(userId: UserId): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.stepBack();
}

function rewind(userId: UserId, targetTick: number): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.rewindToTick(targetTick);
}

function reset(userId: UserId): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.reset();
}

function queueMove(userId: UserId, source: Coord, direction: Direction): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.queueMove(source, direction);
}

function undoMove(userId: UserId): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.undoMove();
}

function clearMoves(userId: UserId): void {
  const manager = sandboxService.getSession(userId);
  if (!manager) return;
  manager.clearMoves();
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
};

export { sandboxActions };
