import { Selectable, Insertable } from 'kysely';

import { BaseRepository } from '@/utils/base-repository';
import { UsersTable } from '@/domains/users/user.db';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

class UserRepository extends BaseRepository {
  async findById(id: number): Promise<User | null> {
    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return user || null;
  }

  async findByIds(ids: number[]): Promise<User[]> {
    return this.db.selectFrom('users').selectAll().where('id', 'in', ids).execute();
  }

  async findByUserKey(userKey: string): Promise<User | null> {
    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('user_key', '=', userKey)
      .executeTakeFirst();

    return user || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();

    return user || null;
  }

  async create(userData: NewUser): Promise<User> {
    const user = await this.db
      .insertInto('users')
      .values(userData)
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
  }

  async updateUsername(id: number, username: string): Promise<User | null> {
    const updatedUser = await this.db
      .updateTable('users')
      .set({ username })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return updatedUser || null;
  }
}

const userRepository = new UserRepository();

export { userRepository };
