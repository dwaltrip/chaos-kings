import { Selectable, Insertable } from 'kysely';

import { validateUsername } from '@/domains/users/validation/username';
import { UsersTable } from '@/domains/users/user.db';
import { userRepository } from '@/domains/users/user-repository';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

async function createUser(username: string): Promise<User> {
  const validation = validateUsername(username);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }
  const trimmedUsername = username.trim();

  const newUser: NewUser = {
    username: trimmedUsername,
    user_key: crypto.randomUUID(),
  };

  return await userRepository.create(newUser);
}

export { createUser };
