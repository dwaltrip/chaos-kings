import { Selectable } from 'kysely';

import { UsersTable } from '@/domains/users/user.db';
import { userRepository } from '@/domains/users/user-repository';

type User = Selectable<UsersTable>;

async function findUser(userId: number): Promise<User | null> {
  return await userRepository.findById(userId);
}

export { findUser };
