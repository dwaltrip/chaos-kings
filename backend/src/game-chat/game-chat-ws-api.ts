import { DomainAPI } from '@/websocket/api';
import {
  GAME_CHAT_DOMAIN,
  type GameChatClientMessageType,
  type GameChatServerInbound,
} from '@common/types/game-chat';
import { createGameChatEffects } from '@/game-chat/ws-effects';
import { postMessage } from '@/game-chat/actions/post-message-action';

const GameChatWsAPI = new DomainAPI<GameChatClientMessageType>(
  GAME_CHAT_DOMAIN,
  {
    'join-room': (data, wsActions) => {
      const { room } = (
        data as Extract<GameChatServerInbound, { type: 'join-room' }>
      ).payload;
      if (!room) return;
      const effects = createGameChatEffects(wsActions);
      effects.joinChatRoom(room);
    },
    'leave-room': (data, wsActions) => {
      const { room } = (
        data as Extract<GameChatServerInbound, { type: 'leave-room' }>
      ).payload;
      if (!room) return;
      const effects = createGameChatEffects(wsActions);
      effects.leaveChatRoom(room);
    },
    'post-message': async (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      const { room, content } = (
        data as Extract<GameChatServerInbound, { type: 'post-message' }>
      ).payload;
      if (!room || typeof content !== 'string') return;
      const effects = createGameChatEffects(wsActions);
      await postMessage(Number(user.id), user.username, room, content, effects);
    },
  },
);

export { GameChatWsAPI };
