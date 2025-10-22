import { useEffect, useState, useRef } from 'react';
import { userStore } from '@/stores/user-store';
import { getWebSocketService } from '@/services/websocket-service';

function useUserWebSocketInit() {
  const { isInitialized, isLoading, actions } = userStore();
  const [wsReady, setWsReady] = useState(false);
  const [wsInitializing, setWsInitializing] = useState(false);
  const userInitializing = useRef(false);

  // Initialize user if not already done
  useEffect(() => {
    if (!isInitialized && !isLoading && !userInitializing.current) {
      userInitializing.current = true;
      actions.initializeUser();
    }
  }, [isInitialized, isLoading, actions]);

  // Reset userInitializing ref when initialization completes
  useEffect(() => {
    if (isInitialized) {
      userInitializing.current = false;
    }
  }, [isInitialized]);

  // Initialize WebSocket after user is ready
  useEffect(() => {
    if (isInitialized && !wsReady && !wsInitializing) {
      // User is ready, now initialize WebSocket
      setWsInitializing(true);
      const ws = getWebSocketService();
      ws.onReadyOrNow().then(() => {
        setWsReady(true);
        setWsInitializing(false);
      });
    }
  }, [isInitialized, wsReady, wsInitializing]);

  return {
    isReady: isInitialized && wsReady,
    userReady: isInitialized,
    wsReady,
  };
}

export { useUserWebSocketInit };
