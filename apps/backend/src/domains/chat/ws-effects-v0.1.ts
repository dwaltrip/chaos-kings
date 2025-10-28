import type { ClientWsActions } from '@/websocket/types';
import { roomKey } from '@common/utils/room-key';
import { GAME_CHAT_DOMAIN } from '@common/types/game-chat';

interface GameChatEffects {
  joinChatRoom(room: string): void;
  leaveChatRoom(room: string): void;
  broadcastNewMessage(
    room: string,
    payload: {
      content: string;
      userId: number;
      username: string;
      timestamp: number;
    },
  ): void;
}

function createGameChatEffects(wsActions: ClientWsActions): GameChatEffects {
  return {
    joinChatRoom(room: string) {
      wsActions.join(roomKey(GAME_CHAT_DOMAIN, room));
    },
    leaveChatRoom(room: string) {
      wsActions.leave(roomKey(GAME_CHAT_DOMAIN, room));
    },
    broadcastNewMessage(room: string, payload) {
      wsActions.broadcast(roomKey(GAME_CHAT_DOMAIN, room), {
        domain: GAME_CHAT_DOMAIN,
        type: 'new-message',
        payload: {
          room,
          ...payload,
        },
      });
    },
  };
}

export { createGameChatEffects, type GameChatEffects };
