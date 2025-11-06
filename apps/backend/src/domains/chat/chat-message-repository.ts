import { Selectable, Insertable, Kysely } from 'kysely';

import { GameId } from '@kernel/ids';

import { Database } from '@/types';
import { db } from '@/services/db';
import { GameChatMessagesTable } from '@/domains/chat/chat.db';

type GameChatMessageDB = Selectable<GameChatMessagesTable>;
type NewGameChatMessage = Insertable<GameChatMessagesTable>;

class ChatMessageRepository {
  constructor(private dbInstance: Kysely<Database> = db) {}

  async createGameChat(data: NewGameChatMessage): Promise<GameChatMessageDB> {
    const message = await this.dbInstance
      .insertInto('game_chat_messages')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    return message;
  }

  async findGameChatsByGameId(gameId: GameId): Promise<GameChatMessageDB[]> {
    const messages = await this.dbInstance
      .selectFrom('game_chat_messages')
      .selectAll()
      .where('game_id', '=', gameId)
      .orderBy('created_at', 'asc')
      .execute();

    return messages;
  }
}

export { ChatMessageRepository };
