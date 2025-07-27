import { db } from '@/db';
import { UsersTable } from '@/users/user.tables';
import { Selectable, Kysely } from 'kysely';
import { Database } from '@/types';

type User = Selectable<UsersTable>;

export async function updateUsername(userId: number, newUsername: string, dbInstance: Kysely<Database> = db): Promise<User> {
  if (!newUsername || newUsername.trim().length === 0) {
    throw new Error('Username is required');
  }

  if (newUsername.length > 50) {
    throw new Error('Username must be 50 characters or less');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }

  try {
    const updatedUser = await dbInstance
      .updateTable('users')
      .set({ username: newUsername.trim() })
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      throw new Error('Username already exists');
    }
    throw error;
  }
}