import { describe, it, expect, vi } from 'vitest';

import { createStore } from '../lib/create-store';

// ---------------------------------------------------------------------------
// createStore — generic store primitive
// ---------------------------------------------------------------------------

describe('createStore', () => {
  describe('makeAction', () => {
    it('mutates state via the action function', () => {
      const store = createStore({ initialState: { count: 0 } });
      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(store.state.count).toBe(1);
    });

    it('recomputes derived before calling onChange', () => {
      const order: string[] = [];
      const store = createStore({
        initialState: { count: 0 },
        derive(state) {
          order.push('derive');
          return { doubled: state.count * 2 };
        },
        onChange() {
          order.push('onChange');
        },
      });
      // Clear initial derive call from construction
      order.length = 0;

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(order).toEqual(['derive', 'onChange']);
    });

    it('calls onChange with merged state & derived object', () => {
      let received: any = null;
      const store = createStore({
        initialState: { count: 0 },
        derive(state) {
          return { doubled: state.count * 2 };
        },
        onChange(merged) {
          received = merged;
        },
      });

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(received).toEqual({ count: 1, doubled: 2 });
    });

    it('notifies all subscribers after onChange', () => {
      const order: string[] = [];
      const store = createStore({
        initialState: { count: 0 },
        onChange() {
          order.push('onChange');
        },
      });
      store.subscribe(() => {
        order.push('subscriber');
      });

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(order).toEqual(['onChange', 'subscriber']);
    });

    it('increments version after each action', () => {
      const store = createStore({ initialState: { count: 0 } });
      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      expect(store.version).toBe(0);
      inc();
      expect(store.version).toBe(1);
      inc();
      expect(store.version).toBe(2);
      inc();
      expect(store.version).toBe(3);
    });
  });

  describe('derive', () => {
    it('derived values accessible via store.derived after action', () => {
      const store = createStore({
        initialState: { count: 5 },
        derive(state) {
          return { doubled: state.count * 2 };
        },
      });
      // Initial derive runs during construction
      expect(store.derived.doubled).toBe(10);

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(store.derived.doubled).toBe(12);
    });

    it('warns in dev mode if derived keys collide with state keys', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const store = createStore({
        initialState: { count: 0, doubled: 0 },
        derive(state) {
          return { doubled: state.count * 2 };
        },
      });
      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Derived key "doubled" collides'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('ordering', () => {
    it('onChange fires before subscribers', () => {
      const order: string[] = [];
      const store = createStore({
        initialState: { count: 0 },
        onChange() {
          order.push('onChange');
        },
      });
      store.subscribe(() => {
        order.push('subscriber');
      });

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(order).toEqual(['onChange', 'subscriber']);
    });

    it('subscriber sees updated version (not stale)', () => {
      const store = createStore({ initialState: { count: 0 } });
      let seenVersion = -1;
      store.subscribe(() => {
        seenVersion = store.version;
      });

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(seenVersion).toBe(1);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('returns unsubscribe function that prevents future callbacks', () => {
      const store = createStore({ initialState: { count: 0 } });
      const cb = vi.fn();
      const unsub = store.subscribe(cb);

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();
      inc();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('multiple subscribers all receive notifications', () => {
      const store = createStore({ initialState: { count: 0 } });
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      store.subscribe(cb1);
      store.subscribe(cb2);

      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('replaces state with new value', () => {
      const store = createStore({ initialState: { count: 5 } });
      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      expect(store.state.count).toBe(6);

      store.reset({ count: 0 });
      expect(store.state.count).toBe(0);
    });

    it('calls onReset before onChange', () => {
      const order: string[] = [];
      const store = createStore({
        initialState: { count: 0 },
        onChange() {
          order.push('onChange');
        },
        onReset() {
          order.push('onReset');
        },
      });
      // Clear onChange from reset's own lifecycle
      order.length = 0;

      store.reset({ count: 0 });
      expect(order).toEqual(['onReset', 'onChange']);
    });

    it('calls onChange with new state', () => {
      let received: any = null;
      const store = createStore({
        initialState: { count: 5 },
        onChange(merged) {
          received = merged;
        },
      });

      store.reset({ count: 42 });
      expect(received).toEqual({ count: 42 });
    });

    it('resets version to 0', () => {
      const store = createStore({ initialState: { count: 0 } });
      const inc = store.makeAction((state) => {
        state.count += 1;
      });
      inc();
      inc();
      expect(store.version).toBe(2);

      store.reset({ count: 0 });
      expect(store.version).toBe(0);
    });

    it('notifies subscribers after reset', () => {
      const store = createStore({ initialState: { count: 0 } });
      const cb = vi.fn();
      store.subscribe(cb);

      store.reset({ count: 0 });
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
