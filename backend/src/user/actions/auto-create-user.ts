import { UserRepository } from '@/user/user-repository';
import { UsersTable } from '@/user/user.db';
import { Selectable, Insertable, Kysely } from 'kysely';
import { Database } from '@/types';

type User = Selectable<UsersTable>;
type NewUser = Insertable<UsersTable>;

interface AutoCreateResult {
  user: User;
  isNewUser: boolean;
}

export async function autoCreateUser(dbInstance?: Kysely<Database>): Promise<AutoCreateResult> {
  const userRepository = new UserRepository(dbInstance);
  
  // Generate unique username
  let username: string;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    const randomNum = Math.floor(Math.random() * 1000000);
    username = `Player_${randomNum}`;
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique username');
    }
    
    // Check if username already exists
    const existingUser = await userRepository.findByUsername(username);
    if (!existingUser) break;
    
  } while (true);
  
  // Generate user key
  const userKey = crypto.randomUUID();
  
  const newUser: NewUser = {
    username,
    user_key: userKey,
  };
  
  const user = await userRepository.create(newUser);
  
  return {
    user,
    isNewUser: true
  };
}