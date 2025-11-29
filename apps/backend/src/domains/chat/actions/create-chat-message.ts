import { ChatMessageId, RoomId, UserId } from '@kernel/ids';

import { requireEntity } from '@/utils/db-utils';
import { userRepository } from '@/domains/users/user-repository';
import { ChatMessageEntity } from '@/domains/chat/types';

async function createChatMessage(
  roomId: RoomId,
  content: string,
  userId: UserId,
): Promise<ChatMessageEntity> {
  // TODO: [DB] Get message ID from database after insert
  const tempId = ChatMessageId(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  // TODO: timestamp should come from DB
  const timestamp = Date.now();

  const user = await requireEntity(
    userRepository.findById(userId),
    'User not found for broadcasting chat message',
  );

  const trimmed = content.trim();
  if (!trimmed) {
    console.error('Chat message contents empty...');
  }

  return {
    id: tempId,
    roomId,
    content,
    userId,
    username: user.username,
    timestamp,
  };
}

export { createChatMessage };
