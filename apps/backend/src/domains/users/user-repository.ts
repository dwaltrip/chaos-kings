import { Selectable, Insertable, Kysely } from 'kysely';

import { Database } from '@/types';
import { db } from '@/services/db';
import { UsersTable } from '@/domains/users/user.db';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

class UserRepository {
  constructor(private dbInstance: Kysely<Database> = db) {}

  async findById(id: number): Promise<User | null> {
    const user = await this.dbInstance
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return user || null;
  }

  async findByUserKey(userKey: string): Promise<User | null> {
    const user = await this.dbInstance
      .selectFrom('users')
      .selectAll()
      .where('user_key', '=', userKey)
      .executeTakeFirst();

    return user || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.dbInstance
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();

    return user || null;
  }

  async create(userData: NewUser): Promise<User> {
    const user = await this.dbInstance
      .insertInto('users')
      .values(userData)
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
  }

  async updateUsername(id: number, username: string): Promise<User | null> {
    const updatedUser = await this.dbInstance
      .updateTable('users')
      .set({ username })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return updatedUser || null;
  }
}

export { UserRepository };
