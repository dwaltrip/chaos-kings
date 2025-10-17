import { MessageUnion } from '@protocol/utils/message-helpers';
import { ExtractMsg } from '@protocol/utils/type-helpers';

type MatchmakingServerPayloadMap = {
  'matchmaking:queue-status': {
    queueSize: number;
    playersNeeded: number;
  };

  'matchmaking:early-start-status': {
    voters: number[];
    queueSize: number;
    allVoted: boolean;
  };

  'matchmaking:game-ready': {
    gameId: number;
  };
};

type MatchmakingServerMessage = MessageUnion<MatchmakingServerPayloadMap>;
type QueueStatusMessage = ExtractMsg<
  MatchmakingServerMessage,
  'matchmaking:queue-status'
>;
type EarlyStartStatusMessage = ExtractMsg<
  MatchmakingServerMessage,
  'matchmaking:early-start-status'
>;
type GameReadyMessage = ExtractMsg<MatchmakingServerMessage, 'matchmaking:game-ready'>;

const MsgCreators = {
  createQueueStatusMessage: (
    queueSize: number,
    playersNeeded: number,
  ): QueueStatusMessage => ({
    type: 'matchmaking:queue-status',
    payload: { queueSize, playersNeeded },
  }),

  createEarlyStartStatusMessage: (
    voters: number[],
    queueSize: number,
    allVoted: boolean,
  ): EarlyStartStatusMessage => ({
    type: 'matchmaking:early-start-status',
    payload: { voters, queueSize, allVoted },
  }),

  createGameReadyMessage: (gameId: number): GameReadyMessage => ({
    type: 'matchmaking:game-ready',
    payload: { gameId },
  }),
} as const;

export type { MatchmakingServerPayloadMap, MatchmakingServerMessage };
export { MsgCreators };
