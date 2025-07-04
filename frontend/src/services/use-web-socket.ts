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

interface WebSocketInstance {
  ws: WebSocket;
  listeners: Set<(message: RoomMessage) => void>;
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
    connectionStateListeners: new Set(),
    isConnected: false,
  };

  ws.onopen = () => {
    instance.isConnected = true;
    instance.connectionStateListeners.forEach(listener => listener(true));
    console.log('Connected to WebSocket server');
  };

  ws.onmessage = (event) => {
    const message: RoomMessage = JSON.parse(event.data);
    instance.listeners.forEach(listener => listener(message));
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

  return {
    send,
    isConnected,
    addMessageListener,
    joinRoom,
    leaveRoom,
    currentRoom: globalWebSocketInstance?.currentRoom,
  };
};

export { useWebSocket, type WsMessage, type RoomMessage };
