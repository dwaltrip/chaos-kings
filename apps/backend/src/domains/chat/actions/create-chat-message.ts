import { GameId, UserId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import { ChatMessageRepository } from '@/domains/chat/chat-message-repository';
import { toEntity } from '@/domains/chat/serializers';
import { ChatMessageEntity } from '@/domains/chat/types';

async function createChatMessage(
  gameId: GameId,
  content: string,
  userId: UserId,
): Promise<ChatMessageEntity> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Chat message content cannot be empty');
  }

  const chatRepo = new ChatMessageRepository();
  const dbRow = await chatRepo.createGameChat({
    content: trimmed,
    user_id: idToNumber(userId),
    game_id: idToNumber(gameId),
  });

  return toEntity(dbRow);
}

export { createChatMessage };
