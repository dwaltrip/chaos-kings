import { Selectable } from 'kysely';

import { ChatMessageId, GameId, UserId } from '@kernel/ids';
import { buildGameRoomId } from '@platform/domains/gameplay/helpers';

import { GameChatMessagesTable } from '@/domains/chat/chat.db';
import { ChatMessageEntity } from '@/domains/chat/types';

type ChatMessageRow = Selectable<GameChatMessagesTable> & { username: string };

function toEntity(row: ChatMessageRow, gameId: GameId): ChatMessageEntity {
  const roomId = buildGameRoomId(gameId);
  return {
    id: ChatMessageId(row.id),
    gameId,
    userId: UserId(row.user_id),
    username: row.username,
    roomId,
    content: row.content,
    timestamp: row.created_at.getTime(),
  };
}

export { toEntity };
export type { ChatMessageRow };
