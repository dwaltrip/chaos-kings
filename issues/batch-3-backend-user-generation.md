# Batch 3: Backend User Generation

**Status:** Ready after Batch 2  
**Dependencies:** Batch 2 (cookie infrastructure, auto-create endpoint)  

## Overview
Refine and optimize the user generation logic, add comprehensive testing, and ensure robust handling of edge cases in the backend user system.

## Tasks

### 1. Enhance Username Generation Logic
**File:** `backend/src/user/actions/auto-create-user.ts`

Improve the username generation to handle edge cases better:

```typescript
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
    
    // Log collision for monitoring (optional)
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

// Update autoCreateUser to use this function:
export async function autoCreateUser(dbInstance?: Kysely<Database>): Promise<AutoCreateResult> {
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
}
```

### 2. Add Comprehensive Error Handling
**File:** `backend/src/user/actions/auto-create-user.ts`

Add proper error handling and logging:

```typescript
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
```

### 3. Create Comprehensive Tests
**File:** `backend/src/user/actions/auto-create-user.test.ts`

```typescript
import { autoCreateUser } from './auto-create-user';
import { UserRepository } from '@/user/user-repository';
import { createTestDb, clearTestDb } from '@/tests/test-helpers';

describe('autoCreateUser', () => {
  let testDb: any;
  
  beforeEach(async () => {
    testDb = await createTestDb();
  });
  
  afterEach(async () => {
    await clearTestDb(testDb);
  });
  
  it('should create user with auto-generated username', async () => {
    const result = await autoCreateUser(testDb);
    
    expect(result.isNewUser).toBe(true);
    expect(result.user.username).toMatch(/^Player_\d{6}$/);
    expect(result.user.user_key).toBeDefined();
    expect(result.user.id).toBeDefined();
  });
  
  it('should generate unique usernames when collisions occur', async () => {
    // Create multiple users to test uniqueness
    const users = await Promise.all([
      autoCreateUser(testDb),
      autoCreateUser(testDb),
      autoCreateUser(testDb)
    ]);
    
    const usernames = users.map(u => u.user.username);
    const uniqueUsernames = new Set(usernames);
    
    expect(uniqueUsernames.size).toBe(3);
  });
  
  it('should handle database errors gracefully', async () => {
    // Mock repository to simulate database error
    jest.spyOn(UserRepository.prototype, 'create')
      .mockRejectedValue(new Error('Database connection failed'));
    
    await expect(autoCreateUser(testDb)).rejects.toThrow('Failed to create user account');
  });
  
  it('should generate user_key as valid UUID', async () => {
    const result = await autoCreateUser(testDb);
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(result.user.user_key).toMatch(uuidRegex);
  });
});
```

### 4. Update Existing Tests
**Files to update:**
- `backend/src/user/actions/create-user.test.ts`
- `backend/src/user/actions/update-username.test.ts`

Update existing tests to handle the new user_key field:

```typescript
// In create-user.test.ts - update test expectations:
expect(user.user_key).toBeDefined();
expect(typeof user.user_key).toBe('string');

// In update-username.test.ts - ensure test user has user_key:
const testUser = await createUser('testuser', testDb);
expect(testUser.user_key).toBeDefined();
```

### 5. Add Performance Monitoring
**File:** `backend/src/user/actions/auto-create-user.ts`

Add basic performance tracking:

```typescript
export async function autoCreateUser(dbInstance?: Kysely<Database>): Promise<AutoCreateResult> {
  const startTime = Date.now();
  
  try {
    // ... existing implementation
    
    const duration = Date.now() - startTime;
    if (duration > 1000) { // Log slow user creation (>1s)
      console.warn(`Slow user creation: ${duration}ms`);
    }
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`User creation failed after ${duration}ms:`, error);
    throw error;
  }
}
```

### 6. Update Route Error Handling
**File:** `backend/src/user/user-routes.ts`

Improve error handling in the auto-create endpoint:

```typescript
fastify.post('/users/auto-create', asyncHandler(async (request, reply) => {
  try {
    const result = await autoCreateUser();
    
    // Set cookie
    reply.setCookie(COOKIE_NAME, result.user.user_key, COOKIE_OPTIONS);
    
    return reply.status(201).send(result);
    
  } catch (error) {
    console.error('Auto-create user endpoint error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Username conflict')) {
        return reply.status(409).send({ error: 'Unable to generate unique username' });
      }
      
      if (error.message.includes('Database connection')) {
        return reply.status(503).send({ error: 'Service temporarily unavailable' });
      }
    }
    
    return reply.status(500).send({ error: 'Failed to create user account' });
  }
}));
```

## Acceptance Criteria

- [ ] Username generation handles collisions robustly (up to 50 attempts)
- [ ] Fallback username generation using timestamp works
- [ ] Comprehensive error handling for database issues
- [ ] Performance monitoring logs slow operations
- [ ] All new functionality has unit tests
- [ ] Existing tests updated for user_key field
- [ ] Auto-create endpoint returns proper HTTP status codes
- [ ] User generation works under concurrent load
- [ ] Generated usernames follow exact Player_###### format

## Testing

### Manual Testing Steps
1. Create multiple users rapidly to test uniqueness
2. Test error scenarios (database unavailable, etc.)
3. Verify performance under load (create 100+ users)
4. Check that generated usernames match expected format
5. Verify UUID format for user_key generation
6. Test concurrent user creation from multiple clients

### Automated Testing
- Run new auto-create-user test suite
- Update and run existing user action tests
- Performance tests for username generation
- Concurrent user creation tests
- Error handling tests

### Load Testing
- Test creating users under high concurrency
- Verify username uniqueness under load
- Monitor database performance with user creation spikes

## Dependencies for Next Batch
This batch completes the backend foundation. Batch 4 will focus on:
- Frontend integration with these backend endpoints
- User store replacement
- Frontend error handling

## Notes
- Username format strictly follows Player_###### (6 digits)
- Performance monitoring helps identify potential issues early
- Error handling provides specific HTTP status codes for different failures
- Fallback generation ensures system never completely fails to create users
