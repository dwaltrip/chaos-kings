import { useEffect, useRef } from 'react';

import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import {
  createJoinRoomMessage,
  createLeaveRoomMessage,
} from '@common/websockets/message-types';

import { getWebSocketService } from '@/services/websocket-service';
import { GameplayWsHandler } from '@/game-ui/store/gameplay-ws-handler';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { roomNameForGameplay } from '@common/domains/game/utils';

function useGameplayWebSocket(gameId: number | null) {
  const wsServiceRef = useRef<ReturnType<typeof getWebSocketService> | null>(
    null,
  );
  const { actions } = gameplayStore.getState();

  useEffect(() => {
    if (!gameId) return;

    const wsService = getWebSocketService();
    wsService.addMessageHandler(GAMEPLAY_DOMAIN, GameplayWsHandler);
    wsServiceRef.current = wsService;

    const gameplayRoom = roomNameForGameplay('' + gameId);
    // Join gameplay room after connection is establishe
    wsService.onReadyOrNow().then(() => {
      wsService.send(createJoinRoomMessage(GAMEPLAY_DOMAIN, gameplayRoom));
    });

    return () => {
      // Leave gameplay room and clean up
      wsService.send(createLeaveRoomMessage(GAMEPLAY_DOMAIN, gameplayRoom));
      wsService.removeMessageHandler(GAMEPLAY_DOMAIN, GameplayWsHandler);
      actions.reset();
    };
  }, [gameId, actions]);
}

export { useGameplayWebSocket };
