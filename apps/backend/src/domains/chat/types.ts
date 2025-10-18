import { ChatMessageId } from '@kernel/domains/chat';
import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';

interface ChatMessageEntity {
  id: ChatMessageId;
  userId: UserId;
  roomId: RoomId;
  content: string;
  timestamp: number; // TODO: figure out how timestamps will work...
}

export { ChatMessageEntity };
