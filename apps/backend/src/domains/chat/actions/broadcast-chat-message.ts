import { ChatMessageEntity } from '@/domains/chat/types';
import { chatWsEffects } from '@/domains/chat/ws-effects';

// TODO: Put into shared types, and standardize the pattern
type UserContext = { userId: string };

function broadcastChatMessage(message: ChatMessageEntity, ctx: UserContext) {
  chatWsEffects.broadcastNewMessage(message);
}

export { broadcastChatMessage };
