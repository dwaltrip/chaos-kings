# AsyncLocalStorage Context Pattern - Implementation Plan

## Background

During a repository refactor (commit `af8335d`) to convert from instantiation-based to singleton pattern, several architectural issues emerged:

### Initial Problem
- Attempted to simplify repository usage by removing `new UserRepository(db)` calls across the app
- Converted to singleton pattern: `const userRepository = new UserRepository(db);`
- Quickly discovered this broke test isolation - tests couldn't inject test database

### Attempted Fix #1: Optional `dbInstance?` Parameter
```typescript
async function createUser(username: string, dbInstance?: Kysely<Database>) {
  const repo = dbInstance ? createUserRepository(dbInstance) : userRepository;
  return await repo.create(...);
}
```

**Problems:**
- Inconsistent implementation - some actions have it, others don't (e.g., `autoCreateUser`)
- Production code polluted with test concerns
- Easy to forget (proven by test failures in `auto-create-user.test.ts`)
- Doesn't solve cross-repository dependencies
- Factory functions provide minimal value (just wrapper around `new`)

### Current Test Failures
```typescript
// auto-create-user.test.ts - 2 tests failing
const result = await autoCreateUser();
// ^ Uses production singleton → writes to production DB

const users = await testDb.selectFrom('users')...;
// ^ Queries test DB → Expected 1, got 0
```

### Root Cause
**No dependency injection pattern** for database connections. Production and test code both need access to database, but tests require isolation.

## The Decision: Repositories Get Context Internally

Instead of threading context through application code, **repositories will call `getContext()` internally**:

```typescript
// Repositories get their own db reference
class UserRepository {
  async create(data: NewUser) {
    const db = getContext().db;  // Get context internally
    return db.insertInto('users').values(data)...;
  }
}

// App code stays clean - no context parameters!
import { userRepository } from '@/domains/users/user-repository';
const user = await userRepository.create({ username: 'test' });
```

**Benefits:**
- ✅ App code doesn't touch context (cleaner signatures)
- ✅ Familiar import pattern (just import and use)
- ✅ Context becomes implementation detail
- ✅ Simpler context type (just `{ db }`, no repository wiring)
- ✅ Cross-repo dependencies just import each other naturally

## Implementation Approach: Pattern D (AsyncLocalStorage)

Using Node.js `AsyncLocalStorage` to provide message-scoped context isolation.

### Core Pattern

```typescript
// 1. Context storage
const contextStorage = new AsyncLocalStorage<AppContext>();

// 2. WebSocket messages wrapped in context scope
ws.on('message', async (raw) => {
  await runWithContext(productionContext, async () => {
    await handler(message.payload);
  });
});

// 3. Repositories get context internally
class UserRepository {
  async create(data: NewUser) {
    const db = getContext().db;
    return db.insertInto('users')...;
  }
}

// 4. Tests wrap execution in test context
it('test', async () => {
  await runWithContext(createContext(testDb), async () => {
    const result = await action();
    expect(result)...
  });
});
```

### Why AsyncLocalStorage?

**Automatic scope isolation:**
- Each message handler gets isolated context
- Each test gets isolated context
- No global state pollution between parallel operations
- Context automatically flows through async call chains

**Tradeoffs:**
- ⚠️ Node.js-specific (AsyncLocalStorage)
- ⚠️ Requires wrapping message handlers, timers, and tests
- ⚠️ Runtime errors if called outside async scope (vs compile-time with explicit parameters)
- ⚠️ Dependencies not visible in function signatures ("magic")

## Alternative: Pattern C (Global Context) - Simpler Fallback

If AsyncLocalStorage proves too complex or issues arise during implementation, **Pattern C is a simpler alternative:**

```typescript
// Global module variable
let _context: AppContext | null = null;

function initContext(ctx: AppContext) {
  _context = ctx;
}

function getContext(): AppContext {
  if (!_context) throw new Error('Context not initialized');
  return _context;
}

// Production: set once at startup
initContext(productionContext);

// Tests: override in beforeEach
beforeEach(() => initContext(createContext(testDb)));

// No wrapping needed!
const result = await action();  // Just works
```

**Simpler because:**
- No wrapper functions needed (timers, tests, message handlers)
- No AsyncLocalStorage mental model
- Works naturally with timers/background jobs
- Just one `initContext()` call per test file

**Limitation:**
- Tests in same file can't run in parallel (Jest runs files in parallel, so usually not an issue)

**When to use:** If implementation complexity grows or AsyncLocalStorage causes issues, Pattern C gets 80% of benefits with 30% less code.

## Affected Files Analysis

### Repositories (4 files)
All repositories need to call `getContext().db` instead of using injected `dbInstance`:

1. `src/domains/users/user-repository.ts`
2. `src/domains/games/game-repository.ts`
3. `src/domains/games/game-players-repository.ts`
4. `src/domains/chat/chat-message-repository.ts`

**Changes:**
- Remove constructor parameter `dbInstance`
- Add `const db = getContext().db;` to each method
- Remove factory functions (`createUserRepository`)
- Export singleton: `export const userRepository = new UserRepository();`

### Actions Using `dbInstance?` Parameter (5 files)
These actions currently accept optional `dbInstance` for tests - will be removed:

1. `src/domains/users/actions/create-user.ts`
2. `src/domains/users/actions/update-username.ts`
3. `src/domains/users/actions/find-user.ts`
4. `src/domains/games/actions/get-game.ts`
5. `src/domains/games/actions/list-games.ts`

**Changes:**
- Remove `dbInstance?: Kysely<Database>` parameter
- Remove `createXRepository(dbInstance)` factory calls
- Remove conditional logic: `dbInstance ? createRepo(dbInstance) : repo`
- Just use repository singleton directly

### Actions Without DB Access (2 files)
These were broken - couldn't pass testDb, causing failures:

1. `src/domains/users/actions/auto-create-user.ts` ❌ 2 tests failing
2. `src/domains/games/actions/end-game.ts` ❌ Can't test with testDb

**Changes:**
- No signature changes needed!
- Just import and use repositories
- Tests will work automatically via context

### Special Case: Direct DB Queries (1 file)
`src/domains/games/actions/create-game.ts` uses direct DB queries (lines 49-53):

```typescript
const existingUsers = await dbInstance.selectFrom('users')...
```

**Changes:**
- **MUST refactor to use repository method** - don't just replace with `getContext().db`
- Add `findByIds(ids: number[]): Promise<User[]>` method to `UserRepository`
- Update `create-game.ts` to call `userRepository.findByIds(playerIds)`
- This keeps direct DB queries inside repositories where they belong

### Test Files (4 files)
All tests need to wrap execution in `runWithContext()`:

1. `src/domains/users/actions/auto-create-user.test.ts`
2. `src/domains/users/actions/create-user.test.ts`
3. `src/domains/users/actions/update-username.test.ts`
4. `src/domains/games/actions/create-game.test.ts`

**Pattern (before):**
```typescript
it('should create user', async () => {
  const user = await createUser('test', testDb);  // Pass testDb
  const users = await testDb.selectFrom('users')...;
  expect(users).toHaveLength(1);
});
```

**Pattern (after):**
```typescript
it('should create user', async () => {
  await runWithContext(createContext(testDb), async () => {
    const user = await createUser('test');  // No testDb param
    const users = await testDb.selectFrom('users')...;
    expect(users).toHaveLength(1);
  });
});
```

### Timers/Background Jobs (2 files)
Game server uses timers that may call actions/repos:

1. `src/domains/gameplay/game-server.ts` - countdown timers, move flush timers
2. `src/domains/gameplay/game-coordinator.ts` - global tick system (`setInterval`)

**Pattern:**
```typescript
// Before
setInterval(() => {
  this.tick();  // Calls actions internally
}, TICK_RATE_MS);

// After
setInterval(() => {
  await runWithContext(productionContext, async () => {
    await this.tick();
  });
}, TICK_RATE_MS);
```

**Note:** These timers already exist in running production context, so wrapping may not be strictly necessary. Investigate during implementation.

### WebSocket Message Handler (1 file)
Core message routing needs to wrap each message:

`src/ws-lib/server.ts` (lines 81-106)

**Pattern:**
```typescript
// Before
ws.on('message', async (raw: RawData) => {
  const message = decodeMsg(rawString);
  const handler = handlers[message.type];
  await handler(message.payload, context);
});

// After
ws.on('message', async (raw: RawData) => {
  await runWithContext(productionContext, async () => {
    const message = decodeMsg(rawString);
    const handler = handlers[message.type];
    await handler(message.payload, context);
  });
});
```

## Implementation Sketch

### 1. Create Context Module

**File:** `src/context/app-context.ts`

**Key elements:**
```typescript
import { AsyncLocalStorage } from 'async_hooks';
import type { Kysely } from 'kysely';
import type { Database } from '@/db/types';
import { db } from '@/services/db';

// Simple context - just db connection
interface AppContext {
  db: Kysely<Database>;
}

// Semantic aliases for different usage contexts
type RequestContext = AppContext;        // For HTTP handlers
type MessageHandlerContext = AppContext; // For WebSocket handlers

// AsyncLocalStorage instance
const contextStorage = new AsyncLocalStorage<AppContext>();

// Create context from db instance
function createContext(dbInstance: Kysely<Database>): AppContext {
  return { db: dbInstance };
}

// Get current context (throws if not in scope)
function getContext(): AppContext {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error('No context available - must call within runWithContext()');
  }
  return ctx;
}

// Run function within context scope
function runWithContext<T>(
  ctx: AppContext,
  fn: () => Promise<T>
): Promise<T> {
  return contextStorage.run(ctx, fn);
}

// Production context (uses production db)
const productionContext = createContext(db);

export { runWithContext, getContext, createContext, productionContext };
export type { AppContext, RequestContext, MessageHandlerContext };
```

### 2. Modify Repositories

**Example:** `user-repository.ts`

**Before:**
```typescript
class UserRepository {
  constructor(private dbInstance: Kysely<Database>) {}

  async findById(id: number): Promise<User | null> {
    return this.dbInstance.selectFrom('users')...;
  }
}

const userRepository = new UserRepository(db);
function createUserRepository(dbInstance: Kysely<Database>) {
  return new UserRepository(dbInstance);
}

export { userRepository, createUserRepository };
```

**After:**
```typescript
import { getContext } from '@/context/app-context';

class UserRepository {
  async findById(id: number): Promise<User | null> {
    const db = getContext().db;
    return db.selectFrom('users')...;
  }

  // NEW METHOD: needed by create-game.ts
  async findByIds(ids: number[]): Promise<User[]> {
    const db = getContext().db;
    return db.selectFrom('users')
      .selectAll()
      .where('id', 'in', ids)
      .execute();
  }
}

export const userRepository = new UserRepository();
```

**Key changes:**
- Import `getContext` from context module
- Remove constructor and `dbInstance` parameter
- Add `const db = getContext().db;` at start of each method
- **Add `findByIds()` method** (needed to replace direct query in create-game.ts)
- Remove factory function
- Export singleton instance directly

**Apply to all 4 repository files.**

### 3. Update Actions with `dbInstance?` Parameter

**Example:** `create-user.ts`

**Before:**
```typescript
async function createUser(
  username: string,
  dbInstance?: Kysely<Database>
): Promise<User> {
  const repo = dbInstance ? createUserRepository(dbInstance) : userRepository;
  return await repo.create(newUser);
}
```

**After:**
```typescript
async function createUser(username: string): Promise<User> {
  return await userRepository.create(newUser);
}
```

**Key changes:**
- Remove `dbInstance?: Kysely<Database>` parameter
- Remove factory function calls
- Remove conditional logic
- Just use repository singleton

**Apply to 5 action files with `dbInstance?` parameter.**

### 4. Fix Actions with Direct DB Queries

**Example:** `create-game.ts` (lines 49-53)

**Before:**
```typescript
async function createGame(
  playerIds: number[],
  dbInstance: Kysely<Database> = db
): Promise<Game> {
  const existingUsers = await dbInstance.selectFrom('users')...;

  const repo = dbInstance === db ? gameRepository : createGameRepository(dbInstance);
  const game = await repo.create(newGame);

  const playersRepo = dbInstance === db
    ? gamePlayersRepository
    : createGamePlayersRepository(dbInstance);
  await playersRepo.bulkCreate(...);
}
```

**After:**
```typescript
async function createGame(playerIds: number[]): Promise<Game> {
  // Validate users exist via repository
  const existingUsers = await userRepository.findByIds(playerIds);
  const existingUserIds = new Set(existingUsers.map(u => u.id));
  const invalidUserIds = playerIds.filter(id => !existingUserIds.has(id));
  if (invalidUserIds.length > 0) {
    throw new Error(`Invalid user IDs: ${invalidUserIds.join(', ')}`);
  }

  const game = await gameRepository.create(newGame);
  await gamePlayersRepository.bulkCreate(...);
}
```

**Key changes:**
- Remove `dbInstance` parameter
- Add `findByIds()` method to UserRepository (new method needed!)
- Replace direct DB query with `userRepository.findByIds(playerIds)`
- Simplify repository calls (no conditionals)

### 5. Update Test Files

**Example:** `auto-create-user.test.ts`

**Before:**
```typescript
describe('autoCreateUser', () => {
  const testDb = createTestDb();

  beforeEach(async () => {
    await testDb.deleteFrom('users').execute();
  });

  it('should create new user', async () => {
    const result = await autoCreateUser();  // ❌ Uses production DB

    const users = await testDb.selectFrom('users').selectAll().execute();
    expect(users).toHaveLength(1);  // ❌ Fails - nothing in testDb
  });
});
```

**After:**
```typescript
import { runWithContext, createContext } from '@/context/app-context';

describe('autoCreateUser', () => {
  const testDb = createTestDb();

  beforeEach(async () => {
    await testDb.deleteFrom('users').execute();
  });

  it('should create new user', async () => {
    await runWithContext(createContext(testDb), async () => {
      const result = await autoCreateUser();  // ✅ Uses testDb via context

      const users = await testDb.selectFrom('users').selectAll().execute();
      expect(users).toHaveLength(1);  // ✅ Passes
    });
  });
});
```

**Key changes:**
- Import `runWithContext` and `createContext`
- Wrap each test body in `runWithContext(createContext(testDb), async () => { ... })`
- Remove `dbInstance` arguments from action calls

**Apply to all 4 test files.**

**Optional optimization:** Extract helper
```typescript
const withTestContext = (fn: () => Promise<void>) =>
  runWithContext(createContext(testDb), fn);

it('should create user', async () => {
  await withTestContext(async () => {
    // test code
  });
});
```

### 6. Wrap WebSocket Message Handler

**IMPORTANT:** `ws-lib` is generic infrastructure and must NOT import from app code (`@/context/...`).

**Solution:** Add optional `setupHandlerContext` callback to `WSServerConfig` that ws-lib calls before executing each handler.

**File 1:** `src/ws-lib/server.ts` (modify config type and usage)

Add to `WSServerConfig` type:
```typescript
type WSServerConfig<...> = {
  handlers: HandlerMapWithCtx<TIncoming, TContext>;
  createConnectionContext: (...) => TContext;  // RENAMED from createContext
  getUserKey: (...) => string;
  onDisconnect?: (context: TContext) => void;
  encode?: (msg: TOutgoing) => string;
  decode?: (raw: string) => TIncoming;

  // NEW: Optional wrapper for message execution (sets up MessageHandlerContext)
  setupHandlerContext?: <T>(execute: () => Promise<T>) => Promise<T>;
};
```

In `handleConnection` (line ~76), rename the call:
```typescript
// OLD: const context = createContext(connectionContext, connectionId);
// NEW:
const context = config.createConnectionContext(connectionContext, connectionId);
```

In message handler (line ~101):
```typescript
ws.on('message', async (raw: RawData) => {
  const executeHandler = async () => {
    const rawString = /* normalize buffer */;
    const message = decodeMsg(rawString);
    const handler = handlers[message.type];
    if (!handler) {
      console.warn(`No handler for message type: ${message.type}`);
      return;
    }
    await handler(message.payload, context);
  };

  // Use wrapper if provided, otherwise execute directly
  if (config.setupHandlerContext) {
    await config.setupHandlerContext(executeHandler);
  } else {
    await executeHandler();
  }
});
```

**File 2:** `src/ws/server-bootstrap.ts` (app-level integration)

```typescript
import { runWithContext, productionContext } from '@/context/app-context';
import type { ConnectionContext } from '@/ws/connection-context';

const wsServer = createWSServer<ClientMessage, ServerMessage, ConnectionContext, User>({
  handlers: mergedHandlers,

  createConnectionContext: (user, connectionId) => ({
    userId: user.id,
    connectionId,
  }),

  getUserKey: (user) => String(user.id),

  onDisconnect: (context) => { /* ... */ },

  // NEW: Wrap each message in MessageHandlerContext scope
  setupHandlerContext: async (execute) => {
    await runWithContext(productionContext, execute);
  },
});
```

**File 3:** `src/ws/connection-context.ts` (rename from app-handler-context.ts)

```typescript
import type { ConnectionId } from '@/ws-lib/types';

type ConnectionContext = {  // RENAMED from AppHandlerContext
  userId: number;
  connectionId: ConnectionId;
};

export type { ConnectionContext };
```

**File 4:** Update all handler files that import `AppHandlerContext`

Replace:
```typescript
import type { AppHandlerContext } from '@/ws/app-handler-context';
```

With:
```typescript
import type { ConnectionContext } from '@/ws/connection-context';
```

Update handler signatures from `AppHandlerContext` to `ConnectionContext`.

**Key changes:**
- Add `setupHandlerContext` optional config to ws-lib (keeps it generic)
- Rename `createContext` → `createConnectionContext` in ws-lib config
- Rename `AppHandlerContext` → `ConnectionContext` (matches lifespan/scope)
- App code provides the wrapper in server-bootstrap (where it belongs)
- ws-lib stays independent of app code (no imports from `@/context`)

### 7. Wrap Timer/Background Jobs (If Needed)

**Files:** `game-server.ts`, `game-coordinator.ts`

**Investigation needed:** These timers run in the same process as the WebSocket server. They may already have access to production context without explicit wrapping.

**If wrapping is needed:**
```typescript
import { runWithContext, productionContext } from '@/context/app-context';

setInterval(async () => {
  await runWithContext(productionContext, async () => {
    await this.tick();
  });
}, TICK_RATE_MS);
```

**Decision:** Test without wrapping first. Only add if context errors occur.

### 8. Clean Up Obsolete Code

After migration is complete:

**Remove from all repositories:**
- Constructor parameters
- Factory functions (`createUserRepository`, etc.)
- Factory exports

**Remove from all actions:**
- `dbInstance?: Kysely<Database>` parameters
- Conditional repository creation logic
- `import { db } from '@/services/db'` (unless directly used)

**Remove from imports:**
- `import { createUserRepository } from '...'`
- Update to just: `import { userRepository } from '...'`

## Implementation Order

Recommended sequence to minimize breakage:

### Phase 1: Foundation (No Breaking Changes)
1. ✅ Create `src/context/app-context.ts`
2. ✅ Verify it compiles

### Phase 2: One Repository (Proof of Concept)
3. ✅ Modify `user-repository.ts` to use `getContext()`
4. ✅ Update actions that use `userRepository`
5. ✅ Update tests for those actions
6. ✅ Run tests - should pass
7. ✅ Commit: "feat: Migrate user repository to context pattern"

### Phase 3: Remaining Repositories
8. ✅ Migrate `game-repository.ts`
9. ✅ Migrate `game-players-repository.ts`
10. ✅ Migrate `chat-message-repository.ts`
11. ✅ Update all affected actions
12. ✅ Update all affected tests
13. ✅ Run full test suite
14. ✅ Commit: "feat: Complete repository context migration"

### Phase 4: Infrastructure
15. ✅ Wrap WebSocket message handler (`ws-lib/server.ts`)
16. ✅ Test WebSocket flow manually
17. ✅ Investigate timer wrapping (add if needed)
18. ✅ Commit: "feat: Add context wrapping to WS and timers"

### Phase 5: Cleanup
19. ✅ Remove all factory functions
20. ✅ Remove obsolete imports
21. ✅ Run builds and tests
22. ✅ Commit: "refactor: Clean up obsolete repository factories"

## Testing Strategy

**After each phase:**
1. Run backend build: `npm run build` in `apps/backend`
2. Run backend tests: `npm test` in `apps/backend`
3. Fix any issues before proceeding

**Before final commit:**
1. Run full build: `bash tools/build-all.sh`
2. Run all tests: `bash tools/test-all.sh`
3. Manually test WebSocket flow (connect, send message, verify)

## Rollback Plan

**If AsyncLocalStorage proves problematic:**

1. Keep `app-context.ts` but switch to Pattern C implementation:
   - Replace `AsyncLocalStorage` with simple global variable
   - Replace `runWithContext()` with `initContext()`
   - Remove all wrapper calls (message handler, timers)
   - Add `initContext()` to test `beforeEach` blocks

2. Benefits preserved:
   - Repositories still use `getContext()` internally
   - App code still clean (no context parameters)
   - Tests still isolated (via `beforeEach`)

3. Tradeoff:
   - Manual context initialization in tests
   - Can't run tests in parallel within same file (rare use case)

## Key Design Decisions

### Why Not Pass Context Through Actions?
- Would require changing every action signature
- Would pollute business logic with infrastructure concerns
- 20+ action files would need updates
- Every caller would need to pass context

### Why Not Put Repositories in Context?
- Creates circular dependency (repos need context, context needs repos)
- Complex initialization/wiring logic
- Cross-repo dependencies need manual wiring
- Simpler: repos just import each other, both call `getContext()`

### Why AsyncLocalStorage Over Global?
- Automatic isolation per message/test
- Parallel test support (if needed in future)
- "Correct" pattern for async request-scoped dependencies
- Can easily downgrade to Pattern C if too complex

### Why Keep Repository Classes?
- Already implemented and working
- Provides namespace for related queries
- Can add caching/logging/hooks later
- Could convert to plain functions later if desired

## Success Criteria

- ✅ All tests passing (including previously failing `auto-create-user.test.ts`)
- ✅ No `dbInstance?` parameters in production code
- ✅ Repositories use `getContext()` internally
- ✅ App code just imports and uses repositories
- ✅ Test isolation working (each test uses testDb)
- ✅ WebSocket messages have context access
- ✅ Builds pass (backend + frontend)
- ✅ Cross-repository dependencies work (e.g., ChatMessageRepository → UserRepository)

## Open Questions for Implementation

1. **Timer wrapping:** Do game server timers need explicit `runWithContext()`? Test first.
2. **Error messages:** Should `getContext()` error include call stack for debugging?
3. **Performance:** Any measurable overhead from AsyncLocalStorage? (Likely negligible)
4. **Transactions:** Future consideration - context could hold transaction instead of db pool
5. **Test helpers:** Should we create `withTestContext()` helper to reduce test boilerplate?

---

**This document is for use in a fresh AI coding session. Implementer should:**
- Read this doc fully before starting
- Follow the phase order
- Commit after each phase
- Run tests after each phase
- Ask questions if assumptions seem wrong
- Consider switching to Pattern C if complexity grows unexpectedly
