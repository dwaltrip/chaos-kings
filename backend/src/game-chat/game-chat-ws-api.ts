import { DomainAPI } from '@/websocket/api';
import {
  GAME_CHAT_DOMAIN,
  type GameChatClientMessageType,
} from '@common/types/game-chat';
import { createGameChatEffects } from '@/game-chat/ws-effects';
import { postMessage } from '@/game-chat/actions/post-message-action';

const GameChatWsAPI = new DomainAPI<GameChatClientMessageType>(
  GAME_CHAT_DOMAIN,
  {
    'join-room': (data, wsActions) => {
      const room = (data as any).payload?.room as string;
      if (!room) return;
      const effects = createGameChatEffects(wsActions);
      effects.joinChatRoom(room);
    },
    'leave-room': (data, wsActions) => {
      const room = (data as any).payload?.room as string;
      if (!room) return;
      const effects = createGameChatEffects(wsActions);
      effects.leaveChatRoom(room);
    },
    'post-message': async (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      const payload = (data as any).payload ?? {};
      const room: string | undefined = payload.room;
      const content: string | undefined = payload.content;
      if (!room || typeof content !== 'string') return;
      const effects = createGameChatEffects(wsActions);
      await postMessage(Number(user.id), user.username, room, content, effects);
    },
  },
);

export { GameChatWsAPI };
