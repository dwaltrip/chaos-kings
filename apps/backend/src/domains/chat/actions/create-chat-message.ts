import { GameId, UserId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import { toEntity } from '@/domains/chat/serializers';
import { chatMessageRepository } from '@/domains/chat/chat-message-repository';
import { ChatMessageEntity } from '@/domains/chat/types';
import { invariant } from '@utils/assertions/invariant';

async function createChatMessage(
  gameId: GameId,
  content: string,
  userId: UserId,
): Promise<ChatMessageEntity> {
  const trimmed = content.trim();
  invariant(!!trimmed, 'Chat message content cannot be empty');

  return toEntity(
    await chatMessageRepository.createGameChat({
      content: trimmed,
      user_id: idToNumber(userId),
      game_id: idToNumber(gameId),
    }),
  );
}

export { createChatMessage };
