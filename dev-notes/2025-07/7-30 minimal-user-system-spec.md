# Minimal User System Implementation Plan

**Project:** Generals v2  
**Date:** 2025-07-30  
**Scope:** Cookie-based auto-user creation with editable usernames (no passwords)

## Overview

This document outlines the implementation of a minimal user system for prototyping. Users are auto-created with unique keys stored in cookies, can edit their usernames, and the system requires no passwords or complex authentication.

## Current State Analysis

### ✅ Already Implemented
- Database schema with `users` table (`id`, `username`, `created_at`)
- Backend user CRUD operations (create, find, update username)
- REST API endpoints (`POST /users`, `GET /users/:id`, `PUT /users/:id/username`)
- Frontend username storage in localStorage
- Username form component with validation
- Zustand store for username management

### ❌ Missing Components
- Cookie-based user key system for persistent sessions
- Auto-creation of users on first visit
- Connection between frontend username and backend user records
- Enhanced user store in frontend that replaces the "username" store

## Implementation Plan

### 1. Database Schema Changes

**New Migration:** `add_user_key_column.ts`
```sql
-- Add user_key column for cookie-based identification
ALTER TABLE users ADD COLUMN user_key VARCHAR(255) UNIQUE NOT NULL;
CREATE INDEX idx_users_user_key ON users(user_key);
```

**Details:**
- Use UUID v4 for user keys: `crypto.randomUUID()`
- User key is permanent identifier, never changes
- Index on user_key for fast lookups

### 2. Backend Implementation

#### Cookie Configuration
```typescript
// Cookie settings
const COOKIE_OPTIONS = {
  httpOnly: true,           // Prevent JS access for security
  secure: false,            // Set to true in production (HTTPS)
  sameSite: 'lax' as const, // CSRF protection
  maxAge: 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years (forever)
  path: '/'
};

const COOKIE_NAME = 'general_v2:user_key';
```

#### New API Endpoints

**POST /users/auto-create**
- Creates new user with generated username and unique key
- Sets HTTP-only cookie with user key
- Returns user data and isNewUser flag

```typescript
// Request: No body required
// Response: 
{
  user: {
    id: number,
    username: string,
    user_key: string,
    created_at: string
  },
  isNewUser: boolean
}
```

**GET /users/me**
- Gets current user by reading cookie
- Returns 404 if no cookie or user not found

```typescript
// Response:
{
  id: number,
  username: string,
  user_key: string, 
  created_at: string
}
```

#### Modified Endpoints

**PUT /users/me/username** (or modify existing endpoint for cookie auth)
- Updates current user's username based on cookie
- Validates username according to backend rules

```typescript
// Request body:
{
  username: string
}
// Response: Updated user object
```

#### Default Username Generation
- Format: `Player_${Math.floor(Math.random() * 1000000)}`
- Examples: "Player_284751", "Player_942033"
- Check database for uniqueness during creation
- Retry with new random number if collision occurs

#### Username Validation (Shared Implementation)
- **Location:** `common/validation/username.ts` - shared between frontend and backend
- **Length:** 1-25 characters (updated from current 50)
- **Pattern:** `^[a-zA-Z0-9_-]+$` (letters, numbers, underscore, hyphen)
- **Required:** Non-empty after trimming
- Frontend and backend use same validation function for consistency

### 3. Frontend Implementation

#### Update localStorage Utility
```typescript
// In local-storage.ts
const LOCALSTORAGE_PREFIX = 'generals-v2'
const STORAGE_KEYS = {
  USERNAME: `${LOCALSTORAGE_PREFIX}:game-username`, // Updated prefix
} as const;
```

#### New User Service
```typescript
// services/user-service.ts
interface User {
  id: number;
  username: string;
  user_key: string;
  created_at: string;
}

class UserService {
  async initializeUser(): Promise<User> {
    try {
      // Try to get existing user
      const response = await fetch('/api/users/me');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to get existing user:', error);
    }

    // Auto-create new user
    const response = await fetch('/api/users/auto-create', {
      method: 'POST',
      credentials: 'include' // Include cookies
    });
    
    if (!response.ok) {
      throw new Error('Failed to create user');
    }
    
    const data = await response.json();
    return data.user;
  }
  
  async updateUsername(username: string): Promise<User> {
    const response = await fetch('/api/users/me/username', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update username');
    }
    
    return await response.json();
  }
}

export const userService = new UserService();
```

#### Enhanced User Store (renamed from username-store)
```typescript
// stores/user-store.ts (renamed from username-store.ts)
interface UserState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  actions: {
    initializeUser(): Promise<void>;
    updateUsername(username: string): Promise<void>;
    clearUser(): void;
  };
}

export const userStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  actions: {
    initializeUser: async () => {
      set({ isLoading: true });
      try {
        const user = await userService.initializeUser();
        set({ user, isLoading: false, isInitialized: true });
      } catch (error) {
        console.error('Failed to initialize user:', error);
        set({ isLoading: false, isInitialized: true });
      }
    },
    
    updateUsername: async (username: string) => {
      set({ isLoading: true });
      try {
        const updatedUser = await userService.updateUsername(username);
        set({ user: updatedUser, isLoading: false });
      } catch (error) {
        set({ isLoading: false });
        throw error; // Re-throw for form error handling
      }
    },
    
    clearUser: () => {
      set({ user: null, isInitialized: false });
    }
  }
}));
```

#### App Integration
```typescript
// App.tsx - Initialize user on startup
function App() {
  const { user, isLoading, isInitialized, actions } = userStore();
  
  useEffect(() => {
    if (!isInitialized) {
      actions.initializeUser();
    }
  }, [isInitialized, actions]);
  
  if (!isInitialized || isLoading) {
    return <div>Loading...</div>;
  }
  
  // Rest of app...
}
```

#### Updated Username Form
```typescript
// Update existing username-form.tsx to use backend
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const validationError = validateUsername(inputValue);
  if (validationError) {
    setError(validationError);
    return;
  }

  try {
    setError('');
    await actions.updateUsername(inputValue);
    setInputValue('');
    onUsernameSet?.();
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Failed to update username');
  }
};
```

### 4. Implementation Order

1. **Backend Migration** - Add `user_key` column to users table
2. **Backend Cookie Setup** - Add Fastify cookie middleware 
3. **Backend Endpoints** - Implement auto-create and me endpoints
4. **Backend Auth** - Add cookie-based auth to username update
5. **Shared Validation** - Create shared validation function in common/validation/username.ts
6. **Frontend Service** - Create user service with backend integration
7. **Frontend Store** - Rename and update username store to user store, use service instead of localStorage
8. **Frontend Integration** - Initialize user on app startup
9. **Manual Testing** - Test full user creation and username editing flow

### 5. User Flows

#### First-Time User Flow
```
1. User visits site
2. App.tsx calls userStore.initializeUser()
3. userService.initializeUser() calls GET /users/me
4. Returns 404 (no cookie exists)
5. Calls POST /users/auto-create
6. Backend generates UUID key + "Player_123456" username
7. Backend sets cookie and returns user data
8. Frontend stores user in Zustand store
9. User sees their generated username in UI
```

#### Returning User Flow
```
1. User visits site (has cookie from previous visit)
2. App.tsx calls userStore.initializeUser()
3. userService.initializeUser() calls GET /users/me
4. Backend reads cookie, finds user, returns user data
5. Frontend stores user in Zustand store
6. User sees their saved username in UI
```

#### Username Edit Flow
```
1. User submits new username via existing form
2. Form calls userStore.updateUsername()
3. userService.updateUsername() calls PUT /users/me/username
4. Backend validates username and updates database
5. Backend returns updated user data
6. Frontend updates store with new username
7. UI reflects new username immediately
```

### 6. Key Decisions Made

- **Cookie name:** `general_v2:user_key` (matches localStorage prefix pattern)
- **Cookie expiry:** ~100 years (effectively permanent)
- **Default username format:** `Player_######` with random 6-digit numbers
- **Username validation:** Backend authoritative, max 25 chars, alphanumeric + underscore/hyphen
- **Error handling:** Minimal - ignore edge cases like deleted users for now
- **No migration:** Fresh start, no existing user data to preserve
- **No user deletion:** Keep all user records permanently
- **No admin features:** Pure minimal implementation

### 7. Technical Notes

#### Backend Dependencies
- Add `@fastify/cookie` for cookie handling
- Use Node.js built-in `crypto.randomUUID()` for user keys
- Import shared validation from `common/validation/username.ts`

#### Frontend Dependencies  
- No new dependencies required
- Remove localStorage dependency from username management
- Import shared validation from `common/validation/username.ts`

#### Database Considerations
- Migration will need to populate user_key for existing users (if any)
- Consider adding created_at index if user lookup by date becomes needed
- user_key should never be exposed to client-side JavaScript (httpOnly cookies)

#### Security Notes
- HttpOnly cookies prevent XSS attacks on user keys
- SameSite=lax prevents CSRF while allowing normal navigation
- No sensitive data stored (usernames are public game identifiers)
- User keys are UUIDs, not sequential, preventing enumeration

### 8. Testing Checklist

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

### 9. Future Enhancements (Out of Scope)

- User deletion/cleanup
- Username history
- User profile pictures/avatars  
- User statistics
- Account recovery mechanisms
- Admin user management interface
- Rate limiting on user creation
- User blocking/reporting system

### 10. Prototype-First Approach: What We're Intentionally Skipping

This implementation deliberately omits many "production-ready" features to focus on rapid prototyping:

**Authentication & Security**
- No passwords, email verification, or OAuth integration
- No session expiration or refresh tokens
- No rate limiting on endpoints
- No CAPTCHA or bot protection

**Data Integrity & Edge Cases**
- No handling of corrupted cookies or malicious user keys
- No cleanup of orphaned user records
- No handling of database conflicts during high-concurrency user creation
- No validation of cookie tampering

**User Experience Polish**
- No "remember me" toggles or session preferences
- No user onboarding flow or welcome messages
- No username suggestions when conflicts occur
- No undo/redo for username changes

**Monitoring & Operations**
- No logging of user creation events
- No metrics on user retention or activity
- No admin tools for user management
- No backup/restore procedures for user data

**Scalability Concerns**
- No database connection pooling considerations
- No CDN or caching strategies for user data
- No horizontal scaling patterns
- No performance optimization for user lookups

**Compliance & Legal**
- No GDPR/privacy policy integration
- No terms of service acceptance tracking
- No data export/deletion capabilities
- No audit trails for user actions

These omissions are intentional - we can add them later if/when the prototype proves valuable and needs to scale. For now, the focus is on getting a working multiplayer game experience.

---

This implementation provides a solid foundation for user management while keeping the scope minimal for prototyping phase.
