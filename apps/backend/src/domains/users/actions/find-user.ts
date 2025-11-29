import { Selectable, Kysely } from 'kysely';

import { Database } from '@/types';
import { UsersTable } from '@/domains/users/user.db';
import {
  userRepository,
  createUserRepository,
} from '@/domains/users/user-repository';

type User = Selectable<UsersTable>;

// TODO: this is duplicated in user-repository. Need to fix.
async function findUser(
  userId: number,
  dbInstance?: Kysely<Database>,
): Promise<User | null> {
  const repo = dbInstance ? createUserRepository(dbInstance) : userRepository;
  return await repo.findById(userId);
}

export { findUser };
