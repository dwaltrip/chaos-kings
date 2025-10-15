import { MsgCreators } from '@protocol/domains/matchmaking/server-messages';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';

// import { wsBridge } from '@/ws/bridge';
const wsBridge: any = {};

const matchmakingWsEffects = {
  broadcastQueueStatus(queueSize: number, playersNeeded: number) {
    wsBridge.broadcastToRoom(
      MATCHMAKING_ROOM_ID,
      MsgCreators.createQueueStatusMessage(queueSize, playersNeeded),
    );
  },

  broadcastEarlyStartStatus(voters: string[], queueSize: number, allVoted: boolean) {
    wsBridge.broadcastToRoom(
      MATCHMAKING_ROOM_ID,
      MsgCreators.createEarlyStartStatusMessage(voters, queueSize, allVoted),
    );
  },

  broadcastGameReady(gameId: number) {
    wsBridge.broadcastToRoom(
      MATCHMAKING_ROOM_ID,
      MsgCreators.createGameReadyMessage(gameId),
    );
  },
};

export { matchmakingWsEffects };
