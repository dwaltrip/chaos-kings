# Batch 2: Backend Cookie Infrastructure

**Status:** Ready after Batch 1  
**Dependencies:** Batch 1 (shared validation, user_key column, findByUserKey method)  

## Overview
Implement cookie-based authentication infrastructure and the new API endpoints for auto-user creation and current user lookup.

## Tasks

### 1. Install Cookie Dependencies
**Command:** `cd backend && npm install @fastify/cookie`

### 2. Configure Cookie Middleware
**File:** `backend/src/server.ts`

Add cookie support to the Fastify server:

```typescript
import fastifyCookie from '@fastify/cookie';

// Add after other plugin registrations
await fastify.register(fastifyCookie);
```

### 3. Create Cookie Configuration
**File:** `backend/src/user/cookie-config.ts`

```typescript
export const COOKIE_OPTIONS = {
  httpOnly: true,           // Prevent JS access for security
  secure: false,            // Set to true in production (HTTPS)
  sameSite: 'lax' as const, // CSRF protection
  maxAge: 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years (forever)
  path: '/'
};

export const COOKIE_NAME = 'general_v2:user_key';
```

### 4. Implement Auto-Create User Action
**File:** `backend/src/user/actions/auto-create-user.ts`

```typescript
import { UserRepository } from '@/user/user-repository';
import { UsersTable } from '@/user/user.db';
import { Selectable, Insertable, Kysely } from 'kysely';
import { Database } from '@/types';
import { validateUsername } from '@/../../common/validation/username';

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
  
  // NOTE: During implementation, move this naming logic to a separate function
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
```

### 5. Add findByUsername to Repository
**File:** `backend/src/user/user-repository.ts`

Add method needed for username uniqueness checking:

```typescript
async findByUsername(username: string): Promise<User | null> {
  const user = await this.dbInstance
    .selectFrom('users')
    .selectAll()
    .where('username', '=', username)
    .executeTakeFirst();

  return user || null;
}
```

### 6. Implement New API Endpoints
**File:** `backend/src/user/user-routes.ts`

Add the new cookie-based endpoints:

```typescript
import { autoCreateUser } from '@/user/actions/auto-create-user';
import { COOKIE_NAME, COOKIE_OPTIONS } from '@/user/cookie-config';

// Add these new routes:

// POST /users/auto-create
fastify.post('/users/auto-create', asyncHandler(async (request, reply) => {
  const result = await autoCreateUser();
  
  // Set cookie
  reply.setCookie(COOKIE_NAME, result.user.user_key, COOKIE_OPTIONS);
  
  return reply.status(201).send(result);
}));

// GET /users/me
fastify.get('/users/me', asyncHandler(async (request, reply) => {
  const userKey = request.cookies[COOKIE_NAME];
  
  if (!userKey) {
    return reply.status(404).send({ error: 'No user session found' });
  }
  
  const userRepository = new UserRepository();
  const user = await userRepository.findByUserKey(userKey);
  
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }
  
  return reply.send(user);
}));

// PUT /users/me/username
fastify.put('/users/me/username', asyncHandler(async (request, reply) => {
  const userKey = request.cookies[COOKIE_NAME];
  const { username } = request.body as { username: string };
  
  if (!userKey) {
    return reply.status(401).send({ error: 'No user session found' });
  }
  
  const userRepository = new UserRepository();
  const user = await userRepository.findByUserKey(userKey);
  
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }
  
  const updatedUser = await updateUsername(user.id, username);
  
  return reply.send(updatedUser);
}));
```

### 7. Update create-user Action for user_key
**File:** `backend/src/user/actions/create-user.ts`

Modify to generate user_key:

```typescript
// Add at top
import { validateUsername } from '@/../../common/validation/username';

// Replace validation logic with:
const validation = validateUsername(username);
if (!validation.isValid) {
  throw new Error(validation.error);
}

// Add user_key generation:
const newUser: NewUser = {
  username: trimmedUsername,
  user_key: crypto.randomUUID(), // Add this line
};
```

## API Endpoint Specifications

### POST /users/auto-create
- **Purpose:** Create new user with auto-generated username and set cookie
- **Request:** No body required
- **Response:** `{ user: User, isNewUser: boolean }`
- **Cookie:** Sets httpOnly cookie with user_key
- **Status:** 201 Created

### GET /users/me  
- **Purpose:** Get current user info from cookie
- **Request:** No body, reads cookie
- **Response:** `User` object
- **Status:** 200 OK or 404 Not Found

### PUT /users/me/username
- **Purpose:** Update current user's username using cookie auth
- **Request:** `{ username: string }`
- **Response:** Updated `User` object  
- **Status:** 200 OK, 401 Unauthorized, or 404 Not Found

## Acceptance Criteria

- [ ] Cookie middleware is properly configured
- [ ] POST /users/auto-create creates user and sets cookie
- [ ] GET /users/me reads cookie and returns user
- [ ] PUT /users/me/username updates user via cookie auth
- [ ] Generated usernames follow Player_###### format
- [ ] Username uniqueness is enforced during generation
- [ ] Cookies have correct security settings (httpOnly, sameSite, etc.)
- [ ] All existing endpoints still work
- [ ] user_key is populated for all new users

## Testing

### Manual Testing Steps
1. Test POST /users/auto-create - verify user created and cookie set
2. Test GET /users/me with valid cookie - should return user
3. Test GET /users/me without cookie - should return 404
4. Test PUT /users/me/username with valid cookie and username
5. Test PUT /users/me/username without cookie - should return 401
6. Verify cookie settings in browser dev tools
7. Test that multiple calls to auto-create make different users

### Automated Testing
- Unit tests for autoCreateUser function
- Integration tests for new endpoints
- Test cookie handling and security settings
- Test username generation uniqueness

## Dependencies for Next Batch
This batch enables Batch 3, which will focus on:
- Refining user generation logic
- Adding more comprehensive testing
- Performance optimizations

## Notes
- Keep existing REST endpoints functional during transition
- Cookie security settings optimized for development (secure: false)
- Need to update secure: true for production deployment
