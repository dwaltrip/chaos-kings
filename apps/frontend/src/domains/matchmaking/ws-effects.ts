import { MsgCreators } from '@protocol/domains/matchmaking/client-messages';

import { wsBridge } from '@/ws';

const matchmakingWsEffects = {
  sendJoinQueue() {
    wsBridge.send(MsgCreators.createJoinQueueMessage());
  },

  sendLeaveQueue() {
    wsBridge.send(MsgCreators.createLeaveQueueMessage());
  },

  sendEarlyStartVote(vote: boolean) {
    wsBridge.send(MsgCreators.createEarlyStartVoteMessage(vote));
  },
};

export { matchmakingWsEffects };
