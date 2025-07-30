# Batch 5: Testing & Polish

**Status:** Ready after Batch 4  
**Dependencies:** Batches 1-4 (complete user system implementation)  

## Overview
Comprehensive end-to-end testing of the user system, performance verification, bug fixes, and final polish to ensure production readiness.

## Tasks

### 1. End-to-End User Flow Testing
**Manual testing checklist covering all user scenarios:**

#### First-Time User Flow
- [ ] Visit site in fresh browser/incognito
- [ ] Verify auto-creation happens automatically
- [ ] Check that generated username follows `Player_######` format
- [ ] Confirm user appears in database with proper user_key
- [ ] Verify cookie is set with correct attributes
- [ ] Test that username form shows current generated username

#### Returning User Flow
- [ ] Refresh page with existing cookie
- [ ] Verify same user is loaded (no new user created)
- [ ] Check that username persists correctly
- [ ] Open multiple tabs → should share same user
- [ ] Close/reopen browser → should maintain session

#### Username Update Flow
- [ ] Submit new valid username
- [ ] Verify immediate UI update
- [ ] Refresh page → confirm username persisted
- [ ] Try invalid usernames → verify validation errors
- [ ] Test 25-character username (boundary case)
- [ ] Test special characters and spaces

#### Error Scenarios
- [ ] Simulate network failure during user creation
- [ ] Simulate network failure during username update
- [ ] Test with backend server offline
- [ ] Test with database unavailable
- [ ] Verify graceful degradation and error messages

### 2. Cross-Browser Testing
Test the complete flow in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

Verify:
- Cookie handling works correctly
- User sessions persist across browser restarts
- No JavaScript errors in console
- UI renders correctly on all browsers

### 3. Performance Testing
**File:** `backend/src/tests/performance/user-creation.test.ts`

Create performance tests:

```typescript
import { autoCreateUser } from '@/user/actions/auto-create-user';
import { createTestDb, clearTestDb } from '@/tests/test-helpers';

describe('User Creation Performance', () => {
  let testDb: any;
  
  beforeEach(async () => {
    testDb = await createTestDb();
  });
  
  afterEach(async () => {
    await clearTestDb(testDb);
  });
  
  it('should create users within acceptable time limits', async () => {
    const startTime = Date.now();
    
    await autoCreateUser(testDb);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
  
  it('should handle concurrent user creation', async () => {
    const startTime = Date.now();
    
    // Create 10 users concurrently
    const promises = Array(10).fill(null).map(() => autoCreateUser(testDb));
    const users = await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    
    // All users should be unique
    const usernames = users.map(u => u.user.username);
    const uniqueUsernames = new Set(usernames);
    expect(uniqueUsernames.size).toBe(10);
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000);
  });
});
```

### 4. Integration Test Suite
**File:** `backend/src/tests/integration/user-api.test.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { buildServer } from '@/server';
import { createTestDb, clearTestDb } from '@/tests/test-helpers';

describe('User API Integration', () => {
  let server: FastifyInstance;
  let testDb: any;
  
  beforeEach(async () => {
    testDb = await createTestDb();
    server = buildServer({ database: testDb });
    await server.ready();
  });
  
  afterEach(async () => {
    await clearTestDb(testDb);
    await server.close();
  });
  
  describe('POST /users/auto-create', () => {
    it('should create user and set cookie', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/auto-create'
      });
      
      expect(response.statusCode).toBe(201);
      
      const body = JSON.parse(response.body);
      expect(body.user.username).toMatch(/^Player_\d{6}$/);
      expect(body.isNewUser).toBe(true);
      
      // Check cookie was set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader[0]).toContain('general_v2:user_key');
    });
  });
  
  describe('GET /users/me', () => {
    it('should return user with valid cookie', async () => {
      // First create a user
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/users/auto-create'
      });
      
      const cookies = createResponse.cookies;
      
      // Then get the user
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/me',
        cookies
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.username).toMatch(/^Player_\d{6}$/);
    });
    
    it('should return 404 without cookie', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/me'
      });
      
      expect(response.statusCode).toBe(404);
    });
  });
  
  describe('PUT /users/me/username', () => {
    it('should update username with valid cookie', async () => {
      // Create user first
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/users/auto-create'
      });
      
      const cookies = createResponse.cookies;
      
      // Update username
      const response = await server.inject({
        method: 'PUT',
        url: '/api/users/me/username',
        payload: { username: 'NewUsername' },
        cookies
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.username).toBe('NewUsername');
    });
  });
});
```

### 5. Frontend Testing
**File:** `frontend/src/services/user-service.test.ts`

```typescript
import { userService } from './user-service';

// Mock fetch
global.fetch = jest.fn();

describe('UserService', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });
  
  describe('initializeUser', () => {
    it('should return existing user if available', async () => {
      const mockUser = {
        id: 1,
        username: 'TestUser',
        user_key: 'test-key',
        created_at: '2025-01-01'
      };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser)
      });
      
      const user = await userService.initializeUser();
      
      expect(fetch).toHaveBeenCalledWith('/api/users/me', {
        credentials: 'include'
      });
      expect(user).toEqual(mockUser);
    });
    
    it('should auto-create user if none exists', async () => {
      const mockUser = {
        id: 1,
        username: 'Player_123456',
        user_key: 'new-key',
        created_at: '2025-01-01'
      };
      
      // First call returns 404
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ user: mockUser, isNewUser: true })
        });
      
      const user = await userService.initializeUser();
      
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(user).toEqual(mockUser);
    });
  });
});
```

### 6. Database Migration Testing
Verify database schema and migrations:

```bash
# Test migration on fresh database
npm run migrate:latest

# Verify schema
psql -d generals_v2_dev -c "\\d users"

# Check constraints
psql -d generals_v2_dev -c "SELECT * FROM information_schema.table_constraints WHERE table_name = 'users';"

# Test index exists
psql -d generals_v2_dev -c "SELECT * FROM pg_indexes WHERE tablename = 'users';"
```

### 7. Security Testing
Verify security measures:

#### Cookie Security
- [ ] Cookies are httpOnly (not accessible via JavaScript)
- [ ] Cookies have proper sameSite setting
- [ ] Cookies have reasonable expiration
- [ ] user_key is never exposed to client-side JavaScript

#### Input Validation
- [ ] Username validation works on both frontend and backend
- [ ] SQL injection attempts are prevented
- [ ] XSS attempts in usernames are blocked
- [ ] Long username attacks fail gracefully

#### Session Management
- [ ] user_key cannot be guessed or enumerated
- [ ] Invalid cookies are handled gracefully
- [ ] Expired sessions are cleaned up properly

### 8. Final Polish Tasks

#### Code Quality
- [ ] Run linting on all modified files
- [ ] Fix any TypeScript errors
- [ ] Update JSDoc comments where needed
- [ ] Remove any console.log statements (keep console.error/warn)

#### Documentation Updates
- [ ] Update README if needed
- [ ] Add API documentation for new endpoints
- [ ] Document any environment variable requirements

#### Performance Optimization
- [ ] Verify no unnecessary re-renders in React components
- [ ] Check database query performance
- [ ] Minimize API calls in user initialization

## Acceptance Criteria

### Functionality
- [ ] All user flows work end-to-end
- [ ] Error handling is comprehensive
- [ ] Performance meets requirements (<1s user creation)
- [ ] Security measures are properly implemented

### Quality
- [ ] All tests pass (unit, integration, performance)
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Code follows project conventions

### Cross-Platform
- [ ] Works in all major browsers
- [ ] Mobile responsive (if applicable)
- [ ] Handles network connectivity issues

### Production Readiness
- [ ] Proper error logging
- [ ] Graceful degradation
- [ ] No data leaks or security issues
- [ ] Performance monitoring in place

## Final Testing Checklist

Run through the complete testing checklist specified in the original spec:

- [ ] New user auto-creation works
- [ ] Returning user recognition works  
- [ ] Username editing persists across sessions
- [ ] Username validation works on frontend and backend
- [ ] Unique username enforcement works
- [ ] Cookie settings are correct (httpOnly, etc.)
- [ ] Multiple browser tabs share same user
- [ ] Incognito/private browsing creates new users
- [ ] Backend endpoints return proper error codes
- [ ] Frontend handles network errors gracefully

## Deployment Preparation

### Environment Configuration
- [ ] Set `secure: true` for cookies in production
- [ ] Configure proper CORS settings
- [ ] Set up database connection pooling
- [ ] Configure Redis if needed

### Monitoring
- [ ] Set up error tracking
- [ ] Configure performance monitoring
- [ ] Add health check endpoints

## Notes
- This batch ensures the system is truly production-ready
- Focus on edge cases and error scenarios
- Performance testing prevents scalability issues
- Security testing protects user data
- Cross-browser testing ensures wide compatibility
