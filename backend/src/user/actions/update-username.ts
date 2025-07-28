import { UserRepository } from '@/user/user-repository';
import { UsersTable } from '@/user/user.db';
import { Selectable, Kysely } from 'kysely';
import { Database } from '@/types';

type User = Selectable<UsersTable>;

export async function updateUsername(userId: number, newUsername: string, dbInstance?: Kysely<Database>): Promise<User> {
  if (!newUsername || newUsername.trim().length === 0) {
    throw new Error('Username is required');
  }

  const trimmedUsername = newUsername.trim();

  if (trimmedUsername.length > 50) {
    throw new Error('Username must be 50 characters or less');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }

  try {
    const userRepository = new UserRepository(dbInstance);
    const updatedUser = await userRepository.updateUsername(userId, trimmedUsername);

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
