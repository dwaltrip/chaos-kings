import { getWebSocketService } from '../services/websocket-service';
import { type MatchmakingMessage } from '../services/use-web-socket';

let removeConnectionListener: (() => void) | null = null;
let removeMatchmakingListener: (() => void) | null = null;

const matchmakingActions = {
  initialize(callbacks: {
    onConnectionChange: (isConnected: boolean) => void;
    onQueueStatusUpdate: (status: { queueSize: number; playersInQueue: string[]; playersNeeded: number }) => void;
    onGameFound: (gameId: string) => void;
  }) {
    console.log(`[Matchmaking-Actions] Initializing matchmaking`);
    const wsService = getWebSocketService();

    // Clean up existing listeners
    if (removeConnectionListener) {
      console.log(`[Matchmaking-Actions] Cleaning up existing connection listener`);
      removeConnectionListener();
    }
    if (removeMatchmakingListener) {
      console.log(`[Matchmaking-Actions] Cleaning up existing matchmaking listener`);
      removeMatchmakingListener();
    }

    // Set up connection state listener
    console.log(`[Matchmaking-Actions] Setting up connection state listener`);
    removeConnectionListener = wsService.addConnectionStateListener((isConnected) => {
      console.log(`[Matchmaking-Actions] Connection state changed: ${isConnected}`);
      callbacks.onConnectionChange(isConnected);
    });

    // Set up matchmaking message listener
    console.log(`[Matchmaking-Actions] Setting up matchmaking message listener`);
    removeMatchmakingListener = wsService.addMatchmakingMessageListener((message: MatchmakingMessage) => {
      console.log(`[Matchmaking-Actions] Received matchmaking message:`, message);
      
      if (message.type === 'queue-status-update') {
        console.log(`[Matchmaking-Actions] Processing queue status update`);
        callbacks.onQueueStatusUpdate({
          queueSize: message.queueSize || 0,
          playersInQueue: message.playersInQueue || [],
          playersNeeded: message.playersNeeded || 4
        });
      } else if (message.type === 'game-found') {
        console.log(`[Matchmaking-Actions] Processing game found: ${message.gameId}`);
        callbacks.onGameFound(message.gameId || 'unknown');
      }
    });
    
    console.log(`[Matchmaking-Actions] Initialization complete`);
  },

  joinQueue(playerId: string, username: string, level: number) {
    console.log(`[Matchmaking-Actions] Attempting to join queue: ${playerId}, ${username}, level ${level}`);
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      console.error(`[Matchmaking-Actions] L Cannot join queue: Not connected`);
      return false;
    }
    
    if (!playerId.trim() || !username.trim()) {
      console.error(`[Matchmaking-Actions] L Cannot join queue: Invalid player data`);
      return false;
    }

    const message: MatchmakingMessage = {
      type: 'join-queue',
      playerId,
      playerData: {
        username: username.trim(),
        level
      }
    };

    console.log(`[Matchmaking-Actions] Sending join queue message:`, message);
    wsService.send(message);
    return true;
  },

  leaveQueue(playerId: string) {
    console.log(`[Matchmaking-Actions] Attempting to leave queue: ${playerId}`);
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      console.error(`[Matchmaking-Actions] L Cannot leave queue: Not connected`);
      return false;
    }
    
    if (!playerId.trim()) {
      console.error(`[Matchmaking-Actions] L Cannot leave queue: Invalid player ID`);
      return false;
    }

    const message: MatchmakingMessage = {
      type: 'leave-queue',
      playerId
    };

    console.log(`[Matchmaking-Actions] Sending leave queue message:`, message);
    wsService.send(message);
    return true;
  },

  requestQueueStatus(playerId: string) {
    console.log(`[Matchmaking-Actions] Requesting queue status: ${playerId}`);
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      console.error(`[Matchmaking-Actions] L Cannot request status: Not connected`);
      return false;
    }
    
    if (!playerId.trim()) {
      console.error(`[Matchmaking-Actions] L Cannot request status: Invalid player ID`);
      return false;
    }

    const message: MatchmakingMessage = {
      type: 'queue-status',
      playerId
    };

    console.log(`[Matchmaking-Actions] Sending queue status request:`, message);
    wsService.send(message);
    return true;
  },

  cleanup() {
    console.log(`[Matchmaking-Actions] Cleaning up matchmaking actions`);
    if (removeConnectionListener) {
      console.log(`[Matchmaking-Actions] Removing connection listener`);
      removeConnectionListener();
      removeConnectionListener = null;
    }
    if (removeMatchmakingListener) {
      console.log(`[Matchmaking-Actions] Removing matchmaking listener`);
      removeMatchmakingListener();
      removeMatchmakingListener = null;
    }
    console.log(`[Matchmaking-Actions] Cleanup complete`);
  }
};

export { matchmakingActions };