import { useState, useEffect } from 'react';

import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { PLAYERS_PER_GAME } from '@common/constants/matchmaking';
import { gameMatchmakingStore } from '@/pages/join-game/join-game-store';
import {
  joinQueue,
  leaveQueue,
} from '@/pages/join-game/game-matchmaking-actions';
import { GameMatchmakingWsHandler } from '@/pages/join-game/game-matchmaking-ws-handler';
import { useWebsocket } from '@/hooks/use-websocket';

function JoinGamePage() {
  const queueSize = gameMatchmakingStore((state) => state.queueSize);
  const playersNeeded = gameMatchmakingStore((state) => state.playersNeeded);
  const isInQueue = gameMatchmakingStore((state) => state.isInQueue);
  const gameReady = gameMatchmakingStore((state) => state.gameReady);
  const [waitingTime, setWaitingTime] = useState(0);
  const wsService = useWebsocket(
    GAME_MATCHMAKING_DOMAIN,
    GameMatchmakingWsHandler,
  );

  // TODO: move this to store. also name it better (waiting time is not a good name)
  useEffect(() => {
    if (!isInQueue) {
      setWaitingTime(0);
      return;
    }

    const interval = setInterval(() => {
      setWaitingTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isInQueue]);

  const handleJoinQueue = () => joinQueue();
  const handleCancelQueue = () => leaveQueue();

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
        <div className="text-lg text-green-600 font-medium">
          Game found! Joining...
        </div>
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
          <div className="text-lg">
            Queue Status: {queueSize}/{PLAYERS_PER_GAME} players (
            {playersNeeded} needed)
          </div>

          <div className="text-lg">Waiting Time: {formatTime(waitingTime)}</div>

          <button
            onClick={handleCancelQueue}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
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
