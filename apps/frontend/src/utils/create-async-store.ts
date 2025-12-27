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
  set: (updates: Partial<AsyncStoreState<T>>) => void,
  get: () => AsyncStore<T> & E,
) => E;

function createAsyncStore<T, E extends Record<string, unknown> = {}>(
  extend?: ExtendFn<T, E>,
) {
  type FullStore = AsyncStore<T> & E;

  return create<FullStore>((zustandSet, zustandGet) => {
    let pendingPromise: Promise<T> | null = null;

    // Wrapper that only allows updating base state (not actions or extensions)
    const set = (updates: Partial<AsyncStoreState<T>>) => {
      zustandSet(updates as Partial<FullStore>);
    };

    const get = zustandGet;

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

        set({ loading: true, error: null });

        pendingPromise = (async () => {
          try {
            const data = await fetchFn();
            set({ data, loading: false, error: null });
            return data;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            set({ loading: false, error });
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
        set({ data: null, loading: false, error: null });
      },
    };

    const extensions = extend ? extend(set, get) : ({} as E);
    return { ...base, ...extensions };
  });
}

export type { AsyncStore, AsyncStoreState, AsyncStoreActions };
export { createAsyncStore };
