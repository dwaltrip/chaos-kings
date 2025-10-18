import { MsgCreators } from '@protocol/domains/matchmaking/client-messages';

// TODO: [PHASE-2] Import wsBridge when available
// import { wsBridge } from '@/ws/bridge';
const wsBridge: any = {};

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
