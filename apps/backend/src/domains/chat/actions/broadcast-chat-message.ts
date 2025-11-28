import { GameId, UserId } from '@kernel/ids';

import { chatWsEffects } from '@/domains/chat/ws-effects';
import { createChatMessage } from '@/domains/chat/actions';

async function broadcastChatMessage(gameId: GameId, content: string, userId: UserId) {
  const chatMessage = await createChatMessage(gameId, content, userId);
  chatWsEffects.broadcastNewMessage(chatMessage);
}

export { broadcastChatMessage };
