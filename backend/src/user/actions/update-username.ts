import { UserRepository } from '@/user/user-repository';
import { UsersTable } from '@/user/user.db';
import { Selectable, Kysely } from 'kysely';
import { Database } from '@/types';
import { validateUsername } from '@common/validation/username';

type User = Selectable<UsersTable>;

async function updateUsername(
  userId: number,
  newUsername: string,
  dbInstance?: Kysely<Database>,
): Promise<User> {
  const validation = validateUsername(newUsername);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const trimmedUsername = newUsername.trim();

  try {
    const userRepository = new UserRepository(dbInstance);
    const updatedUser = await userRepository.updateUsername(
      userId,
      trimmedUsername,
    );

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

export { updateUsername };
