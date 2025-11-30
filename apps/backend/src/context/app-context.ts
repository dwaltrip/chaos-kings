import { AsyncLocalStorage } from 'async_hooks';
import type { Kysely } from 'kysely';

import type { Database } from '@/types';
import { db } from '@/services/db';

// Request-scoped application context
// Also works for ws message handling, background jobs, etc.
interface AppContext {
  db: Kysely<Database>;
}

const contextStorage = new AsyncLocalStorage<AppContext>();

function createContext(dbInstance: Kysely<Database>): AppContext {
  return { db: dbInstance };
}

function getContext(): AppContext {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error('No context available - must call within runWithContext()');
  }
  return ctx;
}

function runWithContext<T>(ctx: AppContext, fn: () => Promise<T>): Promise<T> {
  return contextStorage.run(ctx, fn);
}

// Run function with both AppContext and a new DB transaction
async function runInContextWithTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction().execute(async (tx) => {
    return runWithContext(createContext(tx), fn);
  });
}

export {
  contextStorage,
  getContext,
  createContext,
  runWithContext,
  runInContextWithTransaction,
};
export type { AppContext };
