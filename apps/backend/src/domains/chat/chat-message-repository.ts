import { Insertable, Kysely } from 'kysely';

import { GameId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import { Database } from '@/types';
import { db } from '@/services/db';
import { GameChatMessagesTable } from '@/domains/chat/chat.db';
import { ChatMessageRow } from '@/domains/chat/serializers';

class ChatMessageRepository {
  constructor(private dbInstance: Kysely<Database> = db) {}

  async createGameChat(data: Insertable<GameChatMessagesTable>): Promise<ChatMessageRow> {
    const message = await this.dbInstance
      .insertInto('game_chat_messages')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    const messageWithUsername = await this.dbInstance
      .selectFrom('game_chat_messages')
      .innerJoin('users', 'users.id', 'game_chat_messages.user_id')
      .select([
        'game_chat_messages.id',
        'game_chat_messages.content',
        'game_chat_messages.created_at',
        'game_chat_messages.updated_at',
        'game_chat_messages.user_id',
        'game_chat_messages.game_id',
        'users.username',
      ])
      .where('game_chat_messages.id', '=', message.id)
      .executeTakeFirstOrThrow();

    return messageWithUsername;
  }

  async findGameChatsByGameId(gameId: GameId): Promise<ChatMessageRow[]> {
    const messages = await this.dbInstance
      .selectFrom('game_chat_messages')
      .innerJoin('users', 'users.id', 'game_chat_messages.user_id')
      .select([
        'game_chat_messages.id',
        'game_chat_messages.content',
        'game_chat_messages.created_at',
        'game_chat_messages.updated_at',
        'game_chat_messages.user_id',
        'game_chat_messages.game_id',
        'users.username',
      ])
      .where('game_chat_messages.game_id', '=', idToNumber(gameId))
      .orderBy('game_chat_messages.created_at', 'asc')
      .execute();

    return messages;
  }
}

export { ChatMessageRepository };
