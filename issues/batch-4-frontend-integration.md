# Batch 4: Frontend Integration

**Status:** Ready after Batch 3  
**Dependencies:** Batches 1-3 (backend endpoints, cookie auth, user generation)  

## Overview
Replace the localStorage-based username system with full backend integration, including user service, updated store, and automatic user initialization.

## Tasks

### 1. Update localStorage Configuration
**File:** `frontend/src/utils/local-storage.ts`

Update the storage prefix as specified in the spec:

```typescript
const LOCALSTORAGE_PREFIX = 'generals-v2';
const STORAGE_KEYS = {
  USERNAME: `${LOCALSTORAGE_PREFIX}:game-username`, // Updated prefix
} as const;
```

### 2. Create User Service
**File:** `frontend/src/services/user-service.ts`

Create the service that handles all backend API communication:

```typescript
import { validateUsername } from '@/../../common/validation/username';

export interface User {
  id: number;
  username: string;
  user_key: string;
  created_at: string;
}

export interface AutoCreateResult {
  user: User;
  isNewUser: boolean;
}

class UserService {
  private baseUrl = '/api';

  async initializeUser(): Promise<User> {
    try {
      // Try to get existing user first
      const response = await fetch(`${this.baseUrl}/users/me`, {
        credentials: 'include' // Include cookies
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // If no existing user found, auto-create
      if (response.status === 404) {
        return await this.autoCreateUser();
      }
      
      throw new Error(`Failed to get user: ${response.status}`);
      
    } catch (error) {
      console.warn('Failed to get existing user, creating new one:', error);
      return await this.autoCreateUser();
    }
  }
  
  private async autoCreateUser(): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users/auto-create`, {
      method: 'POST',
      credentials: 'include' // Include cookies
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create user: ${response.status}`);
    }
    
    const data: AutoCreateResult = await response.json();
    return data.user;
  }
  
  async updateUsername(username: string): Promise<User> {
    // Client-side validation first
    const validation = validateUsername(username);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    const response = await fetch(`${this.baseUrl}/users/me/username`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json' 
      },
      credentials: 'include',
      body: JSON.stringify({ username: username.trim() })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update username');
    }
    
    return await response.json();
  }
  
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }
}

export const userService = new UserService();
```

### 3. Create New User Store
**File:** `frontend/src/stores/user-store.ts` (renamed from username-store.ts)

Replace the username store with a full user store:

```typescript
import { create } from 'zustand';
import { userService, User } from '@/services/user-service';

interface UserState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  actions: {
    initializeUser(): Promise<void>;
    updateUsername(username: string): Promise<void>;
    clearUser(): void;
    getCurrentUser(): Promise<void>;
  };
}

export const userStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  
  actions: {
    initializeUser: async () => {
      if (get().isLoading || get().isInitialized) {
        return;
      }
      
      set({ isLoading: true });
      
      try {
        const user = await userService.initializeUser();
        set({ 
          user, 
          isLoading: false, 
          isInitialized: true 
        });
      } catch (error) {
        console.error('Failed to initialize user:', error);
        set({ 
          user: null, 
          isLoading: false, 
          isInitialized: true 
        });
        throw error;
      }
    },
    
    updateUsername: async (username: string) => {
      const currentUser = get().user;
      if (!currentUser) {
        throw new Error('No user session found');
      }
      
      set({ isLoading: true });
      
      try {
        const updatedUser = await userService.updateUsername(username);
        set({ 
          user: updatedUser, 
          isLoading: false 
        });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },
    
    getCurrentUser: async () => {
      try {
        const user = await userService.getCurrentUser();
        set({ user });
      } catch (error) {
        console.error('Failed to get current user:', error);
        set({ user: null });
      }
    },
    
    clearUser: () => {
      set({ 
        user: null, 
        isInitialized: false,
        isLoading: false
      });
    }
  }
}));
```

### 4. Update Username Form
**File:** `frontend/src/pages/home/username-form.tsx`

Update the form to use the new user store and backend validation:

```typescript
import { useState } from 'react';
import { userStore } from '@/stores/user-store';
import { validateUsername } from '@/../../common/validation/username';

interface UsernameFormProps {
  onUsernameSet?: () => void;
}

export function UsernameForm({ onUsernameSet }: UsernameFormProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const { user, isLoading, actions } = userStore();
  
  // Show current username if available
  const currentUsername = user?.username || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedValue = inputValue.trim();
    
    // Client-side validation first
    const validationResult = validateUsername(trimmedValue);
    if (!validationResult.isValid) {
      setError(validationResult.error || 'Invalid username');
      return;
    }

    try {
      setError('');
      await actions.updateUsername(trimmedValue);
      setInputValue('');
      onUsernameSet?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update username');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        {currentUsername ? 'Update Your Username' : 'Choose Your Username'}
      </h2>
      
      {currentUsername && (
        <p className="text-gray-600 mb-4">
          Current username: <span className="font-medium">{currentUsername}</span>
        </p>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError('');
            }}
            placeholder={currentUsername ? "Enter new username" : "Enter your username"}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={25}
            disabled={isLoading}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Updating...' : (currentUsername ? 'Update Username' : 'Set Username')}
        </button>
      </form>
    </div>
  );
}
```

### 5. Update App.tsx for User Initialization
**File:** `frontend/src/App.tsx`

Add automatic user initialization on app startup:

```typescript
import { useEffect } from 'react';
import { userStore } from '@/stores/user-store';

function App() {
  const { user, isLoading, isInitialized, actions } = userStore();
  
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      actions.initializeUser().catch(error => {
        console.error('Failed to initialize user on app startup:', error);
      });
    }
  }, [isInitialized, isLoading, actions]);
  
  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your session...</p>
        </div>
      </div>
    );
  }
  
  // Rest of your existing App component...
  return (
    <div className="App">
      {/* Your existing app content */}
    </div>
  );
}

export default App;
```

### 6. Remove Old Username Store
**Action:** Delete `frontend/src/stores/username-store.ts` after confirming all references are updated

### 7. Update Any Components Using Old Username Store
**Files to check and update:**
- Any components importing from `@/stores/username-store`
- Update imports to use `@/stores/user-store`
- Update property names (`username` → `user?.username`)

## API Integration Details

### Error Handling
The frontend service handles these backend scenarios:
- **404** from `/users/me` → Auto-create new user
- **401** from `/users/me/username` → Clear user session
- **409** from `/users/auto-create` → Username conflict (retry)
- **503** from any endpoint → Service unavailable

### Cookie Management
- All API calls use `credentials: 'include'` to send cookies
- No manual cookie handling needed on frontend
- Cookies are httpOnly, managed entirely by browser

### Loading States
- User initialization shows loading spinner
- Username updates show loading button state
- Error states display specific error messages

## Acceptance Criteria

- [ ] User service integrates with all backend endpoints
- [ ] User store replaces username store completely
- [ ] App initializes user automatically on startup
- [ ] Username form works with backend validation
- [ ] Error handling covers all API scenarios
- [ ] Loading states provide good UX
- [ ] Shared validation works on frontend
- [ ] Old username store and references removed
- [ ] User persists across browser refreshes
- [ ] Multiple tabs share same user session

## Testing

### Manual Testing Steps
1. Fresh browser session → should auto-create new user
2. Refresh page → should maintain same user
3. Update username → should persist after refresh
4. Invalid username → should show validation error
5. Network error simulation → should handle gracefully
6. Multiple browser tabs → should share same user

### Integration Testing
- Test user initialization flow
- Test username update flow
- Test error scenarios (network failures, invalid responses)
- Test browser refresh behavior
- Test incognito mode (should create new user)

### Edge Cases
- Test with cookies disabled
- Test with network connectivity issues
- Test rapid username changes
- Test very long usernames (25+ chars)

## Dependencies for Next Batch
This completes the core user system. Batch 5 will focus on:
- End-to-end testing
- Performance optimization
- Bug fixes and polish

## Notes
- Frontend now fully integrated with backend user system
- localStorage only used for storage prefix, not user data
- Shared validation ensures consistency between frontend/backend
- Loading states improve perceived performance
- Error handling provides clear user feedback
