import { useState, useEffect } from 'react';

function JoinGamePage() {
  const [inQueue, setInQueue] = useState(false);
  const [playersInQueue, setPlayersInQueue] = useState(0);
  const [maxPlayers] = useState(8);
  const [waitingTime, setWaitingTime] = useState(0);

  useEffect(() => {
    if (!inQueue) {
      setWaitingTime(0);
      return;
    }

    const interval = setInterval(() => {
      setWaitingTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [inQueue]);

  const handleJoinQueue = () => {
    setInQueue(true);
    setPlayersInQueue(5); // Mock data
  };

  const handleCancelQueue = () => {
    setInQueue(false);
    setPlayersInQueue(0);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">
        {inQueue ? 'Waiting for players...' : 'Find a Game'}
      </h1>
      
      {!inQueue ? (
        <button 
          onClick={handleJoinQueue}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Join queue
        </button>
      ) : (
        <div className="space-y-4">
          <div className="text-lg">
            Queue Status: {playersInQueue}/{maxPlayers} players
          </div>
          
          <div className="text-lg">
            Waiting Time: {formatTime(waitingTime)}
          </div>
          
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
};

export { JoinGamePage };
