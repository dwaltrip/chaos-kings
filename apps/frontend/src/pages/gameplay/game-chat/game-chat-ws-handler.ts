import type { WsServerOutbound } from '@common/types/websockets';
import type { GameChatServerMessageType } from '@common/types/game-chat';
import type { ChatMessage } from '@/pages/game/game-chat/types';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';

const { actions } = gameChatStore.getState();

const GameChatWsHandler = {
  handleMessage: (data: WsServerOutbound) => {
    const { type } = data;
    // const { type, payload } = data;
    // const user = payload.user || '??';
    // const date = payload.timestamp ? new Date(payload.timestamp) : '-'

    switch (type as GameChatServerMessageType) {
      case 'new-message':
        actions.addMessage(data.payload as ChatMessage);
        break;
      // case 'user-joined':
      //   store.addUser(data.user);
      //   break;
      default:
        console.error(`[game-chat] Unknown message type: ${type}`);
    }
  },
};

export { GameChatWsHandler };
