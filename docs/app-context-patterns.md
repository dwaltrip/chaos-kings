Chat convo: https://claude.ai/share/6fe363c6-b4a9-4305-9df3-07beb026234d
Date: 2025-11-30

---

# App Context & Transaction Patterns

## Why AsyncLocalStorage?

For a multiplayer game server handling concurrent WebSocket messages, `AsyncLocalStorage` provides:

- **Request isolation** — each message handler gets its own context, even when multiple handlers are interleaved on the same thread
- **Implicit propagation** — context flows through async call stacks without prop drilling
- **Clean repository code** — repositories call `getContext().db` without needing explicit parameters

Without it, you'd need to pass `ctx` or `db` through every function in the call chain.

## App Context Setup

```ts
// app-context.ts
import { AsyncLocalStorage } from 'async_hooks';
import type { Kysely, Transaction } from 'kysely';

interface AppContext {
  db: Kysely<Database> | Transaction<Database>;
}

export const contextStorage = new AsyncLocalStorage<AppContext>();

export function createContext(db: Kysely<Database> | Transaction<Database>): AppContext {
  return { db };
}

export function getContext(): AppContext {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error('No context available');
  }
  return ctx;
}

export function runWithContext<T>(ctx: AppContext, fn: () => Promise<T>): Promise<T> {
  return contextStorage.run(ctx, fn);
}
```

## Transaction Helper

Wraps code in a transaction and sets up context. Named `runInContextWithTransaction` to clarify it does two things:

1. Starts a database transaction
2. Creates a context with that transaction accessible via `getContext()`

Automatically commits on success, rolls back on error.

```ts
// transactions.ts
import { db } from '@/services/db';
import { runWithContext, createContext } from './app-context';

export async function runInContextWithTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction().execute(async (trx) => {
    return runWithContext(createContext(trx), fn);
  });
}
```

## Usage in Handlers

### HTTP (Fastify)

Wrap `runInContextWithTransaction` in your existing `asyncHandler`:

```ts
// async-handler.ts
function asyncHandler(handler: RouteHandler) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await runInContextWithTransaction(() => handler(request, reply));
    } catch (error) {
      // handle / log error, etc
    }
  };
}
```

Routes stay clean:

```ts
fastify.post(
  '/users',
  asyncHandler(async (request, reply) => {
    const { username } = request.body as { username: string };
    const user = await createUser(username);
    return reply.status(201).send(user);
  }),
);
```

If you need a handler without a transaction (e.g., simple reads where overhead matters):

```ts
function asyncHandlerNoTx(handler: RouteHandler) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await runWithContext(createContext(db), () => handler(request, reply));
    } catch (error) { ... }
  };
}
```

For a prototype, just wrap everything in transactions — the overhead is negligible until you hit scale.

### WebSocket

```ts
socket.on('message', (msg) => {
  runInContextWithTransaction(async () => {
    await handleMessage(playerId, msg);
  }).catch((err) => {
    // Handle error, notify client
  });
});
```

### Game Loop / Tick

Use `runWithContext` (context but no transaction) or `runInContextWithTransaction` depending on whether ticks need atomicity:

```ts
this.tickInterval = setInterval(() => {
  void runInContextWithTransaction(async () => {
    await this.tick();
  });
}, TICK_RATE_MS);
```

## Repositories

Repositories remain simple — they pull db/transaction from context:

```ts
class GameRepository {
  async findById(id: string) {
    const { db } = getContext();
    return db.selectFrom('games').where('id', '=', id).executeTakeFirst();
  }

  async save(game: Game) {
    const { db } = getContext();
    await db.insertInto('games').values(game).execute();
  }
}

export const gameRepository = new GameRepository();
```

## Test Setup

Tests use `contextStorage.enterWith` to set up context with `testDb`. Unlike production code, tests don't automatically wrap in transactions — context is set up via `beforeEach`, and if the code under test uses `runInContextWithTransaction`, it creates a transaction from `testDb`.

### Option 1: Per-describe opt-in

```ts
// test-utils.ts
import { contextStorage, createContext } from '@/app-context';
import { testDb } from './test-db';

export function useTestContext() {
  beforeEach(() => {
    contextStorage.enterWith(createContext(testDb));
  });
}
```

```ts
// game.test.ts
describe('games', () => {
  useTestContext();

  test('creates a game', async () => {
    const game = await createGame(['alice', 'bob']);
    expect(game.id).toBeDefined();
  });
});
```

### Option 2: Global setup

If most tests need db context, set it globally:

```ts
// setup-tests.ts (referenced in vitest/jest config)
import { contextStorage, createContext } from '@/app-context';
import { testDb } from './test-db';

beforeEach(() => {
  contextStorage.enterWith(createContext(testDb));
});
```

Then tests need no additional setup:

```ts
test('creates a game', async () => {
  const game = await createGame(['alice', 'bob']);
  expect(game.id).toBeDefined();
});
```

### How it flows

```
Test setup:     enterWith(createContext(testDb))
                           ↓
Test code:      handleAttack(...)
                           ↓
Handler:        runInContextWithTransaction(...)  ← creates tx from testDb
                           ↓
Repository:     getContext().db  ← gets the transaction
```

## Key Points

| Concern | Approach |
|---------|----------|
| Concurrent request isolation | `AsyncLocalStorage` with `runWithContext` |
| Transaction lifecycle | `db.transaction().execute()` auto-commits/rollbacks |
| Handler wrapper | `asyncHandler` wraps in `runInContextWithTransaction` |
| Repository db access | `getContext().db` — works with both raw db and transactions |
| Test isolation | `contextStorage.enterWith(createContext(testDb))` in `beforeEach` |
| Parallel tests (`test.concurrent`) | Would need `runWithContext` per test instead of `enterWith` |
