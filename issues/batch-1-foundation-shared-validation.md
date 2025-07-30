# Batch 1: Foundation & Shared Validation

**Status:** Ready to implement  
**Dependencies:** None  

## Overview
Establish the foundation for the cookie-based user system by creating shared validation logic and updating the database schema to support user keys for persistent sessions.

## Tasks

### 1. Create Shared Username Validation
**File:** `common/validation/username.ts`

Create a new validation module that will be shared between frontend and backend to ensure consistency.

```typescript
export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateUsername(username: string): UsernameValidationResult {
  const trimmed = username.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Username is required' };
  }
  
  if (trimmed.length < 1) {
    return { isValid: false, error: 'Username must be at least 1 character' };
  }
  
  if (trimmed.length > 25) {
    return { isValid: false, error: 'Username must be 25 characters or less' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }
  
  return { isValid: true };
}
```

### 2. Create Database Migration
**File:** `backend/migrations/[timestamp]_add_user_key_column.ts`

Add the `user_key` column needed for cookie-based authentication. This migration will be run using the Kysely CLI tools. See existing migration for reference.  

```sql
-- Migration adds:
ALTER TABLE users ADD COLUMN user_key VARCHAR(255) UNIQUE NOT NULL;
CREATE INDEX idx_users_user_key ON users(user_key);
```

**Implementation notes:**
- Create the migration file using kysely CLI. Note: Kysely CLI has feature parity w/ the Knex.js CLI tool.  
- Use `crypto.randomUUID()` for generating keys
- Column must be unique and not null
- Add index for fast lookups by user_key
- Handle existing users if any (populate with generated keys)

### 3. Update Backend User Models
**Files to modify:**
- `backend/src/user/user.db.ts` - Add user_key to UsersTable interface
- `backend/src/user/user-repository.ts` - Add findByUserKey method
- `backend/src/types.ts` - Update if needed

**Changes needed:**

In `user.db.ts`:
```typescript
interface UsersTable {
  id: Generated<number>
  username: string
  user_key: string  // Add this line
  created_at: ColumnType<Date, string | undefined, never>
}
```

In `user-repository.ts`:
```typescript
async findByUserKey(userKey: string): Promise<User | null> {
  const user = await this.dbInstance
    .selectFrom('users')
    .selectAll()
    .where('user_key', '=', userKey)
    .executeTakeFirst();

  return user || null;
}
```

### 4. Update Backend Validation
**Files to modify:**
- `backend/src/user/actions/create-user.ts`
- `backend/src/user/actions/update-username.ts`

Replace inline validation with shared validation function:

```typescript
import { validateUsername } from '@/../../common/validation/username';

// Replace existing validation logic with:
const validation = validateUsername(username);
if (!validation.isValid) {
  throw new Error(validation.error);
}
```

## Acceptance Criteria

- [ ] Shared validation function works consistently
- [ ] Database migration runs successfully
- [ ] New user_key column exists with proper constraints
- [ ] Backend uses shared validation (25 char limit)
- [ ] UserRepository has findByUserKey method
- [ ] All existing tests still pass
- [ ] Can create users with user_key populated

## Testing

### Manual Testing Steps (Daniel will do these)
1. Run the migration: `npm run migrate:latest`
2. Verify users table has user_key column with unique constraint
3. Test backend validation with various username inputs
4. Create a user and verify user_key is generated
5. Test findByUserKey repository method

### Automated Testing
- Update existing user tests to account for user_key
- Test shared validation function with edge cases
- Test repository findByUserKey method

## Dependencies for Next Batch
This batch must be completed before Batch 2 can begin, as Batch 2 depends on:
- user_key column existing in database
- findByUserKey method in repository
- Shared validation function

## Notes
- Keep existing REST endpoints working during this batch
- user_key should be generated but not yet used for authentication
- Frontend changes are minimal in this batch (just validation)
