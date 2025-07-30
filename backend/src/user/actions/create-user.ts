import { UserRepository } from '@/user/user-repository';
import { UsersTable } from '@/user/user.db';
import { Selectable, Insertable, Kysely } from 'kysely';
import { Database } from '@/types';
import { validateUsername } from '@common/validation/username';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

export async function createUser(username: string, dbInstance?: Kysely<Database>): Promise<User> {
  const validation = validateUsername(username);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const trimmedUsername = username.trim();

  try {
    const newUser: NewUser = {
      username: trimmedUsername,
      user_key: crypto.randomUUID(),
    };

    const userRepository = new UserRepository(dbInstance);
    const user = await userRepository.create(newUser);

    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      throw new Error('Username already exists');
    }
    throw error;
  }
}
