import { Selectable } from 'kysely';

import { validateUsername } from '@/domains/users/validation/username';
import { UsersTable } from '@/domains/users/user.db';
import { userRepository } from '@/domains/users/user-repository';

type User = Selectable<UsersTable>;

async function updateUsername(userId: number, newUsername: string): Promise<User> {
  const validation = validateUsername(newUsername);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const trimmedUsername = newUsername.trim();

  try {
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

export { updateUsername };
