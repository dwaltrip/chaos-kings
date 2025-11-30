import { Selectable, Insertable } from 'kysely';

import { UsersTable } from '@/domains/users/user.db';
import { userRepository } from '@/domains/users/user-repository';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

interface AutoCreateResult {
  user: User;
  isNewUser: boolean;
}

const MAX_ATTEMPTS = 50;
const MIN_RANDOM_NUMBER = 100000;
const MAX_RANDOM_NUMBER = 999999;

async function generateUniqueUsername(): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const randomNum = Math.floor(
      Math.random() * (MAX_RANDOM_NUMBER - MIN_RANDOM_NUMBER + 1) + MIN_RANDOM_NUMBER,
    );
    const username = `Player_${randomNum}`;

    // Check if username exists
    const existingUser = await userRepository.findByUsername(username);
    if (!existingUser) {
      return username;
    }
  }

  // Fallback: use timestamp-based username
  const timestamp = Date.now().toString().slice(-6);
  const fallbackUsername = `Player_${timestamp}`;
  console.warn(`[generateUniqueUsername] Using fallback username: ${fallbackUsername}`);
  return fallbackUsername;
}

async function autoCreateUser(): Promise<AutoCreateResult> {
  const username = await generateUniqueUsername();
  const userKey = crypto.randomUUID();

  const newUser: NewUser = {
    username,
    user_key: userKey,
  };

  const user = await userRepository.create(newUser);
  return {
    user,
    isNewUser: true,
  };
}

export { autoCreateUser };
