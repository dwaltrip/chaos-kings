import { useEffect, useRef } from 'react';

import { GAMEPLAY_DOMAIN, createJoinRoomMessage, createLeaveRoomMessage } from '@common/types/gameplay';
import { getWebSocketService } from '@/services/websocket-service';
import { GameplayWsHandler } from '@/game-ui/store/gameplay-ws-handler';
import { gameplayStore } from '@/game-ui/store/gameplay-store';

function useGameplayWebSocket(gameId: number | null) {
  const wsServiceRef = useRef<ReturnType<typeof getWebSocketService> | null>(null);
  const { actions } = gameplayStore.getState();

  useEffect(() => {
    if (!gameId) return;

    const wsService = getWebSocketService();
    wsService.addMessageHandler(GAMEPLAY_DOMAIN, GameplayWsHandler);
    wsServiceRef.current = wsService;

    // Join gameplay room after connection is established
    const gameplayRoom = `gameplay-${gameId}`;
    wsService.onReadyOrNow().then(() => {
      wsService.send(createJoinRoomMessage(gameplayRoom));
    });

    return () => {
      // Leave gameplay room and clean up
      wsService.send(createLeaveRoomMessage(gameplayRoom));
      wsService.removeMessageHandler(GAMEPLAY_DOMAIN, GameplayWsHandler);
      actions.reset();
    };
  }, [gameId, actions]);
}

export { useGameplayWebSocket };