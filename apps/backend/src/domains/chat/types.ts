import { ChatMessageId, RoomId, UserId } from '@kernel/ids';

interface ChatMessageEntity {
  id: ChatMessageId;
  userId: UserId;
  username: string;
  roomId: RoomId;
  content: string;
  timestamp: number;
}

export { ChatMessageEntity };
