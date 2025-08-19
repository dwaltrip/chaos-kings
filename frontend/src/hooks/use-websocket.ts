import type { WsDomainHandler } from '@common/types/websockets';
import { getWebSocketService } from '@/services/websocket-service';
import { useEffect } from 'react';

function useWebsocket(domain: string, handler: WsDomainHandler) {
  const wsService = getWebSocketService();

  useEffect(() => {
    wsService.onReadyOrNow().then(() => {
      wsService.addMessageHandler(domain, handler);
    });
    return () => {
      wsService.removeMessageHandler(domain, handler);
    };
  }, [domain, handler]);

  return wsService;
}

export { useWebsocket };
