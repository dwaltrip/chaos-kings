import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';
import type { WsMessage } from '@common/types/websockets';
import type { ChatMessage } from '@/chat-demo/types';

const { actions } = gameChatStore.getState();

const GameChatWsHandler = {
  handleMessage: (data: WsMessage) => { 
    const { type } = data;
    // const { type, payload } = data;
    // const user = payload.user || '??';
    // const date = payload.timestamp ? new Date(payload.timestamp) : '-'

    switch (type) {
      case 'new-message':
        actions.addMessage(data.payload as ChatMessage);
        break;
      // case 'user-joined':
      //   store.addUser(data.user);
      //   break;
      default:
        console.error(`[game-chat] Unknown message type: ${type}`);
    }
  }
}

export { GameChatWsHandler };
