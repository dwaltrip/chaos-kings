import { Insertable, Kysely } from 'kysely';

import { invariant } from '@utils/assertions/invariant';
import { GameId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import { Database } from '@/types';
import { db } from '@/services/db';
import { UserRepository } from '@/domains/users/user-repository';
import { GameChatMessagesTable } from '@/domains/chat/chat.db';
import { ChatMessageEntity } from '@/domains/chat/types';
import { ChatMessageRow, toEntity } from '@/domains/chat/serializers';

class ChatMessageRepository {
  constructor(private dbInstance: Kysely<Database> = db) {}

  async createGameChat(data: Insertable<GameChatMessagesTable>): Promise<ChatMessageRow> {
    const message = await this.dbInstance
      .insertInto('game_chat_messages')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    const userRepo = new UserRepository(this.dbInstance);
    const user = await userRepo.findById(message.user_id);
    // This should never happen...
    invariant(!!user, `User with id ${message.user_id} not found`);

    return { ...message, username: user.username };
  }

  async findGameChatsByGameId(gameId: GameId): Promise<ChatMessageEntity[]> {
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

    return messages.map((msg) => toEntity(msg));
  }
}

export { ChatMessageRepository };
