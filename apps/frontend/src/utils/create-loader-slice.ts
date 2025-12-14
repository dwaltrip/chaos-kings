type LoaderState<Id> = {
  loading: boolean;
  error: string | null;
  loadedId: Id | null;
};

type LoaderActions<Id> = {
  startLoading: (id: Id) => void;
  fail: (message: string) => void;
  succeed: (id: Id) => void;
  isReady: (id: Id) => boolean;
  run: <T>(id: Id, fn: () => Promise<T>) => Promise<T>;
  resetLoader: () => void;
};

function createLoaderSlice<Id>() {
  const initial: LoaderState<Id> = { loading: false, error: null, loadedId: null };

  return {
    initial,
    actions: (
      set: (updates: Partial<LoaderState<Id>>) => void,
      get: () => LoaderState<Id>,
    ): LoaderActions<Id> => ({
      startLoading: (id: Id) => set({ loading: true, error: null, loadedId: id }),
      fail: (message: string) => set({ loading: false, error: message }),
      succeed: (id: Id) => set({ loading: false, error: null, loadedId: id }),
      isReady: (id: Id) => {
        const state = get();
        return !state.loading && !state.error && state.loadedId === id;
      },
      run: async <T>(id: Id, fn: () => Promise<T>): Promise<T> => {
        set({ loading: true, error: null, loadedId: id });
        try {
          const result = await fn();
          set({ loading: false, error: null, loadedId: id });
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ loading: false, error: message });
          throw error;
        }
      },
      resetLoader: () => set(initial),
    }),
  };
}

export type { LoaderActions, LoaderState };
export { createLoaderSlice };
