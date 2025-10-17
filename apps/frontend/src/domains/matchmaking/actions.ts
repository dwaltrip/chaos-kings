import { UserId } from '@kernel/domains/user';
import { GameId } from '@kernel/domains/game';
import { MsgCreators } from '@protocol/domains/matchmaking/client-messages';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';

import { systemWsEffects } from '@/domains/system/actions';

// Mock WebSocket service until Phase 2
const wsService: any = {};

// ---------------------------------------------
// Outbound Actions (Client → Server)
// ---------------------------------------------

function joinQueue() {
  // Join the matchmaking room
  systemWsEffects.joinRoom(MATCHMAKING_ROOM_ID);

  // Send join-queue message
  wsService.send(MsgCreators.createJoinQueueMessage());
}

function leaveQueue() {
  // Send leave-queue message
  wsService.send(MsgCreators.createLeaveQueueMessage());

  // Leave the matchmaking room
  systemWsEffects.leaveRoom(MATCHMAKING_ROOM_ID);
}

function voteEarlyStart(vote: boolean) {
  // Send early-start-vote message
  wsService.send(MsgCreators.createEarlyStartVoteMessage(vote));
}

// ---------------------------------------------
// Inbound Actions (Server → Client)
// ---------------------------------------------

function handleQueueStatus(payload: { queueSize: number; playersNeeded: number }) {
  // TODO: [MATCHMAKING_FE] Update store with queue status
  // - Decide which store to use (create new v2 store or integrate with v1?)
  // - Update queueSize and playersNeeded
  // - Trigger UI re-render
}

function handleEarlyStartStatus(payload: {
  voters: UserId[];
  queueSize: number;
  allVoted: boolean;
}) {
  // TODO: [MATCHMAKING_FE] Update store with early start vote status
  // - Update voters list
  // - Update allVoted flag
  // - May need to show which players have voted in UI
}

function handleGameReady(gameId: GameId) {
  // TODO: [MATCHMAKING_FE] Navigate to game
  // - Decide navigation approach: React Router navigate() vs window.location
  // - Navigate to /game/:gameId or appropriate game route
  // - Clear matchmaking state from store
  // - Leave matchmaking room (may already be done by backend)
}

const matchmakingActions = {
  // Outbound
  joinQueue,
  leaveQueue,
  voteEarlyStart,

  // Inbound
  handleQueueStatus,
  handleEarlyStartStatus,
  handleGameReady,
};

export { matchmakingActions };
