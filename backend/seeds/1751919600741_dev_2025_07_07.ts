import type { Kysely } from 'kysely';

import { Database, NewUser } from '../src/types';

export async function seed(db: Kysely<Database>): Promise<void> {
  async function createUser(user: NewUser) {
    return await db.insertInto('users')
      .values(user)
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  const dan = await createUser({ username: 'dan' });
  const joe = await createUser({ username: 'joe' });

  console.log(
    `seeded users: ${dan.username} (id: ${dan.id}), ${joe.username} (id: ${joe.id})`
  );
}
