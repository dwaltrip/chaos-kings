import type { UserId, RoomId } from '@kernel/ids';

interface ChatMessage {
  roomId: RoomId;
  content: string;
  userId: UserId;
  username: string;
  timestamp: number;
}

export type { ChatMessage };
