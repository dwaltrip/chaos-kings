import { Selectable, Insertable, Kysely } from 'kysely';

import { validateUsername } from '@/domains/users/validation/username';
import { Database } from '@/types';
import { UsersTable } from '@/domains/users/user.db';
import {
  userRepository,
  createUserRepository,
} from '@/domains/users/user-repository';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

async function createUser(
  username: string,
  dbInstance?: Kysely<Database>,
): Promise<User> {
  const validation = validateUsername(username);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }
  const trimmedUsername = username.trim();

  const newUser: NewUser = {
    username: trimmedUsername,
    user_key: crypto.randomUUID(),
  };

  const repo = dbInstance ? createUserRepository(dbInstance) : userRepository;
  return await repo.create(newUser);
}

export { createUser };
