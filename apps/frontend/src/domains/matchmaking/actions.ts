import { UserId } from '@kernel/domains/user';
import { GameId } from '@kernel/domains/game';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';
import { NAVIGATION_DELAY_MS } from '@core/ui-timing-config';

import { systemWsEffects } from '@/domains/system/actions';
import { gameMatchmakingStore } from '@/domains/matchmaking/matchmaking-store';
import { matchmakingWsEffects } from '@/domains/matchmaking/ws-effects';

function joinQueue() {
  const { actions } = gameMatchmakingStore.getState();
  matchmakingWsEffects.sendJoinQueue();
  actions.setIsInQueue(true);

  // -------------------------------------------------------
  // TODO: does this belong here?
  // v1 didn't do anything with rooms here.
  // -------------------------------------------------------
  systemWsEffects.joinRoom(MATCHMAKING_ROOM_ID);
}

function leaveQueue() {
  const { actions } = gameMatchmakingStore.getState();
  matchmakingWsEffects.sendLeaveQueue();
  actions.setIsInQueue(false);

  // -------------------------------------------------------
  // TODO: does this belong here?
  // v1 didn't do anything with rooms here.
  // -------------------------------------------------------
  systemWsEffects.leaveRoom(MATCHMAKING_ROOM_ID);
}

function voteEarlyStart(vote: boolean) {
  matchmakingWsEffects.sendEarlyStartVote(vote);
}

function updateQueueStatus(queueSize: number, playersNeeded: number) {
  const { actions } = gameMatchmakingStore.getState();
  actions.setQueueSize(queueSize);
  actions.setPlayersNeeded(playersNeeded);
}

function updateEarlyStartStatus(voters: UserId[], queueSize: number, allVoted: boolean) {
  const { actions } = gameMatchmakingStore.getState();
  actions.setEarlyStartStatus(voters, queueSize, allVoted);
}

// TODO: clear matchmaking state??
function handleGameReady(gameId: GameId) {
  console.log('-- handleGameReady -- gameId:', gameId);
  const { actions } = gameMatchmakingStore.getState();
  actions.setGameReady(gameId);

  // Navigate to game page after navigation delay
  setTimeout(() => {
    console.log(`Navigating to game ${gameId}...`);
    // TODO: use React Router navigate helper
    window.location.href = `/games/${gameId}`;
  }, NAVIGATION_DELAY_MS);
}

export {
  // Outbound
  joinQueue,
  leaveQueue,
  voteEarlyStart,

  // Inbound
  updateQueueStatus,
  updateEarlyStartStatus,
  handleGameReady,
};
