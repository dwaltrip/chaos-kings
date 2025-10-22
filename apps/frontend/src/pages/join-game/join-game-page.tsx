import { useState, useEffect } from 'react';

import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { FFA_NUM_PLAYERS_MAX } from '@common/constants/matchmaking';
import { gameMatchmakingStore } from '@/pages/join-game/join-game-store';
import { joinQueue, leaveQueue } from '@/pages/join-game/game-matchmaking-actions';
import { sendEarlyStartVote } from '@/pages/join-game/game-matchmaking-actions';
import { GameMatchmakingWsHandler } from '@/pages/join-game/game-matchmaking-ws-handler';
import { useWebsocket } from '@/hooks/use-websocket';
import { MATCHMAKING_WAITING_TIMER_INTERVAL_MS } from '@core/ui-timing-config';
import { userStore } from '@/stores/user-store';

function JoinGamePage() {
  const queueSize = gameMatchmakingStore((state) => state.queueSize);
  const playersNeeded = gameMatchmakingStore((state) => state.playersNeeded);
  const isInQueue = gameMatchmakingStore((state) => state.isInQueue);
  const gameReady = gameMatchmakingStore((state) => state.gameReady);
  const earlyStartVoters = gameMatchmakingStore((state) => state.earlyStartVoters);
  const allVoted = gameMatchmakingStore((state) => state.allVoted);
  const user = userStore((state) => state.user);
  const [waitingTime, setWaitingTime] = useState(0);
  const wsService = useWebsocket(GAME_MATCHMAKING_DOMAIN, GameMatchmakingWsHandler);

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
  const hasVoted = !!(user && earlyStartVoters.includes(user.id.toString()));
  const toggleEarlyStartVote = () => sendEarlyStartVote(!hasVoted);

  return (
    <div className="p-4">
      <div className="mb-4">
        <span className="text-sm">
          {wsService.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
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
          disabled={!wsService.isConnected}
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
