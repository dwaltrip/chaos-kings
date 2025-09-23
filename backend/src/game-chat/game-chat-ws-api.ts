import {
  GAME_CHAT_DOMAIN,
  type GameChatServerInbound,
} from '@common/types/game-chat';
import { createGameChatEffects } from '@/game-chat/ws-effects';
import { postMessage } from '@/game-chat/actions/post-message-action';

type RegisterFn = (
  domain: string,
  handler: (data: any, actions: any) => void,
) => void;

function registerGameChatWsHandlers(register: RegisterFn): void {
  register(GAME_CHAT_DOMAIN, (data, wsActions) => {
    const msg = data as GameChatServerInbound;
    const effects = createGameChatEffects(wsActions);

    switch (msg.type) {
      case 'join-room': {
        const { room } = msg.payload;
        if (!room) return;
        effects.joinChatRoom(room);
        break;
      }
      case 'leave-room': {
        const { room } = msg.payload;
        if (!room) return;
        effects.leaveChatRoom(room);
        break;
      }
      case 'post-message': {
        const user = msg.user;
        if (!user) return;
        const { room, content } = msg.payload;
        if (!room || typeof content !== 'string') return;
        void postMessage(
          Number(user.id),
          user.username,
          room,
          content,
          effects,
        );
        break;
      }
      default:
        // Unknown type for this domain; ignore
        break;
    }
  });
}

export { registerGameChatWsHandlers };
