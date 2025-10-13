import { MessageUnion } from '@protocol/utils/message-helpers';
import { EmptyPayload, ExtractMsg } from '@protocol/utils/type-helpers';
import { create } from 'domain';

type MatchmakingClientPayloadMap = {
  'matchmaking:join-queue': EmptyPayload;
  'matchmaking:leave-queue': EmptyPayload;
  'matchmaking:early-start-vote': {
    vote: boolean;
  };
};

type MatchmakingClientMessage = MessageUnion<MatchmakingClientPayloadMap>;
type JoinQueueMessage = ExtractMsg<MatchmakingClientMessage, 'matchmaking:join-queue'>;
type LeaveQueueMessage = ExtractMsg<MatchmakingClientMessage, 'matchmaking:leave-queue'>;
type EarlyStartVoteMessage = ExtractMsg<
  MatchmakingClientMessage,
  'matchmaking:early-start-vote'
>;

const MsgCreators = {
  createJoinQueueMessage: (): JoinQueueMessage => ({
    type: 'matchmaking:join-queue',
    payload: {},
  }),
  createLeaveQueueMessage: (): LeaveQueueMessage => ({
    type: 'matchmaking:leave-queue',
    payload: {},
  }),
  createEarlyStartVoteMessage: (vote: boolean): EarlyStartVoteMessage => ({
    type: 'matchmaking:early-start-vote',
    payload: { vote },
  }),
} as const;

export type { MatchmakingClientPayloadMap, MatchmakingClientMessage };
export { MsgCreators };
