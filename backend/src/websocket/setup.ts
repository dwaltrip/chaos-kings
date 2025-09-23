import { WsRouter } from '@/websocket/router';
import { WebSocketManager } from '@/websocket/manager';
import { setGlobalWebSocketManager } from '@/websocket/global-manager';

import {
  GAME_CHAT_DOMAIN,
  handleGameChatMessage,
} from '@/game-chat/game-chat-ws-api';
import {
  GAMEPLAY_DOMAIN,
  type GameplayServerInbound,
} from '@common/types/gameplay';
import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { handleGameplayMessage } from '@/gameplay/gameplay-ws-api';
import { handleGameMatchmakingMessage } from '@/game-matchmaking/game-matchmaking-ws-api';

function setupWebsocket(): WebSocketManager {
  const router = new WsRouter();
  router.register(GAME_CHAT_DOMAIN, handleGameChatMessage as any);
  router.register(GAMEPLAY_DOMAIN, handleGameplayMessage as any);
  router.register(GAME_MATCHMAKING_DOMAIN, handleGameMatchmakingMessage as any);

  const wsManager = new WebSocketManager((data, actions) =>
    router.dispatch(data, actions),
  );
  setGlobalWebSocketManager(wsManager);
  return wsManager;
}

export { setupWebsocket };
