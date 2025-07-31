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

interface UsernameGenerationOptions {
  maxAttempts?: number;
  minRandomNumber?: number;
  maxRandomNumber?: number;
}

async function generateUniqueUsername(
  repository: UserRepository, 
  options: UsernameGenerationOptions = {}
): Promise<string> {
  const { 
    maxAttempts = 50, 
    minRandomNumber = 100000, 
    maxRandomNumber = 999999 
  } = options;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const randomNum = Math.floor(
      Math.random() * (maxRandomNumber - minRandomNumber + 1) + minRandomNumber
    );
    const username = `Player_${randomNum}`;
    
    // Check if username exists
    const existingUser = await repository.findByUsername(username);
    
    if (!existingUser) {
      return username;
    }
    
    // Log collision for monitoring
    if (attempt % 10 === 0) {
      console.warn(`Username generation collision attempt ${attempt} for ${username}`);
    }
  }
  
  // Fallback: use timestamp-based username
  const timestamp = Date.now().toString().slice(-6);
  const fallbackUsername = `Player_${timestamp}`;
  
  // Final check on fallback
  const existingFallback = await repository.findByUsername(fallbackUsername);
  if (existingFallback) {
    throw new Error('Failed to generate unique username after all attempts');
  }
  
  return fallbackUsername;
}

export async function autoCreateUser(dbInstance?: Kysely<Database>): Promise<AutoCreateResult> {
  try {
    const userRepository = new UserRepository(dbInstance);
    
    const username = await generateUniqueUsername(userRepository);
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
    
  } catch (error) {
    console.error('Failed to auto-create user:', error);
    
    if (error instanceof Error) {
      // Handle specific database errors
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        throw new Error('Username conflict occurred during user creation');
      }
      
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        throw new Error('Database connection error during user creation');
      }
    }
    
    throw new Error('Failed to create user account');
  }
}