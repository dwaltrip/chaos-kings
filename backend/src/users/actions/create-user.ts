import { db } from '@/db';
import { UsersTable } from '@/users/user.tables';
import { Selectable, Insertable } from 'kysely';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

export async function createUser(username: string): Promise<User> {
  if (!username || username.trim().length === 0) {
    throw new Error('Username is required');
  }

  if (username.length > 50) {
    throw new Error('Username must be 50 characters or less');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }

  try {
    const newUser: NewUser = {
      username: username.trim(),
    };

    const user = await db
      .insertInto('users')
      .values(newUser)
      .returningAll()
      .executeTakeFirstOrThrow();

    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      throw new Error('Username already exists');
    }
    throw error;
  }
}