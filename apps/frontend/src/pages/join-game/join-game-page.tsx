import { useState, useEffect } from 'react';

import { FFA_NUM_PLAYERS_MAX } from '@platform/domains/matchmaking/constants';
import { MATCHMAKING_WAITING_TIMER_INTERVAL_MS } from '@core/ui-timing-config';

import { useWsConnectionStore } from '@/ws-lib';
import { userStore } from '@/domains/users/user-store';
import { gameMatchmakingStore } from '@/domains/matchmaking/matchmaking-store';
import { joinQueue, leaveQueue, voteEarlyStart } from '@/domains/matchmaking/actions';

function JoinGamePage() {
  const queueSize = gameMatchmakingStore((state) => state.queueSize);
  const playersNeeded = gameMatchmakingStore((state) => state.playersNeeded);
  const isInQueue = gameMatchmakingStore((state) => state.isInQueue);
  const gameReady = gameMatchmakingStore((state) => state.gameReady);
  const earlyStartVoters = gameMatchmakingStore((state) => state.earlyStartVoters);
  const allVoted = gameMatchmakingStore((state) => state.allVoted);
  const user = userStore((state) => state.user);
  const [waitingTime, setWaitingTime] = useState(0);

  // TODO: re-think how we display connection status in the UI in general,
  // and how we access that state.
  const isConnected = useWsConnectionStore((state) => state.isConnected);

  // TODO: move this to store. also name it better (waiting time is not a good name)
  useEffect(() => {
    if (!isInQueue) {
      setWaitingTime(0);
      return;
    }

    const interval = setInterval(() => {
      setWaitingTime((prev) => prev + 1);
    }, MATCHMAKING_WAITING_TIMER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isInQueue]);

  const handleJoinQueue = () => joinQueue();
  const handleCancelQueue = () => leaveQueue();
  const hasVoted = !!(user && earlyStartVoters.includes(user.id));
  const toggleEarlyStartVote = () => voteEarlyStart(!hasVoted);

  return (
    <div className="p-4">
      <div className="mb-4">
        <span className="text-sm">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

      <h1 className="text-2xl mb-4">
        {isInQueue ? 'Waiting for players...' : 'Find a Game'}
      </h1>

      {gameReady ? (
        <div className="text-lg text-green-600 font-medium">Game found! Joining...</div>
      ) : !isInQueue ? (
        <button
          onClick={handleJoinQueue}
          disabled={!isConnected}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Join queue
        </button>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-lg">
              Queue Status: {queueSize}/{FFA_NUM_PLAYERS_MAX} players ({playersNeeded}{' '}
              needed)
            </div>
            <div className="text-lg">
              Start Early: {earlyStartVoters.length}/{queueSize} voted
              {allVoted && queueSize >= 2 ? ' — Ready!' : ''}
            </div>
          </div>

          <div className="text-lg">Waiting Time: {formatTime(waitingTime)}</div>

          <div className="flex gap-3">
            <button
              onClick={toggleEarlyStartVote}
              disabled={queueSize < 2}
              className={`px-4 py-2 rounded text-white ${
                hasVoted
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {hasVoted ? 'Unvote Early Start' : 'Start Early'}
            </button>
            <button
              onClick={handleCancelQueue}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export { JoinGamePage };
