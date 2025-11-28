import { ChatMessageId, GameId, RoomId, UserId } from '@kernel/ids';

interface ChatMessageEntity {
  id: ChatMessageId;
  gameId: GameId;
  userId: UserId;
  username: string;
  roomId: RoomId;
  content: string;
  timestamp: number;
}

export type { ChatMessageEntity };
