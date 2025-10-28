import { Selectable, Kysely } from 'kysely';

import { Database } from '@/types';
import { UsersTable } from '@/domains/users/user.db';
import { UserRepository } from '@/domains/users/user-repository';

type User = Selectable<UsersTable>;

// TODO: this is duplicated in user-repository. Need to fix.
async function findUser(
  userId: number,
  dbInstance?: Kysely<Database>,
): Promise<User | null> {
  const userRepository = new UserRepository(dbInstance);

  return await userRepository.findById(userId);
}

export { findUser };
