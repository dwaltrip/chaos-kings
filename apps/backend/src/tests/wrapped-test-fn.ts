/**
 * Wraps Jest's test function to provide database context via AsyncLocalStorage.
 *
 * Why this is necessary:
 * We use AsyncLocalStorage to make the db connection available anywhere in the
 * call stack via getContext(). The intuitive approach would be to call
 * contextStorage.enterWith() in a beforeEach hook, but this doesn't work.
 *
 * enterWith() persists context through async calls that originate from the same
 * synchronous execution. However, Jest invokes beforeEach and the test body as
 * separate synchronous executions — so context set in beforeEach is not available
 * in the test body.
 *
 * Instead, we wrap each test in runWithContext(), which uses AsyncLocalStorage.run()
 * to create a context scope that persists for the entire test execution.
 */

import { test as jestTest } from '@jest/globals';
import { runWithContext, createContext } from '@/context/app-context';
import { testDb } from '@/services/test-db';

const test = (name: string, fn: () => Promise<void>, timeout?: number) => {
  jestTest(name, () => runWithContext(createContext(testDb), fn), timeout);
};

// Preserve test.only, test.skip, etc.
test.only = (name: string, fn: () => Promise<void>, timeout?: number) => {
  jestTest.only(name, () => runWithContext(createContext(testDb), fn), timeout);
};

test.skip = jestTest.skip;
test.todo = jestTest.todo;

export { test };
