import type { WsDomainHandler } from '@common/types/websockets';
import { getWebSocketService } from '@/services/websocket-service';
import { useEffect } from 'react';

function useWebsocket(domain: string, handler: WsDomainHandler, room?: string) {
  const wsService = getWebSocketService();

  useEffect(() => {
    wsService.onReadyOrNow().then(() => {
      wsService.addMessageHandler(domain, handler);
      if (room) {
        wsService.joinRoom(domain, room);
      }
    });
    return () => {
      wsService.removeMessageHandler(domain, handler);
    };
  }, [domain, handler, room]);

  return wsService;
}

export { useWebsocket };
