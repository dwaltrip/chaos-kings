import { useEffect, useRef, useState, useCallback } from 'react';

interface WsMessage {
  user: string;
  message: string;
  timestamp: number;
}

interface RoomMessage extends WsMessage {
  room: string;
  type: 'chat' | 'join' | 'leave';
}

interface MatchmakingMessage {
  type: 'join-queue' | 'leave-queue' | 'queue-status' | 'queue-status-update' | 'game-found';
  playerId: string;
  playerData?: {
    username: string;
    level: number;
  };
  queueSize?: number;
  playersInQueue?: string[];
  playersNeeded?: number;
  gameId?: string;
}

type WebSocketMessage = RoomMessage | MatchmakingMessage;

interface WebSocketInstance {
  ws: WebSocket;
  listeners: Set<(message: RoomMessage) => void>;
  matchmakingListeners: Set<(message: MatchmakingMessage) => void>;
  connectionStateListeners: Set<(isConnected: boolean) => void>;
  isConnected: boolean;
  currentRoom?: string;
}

let globalWebSocketInstance: WebSocketInstance | null = null;

const createWebSocketInstance = (url: string): WebSocketInstance => {
  const ws = new WebSocket(url);
  const instance: WebSocketInstance = {
    ws,
    listeners: new Set(),
    matchmakingListeners: new Set(),
    connectionStateListeners: new Set(),
    isConnected: false,
  };

  ws.onopen = () => {
    instance.isConnected = true;
    instance.connectionStateListeners.forEach(listener => listener(true));
    console.log('Connected to WebSocket server');
  };

  ws.onmessage = (event) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('Received WebSocket message:', message);
      
      if ('room' in message) {
        console.log('Routing to chat listeners');
        instance.listeners.forEach(listener => listener(message as RoomMessage));
      } else if ('type' in message && (message.type === 'queue-status-update' || message.type === 'game-found' || 'playerId' in message)) {
        console.log('Routing to matchmaking listeners');
        instance.matchmakingListeners.forEach(listener => listener(message as MatchmakingMessage));
      } else {
        console.log('Unknown message format:', message);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = () => {
    instance.isConnected = false;
    instance.connectionStateListeners.forEach(listener => listener(false));
    console.log('Disconnected from WebSocket server');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  // Gracefully close connection on page unload
  const handleUnload = () => {
    if (instance.ws.readyState === WebSocket.OPEN) {
      instance.ws.close();
    }
    globalWebSocketInstance = null;
  };
  
  window.addEventListener('beforeunload', handleUnload);

  return instance;
};

const useWebSocket = (url: string = 'ws://localhost:8080') => {
  const [isConnected, setIsConnected] = useState(false);
  const messageListenerRef = useRef<((message: RoomMessage) => void) | null>(null);
  const matchmakingListenerRef = useRef<((message: MatchmakingMessage) => void) | null>(null);
  const connectionListenerRef = useRef<((isConnected: boolean) => void) | null>(null);

  useEffect(() => {
    if (!globalWebSocketInstance) {
      globalWebSocketInstance = createWebSocketInstance(url);
    }

    const instance = globalWebSocketInstance;

    const connectionListener = (connected: boolean) => {
      setIsConnected(connected);
    };

    connectionListenerRef.current = connectionListener;
    instance.connectionStateListeners.add(connectionListener);
    setIsConnected(instance.isConnected);

    return () => {
      if (connectionListenerRef.current) {
        instance.connectionStateListeners.delete(connectionListenerRef.current);
      }
      if (messageListenerRef.current) {
        instance.listeners.delete(messageListenerRef.current);
      }
      if (matchmakingListenerRef.current) {
        instance.matchmakingListeners.delete(matchmakingListenerRef.current);
      }
      // Keep connection alive for other components that might be using it
    };
  }, [url]);

  const send = useCallback((message: RoomMessage) => {
    if (globalWebSocketInstance?.isConnected) {
      globalWebSocketInstance.ws.send(JSON.stringify(message));
    }
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    if (globalWebSocketInstance?.isConnected) {
      const joinMessage: RoomMessage = {
        user: '',
        message: '',
        timestamp: Date.now(),
        room: roomId,
        type: 'join'
      };
      globalWebSocketInstance.ws.send(JSON.stringify(joinMessage));
      globalWebSocketInstance.currentRoom = roomId;
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    if (globalWebSocketInstance?.isConnected) {
      const leaveMessage: RoomMessage = {
        user: '',
        message: '',
        timestamp: Date.now(),
        room: roomId,
        type: 'leave'
      };
      globalWebSocketInstance.ws.send(JSON.stringify(leaveMessage));
      globalWebSocketInstance.currentRoom = undefined;
    }
  }, []);

  const addMessageListener = useCallback((listener: (message: RoomMessage) => void) => {
    if (globalWebSocketInstance) {
      if (messageListenerRef.current) {
        globalWebSocketInstance.listeners.delete(messageListenerRef.current);
      }
      messageListenerRef.current = listener;
      globalWebSocketInstance.listeners.add(listener);
    }
  }, []);

  const addMatchmakingListener = useCallback((listener: (message: MatchmakingMessage) => void) => {
    if (globalWebSocketInstance) {
      if (matchmakingListenerRef.current) {
        globalWebSocketInstance.matchmakingListeners.delete(matchmakingListenerRef.current);
      }
      matchmakingListenerRef.current = listener;
      globalWebSocketInstance.matchmakingListeners.add(listener);
    }
  }, []);

  const sendMatchmakingMessage = useCallback((message: MatchmakingMessage) => {
    if (globalWebSocketInstance?.isConnected) {
      globalWebSocketInstance.ws.send(JSON.stringify(message));
    }
  }, []);

  return {
    send,
    isConnected,
    addMessageListener,
    addMatchmakingListener,
    sendMatchmakingMessage,
    joinRoom,
    leaveRoom,
    currentRoom: globalWebSocketInstance?.currentRoom,
  };
};

export { useWebSocket, type WsMessage, type RoomMessage, type MatchmakingMessage };
