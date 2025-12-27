// Factory for creating Zustand stores with async loading boilerplate
// Handles deduplication of concurrent calls and caching

import { create } from 'zustand';

type AsyncStoreState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

type AsyncStoreActions<T> = {
  load: (fetchFn: () => Promise<T>) => Promise<T>;
  isReady: () => boolean;
  reset: () => void;
};

type AsyncStore<T> = AsyncStoreState<T> & AsyncStoreActions<T>;

type ExtendFn<T, E extends Record<string, unknown>> = (
  set: (updates: Partial<AsyncStoreState<T> & E>) => void,
  get: () => AsyncStore<T> & E,
) => E;

function createAsyncStore<T, E extends Record<string, unknown> = {}>(
  extend?: ExtendFn<T, E>,
) {
  type FullStore = AsyncStore<T> & E;

  return create<FullStore>((zustandSet, zustandGet) => {
    let pendingPromise: Promise<T> | null = null;

    const get = zustandGet;

    // For base store internals - only updates AsyncStoreState fields
    const setBase = (updates: Partial<AsyncStoreState<T>>) => {
      zustandSet(updates as Partial<FullStore>);
    };

    // For extensions - can update both base and extension state
    const set = (updates: Partial<AsyncStoreState<T> & E>) => {
      zustandSet(updates as Partial<FullStore>);
    };

    const base: AsyncStore<T> = {
      data: null,
      loading: false,
      error: null,

      // NOTE: If we need per-key caching (e.g., loading different games by ID),
      // add `loadFor(key, fetchFn)` that tracks `dataKey` and only refetches on key change.
      load: async (fetchFn) => {
        const state = get();

        // Already loaded → return cached data
        if (state.data !== null && !state.loading) {
          return state.data;
        }

        // Currently loading → return existing promise (dedupe concurrent calls)
        if (state.loading && pendingPromise) {
          return pendingPromise;
        }

        setBase({ loading: true, error: null });

        pendingPromise = (async () => {
          try {
            const data = await fetchFn();
            setBase({ data, loading: false, error: null });
            return data;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setBase({ loading: false, error });
            throw error;
          } finally {
            pendingPromise = null;
          }
        })();

        return pendingPromise;
      },

      isReady: () => {
        const state = get();
        return !state.loading && state.error === null && state.data !== null;
      },

      reset: () => {
        pendingPromise = null;
        setBase({ data: null, loading: false, error: null });
      },
    };

    const extensions = extend ? extend(set, get) : ({} as E);
    return { ...base, ...extensions };
  });
}

export type { AsyncStore, AsyncStoreState, AsyncStoreActions };
export { createAsyncStore };
