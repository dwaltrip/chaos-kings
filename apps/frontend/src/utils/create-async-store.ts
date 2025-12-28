// Factory for creating Zustand stores with async loading boilerplate
// Handles deduplication of concurrent calls and caching

import { create } from 'zustand';

const AsyncStatus = {
  Idle: 'idle',
  Loading: 'loading',
  Success: 'success',
  Error: 'error',
} as const;

type AsyncStatus = (typeof AsyncStatus)[keyof typeof AsyncStatus];

type AsyncStoreState<T> = {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
};

type AsyncStoreActions<T> = {
  load: (fetchFn: () => Promise<T>) => Promise<T>;
  isIdle: () => boolean;
  isLoading: () => boolean;
  isReady: () => boolean;
  isError: () => boolean;
  reset: () => void;
};

type AsyncStore<T> = AsyncStoreState<T> & AsyncStoreActions<T>;

type ExtendFn<T, E extends Record<string, unknown>> = (
  set: (updates: Partial<AsyncStoreState<T>> | Partial<AsyncStoreState<T> & E>) => void,
  get: () => AsyncStore<T> & E,
) => E;

function createAsyncStore<T, E extends Record<string, unknown> = {}>(
  extend?: ExtendFn<T, E>,
) {
  type FullStore = AsyncStore<T> & E;

  return create<FullStore>((zustandSet, zustandGet) => {
    let pendingPromise: Promise<T> | null = null;

    const set = (
      updates: Partial<AsyncStoreState<T>> | Partial<AsyncStoreState<T> & E>,
    ) => {
      zustandSet(updates as Partial<FullStore>);
    };

    const base: AsyncStore<T> = {
      status: AsyncStatus.Idle,
      data: null,
      error: null,

      // NOTE: If we need per-key caching (e.g., loading different games by ID),
      // add `loadFor(key, fetchFn)` that tracks `dataKey` and only refetches on key change.
      load: async (fetchFn) => {
        const state = zustandGet();

        // Already loaded → return cached data
        if (state.status === AsyncStatus.Success) {
          return state.data as T;
        }

        // Currently loading → return existing promise (dedupe concurrent calls)
        if (state.status === AsyncStatus.Loading && pendingPromise) {
          return pendingPromise;
        }

        set({ status: AsyncStatus.Loading, error: null });

        pendingPromise = (async () => {
          try {
            const data = await fetchFn();
            set({ status: AsyncStatus.Success, data, error: null });
            return data;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            set({ status: AsyncStatus.Error, error });
            throw error;
          } finally {
            pendingPromise = null;
          }
        })();

        return pendingPromise;
      },

      isIdle: () => zustandGet().status === AsyncStatus.Idle,
      isLoading: () => zustandGet().status === AsyncStatus.Loading,
      isReady: () => zustandGet().status === AsyncStatus.Success,
      isError: () => zustandGet().status === AsyncStatus.Error,

      reset: () => {
        pendingPromise = null;
        set({ status: AsyncStatus.Idle, data: null, error: null });
      },
    };

    const extensions = extend ? extend(set, zustandGet) : ({} as E);
    return { ...base, ...extensions };
  });
}

export type { AsyncStore, AsyncStoreState, AsyncStoreActions };
export { AsyncStatus, createAsyncStore };
