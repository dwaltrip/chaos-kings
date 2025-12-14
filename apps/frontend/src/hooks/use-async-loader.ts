// -----------------------------------------------------------------------------
// TODO: This is currently dead code!!
// Possibly delete. It was created during the refactor of the loading logic on
//   the gameplay page.
// But then we went with the new `createLoaderSlice` instead.
// Keeping it for the moment, might try a hook-based "loaders" again later.
// -----------------------------------------------------------------------------
import { useState, useCallback } from 'react';

interface AsyncLoaderState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncLoaderResult<T, Args extends any[]> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: Args) => Promise<void>;
  reset: () => void;
}

function useAsyncLoader<T, Args extends any[]>(
  asyncFn: (...args: Args) => Promise<T>,
): UseAsyncLoaderResult<T, Args> {
  const [state, setState] = useState<AsyncLoaderState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await asyncFn(...args);
        setState({ data, loading: false, error: null });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setState({ data: null, loading: false, error: errorMessage });
      }
    },
    [asyncFn],
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    reset,
  };
}

export { useAsyncLoader };
export type { UseAsyncLoaderResult };
