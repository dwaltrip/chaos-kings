import { idToNumber } from '@kernel/branded-type';
import { UserId } from '@kernel/domains/user';
import { GameId } from '@kernel/domains/game';
import { MsgCreators } from '@protocol/domains/matchmaking/server-messages';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';

import { wsBridge } from '@/ws/server-bridge-bootstrap';

const matchmakingWsEffects = {
  broadcastQueueStatus(queueSize: number, playersNeeded: number) {
    wsBridge.broadcastToRoom(
      MATCHMAKING_ROOM_ID,
      MsgCreators.createQueueStatusMessage(queueSize, playersNeeded),
    );
  },

  broadcastEarlyStartStatus(voters: UserId[], queueSize: number, allVoted: boolean) {
    wsBridge.broadcastToRoom(
      MATCHMAKING_ROOM_ID,
      MsgCreators.createEarlyStartStatusMessage(
        voters.map(idToNumber),
        queueSize,
        allVoted,
      ),
    );
  },

  broadcastGameReady(gameId: GameId) {
    wsBridge.broadcastToRoom(
      MATCHMAKING_ROOM_ID,
      MsgCreators.createGameReadyMessage(idToNumber(gameId)),
    );
  },

  // TODO: review this implementation, I wrote it quickly
  // `getConnectionsForUser` was added solely for this
  removeUsersFromMatchmakingRoom(userIds: UserId[]) {
    userIds.forEach((userId) => {
      wsBridge
        .getConnectionsForUser(String(idToNumber(userId)), MATCHMAKING_ROOM_ID)
        .forEach((connId) => {
          wsBridge.rooms.leave(MATCHMAKING_ROOM_ID, connId);
        });
    });
  },
};

export { matchmakingWsEffects };
