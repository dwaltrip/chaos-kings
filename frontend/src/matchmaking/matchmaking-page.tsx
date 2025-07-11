import { useState, useEffect } from 'react';
import { useWebSocket, type MatchmakingMessage } from '../services/use-web-socket';

function MatchmakingPage() {
  const [username, setUsername] = useState('');
  const [level, setLevel] = useState(5);
  const [playerId, setPlayerId] = useState('');
  const [isInQueue, setIsInQueue] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{
    queueSize: number;
    playersInQueue: string[];
    playersNeeded: number;
  }>({ queueSize: 0, playersInQueue: [], playersNeeded: 4 });
  const [gameFound, setGameFound] = useState<string | null>(null);
  
  const { isConnected, addMatchmakingListener, sendMatchmakingMessage } = useWebSocket();

  useEffect(() => {
    if (!playerId && username) {
      setPlayerId(`${username}_${Date.now()}`);
    }
  }, [username, playerId]);

  useEffect(() => {
    addMatchmakingListener((message: MatchmakingMessage) => {
      if (message.type === 'queue-status-update') {
        setQueueStatus({
          queueSize: message.queueSize || 0,
          playersInQueue: message.playersInQueue || [],
          playersNeeded: message.playersNeeded || 4
        });
      } else if (message.type === 'game-found') {
        setGameFound(message.gameId || 'unknown');
        setIsInQueue(false);
      }
    });
  }, [addMatchmakingListener]);


  const joinQueue = () => {
    if (!username.trim() || !playerId) return;

    const message: MatchmakingMessage = {
      type: 'join-queue',
      playerId,
      playerData: {
        username: username.trim(),
        level
      }
    };

    sendMatchmakingMessage(message);
    setIsInQueue(true);
    setGameFound(null);
  };

  const leaveQueue = () => {
    if (!playerId) return;

    const message: MatchmakingMessage = {
      type: 'leave-queue',
      playerId
    };

    sendMatchmakingMessage(message);
    setIsInQueue(false);
  };

  const getQueueStatus = () => {
    if (!playerId) return;

    const message: MatchmakingMessage = {
      type: 'queue-status',
      playerId
    };

    sendMatchmakingMessage(message);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Matchmaking Demo</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <span style={{ marginRight: '20px', color: isConnected ? 'green' : 'red' }}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <strong>Player ID:</strong> {playerId || 'Not set'}
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Username:
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
              disabled={isInQueue}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Level:
            <input
              type="number"
              value={level}
              onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
              min="1"
              max="100"
              style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
              disabled={isInQueue}
            />
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            onClick={joinQueue}
            disabled={!isConnected || !username.trim() || isInQueue}
            style={{ 
              padding: '10px 20px',
              backgroundColor: isInQueue ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isInQueue ? 'not-allowed' : 'pointer'
            }}
          >
            {isInQueue ? 'In Queue...' : 'Join Queue'}
          </button>
          
          <button
            onClick={leaveQueue}
            disabled={!isConnected || !isInQueue}
            style={{ 
              padding: '10px 20px',
              backgroundColor: !isInQueue ? '#ccc' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !isInQueue ? 'not-allowed' : 'pointer'
            }}
          >
            Leave Queue
          </button>
          
          <button
            onClick={getQueueStatus}
            disabled={!isConnected}
            style={{ 
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Status
          </button>
        </div>
      </div>

      <div 
        style={{ 
          border: '1px solid #ccc', 
          padding: '15px',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          marginBottom: '20px'
        }}
      >
        <h3>Queue Status</h3>
        <div><strong>Players in queue:</strong> {queueStatus.queueSize}</div>
        <div><strong>Players needed:</strong> {queueStatus.playersNeeded}</div>
        <div><strong>Queue progress:</strong> {queueStatus.queueSize}/4</div>
        
        {queueStatus.playersInQueue.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <strong>Players waiting:</strong>
            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
              {queueStatus.playersInQueue.map((player, index) => (
                <li key={index}>{player}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {gameFound && (
        <div 
          style={{ 
            border: '2px solid #28a745', 
            padding: '15px',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            color: '#155724'
          }}
        >
          <h3>🎉 Game Found!</h3>
          <div><strong>Game ID:</strong> {gameFound}</div>
          <div>You have been matched with 3 other players!</div>
        </div>
      )}

      {isInQueue && !gameFound && (
        <div 
          style={{ 
            border: '2px solid #007bff', 
            padding: '15px',
            backgroundColor: '#d1ecf1',
            borderRadius: '4px',
            color: '#0c5460'
          }}
        >
          <div>🔍 Searching for players...</div>
          <div>You are currently in the matchmaking queue.</div>
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <h4>How to test:</h4>
        <ol>
          <li>Enter a username and level</li>
          <li>Click "Join Queue" to enter matchmaking</li>
          <li>Open multiple browser tabs/windows to simulate other players</li>
          <li>When 4 players join, a game will be created automatically</li>
          <li>Use "Refresh Status" to manually check queue state</li>
        </ol>
      </div>
    </div>
  );
}

export { MatchmakingPage };
