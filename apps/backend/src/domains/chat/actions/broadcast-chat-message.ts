import { RoomId, UserId } from '@kernel/ids';

import { chatWsEffects } from '@/domains/chat/ws-effects';
import { createChatMessage } from '@/domains/chat/actions';

async function broadcastChatMessage(roomId: RoomId, content: string, userId: UserId) {
  const chatMessage = await createChatMessage(roomId, content, userId);
  chatWsEffects.broadcastNewMessage(chatMessage);
}

export { broadcastChatMessage };
