import { UserRepository } from '@/user/user-repository';
import { UsersTable } from '@/user/user.db';
import { Selectable, Insertable, Kysely } from 'kysely';
import { Database } from '@/types';
import { validateUsername } from '@common/validation/username';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

async function createUser(username: string, dbInstance?: Kysely<Database>): Promise<User> {
  const validation = validateUsername(username);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }
  const trimmedUsername = username.trim();

  const newUser: NewUser = {
    username: trimmedUsername,
    user_key: crypto.randomUUID(),
  };

  const userRepository = new UserRepository(dbInstance);
  return await userRepository.create(newUser);
}

export { createUser };

