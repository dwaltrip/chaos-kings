import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';

interface ChatMessageEntity {
  id: string; // TODO: [BRANDED_TYPES-chatMessageId] - create ChatMessageId branded type
  userId: UserId;
  roomId: RoomId;
  content: string;
  timestamp: number; // TODO: figure out how timestamps will work...
}

export { ChatMessageEntity };
