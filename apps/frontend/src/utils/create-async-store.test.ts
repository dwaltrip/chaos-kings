import { describe, it, expect, vi } from 'vitest';

import { createAsyncStore } from './create-async-store';

describe('createAsyncStore', () => {
  describe('core functionality', () => {
    it('loads data and updates state correctly', async () => {
      const useStore = createAsyncStore<string>();

      expect(useStore.getState().data).toBe(null);
      expect(useStore.getState().loading).toBe(false);
      expect(useStore.getState().error).toBe(null);

      const result = await useStore.getState().load(() => Promise.resolve('test data'));

      expect(result).toBe('test data');
      expect(useStore.getState().data).toBe('test data');
      expect(useStore.getState().loading).toBe(false);
      expect(useStore.getState().error).toBe(null);
    });

    it('handles fetch errors and sets error state', async () => {
      const useStore = createAsyncStore<string>();
      const error = new Error('fetch failed');

      await expect(useStore.getState().load(() => Promise.reject(error))).rejects.toThrow(
        'fetch failed',
      );

      expect(useStore.getState().data).toBe(null);
      expect(useStore.getState().loading).toBe(false);
      expect(useStore.getState().error).toBe(error);
    });

    it('returns cached data without re-fetching', async () => {
      const useStore = createAsyncStore<string>();
      const fetchFn1 = vi.fn(() => Promise.resolve('first'));
      const fetchFn2 = vi.fn(() => Promise.resolve('second'));

      await useStore.getState().load(fetchFn1);
      const result = await useStore.getState().load(fetchFn2);

      expect(result).toBe('first');
      expect(fetchFn1).toHaveBeenCalledTimes(1);
      expect(fetchFn2).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent calls', async () => {
      const useStore = createAsyncStore<string>();
      const fetchFn = vi.fn(() => Promise.resolve('data'));

      const promise1 = useStore.getState().load(fetchFn);
      const promise2 = useStore.getState().load(fetchFn);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result1).toBe('data');
      expect(result2).toBe('data');
    });

    it('reset clears data, error, and pending promise', async () => {
      const useStore = createAsyncStore<string>();

      await useStore.getState().load(() => Promise.resolve('data'));
      expect(useStore.getState().data).toBe('data');

      useStore.getState().reset();

      expect(useStore.getState().data).toBe(null);
      expect(useStore.getState().loading).toBe(false);
      expect(useStore.getState().error).toBe(null);
    });
  });

  describe('isReady', () => {
    it('returns false when loading', () => {
      const useStore = createAsyncStore<string>();

      useStore.getState().load(() => new Promise(() => {})); // never resolves

      expect(useStore.getState().isReady()).toBe(false);
    });

    it('returns false when error', async () => {
      const useStore = createAsyncStore<string>();

      try {
        await useStore.getState().load(() => Promise.reject(new Error('fail')));
      } catch {}

      expect(useStore.getState().isReady()).toBe(false);
    });

    it('returns true only when data loaded', async () => {
      const useStore = createAsyncStore<string>();

      expect(useStore.getState().isReady()).toBe(false);

      await useStore.getState().load(() => Promise.resolve('data'));

      expect(useStore.getState().isReady()).toBe(true);
    });
  });

  describe('extensions', () => {
    it('supports custom state via extend', () => {
      const useStore = createAsyncStore<string, { count: number }>(() => ({
        count: 42,
      }));

      expect(useStore.getState().count).toBe(42);
    });

    it('supports custom actions via extend', () => {
      const useStore = createAsyncStore<string, { count: number; increment: () => void }>(
        (set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }),
      );

      expect(useStore.getState().count).toBe(0);
      useStore.getState().increment();
      expect(useStore.getState().count).toBe(1);
    });
  });
});
