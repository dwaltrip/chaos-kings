# Repository Pattern & DB Dependency Injection - Analysis

## Context

Commit `af8335d` converted repository classes from instantiation-based to singleton pattern. The refactor was incomplete and revealed deeper architectural questions about database dependencies in production vs tests.

## Current Implementation (after refactor)

### Repository Pattern
The refactored repositories export:
- **Singleton instance** for production: `const userRepository = new UserRepository(db);`
- **Factory function** for tests: `function createUserRepository(dbInstance) { return new UserRepository(dbInstance); }`

### Action Pattern (inconsistent)
Some actions accept optional `dbInstance?` parameter:
```typescript
async function createUser(username: string, dbInstance?: Kysely<Database>) {
  const repo = dbInstance ? createUserRepository(dbInstance) : userRepository;
  return await repo.create(newUser);
}
```

Others don't (causes test failures):
```typescript
async function autoCreateUser(): Promise<AutoCreateResult> {
  const user = await userRepository.create(newUser);  // Always uses singleton
  return { user, isNewUser: true };
}
```

## Problems Identified

### 1. Test Isolation Failures

**Failing tests:** `auto-create-user.test.ts` (2 failures)
```typescript
const result = await autoCreateUser();  // Writes to production db
const users = await testDb.selectFrom('users').selectAll().execute();  // Queries testDb
expect(users).toHaveLength(1);  // ✕ Expected 1, got 0
```

Actions without `dbInstance` parameter can't be tested with test database.

### 2. Cross-Repository Dependencies

`ChatMessageRepository` depends on `userRepository` singleton:
```typescript
async createGameChat(data: ...): Promise<ChatMessageRow> {
  const message = await this.dbInstance.insertInto(...);  // Uses injected db ✓
  const user = await userRepository.findById(message.user_id);  // Uses global singleton ✗
  return { ...message, username: user.username };
}
```

Even when created with `createChatMessageRepository(testDb)`, it still calls production `userRepository`.

### 3. Factory Functions Provide No Value

```typescript
function createUserRepository(dbInstance: Kysely<Database>): UserRepository {
  return new UserRepository(dbInstance);  // Just "new" with a wrapper
}
```

No initialization logic, dependency wiring, caching, or abstraction - pure indirection.

### 4. Production Code Contains Test Concerns

Optional `dbInstance?` parameters exist solely for testing:
- Pollutes business logic with test infrastructure
- Easy to forget (proven by `autoCreateUser`, `endGame`)
- No compile-time enforcement
- Inconsistent implementation across actions

### 5. No Transaction Management

Current architecture uses connection pool without transactions:
```typescript
const game = await repo.create(newGame);              // Query 1: auto-commit
await playersRepo.bulkCreate(gamePlayersData);        // Query 2: auto-commit
```

**Not atomic.** If step 2 fails → orphaned game record in DB.

## What `db` Actually Is

```typescript
const db = new Kysely<Database>({ dialect });  // Pool manager, not connection
```

- Manages pool of 10 connections
- Each query: gets connection → executes → returns to pool → auto-commits
- No transaction boundaries across operations
- Each operation is independent

## Architectural Patterns Considered

### Pattern A: Context-Based Dependency Injection

**Concept:** Pass context object containing all dependencies through application.

```typescript
interface AppContext {
  db: Kysely<Database>;
  repositories: {
    users: UserRepository;
    games: GameRepository;
    gamePlayers: GamePlayersRepository;
    chatMessages: ChatMessageRepository;
  };
}

// Production
const productionContext: AppContext = {
  db,
  repositories: {
    users: new UserRepository(db),
    games: new GameRepository(db),
    // ... etc
  },
};

// Tests
function createTestContext(testDb: Kysely<Database>): AppContext {
  const users = new UserRepository(testDb);
  return {
    db: testDb,
    repositories: {
      users,
      games: new GameRepository(testDb),
      chatMessages: new ChatMessageRepository(testDb, users),  // Inject dependencies
    },
  };
}
```

**Usage:**
```typescript
async function autoCreateUser(ctx: AppContext): Promise<AutoCreateResult> {
  const user = await ctx.repositories.users.create(...);
  return { user, isNewUser: true };
}

// Tests
const ctx = createTestContext(testDb);
const result = await autoCreateUser(ctx);
```

**Tradeoffs:**
- ✅ Test isolation - all repos share same test DB
- ✅ Explicit dependencies
- ✅ Solves cross-repository dependencies
- ✅ Type-safe
- ✅ Standard pattern (NestJS, Spring, ASP.NET Core)
- ⚠️ Must pass `ctx` through call chains
- ⚠️ Refactoring required (~3-4 hours estimated)

### Pattern B: Transaction-Scoped Context

**Concept:** Context holds active transaction, not pool manager.

```typescript
interface AppContext {
  trx: Transaction<Database>;  // Active transaction, not pool
  repositories: { /* ... */ };
}

function createContext(trx: Transaction<Database>): AppContext {
  const users = new UserRepository(trx);
  return {
    trx,
    repositories: {
      users,
      games: new GameRepository(trx),
      chatMessages: new ChatMessageRepository(trx, users),
    },
  };
}
```

**WebSocket message handling:**
```typescript
connection.socket.on('message', async (rawMessage) => {
  await db.transaction().execute(async (trx) => {
    const ctx = createContext(trx);
    await handleMessage(message, ctx);
    // Auto-commits if no error, auto-rollbacks if error
  });
});
```

**Test usage:**
```typescript
test('should create game', async () => {
  await testDb.transaction().execute(async (trx) => {
    const ctx = createContext(trx);
    const user1 = await ctx.repositories.users.create(...);
    const game = await createGame([user1.id], ctx);
    expect(game).toBeDefined();
    // Auto-rollback at end - no manual cleanup needed
  });

  const games = await testDb.selectFrom('games').selectAll().execute();
  expect(games).toHaveLength(0);  // Verify nothing persisted
});
```

**Tradeoffs:**
- ✅ All benefits of Pattern A
- ✅ Atomic operations per message/request
- ✅ Auto-rollback on errors
- ✅ Test isolation via transaction rollback (no manual cleanup)
- ✅ Prevents orphaned records from partial failures
- ⚠️ Every message wrapped in transaction (performance consideration)
- ⚠️ Long-running operations hold connection longer

**Why Flask `g` is request-scoped:**
Not about avoiding parameters - it's about **transaction lifecycle tied to request boundaries**. Get connection → begin transaction → handle request → commit/rollback → return to pool. Pattern B achieves this without global state.

### Pattern C: Ambient/Global Context

**Concept:** Module-level variable that tests override.

```typescript
let currentContext: AppContext = productionContext;

export function getContext(): AppContext {
  return currentContext;
}

// Tests
beforeEach(() => setContext(createTestContext(testDb)));
afterEach(() => setContext(productionContext));
```

**Tradeoffs:**
- ✅ No function signature changes
- ✅ Minimal refactoring
- ❌ Global mutable state
- ❌ Hidden dependencies
- ❌ Parallel test issues
- ❌ Easy to forget cleanup
- ❌ Non-deterministic

### Pattern D: Fix Current Approach

**Concept:** Complete the partial implementation - add `dbInstance?` to all actions.

**Tradeoffs:**
- ✅ Familiar (already partially done)
- ✅ Minimal architectural change
- ❌ Doesn't solve cross-repository dependencies
- ❌ Production code polluted with test concerns
- ❌ Verbose - every test passes `testDb` explicitly
- ❌ Easy to forget (no enforcement)
- ❌ Factory functions still useless

## WebSocket Architecture Consideration

Most backend logic runs through **WebSocket messages**, not HTTP requests.

**Current flow:**
```
WS message → handlers.ts → actions.ts → repositories
```

**Implications:**
- No traditional "request" object available in actions
- Fastify's `@fastify/request-context` doesn't naturally help
- Long-lived WebSocket connections (not per-request lifecycle)
- Multiple messages through single connection
- Actions also called from timers, background jobs, tests

Explicit context DI works across all contexts (HTTP, WebSocket, timers, tests). Request-scoped patterns (Flask `g`, Fastify decorators) don't fit WebSocket-first architecture.

## Questions to Consider

1. **Transaction scope:** Should each WebSocket message be atomic? What about long-running game ticks?
2. **Performance:** Transaction overhead vs consistency guarantees - what's the tradeoff?
3. **Test strategy:** Auto-rollback transactions vs explicit cleanup - which is clearer?
4. **Migration effort:** Is 3-4 hours of refactoring worth the architectural improvement?
5. **Cross-repo dependencies:** How many exist? Will they grow? (Only `ChatMessageRepository → UserRepository` identified so far)
6. **Factory functions:** Keep for consistency or delete for simplicity?
7. **Hybrid approach:** Use both patterns (HTTP vs WebSocket) or standardize on one?

## Affected Files

**Repository Classes:**
- `src/domains/users/user-repository.ts`
- `src/domains/games/game-repository.ts`
- `src/domains/games/game-players-repository.ts`
- `src/domains/chat/chat-message-repository.ts`

**Actions (missing dbInstance):**
- `src/domains/users/actions/auto-create-user.ts` ✕ Test failures
- `src/domains/games/actions/end-game.ts` ✕ Can't test with testDb

**Actions (have dbInstance):**
- `src/domains/users/actions/create-user.ts`
- `src/domains/users/actions/update-username.ts`
- `src/domains/users/actions/find-user.ts`
- `src/domains/games/actions/create-game.ts`
- `src/domains/games/actions/list-games.ts`
- `src/domains/games/actions/get-game.ts`

**Tests:**
- `src/domains/users/actions/auto-create-user.test.ts` ✕ 2 failing
- `src/domains/users/actions/create-user.test.ts` ✓ 12 passing
- `src/domains/users/actions/update-username.test.ts` ✓ 10 passing
- `src/domains/games/actions/create-game.test.ts` ✓ 12 passing

## Next Steps

**Quick fix (unblock tests):**
Add `dbInstance?` parameter to `autoCreateUser` and `endGame`. Doesn't solve deeper issues but fixes immediate failures.

**Architectural refactor:**
Choose between Pattern A (pool context) vs Pattern B (transaction context). Consider transaction scope, performance, and maintenance implications.

**Investigation:**
1. How many cross-repository dependencies exist?
2. Are there non-atomic multi-step operations that need transactions?
3. Performance impact of wrapping all WS messages in transactions?
4. Test cleanup: current manual approach vs transaction rollback?
