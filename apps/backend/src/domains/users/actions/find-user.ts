import { UserRepository } from '@/user/user-repository';
import { UsersTable } from '@/user/user.db';
import { Selectable, Kysely } from 'kysely';
import { Database } from '@/types';

type User = Selectable<UsersTable>;

async function findUser(
  userId: number,
  dbInstance?: Kysely<Database>,
): Promise<User | null> {
  const userRepository = new UserRepository(dbInstance);

  return await userRepository.findById(userId);
}

export { findUser };
