import { useEffect, useState } from 'react';
import { userStore } from '@/stores/user-store';
import { getWebSocketService } from '@/services/websocket-service';

function useUserWebSocketInit() {
  const { isInitialized, actions } = userStore();
  const [wsReady, setWsReady] = useState(false);
  
  // Initialize user if not already done
  useEffect(() => {
    if (!isInitialized) {
      actions.initializeUser();
    }
  }, [isInitialized, actions]);
  
  // Initialize WebSocket after user is ready
  useEffect(() => {
    if (isInitialized && !wsReady) {
      // User is ready, now initialize WebSocket
      getWebSocketService(); // This triggers connection
      setWsReady(true);
    }
  }, [isInitialized, wsReady]);
  
  return {
    isReady: isInitialized && wsReady,
    userReady: isInitialized,
    wsReady
  };
}

export { useUserWebSocketInit };